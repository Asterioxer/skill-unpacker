# Skill Unpacker Security Architecture

Skill Unpacker was engineered specifically to address common vulnerabilities when handling untrusted zip packages from agents and users.

---

## Threat Matrix & Defenses

### 1. ZIP Slip / Path Traversal
- **Threat**: An attacker creates an archive with entry names such as `../../../../etc/cron.d/evil` or `..\..\..\Windows\System32\calc.exe`. Unsanitized extraction overwrites critical system binaries.
- **Defense**:
  - `sanitizeEntryName()` splits path segments by forward and backward slashes.
  - Any segment equaling `..` or `.` triggers an immediate `PathTraversalError`.
  - Target paths are resolved using `path.resolve()` and tested against the destination directory via `isPathInside()`. Case-folding normalization is enforced on Windows.

### 2. Absolute and Drive-Qualified Paths
- **Threat**: An archive containing absolute paths (`/etc/shadow`, `C:\autoexec.bat`, or UNC `\\server\share`).
- **Defense**:
  - Slashes at the start of paths and drive letters (`^[a-zA-Z]:`) are strictly rejected.
  - UNC prefixes (`//` or `\\\\`) are rejected before filesystem resolution.

### 3. Windows Reserved Device Names
- **Threat**: On Windows NTFS/FAT, special filenames like `CON`, `PRN`, `AUX`, `NUL`, `COM1-9`, `LPT1-9` (even with extensions like `nul.txt`) refer to DOS devices. Creating or opening them can cause system hang, I/O errors, or denial of service.
- **Defense**:
  - Regex `/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\..*)?$/i` audits every path segment.
  - Characters `< > : " | ? *` and trailing dots/spaces are rejected.

### 4. Symlink Hijacking
- **Threat**: An archive entry is a symbolic link pointing to a sensitive file outside the target folder (e.g. `symlink -> /etc/passwd`). Later entries write through the symlink.
- **Defense**:
  - External file attributes in the central directory are checked (`(unixMode & 0o170000) === 0o120000`).
  - Symlinks are rejected during inspection, extraction, and packaging.

### 5. Decompression Bombs & Forged Size Headers
- **Threat**: A tiny archive (e.g., 42 KB) decompresses into gigabytes of zeros, exhausting disk space. In some variants, the central directory header lies about `uncompressedSize` (e.g., reporting 100 bytes while the stream yields 10 GB).
- **Defense**:
  - Preflight checks: Compression ratios exceeding 200:1 and archives expanding beyond 500 MB are rejected.
  - In-flight stream monitors: `createByteLimitStream()` counts actual chunks received from the decompression pipeline and terminates the stream immediately if single-file or total-byte limits are exceeded.

### 6. Atomic Rollback on Failure
- **Threat**: If extraction fails halfway through due to an I/O error or security violation, incomplete files left behind may be executable or corrupt subsequent tasks.
- **Defense**:
  - `extractArchive()` tracks all files and directories created during the current operation.
  - Upon abort or error, a rollback routine unlinks all created files and removes created directories in reverse order.
  - Pre-existing files in the destination directory are never touched.
