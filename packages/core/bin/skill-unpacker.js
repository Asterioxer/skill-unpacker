#!/usr/bin/env node

const path = require("node:path");
const {
  inspectArchive,
  extractArchive,
  validateSkill,
  packSkill,
  SkillUnpackerError,
  PathTraversalError,
  UnsafePathError,
  SymlinkError,
  OversizedArchiveError,
  OversizedFileError,
  CompressionRatioError
} = require("../src/index");
const pkg = require("../package.json");

function printHelp() {
  console.log(`
Skill Unpacker CLI v${pkg.version}
A secure inspection, validation, extraction, and repackaging tool for .skill archives.

USAGE:
  skill-unpacker <command> [arguments] [options]

COMMANDS:
  inspect <archive>            Inspect .skill or .zip contents without extracting
  extract <archive> -o <dir>   Safely extract an archive to destination directory
  validate <folder>            Validate skill structure and required SKILL.md
  pack <folder> -o <file>      Package an edited skill directory into .skill archive

OPTIONS:
  -o, --output <path>          Output destination directory or archive path
  --overwrite                  Allow overwriting existing files during extraction
  --no-validate                Skip pre-packaging validation
  --json                       Output results formatted as JSON
  -v, --version                Display version number
  -h, --help                   Display this help message

EXAMPLES:
  skill-unpacker inspect my-skill.skill
  skill-unpacker extract my-skill.skill --output ./extracted
  skill-unpacker validate ./extracted/my-skill
  skill-unpacker pack ./extracted/my-skill --output ./my-skill.skill
`);
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function parseCliArgs(args) {
  const flags = {
    output: null,
    overwrite: false,
    noValidate: false,
    json: false,
    help: false,
    version: false
  };
  const positional = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "-h" || arg === "--help") {
      flags.help = true;
    } else if (arg === "-v" || arg === "--version") {
      flags.version = true;
    } else if (arg === "--json") {
      flags.json = true;
    } else if (arg === "--overwrite") {
      flags.overwrite = true;
    } else if (arg === "--no-validate") {
      flags.noValidate = true;
    } else if (arg === "-o" || arg === "--output") {
      i++;
      if (i < args.length) {
        flags.output = args[i];
      }
    } else if (arg.startsWith("--output=")) {
      flags.output = arg.slice("--output=".length);
    } else if (!arg.startsWith("-")) {
      positional.push(arg);
    }
  }

  return { command: positional[0], target: positional[1], flags, positional };
}

