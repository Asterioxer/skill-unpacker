# Skill Unpacker

[![npm version](https://img.shields.io/npm/v/skill-unpacker.svg)](https://www.npmjs.com/package/skill-unpacker)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js CI](https://github.com/Asterioxer/skill-unpacker/actions/workflows/ci.yml/badge.svg)](https://github.com/Asterioxer/skill-unpacker/actions/workflows/ci.yml)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Linux%20%7C%20macOS-lightgrey.svg)](https://github.com/Asterioxer/skill-unpacker)

> A hardened, open-source workbench and decompression engine for inspecting, validating, safely extracting, and repackaging Claude Skill archives (`.skill` / `.zip`).

---

## Overview

Skill packages are distributed as compressed archives containing instructions, metadata (`SKILL.md`), and optional reference files or scripts. Extracting untrusted archives with naive zip utilities creates real security risks: **ZIP Slip path traversal**, **decompression bombs**, **symlink hijacking**, and **Windows device name collisions**.

**Skill Unpacker** solves this by providing two independently usable products from a single, shared codebase:

1. **[Product A — Skill Unpacker Core (`skill-unpacker`)](./packages/core)**: A standalone, zero-fluff Node.js library and CLI tool providing robust preflight inspection, safe extraction, frontmatter validation, and repackaging.
2. **[Product B — Skill Unpacker Desktop](./apps/desktop)**: A Windows-first Electron desktop application providing visual archive inspection, drag-and-drop, real-time extraction progress, cancellation, and validation reports.

---

## Repository Architecture

```text
skill-unpacker/
├── packages/
│   └── core/                 # Standalone npm package & CLI (skill-unpacker)
│       ├── src/
│       │   ├── index.js      # Public CJS entry point
│       │   ├── index.mjs     # Public ESM entry point
│       │   ├── inspect.js    # Preflight archive inspection
│       │   ├── extract.js    # Hardened extraction with atomic rollback
│       │   ├── pack.js       # Validated archive repackaging
│       │   ├── validate.js   # Frontmatter & structure validator
│       │   ├── security.js   # Path sanitization, limits & stream guards
│       │   └── errors.js     # Typed error hierarchy with error codes
│       ├── bin/
│       │   └── skill-unpacker.js # CLI binary
│       ├── types/
│       │   └── index.d.ts    # Complete TypeScript declarations
│       ├── tests/            # Automated test suite (24 passing tests)
│       ├── package.json
│       └── README.md
├── apps/
│   └── desktop/              # Electron Windows workbench application
│       ├── src/
│       │   ├── main.js       # Trusted Electron main process (imports core)
│       │   ├── preload.js    # Context-isolated IPC bridge
│       │   ├── renderer.js   # UI state, drag-drop, progress & search
│       │   ├── index.html    # Clean workbench UI
│       │   └── styles.css    # Modern dark mode styling
│       └── package.json
├── docs/                     # Detailed architectural and API references
├── examples/                 # Node.js usage scripts
├── .github/
│   ├── workflows/            # GitHub Actions (CI & Desktop build)
│   └── ISSUE_TEMPLATE/       # Community issue templates
├── package.json              # Monorepo npm workspaces configuration
├── LICENSE                   # MIT License
├── CONTRIBUTING.md           # Contribution guidelines
├── SECURITY.md               # Security policy and vulnerability disclosures
└── README.md
```

---

## Quick Start: Core Library (npm)

### Installation

```bash
npm install skill-unpacker
```

### Programmatic Usage

```javascript
const {
  inspectArchive,
  extractArchive,
  validateSkill,
  packSkill
} = require("skill-unpacker");

// 1. Inspect archive before extracting
const info = await inspectArchive("./example.skill");
console.log(`Archive contains ${info.entryCount} entries, has SKILL.md: ${info.hasSkillMd}`);

// 2. Safely extract with overwrite protection
const extracted = await extractArchive("./example.skill", "./extracted", {
  onProgress: (p) => console.log(`Extracted: ${p.percent}%`)
});

// 3. Validate skill structure and frontmatter
const report = await validateSkill("./extracted/example");
console.log(`Validation: ${report.valid ? "PASS" : "FAIL"}`);

// 4. Repackage into a distributable archive
const packed = await packSkill("./extracted/example", "./dist/example.skill");
console.log(`Packed ${packed.filesPacked} files.`);
```

---

## Quick Start: Command-Line Interface (CLI)

```bash
# Inspect archive contents
npx skill-unpacker inspect sample.skill

# Safely extract
npx skill-unpacker extract sample.skill --output ./extracted

# Validate skill directory
npx skill-unpacker validate ./extracted/my-skill

# Pack folder into .skill archive
npx skill-unpacker pack ./extracted/my-skill --output ./my-skill.skill
```

---

## Quick Start: Desktop Workbench (Electron)

### Prerequisites

- Windows 10 or 11 (64-bit)
- Node.js 20.x or 22.x+
- npm

### Running the Desktop App

```powershell
# From project root
npm run start --workspace=apps/desktop

# Or navigate to desktop workspace
cd apps/desktop
npm install
npm start
```

### Building the Windows NSIS Installer

```powershell
cd apps/desktop
npm run dist:win
```

The compiled installer will be output to `apps/desktop/release/`.

---

## Security Engineering

Skill Unpacker adopts a zero-trust posture toward archive metadata:

1. **ZIP Slip Protection**: Path normalization strictly checks that every entry resolves within the designated destination. Traversal tokens (`..`, `.`) are rejected in preflight before writing files.
2. **Path Sanitization**: Rejects absolute paths (`/`), UNC network shares (`\\`), and drive qualifiers (`C:`).
3. **Windows Reserved Filenames**: Blocks Windows reserved device names (`CON`, `PRN`, `AUX`, `NUL`, `COM1-9`, `LPT1-9`) regardless of file extension.
4. **Symlink Rejection**: Rejects Unix and Windows symbolic links and directory junctions during inspection, extraction, and packing.
5. **Decompression Bomb Protection**: Enforces maximum entry counts (5,000), total expanded size limits (500 MB), single file size limits (100 MB), and compression ratios (200:1).
6. **Streaming Guardrails**: File streams are monitored in flight via a byte-limiting transform stream, preventing attacks where central directory headers contain falsified uncompressed sizes.
7. **Atomic Rollback on Failure**: Tracks newly created files and directories during extraction. If extraction is aborted or encounters an error, only the newly created files are cleaned up—existing user files are never touched.
8. **Isolated Desktop Architecture**: Electron renderer runs with `contextIsolation: true`, `sandbox: true`, and `nodeIntegration: false`. No raw filesystem access is exposed to the renderer.

---

## Running Automated Tests

Skill Unpacker includes a comprehensive test suite covering all security vectors, validation rules, CLI commands, and roundtrip workflows:

```bash
cd packages/core
npm test
```

### Test Coverage Highlights

- [x] Valid skill archive inspection
- [x] Valid skill extraction
- [x] Skill validation success
- [x] Missing `SKILL.md` detection
- [x] Missing frontmatter fields rejection
- [x] Malformed YAML frontmatter handling
- [x] Path traversal rejection (`..`)
- [x] Absolute and drive path rejection
- [x] Symlink rejection
- [x] Duplicate entry detection and collision prevention
- [x] Oversized archive and single file rejection
- [x] Suspicious compression ratio rejection
- [x] Existing-file collision handling (`overwrite: false`)
- [x] Partial extraction atomic rollback
- [x] `AbortSignal` cancellation
- [x] Malformed ZIP rejection
- [x] Full round-trip test: folder -> pack -> inspect -> extract -> byte-for-byte comparison

---

## Contributing

We welcome community contributions! Please read our [Contributing Guidelines](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md).

---

## Security Vulnerability Reporting

If you discover a potential security issue in Skill Unpacker, please review our [Security Policy](SECURITY.md) for disclosure guidelines.

---

## License

This project is licensed under the [MIT License](LICENSE).
