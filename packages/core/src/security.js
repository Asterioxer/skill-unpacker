const path = require("node:path");
const { Transform } = require("node:stream");
const {
  PathTraversalError,
  UnsafePathError,
  SymlinkError,
  OversizedFileError
} = require("./errors");

const DEFAULT_LIMITS = Object.freeze({
  maxEntries: 5000,
  maxTotalBytes: 500 * 1024 * 1024, // 500 MB
  maxSingleFileBytes: 100 * 1024 * 1024, // 100 MB
  maxCompressionRatio: 200,
  allowOverwrite: false,
  rejectSymlinks: true,
  rejectWindowsReserved: true
});

// Windows reserved device names: CON, PRN, AUX, NUL, COM1-COM9, LPT1-LPT9
const WINDOWS_RESERVED_REGEX = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\..*)?$/i;

// Windows forbidden characters in file/directory names: < > : " | ? *
const WINDOWS_FORBIDDEN_CHARS = /[<>:"|?*]/;

/**
 * Validates and normalizes an archive entry name.
 * Rejects path traversal, absolute paths, drive letters, UNC paths, and Windows reserved names.
 *
 * @param {string} rawName
 * @param {Object} [options]
 * @param {boolean} [options.rejectWindowsReserved=true]
 * @returns {string} Normalized entry path using forward slashes
 */
function sanitizeEntryName(rawName, options = {}) {
  const { rejectWindowsReserved = true } = options;

  if (typeof rawName !== "string" || rawName.trim().length === 0) {
    throw new UnsafePathError(String(rawName), "Entry name is empty or not a string");
  }

  if (rawName.includes("\0")) {
    throw new UnsafePathError(rawName, "Entry name contains null byte");
  }

  // Normalize backslashes to forward slashes
  const normalized = rawName.replace(/\\/g, "/");

  // Reject leading slashes or UNC paths (// or \\)
  if (normalized.startsWith("/") || rawName.startsWith("\\\\") || rawName.startsWith("//")) {
    throw new UnsafePathError(rawName, "Absolute or UNC path");
  }

  // Reject drive-qualified paths (e.g. C:, D:)
  if (/^[a-zA-Z]:/.test(normalized)) {
    throw new UnsafePathError(rawName, "Drive-qualified path");
  }

  const parts = normalized.split("/").filter(Boolean);

  if (parts.length === 0) {
    throw new UnsafePathError(rawName, "Path resolves to root");
  }

  for (const part of parts) {
    // ZIP Slip check: traversal segments
    if (part === ".." || part === ".") {
      throw new PathTraversalError(rawName, { segment: part });
    }

    if (rejectWindowsReserved) {
      // Check Windows reserved device names
      if (WINDOWS_RESERVED_REGEX.test(part)) {
        throw new UnsafePathError(rawName, `Windows reserved device name: "${part}"`);
      }

      // Check Windows forbidden characters
      if (WINDOWS_FORBIDDEN_CHARS.test(part)) {
        throw new UnsafePathError(rawName, `Forbidden character in segment: "${part}"`);
      }

      // Trailing spaces and dots are stripped by Windows file system and can cause collisions/bypasses
      if (/[. ]$/.test(part)) {
        throw new UnsafePathError(rawName, `Segment ends with space or dot: "${part}"`);
      }
    }
  }

  // Retain trailing slash if original entry represents a directory
  const isDirectory = normalized.endsWith("/");
  return parts.join("/") + (isDirectory ? "/" : "");
}

/**
 * Checks if a ZIP entry represents a symbolic link.
 *
 * @param {Object} entry
 * @returns {boolean}
 */
function isSymlink(entry) {
  if (!entry || typeof entry.externalFileAttributes !== "number") return false;
  const unixMode = (entry.externalFileAttributes >>> 16) & 0xffff;
  // 0o120000 = S_IFLNK (Symbolic link in Unix file types)
  return (unixMode & 0o170000) === 0o120000;
}

/**
 * Verifies that targetPath resolves strictly inside destinationRoot.
 *
 * @param {string} destinationRoot
 * @param {string} targetPath
 * @returns {boolean}
 */
function isPathInside(destinationRoot, targetPath) {
  const resolvedRoot = path.resolve(destinationRoot);
  const resolvedTarget = path.resolve(targetPath);

  // Normalize case for Windows path comparison
  const normRoot = process.platform === "win32" ? resolvedRoot.toLowerCase() : resolvedRoot;
  const normTarget = process.platform === "win32" ? resolvedTarget.toLowerCase() : resolvedTarget;

  if (normTarget === normRoot) return true;
  return normTarget.startsWith(normRoot + path.sep);
}

/**
 * Creates a transform stream that enforces a byte-count ceiling.
 * Protects against zip bombs where the central directory uncompressed size was forged.
 *
 * @param {number} maxBytes
 * @param {string} entryName
 * @returns {Transform}
 */
function createByteLimitStream(maxBytes, entryName) {
  let bytesCounted = 0;
  return new Transform({
    transform(chunk, _encoding, callback) {
      bytesCounted += chunk.length;
      if (bytesCounted > maxBytes) {
        callback(new OversizedFileError(entryName, bytesCounted, maxBytes, { streamEnforced: true }));
        return;
      }
      callback(null, chunk);
    }
  });
}

module.exports = {
  DEFAULT_LIMITS,
  WINDOWS_RESERVED_REGEX,
  WINDOWS_FORBIDDEN_CHARS,
  sanitizeEntryName,
  isSymlink,
  isPathInside,
  createByteLimitStream
};
