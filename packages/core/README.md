# skill-unpacker

[![npm version](https://img.shields.io/npm/v/skill-unpacker.svg)](https://www.npmjs.com/package/skill-unpacker)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js CI](https://github.com/Asterioxer/skill-unpacker/actions/workflows/ci.yml/badge.svg)](https://github.com/Asterioxer/skill-unpacker/actions/workflows/ci.yml)

A secure, zero-fluff Node.js engine and CLI for inspecting, validating, extracting, and repackaging `.skill` and `.zip` archives.

Designed as the core decompression engine for Claude Skills and autonomous agent package workflows, with built-in defenses against ZIP Slip, decompression bombs, path traversal, Windows reserved device names, and symlink exploits.

---

## Features

- **Safe Inspection**: Preflight archive inspection without extracting bytes to disk.
- **Hardened Extraction**: Guards against path traversal, absolute/drive paths, Windows reserved device names (`CON`, `PRN`, `AUX`, `NUL`), symlinks, and zip bombs.
- **Atomic Rollback**: Cleans up partially extracted files on failure without disturbing pre-existing user files.
- **Claude Skill Validation**: Checks `SKILL.md` presence, YAML frontmatter syntax, field specs (`name`, `description`), length guidelines, and package organization.
- **Reliable Packaging**: Validates and serializes skill folders back into `.skill` archives with deterministic ordering.
- **Dual Module Support**: Fully supports CommonJS (`require`) and ESM (`import`), plus complete TypeScript type definitions (`.d.ts`).
- **CLI Included**: Full-featured command-line tool with human-readable and `--json` output modes.

---

## Installation

```bash
# Install locally as a project dependency
npm install skill-unpacker

# Or install globally for the CLI
npm install -g skill-unpacker
```

---

## Command-Line Interface (CLI)

```bash
# Inspect archive contents and safety metadata
skill-unpacker inspect my-skill.skill

# Safely extract archive to destination folder
skill-unpacker extract my-skill.skill --output ./extracted

# Validate skill directory structure and frontmatter
skill-unpacker validate ./extracted/my-skill

# Repackage an edited skill into a .skill archive
skill-unpacker pack ./extracted/my-skill --output ./dist/my-skill.skill

# Output raw JSON for scripting
skill-unpacker inspect my-skill.skill --json
```

---

## Programmatic API

### CommonJS
```javascript
const {
  inspectArchive,
  extractArchive,
  validateSkill,
  packSkill,
  DEFAULT_LIMITS
} = require("skill-unpacker");
```

### ES Modules
```javascript
import {
  inspectArchive,
  extractArchive,
  validateSkill,
  packSkill,
  DEFAULT_LIMITS
} from "skill-unpacker";
```

---

### Inspecting an Archive

```javascript
const inspection = await inspectArchive("./example.skill", {
  limits: {
    maxEntries: 1000,
    maxTotalBytes: 100 * 1024 * 1024 // 100 MB
  }
});

console.log(inspection.archiveName);            // 'example.skill'
console.log(inspection.entryCount);             // 5
console.log(inspection.hasSkillMd);             // true
console.log(inspection.skillFiles);             // ['example/SKILL.md']
console.log(inspection.totalUncompressedBytes); // 12480
```

### Extracting an Archive Safely

```javascript
const result = await extractArchive("./example.skill", "./extracted", {
  overwrite: false, // Prevents accidental overwrites
  onProgress: (progress) => {
    console.log(`Progress: ${progress.percent}% (${progress.entryIndex}/${progress.totalEntries})`);
  }
});

console.log(`Extracted ${result.extractedFiles} files to ${result.destination}`);
```

### Validating a Skill Directory

```javascript
const validation = await validateSkill("./extracted/my-skill");

if (!validation.valid) {
  console.error("Validation failed:", validation.errors);
} else {
  console.log("Skill name:", validation.skillMd.name);
  console.log("Description:", validation.skillMd.description);
}
```

### Packaging an Edited Skill

```javascript
const packaged = await packSkill("./extracted/my-skill", "./output/my-skill.skill", {
  rootPrefix: "my-skill" // Prefix entries inside the archive
});

console.log(`Packaged ${packaged.filesPacked} files to ${packaged.outputPath}`);
```

---

## Security Model & Defenses

`skill-unpacker` implements defence-in-depth protections:

| Attack Vector | Defense Mechanism | Error Thrown |
| :--- | :--- | :--- |
| **ZIP Slip / Traversal** | Rejects `..`, `.`, and targets resolving outside destination | `PathTraversalError` |
| **Absolute Paths** | Rejects paths starting with `/`, `\`, UNC shares (`\\`), or drives (`C:`) | `UnsafePathError` |
| **Windows Device Names** | Rejects reserved names: `CON`, `PRN`, `AUX`, `NUL`, `COM1-9`, `LPT1-9` | `UnsafePathError` |
| **Symlink Attacks** | Rejects symbolic links during inspection, extraction, and packing | `SymlinkError` |
| **ZIP Bombs (Ratio)** | Rejects entries with compression ratio exceeding 200:1 | `CompressionRatioError` |
| **ZIP Bombs (Total)** | Rejects archives expanding beyond 500 MB (configurable) | `OversizedArchiveError` |
| **Stream Deception** | Enforces byte-limit stream monitors during actual file streaming | `OversizedFileError` |
| **Overwrite Hazard** | Rejects extracting over existing files unless explicitly requested | `FileExistsError` |
| **Partial Failure** | Automatically rolls back newly extracted files on abort or error | Rollback |

---

## Error Handling

All custom errors inherit from `SkillUnpackerError` and expose a machine-readable `code` property:

```javascript
const {
  SkillUnpackerError,
  PathTraversalError,
  FileExistsError,
  ValidationError
} = require("skill-unpacker");

try {
  await extractArchive(archivePath, dest);
} catch (err) {
  if (err.code === "ERR_PATH_TRAVERSAL") {
    console.error("Security alert: malicious traversal entry detected!");
  } else if (err.code === "ERR_FILE_EXISTS") {
    console.warn("Destination file already exists.");
  }
}
```

---

## License

[MIT](LICENSE) © 2026 Asterioxer and contributors.
