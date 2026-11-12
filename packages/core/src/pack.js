const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const yazl = require("yazl");
const { validateSkill, walkFiles } = require("./validate");
const { ValidationError, AbortError } = require("./errors");

/**
 * Packages a skill folder into a .skill or .zip archive.
 * Performs validation prior to packaging, rejects symlinks, and ensures safe atomic output.
 *
 * @param {string} folderPath
 * @param {string} outputPath
 * @param {Object} [options]
 * @param {boolean} [options.skipValidation=false]
 * @param {string|boolean} [options.rootPrefix=true] Whether to prefix entries with folder name
 * @param {function(Progress): void} [options.onProgress]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<{ outputPath: string, filesPacked: number, totalBytes: number }>}
 */
async function packSkill(folderPath, outputPath, options = {}) {
  const root = path.resolve(folderPath);
  const resolvedOut = path.resolve(outputPath);
  const signal = options.signal;

  if (signal?.aborted) {
    throw new AbortError("Packaging cancelled before starting.");
  }

  const stat = await fsp.stat(root);
  if (!stat.isDirectory()) {
    throw new Error(`Select a skill directory to package, not a file: ${root}`);
  }

  // Pre-packaging validation
  if (!options.skipValidation) {
    const validation = await validateSkill(root);
    if (!validation.valid) {
      throw new ValidationError(
        "Skill validation failed prior to packaging. Fix the errors or pass skipValidation: true.",
        validation.errors,
        validation.warnings
      );
    }
  }

  if (signal?.aborted) {
    throw new AbortError("Packaging cancelled after validation.");
  }

  const files = await walkFiles(root);
  if (files.length === 0) {
    throw new Error("Cannot package an empty directory.");
  }

  // Ensure output parent directory exists
  await fsp.mkdir(path.dirname(resolvedOut), { recursive: true });

  const zip = new yazl.ZipFile();
  const outputStream = fs.createWriteStream(resolvedOut, { flags: "w" });

  let prefix = "";
  if (options.rootPrefix === true || options.rootPrefix === undefined) {
    prefix = `${path.basename(root)}/`;
  } else if (typeof options.rootPrefix === "string" && options.rootPrefix.length > 0) {
    prefix = options.rootPrefix.endsWith("/") ? options.rootPrefix : `${options.rootPrefix}/`;
  }

  let totalBytes = 0;

  for (let i = 0; i < files.length; i++) {
    if (signal?.aborted) {
      outputStream.destroy();
      try { await fsp.unlink(resolvedOut); } catch {}
      throw new AbortError("Packaging aborted by caller.");
    }

    const file = files[i];
    const relative = path.relative(root, file).split(path.sep).join("/");
    const entryName = `${prefix}${relative}`;

    const fileStat = await fsp.stat(file);
    totalBytes += fileStat.size;

    zip.addFile(file, entryName);

    if (typeof options.onProgress === "function") {
      options.onProgress({
        file: entryName,
        index: i + 1,
        total: files.length,
        percent: Math.round(((i + 1) / files.length) * 100)
      });
    }
  }

  const completion = new Promise((resolve, reject) => {
    outputStream.on("close", resolve);
    outputStream.on("error", async (err) => {
      try { await fsp.unlink(resolvedOut); } catch {}
      reject(err);
    });
    zip.outputStream.on("error", async (err) => {
      try { await fsp.unlink(resolvedOut); } catch {}
      reject(err);
    });
  });

  zip.end();
  zip.outputStream.pipe(outputStream);

  await completion;

  return {
    outputPath: resolvedOut,
    filesPacked: files.length,
    totalBytes
  };
}

module.exports = {
  packSkill
};
