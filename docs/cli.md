# Skill Unpacker CLI Reference

`skill-unpacker` provides an ergonomic, Unix-philosophy command-line interface for terminal users, build pipelines, and CI automation.

---

## Global Options

- `-h, --help`: Display help and usage examples.
- `-v, --version`: Display the installed version.
- `--json`: Output results formatted as standard JSON to stdout.

---

## Exit Codes

- `0`: Success.
- `1`: User error, validation failure, missing argument, or file collision.
- `2`: Security violation (Path traversal, unsafe path, symlink, zip bomb, compression ratio).

---

## Commands

### 1. `inspect`
Inspect an archive without extracting files.

```bash
skill-unpacker inspect <archive-path> [--json]
```

**Example:**
```bash
skill-unpacker inspect my-skill.skill
```

**Output:**
```text
📦 Archive: my-skill.skill
   Path:           C:\projects\my-skill.skill
   Entries:        4
   Compressed:     14.2 KB
   Expanded:       48.5 KB
   Has SKILL.md:   ✓ Yes
   Skill files:    my-skill/SKILL.md

Top entries:
   📄 my-skill/SKILL.md (1.2 KB)
   📄 my-skill/references/manual.md (42.0 KB)
```

---

### 2. `extract`
Safely extract an archive to a destination folder.

```bash
skill-unpacker extract <archive-path> -o <destination-dir> [--overwrite] [--json]
```

**Example:**
```bash
skill-unpacker extract my-skill.skill --output ./extracted
```

**Options:**
- `-o, --output <dir>`: Destination directory path (required).
- `--overwrite`: Allow overwriting existing files in destination directory.

---

### 3. `validate`
Check that an extracted skill conforms to the Claude skill specification.

```bash
skill-unpacker validate <folder-path> [--json]
```

**Example:**
```bash
skill-unpacker validate ./extracted/my-skill
```

**Output:**
```text
📋 Validation Report: my-skill
   Status:       ✓ PASS
   Skill Name:   my-skill
   Description:  Comprehensive agent skills for data parsing.
   Lines:        45
   Total files:  3
```

---

### 4. `pack`
Package an edited skill directory back into a `.skill` archive.

```bash
skill-unpacker pack <folder-path> -o <output-archive> [--no-validate] [--json]
```

**Example:**
```bash
skill-unpacker pack ./extracted/my-skill --output ./dist/my-skill.skill
```

**Options:**
- `-o, --output <file>`: Output archive path (required).
- `--no-validate`: Skip pre-packaging validation check.
