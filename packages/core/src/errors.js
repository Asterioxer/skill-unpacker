/**
 * Error hierarchy for skill-unpacker
 */

class SkillUnpackerError extends Error {
  /**
   * @param {string} message
   * @param {string} code
   * @param {Record<string, unknown>} [details]
   */
  constructor(message, code = "ERR_SKILL_UNPACKER", details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

class PathTraversalError extends SkillUnpackerError {
  constructor(pathName, details = {}) {
    super(`Path traversal entry rejected: ${pathName}`, "ERR_PATH_TRAVERSAL", { path: pathName, ...details });
  }
}

class UnsafePathError extends SkillUnpackerError {
  constructor(pathName, reason, details = {}) {
    super(`Unsafe archive path rejected: ${pathName} (${reason})`, "ERR_UNSAFE_PATH", { path: pathName, reason, ...details });
  }
}

class SymlinkError extends SkillUnpackerError {
  constructor(entryName, details = {}) {
    super(`Symbolic link rejected: ${entryName}`, "ERR_SYMLINK_REJECTED", { path: entryName, ...details });
  }
}

class OversizedArchiveError extends SkillUnpackerError {
  constructor(actualBytes, maxBytes, details = {}) {
    super(
      `Archive total expanded size (${actualBytes} bytes) exceeds limit of ${maxBytes} bytes.`,
      "ERR_OVERSIZED_ARCHIVE",
      { actualBytes, maxBytes, ...details }
    );
  }
}

class OversizedFileError extends SkillUnpackerError {
  constructor(entryName, actualBytes, maxBytes, details = {}) {
    super(
      `File "${entryName}" (${actualBytes} bytes) exceeds maximum single-file size of ${maxBytes} bytes.`,
      "ERR_OVERSIZED_FILE",
      { path: entryName, actualBytes, maxBytes, ...details }
    );
  }
}

class TooManyEntriesError extends SkillUnpackerError {
  constructor(actualCount, maxEntries, details = {}) {
    super(
      `Archive contains ${actualCount} entries, exceeding maximum allowed of ${maxEntries}.`,
      "ERR_TOO_MANY_ENTRIES",
      { actualCount, maxEntries, ...details }
    );
  }
}

class CompressionRatioError extends SkillUnpackerError {
  constructor(entryName, ratio, maxRatio, details = {}) {
    super(
      `Suspicious compression ratio (${ratio.toFixed(1)}:1) rejected for entry "${entryName}". Limit is ${maxRatio}:1.`,
      "ERR_COMPRESSION_RATIO",
      { path: entryName, ratio, maxRatio, ...details }
    );
  }
}

class FileExistsError extends SkillUnpackerError {
  constructor(filePath, details = {}) {
    super(
      `Destination file already exists and overwrite is disabled: ${filePath}`,
      "ERR_FILE_EXISTS",
      { destination: filePath, ...details }
    );
  }
}

class DuplicateEntryError extends SkillUnpackerError {
  constructor(entryName, details = {}) {
    super(
      `Archive contains duplicate entry: "${entryName}"`,
      "ERR_DUPLICATE_ENTRY",
      { path: entryName, ...details }
    );
  }
}

class ValidationError extends SkillUnpackerError {
  constructor(message, errors = [], warnings = [], details = {}) {
    super(message, "ERR_VALIDATION_FAILED", { errors, warnings, ...details });
    this.errors = errors;
    this.warnings = warnings;
  }
}

class InvalidArchiveError extends SkillUnpackerError {
  constructor(message, cause, details = {}) {
    super(message, "ERR_INVALID_ARCHIVE", { ...details });
    if (cause) this.cause = cause;
  }
}

class AbortError extends SkillUnpackerError {
  constructor(message = "Operation was aborted.", details = {}) {
    super(message, "ERR_ABORTED", details);
  }
}

module.exports = {
  SkillUnpackerError,
  PathTraversalError,
  UnsafePathError,
  SymlinkError,
  OversizedArchiveError,
  OversizedFileError,
  TooManyEntriesError,
  CompressionRatioError,
  FileExistsError,
  DuplicateEntryError,
  ValidationError,
  InvalidArchiveError,
  AbortError
};