async function run() {
  const rawArgs = process.argv.slice(2);
  const { command, target, flags } = parseCliArgs(rawArgs);

  if (flags.version || command === "version" || command === "-v" || command === "--version") {
    console.log(pkg.version);
    process.exit(0);
  }

  if (flags.help || !command || command === "help") {
    printHelp();
    process.exit(0);
  }

  try {
    switch (command) {
      case "inspect": {
        if (!target) {
          console.error("Error: Missing archive path to inspect.");
          printHelp();
          process.exit(1);
        }

        const info = await inspectArchive(target);
        if (flags.json) {
          console.log(JSON.stringify(info, null, 2));
        } else {
          console.log(`\n📦 Archive: ${info.archiveName}`);
          console.log(`   Path:           ${info.archivePath}`);
          console.log(`   Entries:        ${info.entryCount}`);
          console.log(`   Compressed:     ${formatBytes(info.archiveBytes)}`);
          console.log(`   Expanded:       ${formatBytes(info.totalUncompressedBytes)}`);
          console.log(`   Has SKILL.md:   ${info.hasSkillMd ? "✓ Yes" : "✕ No"}`);
          if (info.skillFiles.length > 0) {
            console.log(`   Skill files:    ${info.skillFiles.join(", ")}`);
          }
          if (info.duplicateEntries.length > 0) {
            console.log(`   Duplicates:     ⚠️ ${info.duplicateEntries.join(", ")}`);
          }
          console.log(`\nTop entries (${Math.min(info.entries.length, 15)} of ${info.entryCount}):`);
          info.entries.slice(0, 15).forEach((e) => {
            console.log(`   ${e.directory ? "📁" : "📄"} ${e.name} ${e.directory ? "" : `(${formatBytes(e.uncompressedSize)})`}`);
          });
          if (info.entries.length > 15) {
            console.log(`   ... and ${info.entries.length - 15} more entries`);
          }
          console.log();
        }
        break;
      }

      case "extract": {
        if (!target) {
          console.error("Error: Missing archive path to extract.");
          process.exit(1);
        }
        if (!flags.output) {
          console.error("Error: Destination output directory required. Specify with -o or --output.");
          process.exit(1);
        }

        const result = await extractArchive(target, flags.output, {
          overwrite: flags.overwrite,
          onProgress: flags.json ? null : (p) => {
            process.stdout.write(`\rExtracting: [${p.percent}%] ${p.entryIndex}/${p.totalEntries} entries`);
          }
        });

        if (!flags.json) {
          console.log(`\n\n✓ Successfully extracted ${result.extractedFiles} files (${formatBytes(result.extractedBytes)})`);
          console.log(`  Destination: ${result.destination}\n`);
        } else {
          console.log(JSON.stringify(result, null, 2));
        }
        break;
      }

      case "validate": {
        if (!target) {
          console.error("Error: Missing skill directory path to validate.");
          process.exit(1);
        }

        const result = await validateSkill(target);
        if (flags.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log(`\n📋 Validation Report: ${path.basename(result.folderPath)}`);
          console.log(`   Status:       ${result.valid ? "✓ PASS" : "✕ FAIL"}`);
          if (result.skillMd) {
            console.log(`   Skill Name:   ${result.skillMd.name || "(missing)"}`);
            console.log(`   Description:  ${result.skillMd.description || "(missing)"}`);
            console.log(`   Lines:        ${result.skillMd.lines}`);
          }
          console.log(`   Total files:  ${result.files.length}`);
          if (result.errors.length > 0) {
            console.log("\nErrors:");
            result.errors.forEach((err) => console.log(`   ✕ ${err}`));
          }
          if (result.warnings.length > 0) {
            console.log("\nWarnings:");
            result.warnings.forEach((warn) => console.log(`   ! ${warn}`));
          }
          console.log();
        }

        if (!result.valid) {
          process.exit(1);
        }
        break;
      }

      case "pack": {
        if (!target) {
          console.error("Error: Missing skill directory path to pack.");
          process.exit(1);
        }
        if (!flags.output) {
          console.error("Error: Output archive path required. Specify with -o or --output.");
          process.exit(1);
        }

        const result = await packSkill(target, flags.output, {
          skipValidation: flags.noValidate
        });

        if (flags.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log(`\n✓ Successfully packed skill`);
          console.log(`  Output: ${result.outputPath}`);
          console.log(`  Files:  ${result.filesPacked}`);
          console.log(`  Size:   ${formatBytes(result.totalBytes)}\n`);
        }
        break;
      }

      default:
        console.error(`Unknown command: "${command}"\n`);
        printHelp();
        process.exit(1);
    }
  } catch (error) {
    if (flags.json) {
      console.error(JSON.stringify({
        error: true,
        name: error.name,
        code: error.code || "ERR_GENERIC",
        message: error.message,
        details: error.details || {}
      }, null, 2));
    } else {
      console.error(`\n✕ Error [${error.code || "ERR"}]: ${error.message}\n`);
    }

    if (
      error instanceof PathTraversalError ||
      error instanceof UnsafePathError ||
      error instanceof SymlinkError ||
      error instanceof OversizedArchiveError ||
      error instanceof OversizedFileError ||
      error instanceof CompressionRatioError
    ) {
      process.exit(2);
    }
    process.exit(1);
  }
}

run();
