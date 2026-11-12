# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.1.0] - 2026-11-12

### Added
- **Skill Unpacker Core (`skill-unpacker`)**: Reusable Node.js engine for inspecting, validating, safely extracting, and packaging `.skill` and `.zip` archives.
- **Full Security Defenses**:
  - ZIP Slip and path traversal protection rejecting `..`, `.`, and UNC paths.
  - Windows reserved device name validation (`CON`, `PRN`, `AUX`, `NUL`, `COM1-9`, `LPT1-9`).
  - Strict symbolic link rejection during inspection, extraction, and packaging.
  - Configurable decompression limits (entry count, total size, single file size, compression ratio).
  - Stream-level byte counter preventing spoofed header uncompressed sizes.
  - Atomic rollback of newly created files on extraction failure.
  - Overwrite protection (`FileExistsError`).
- **Claude Skill Validation**:
  - Safe YAML frontmatter parser supporting multiline block scalars (`>` and `|`).
  - Validation of `name` syntax, `description` presence and length, and `SKILL.md` length.
  - Structural auditing for `references/` and `scripts/`.
- **Command-Line Interface**:
  - `skill-unpacker inspect <archive>`
  - `skill-unpacker extract <archive> -o <dir>`
  - `skill-unpacker validate <folder>`
  - `skill-unpacker pack <folder> -o <file>`
  - JSON output support with `--json`.
- **Desktop Electron App Refactoring**:
  - Refactored `apps/desktop` to consume the shared `skill-unpacker` package directly.
  - Real-time extraction progress reporting and cancellation support.
  - Interactive archive entry search filter.
  - Secure context-isolated IPC bridge.
- **Automated Test Suite**:
  - 24 comprehensive automated unit, security, and round-trip tests using Node.js native test runner.
  - Complete roundtrip verification: pack -> inspect -> extract -> byte-for-byte comparison.
