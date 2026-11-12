# Security Policy

Skill Unpacker is built with security as a core tenet. Because this software handles untrusted, user-provided archive files from third-party sources, security protections are non-negotiable.

---

## Supported Versions

Only the latest release receives active security patches.

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |
| < 0.1.0 | :x:                |

---

## Reporting a Vulnerability

If you discover a security vulnerability in Skill Unpacker, please do **NOT** open a public GitHub issue.

Instead, please report the vulnerability through private disclosure:
- Use GitHub Private Vulnerability Reporting on the repository.
- Alternatively, email the maintainers directly at security@skillunpacker.dev or contact `Asterioxer` on GitHub.

Please include:
1. Description of the vulnerability.
2. Steps or sample archive to reproduce the issue.
3. Potential impact and severity.
4. Suggested mitigation or fix, if known.

We will acknowledge receipt within 48 hours and work with you on a responsible disclosure timeline.

---

## Threat Model & Guarantees

Skill Unpacker protects against:
- **Arbitrary file write via ZIP Slip** (`../` path traversal entries).
- **Absolute path escapes** (`/etc/`, `C:\Windows\`).
- **Arbitrary file access via Symbolic links** (links inside archives pointing to host system files).
- **Denial of Service via Decompression Bombs** (ratio limits, total size limits, single file limits).
- **Silent file overwriting** (wx file flags and preflight collision checks).
- **Renderer privilege escalation** (strict context isolation, sandboxing, and no Node integration in Electron renderer).
