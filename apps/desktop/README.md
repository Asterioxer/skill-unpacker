# Skill Unpacker

A Windows-first Electron desktop application for inspecting, validating, extracting and repackaging `.skill` / ZIP archives.

## Features in this starter release

- Open `.skill` and `.zip` files with a native Windows file picker.
- Drag and drop archive files into the application.
- Inspect archive entries, compressed size and expanded size before extraction.
- Preflight archive paths and reject absolute paths, traversal entries, symlinks, suspicious compression ratios and oversized archives.
- Extract to a user-selected folder without silently overwriting existing files.
- Validate an extracted skill's root `SKILL.md` and basic YAML frontmatter fields (`name`, `description`).
- Repackage a validated skill directory as a `.skill` ZIP archive.
- Local-first: archive processing happens on the user's computer.

## Requirements

- Windows 10 or 11 (64-bit)
- Node.js 20.19+ or 22.12+
- npm

## Run from source

```powershell
cd skill-unpacker-electron
npm install
npm start
```

## Build a Windows installer

```powershell
npm install
npm run dist:win
```

The NSIS installer will be generated in `release/`.

## Security design

The renderer has no Node.js integration. `contextIsolation` is enabled, and the renderer receives a narrow API through `preload.js`.

The archive engine performs metadata preflight before writing files. It rejects:
- absolute paths and drive-qualified paths,
- `..` path traversal,
- symbolic links,
- more than 5,000 archive entries,
- more than 500 MB total expanded content,
- individual files larger than 100 MB,
- compression ratios above 200:1.

Extraction does not overwrite existing files. If a destination already contains a file with the same path, extraction stops with an error. Use a new, empty destination folder for each extraction.

## Current limitations

This is a functional starter implementation, not yet a production-hardened release:
- Validation checks basic frontmatter fields; it is not a complete YAML parser or full Anthropic skill specification validator.
- No signature or malware scanning is included. Do not execute scripts from untrusted skill packages.
- Archive extraction is intentionally conservative. Some unusual but valid ZIP archives may be rejected.
- The app icon is not included yet; remove the `icon` line from `package.json`'s `build.win` section until you add `assets/icon.ico`, or add your own icon.
- No automatic updates, signing, installer testing, or formal security audit yet.

## Suggested next milestones

1. Add a full YAML parser and spec-aware skill validator.
2. Add a tree view, SKILL.md preview, search, and per-file inspection.
3. Add extraction progress and cancellation.
4. Add optional backup/overwrite workflow with explicit confirmation.
5. Add an app icon, Windows code signing, and release pipeline.
6. Add test fixtures for malicious ZIP paths, symlinks, oversized files and malformed archives.
