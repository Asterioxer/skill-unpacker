const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const { pipeline } = require("node:stream/promises");
const { inspectArchive, openZip } = require("./inspect");
const {
  DEFAULT_LIMITS,
  sanitizeEntryName,
  isPathInside,
  createByteLimitStream
} = require("./security");
const {
  FileExistsError,
  UnsafePathError,
  OversizedArchiveError,
  AbortError,
  InvalidArchiveError
} = require("./errors");

/**
 * Safely extracts a .skill or .zip archive to a destination directory.
 * Includes preflight validation, path containment verification, overwrite protection,
 * stream-level decompression guards, progress reporting, cancellation, and rollback on failure.
 *
 * @param {string} archivePath
 * @param {string} destination
 * @param {Object} [options]
 * @param {Partial<typeof DEFAULT_LIMITS>} [options.limits]
 * @param {boolean} [options.overwrite=false]
 * @param {function(ProgressInfo): void} [options.onProgress]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<{ destination: string, extractedFiles: number, extractedBytes: number }>}
 */
async function extractArchive(archivePath, destination, options = {}) {
  const limits = { ...DEFAULT_LIMITS, ...options.limits };
  const overwrite = Boolean(options.overwrite);
  const signal = options.signal;
  const onProgress = typeof options.onProgress === "function" ? options.onProgress : null;

  if (signal?.aborted) {
    throw new AbortError("Extraction cancelled before starting.");
  }

  const dest = path.resolve(destination);

  // Phase 1: Complete preflight inspection
  const inspection = await inspectArchive(archivePath, { limits });

  if (signal?.aborted) {
    throw new AbortError("Extraction cancelled after preflight inspection.");
  }

  // Pre-validate all target paths before touching filesystem
  for (const entry of inspection.entries) {
    const target = path.resolve(dest, ...entry.name.split("/").filter(Boolean));
    if (!isPathInside(dest, target)) {
      throw new UnsafePathError(entry.name, `Target path escapes destination: ${target}`);
    }
  }

  // If overwrite is disabled, check if ANY target file already exists
  if (!overwrite) {
    for (const entry of inspection.entries) {
      if (!entry.directory) {
        const target = path.resolve(dest, ...entry.name.split("/").filter(Boolean));
        try {
          await fsp.access(target);
          // If access succeeds, file exists
          throw new FileExistsError(target, { entry: entry.name });
        } catch (err) {
          if (err instanceof FileExistsError) throw err;
          // ENOENT means file does not exist, which is expected
        }
      }
    }
  }

  // Ensure destination exists
  await fsp.mkdir(dest, { recursive: true });

  // Phase 2: Extraction with rollback tracking
  const createdFiles = [];
  const createdDirs = [];
  let extractedCount = 0;
  let totalBytesExtracted = 0;

  async function rollback() {
    // Delete created files
    for (const file of createdFiles) {
      try {
        await fsp.unlink(file);
      } catch {}
    }
    // Delete created directories in reverse order (leaf first)
    for (let i = createdDirs.length - 1; i >= 0; i--) {
      try {
        await fsp.rmdir(createdDirs[i]);
      } catch {}
    }
  }

  const zip = await openZip(inspection.archivePath);

  try {
    const totalEntries = inspection.entries.length;

    await new Promise((resolve, reject) => {
      let aborted = false;

      function onAbort() {
        aborted = true;
        try { zip.close(); } catch {}
        reject(new AbortError("Extraction aborted by caller."));
      }

      if (signal) {
        if (signal.aborted) {
          onAbort();
          return;
        }
        signal.addEventListener("abort", onAbort, { once: true });
      }

      zip.on("error", (err) => {
        try { zip.close(); } catch {}
        reject(new InvalidArchiveError(`Archive error during extraction: ${err.message}`, err));
      });

      zip.on("end", resolve);

      zip.on("entry", async (entry) => {
        if (aborted || signal?.aborted) {
          try { zip.close(); } catch {}
          reject(new AbortError("Extraction aborted by caller."));
          return;
        }

        try {
          const name = sanitizeEntryName(entry.fileName, {
            rejectWindowsReserved: limits.rejectWindowsReserved
          });
          const target = path.resolve(dest, ...name.split("/").filter(Boolean));

          if (!isPathInside(dest, target)) {
            throw new UnsafePathError(name, `Target path escapes destination: ${target}`);
          }

          if (name.endsWith("/")) {
            // Directory entry
            try {
              const existed = await fsp.stat(target).then(() => true).catch(() => false);
              if (!existed) {
                await fsp.mkdir(target, { recursive: true });
                createdDirs.push(target);
              }
            } catch (err) {
              await fsp.mkdir(target, { recursive: true });
              createdDirs.push(target);
            }
            zip.readEntry();
            return;
          }

          // File entry: ensure parent directory exists
          const parentDir = path.dirname(target);
          const dirExisted = await fsp.stat(parentDir).then(() => true).catch(() => false);
          if (!dirExisted) {
            await fsp.mkdir(parentDir, { recursive: true });
            createdDirs.push(parentDir);
          }

          // Open read stream from yauzl
          const readStream = await new Promise((res, rej) => {
            zip.openReadStream(entry, (err, stream) => {
              if (err) rej(new InvalidArchiveError(`Failed to read entry stream: ${name}`, err));
              else res(stream);
            });
          });

          // Guard stream with byte limit to prevent uncompressed bomb streams
          const limitGuard = createByteLimitStream(limits.maxSingleFileBytes, name);

          // Write file with appropriate flags
          const writeFlags = overwrite ? "w" : "wx";
          const writeStream = fs.createWriteStream(target, { flags: writeFlags });

          let entryBytes = 0;
          limitGuard.on("data", (chunk) => {
            entryBytes += chunk.length;
            totalBytesExtracted += chunk.length;
            if (totalBytesExtracted > limits.maxTotalBytes) {
              limitGuard.destroy(new OversizedArchiveError(totalBytesExtracted, limits.maxTotalBytes));
            }
          });

          await pipeline(readStream, limitGuard, writeStream);

          createdFiles.push(target);
          extractedCount++;

          if (onProgress) {
            onProgress({
              entry: name,
              entryIndex: extractedCount,
              totalEntries,
              extractedBytes: totalBytesExtracted,
              totalBytes: inspection.totalUncompressedBytes,
              percent: totalEntries > 0 ? Math.round((extractedCount / totalEntries) * 100) : 100
            });
          }

          zip.readEntry();
        } catch (error) {
          try { zip.close(); } catch {}
          reject(error);
        }
      });

      zip.readEntry();
    });

    return {
      destination: dest,
      extractedFiles: extractedCount,
      extractedBytes: totalBytesExtracted
    };
  } catch (error) {
    // Perform partial extraction cleanup on failure
    await rollback();
    throw error;
  } finally {
    try { zip.close(); } catch {}
  }
}

module.exports = {
  extractArchive
};
