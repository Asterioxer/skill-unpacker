# Skill Unpacker API Reference

The `skill-unpacker` package provides a programmatic API for inspecting, extracting, validating, and packaging Claude skill archives.

## Table of Contents

- [`inspectArchive(archivePath, options)`](#inspectarchivearchivepath-options)
- [`extractArchive(archivePath, destination, options)`](#extractarchivearchivepath-destination-options)
- [`validateSkill(folderPath)`](#validateskillfolderpath)
- [`packSkill(folderPath, outputPath, options)`](#packskillfolderpath-outputpath-options)
- [Constants: `DEFAULT_LIMITS`](#constants-default_limits)
- [Error Classes & Codes](#error-classes--codes)

---

### `inspectArchive(archivePath, options)`

Inspects archive metadata and entries without decompressing file contents to disk.

**Parameters:**
- `archivePath` (`string`): Absolute or relative path to the `.skill` or `.zip` file.
- `options` (`object`, optional):
  - `limits` (`object`, optional): Overrides for `DEFAULT_LIMITS`.
  - `allowDuplicateEntries` (`boolean`, default: `false`): If `true`, duplicate entries are recorded instead of throwing `DuplicateEntryError`.

**Returns:** `Promise<InspectionResult>`
- `archivePath` (`string`): Resolved file path.
- `archiveName` (`string`): Base file name.
- `archiveBytes` (`number`): Compressed file size on disk.
- `entryCount` (`number`): Number of entries in archive.
- `totalUncompressedBytes` (`number`): Sum of uncompressed sizes.
- `roots` (`string[]`): Top-level directories found in archive.
- `hasSkillMd` (`boolean`): Whether a root or top-level `SKILL.md` was discovered.
- `skillFiles` (`string[]`): Paths of matching `SKILL.md` files.
- `duplicateEntries` (`string[]`): Any duplicate entry names found.
- `entries` (`ArchiveEntry[]`): List of all archive entries (`name`, `directory`, `compressedSize`, `uncompressedSize`).

---

### `extractArchive(archivePath, destination, options)`

Safely extracts an archive to a specified directory with preflight validation, path containment verification, overwrite protection, stream decompression limits, and atomic rollback on failure.

**Parameters:**
- `archivePath` (`string`): Path to archive.
- `destination` (`string`): Target directory.
- `options` (`object`, optional):
  - `overwrite` (`boolean`, default: `false`): If `false`, extraction halts if any file already exists.
  - `signal` (`AbortSignal`, optional): Cancellation signal.
  - `onProgress` (`function`, optional): Progress callback receiving `{ entry, entryIndex, totalEntries, extractedBytes, totalBytes, percent }`.
  - `limits` (`object`, optional): Overrides for security limits.

**Returns:** `Promise<ExtractionResult>`
- `destination` (`string`): Resolved extraction directory.
- `extractedFiles` (`number`): Total files extracted.
- `extractedBytes` (`number`): Total bytes written.

---

### `validateSkill(folderPath)`

Audits a skill folder to ensure it conforms to Claude skill specifications.

**Parameters:**
- `folderPath` (`string`): Path to extracted skill folder.

**Returns:** `Promise<ValidationResult>`
- `valid` (`boolean`): Whether the skill passed all checks without blocking errors.
- `folderPath` (`string`): Resolved path.
- `skillPath` (`string | null`): Path to discovered `SKILL.md`.
- `errors` (`string[]`): List of critical errors (e.g. missing `SKILL.md`, missing required frontmatter).
- `warnings` (`string[]`): Suggestions and best-practice warnings.
- `files` (`string[]`): List of relative files in the skill.
- `skillMd` (`object | null`): Parsed metadata (`name`, `description`, `version`, `lines`, `rawFrontmatter`, `attributes`).

---

### `packSkill(folderPath, outputPath, options)`

Packages a validated skill directory into a `.skill` or `.zip` archive.

**Parameters:**
- `folderPath` (`string`): Path to skill directory.
- `outputPath` (`string`): Destination archive path.
- `options` (`object`, optional):
  - `skipValidation` (`boolean`, default: `false`): If `true`, skips pre-pack validation check.
  - `rootPrefix` (`string | boolean`, default: `true`): If `true`, prefixes entries with folder basename. If string, uses custom prefix. If `false`, extracts to root.
  - `signal` (`AbortSignal`, optional): Cancellation signal.
  - `onProgress` (`function`, optional): Progress callback receiving `{ file, index, total, percent }`.

**Returns:** `Promise<PackResult>`
- `outputPath` (`string`): Resolved output archive path.
- `filesPacked` (`number`): Total files packed.
- `totalBytes` (`number`): Total uncompressed bytes.

---

### Constants: `DEFAULT_LIMITS`

```javascript
{
  maxEntries: 5000,
  maxTotalBytes: 524288000,    // 500 MB
  maxSingleFileBytes: 104857600, // 100 MB
  maxCompressionRatio: 200,    // 200:1
  allowOverwrite: false,
  rejectSymlinks: true,
  rejectWindowsReserved: true
}
```

---

### Error Classes & Codes

| Class | Code | Description |
| :--- | :--- | :--- |
| `SkillUnpackerError` | `ERR_SKILL_UNPACKER` | Base error class |
| `PathTraversalError` | `ERR_PATH_TRAVERSAL` | Directory traversal entry (`..`) |
| `UnsafePathError` | `ERR_UNSAFE_PATH` | Absolute path, drive path, or Windows reserved device name |
| `SymlinkError` | `ERR_SYMLINK_REJECTED` | Symbolic link or junction |
| `OversizedArchiveError` | `ERR_OVERSIZED_ARCHIVE` | Archive exceeds total expansion size limit |
| `OversizedFileError` | `ERR_OVERSIZED_FILE` | Single file exceeds size limit |
| `TooManyEntriesError` | `ERR_TOO_MANY_ENTRIES` | Archive contains more entries than allowed limit |
| `CompressionRatioError` | `ERR_COMPRESSION_RATIO` | Compression ratio exceeds safety limit (zip bomb) |
| `FileExistsError` | `ERR_FILE_EXISTS` | Destination file exists and overwrite is disabled |
| `DuplicateEntryError` | `ERR_DUPLICATE_ENTRY` | Archive contains duplicate entries |
| `ValidationError` | `ERR_VALIDATION_FAILED` | Skill validation failed |
| `InvalidArchiveError` | `ERR_INVALID_ARCHIVE` | Malformed, corrupted, or unreadable ZIP |
| `AbortError` | `ERR_ABORTED` | Extraction or packing aborted by caller |
