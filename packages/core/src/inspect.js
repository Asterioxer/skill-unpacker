const yauzl = require("yauzl");
const fsp = require("node:fs/promises");
const path = require("node:path");
const {
  DEFAULT_LIMITS,
  sanitizeEntryName,
  isSymlink
} = require("./security");
const {
  PathTraversalError,
  UnsafePathError,
  SymlinkError,
  OversizedArchiveError,
  OversizedFileError,
  TooManyEntriesError,
  CompressionRatioError,
  DuplicateEntryError,
  InvalidArchiveError
} = require("./errors");

function openZip(filePath) {
  return new Promise((resolve, reject) => {
    yauzl.open(
      filePath,
      {
        lazyEntries: true,
        autoClose: false,
        decodeStrings: true,
        strictFileNames: false,
        validateEntrySizes: false
      },
      (err, zip) => {
        if (err) {
          reject(new InvalidArchiveError(`Failed to open archive: ${err.message}`, err));
        } else {
          resolve(zip);
        }
      }
    );
  });
}

/**
 * Inspects a .skill or .zip archive without extracting any files.
 * Performs thorough preflight security validation.
 *
 * @param {string} archivePath
 * @param {Object} [options]
 * @param {Partial<typeof DEFAULT_LIMITS>} [options.limits]
 * @param {boolean} [options.allowDuplicateEntries=false]
 * @returns {Promise<InspectionResult>}
 */
async function inspectArchive(archivePath, options = {}) {
  const limits = { ...DEFAULT_LIMITS, ...options.limits };
  const resolvedPath = path.resolve(archivePath);

  let stat;
  try {
    stat = await fsp.stat(resolvedPath);
  } catch (err) {
    throw new InvalidArchiveError(`Archive file not found: ${resolvedPath}`, err);
  }

  if (!stat.isFile()) {
    throw new InvalidArchiveError(`Archive path is not a regular file: ${resolvedPath}`);
  }

  const zip = await openZip(resolvedPath);

  try {
    const entries = [];
    const seenNames = new Set();
    const seenCaseFolded = new Map();
    const duplicateEntries = [];
    let totalUncompressedBytes = 0;

    await new Promise((resolve, reject) => {
      let isRejected = false;
      function fail(err) {
        if (!isRejected) {
          isRejected = true;
          try { zip.close(); } catch {}
          reject(err);
        }
      }

      zip.on("error", (err) => {
        if (/relative path/i.test(err.message) || /\.\./.test(err.message)) {
          fail(new PathTraversalError(err.message, { cause: err }));
        } else if (/absolute path/i.test(err.message) || /drive/i.test(err.message)) {
          fail(new UnsafePathError(err.message, "Absolute or drive path", { cause: err }));
        } else {
          fail(new InvalidArchiveError(`Archive corrupted or malformed: ${err.message}`, err));
        }
      });

      zip.on("end", () => {
        if (!isRejected) resolve();
      });

      zip.on("entry", (entry) => {
        if (isRejected) return;
        try {
          const name = sanitizeEntryName(entry.fileName, {
            rejectWindowsReserved: limits.rejectWindowsReserved
          });

          if (limits.rejectSymlinks && isSymlink(entry)) {
            throw new SymlinkError(name);
          }

          const uncompressed = entry.uncompressedSize || 0;
          const compressed = entry.compressedSize || 0;

          // Track duplicates
          if (seenNames.has(name)) {
            duplicateEntries.push(name);
            if (!options.allowDuplicateEntries) {
              throw new DuplicateEntryError(name);
            }
          }
          seenNames.add(name);

          // Track case collisions
          const lower = name.toLowerCase();
          if (seenCaseFolded.has(lower) && seenCaseFolded.get(lower) !== name) {
            duplicateEntries.push(`${name} (collides with ${seenCaseFolded.get(lower)})`);
          } else {
            seenCaseFolded.set(lower, name);
          }

          // Safety limits check
          if (entries.length + 1 > limits.maxEntries) {
            throw new TooManyEntriesError(entries.length + 1, limits.maxEntries);
          }

          totalUncompressedBytes += uncompressed;
          if (totalUncompressedBytes > limits.maxTotalBytes) {
            throw new OversizedArchiveError(totalUncompressedBytes, limits.maxTotalBytes);
          }

          if (uncompressed > limits.maxSingleFileBytes) {
            throw new OversizedFileError(name, uncompressed, limits.maxSingleFileBytes);
          }

          const effectiveCompressed = Math.max(compressed, 1);
          const ratio = uncompressed / effectiveCompressed;
          if (ratio > limits.maxCompressionRatio && uncompressed > 1024) {
            throw new CompressionRatioError(name, ratio, limits.maxCompressionRatio);
          }

          entries.push({
            name,
            directory: name.endsWith("/"),
            compressedSize: compressed,
            uncompressedSize: uncompressed,
            crc32: entry.crc32
          });

          zip.readEntry();
        } catch (error) {
          fail(error);
        }
      });

      zip.readEntry();
    });

    const skillFiles = entries.filter((e) => /(^|\/)SKILL\.md$/i.test(e.name));
    const roots = [...new Set(entries.map((e) => e.name.split("/")[0]).filter(Boolean))];

    return {
      archivePath: resolvedPath,
      archiveName: path.basename(resolvedPath),
      archiveBytes: stat.size,
      entryCount: entries.length,
      totalUncompressedBytes,
      roots,
      hasSkillMd: skillFiles.length > 0,
      skillFiles: skillFiles.map((f) => f.name),
      duplicateEntries,
      entries
    };
  } finally {
    try { zip.close(); } catch {}
  }
}

module.exports = {
  inspectArchive,
  openZip
};
