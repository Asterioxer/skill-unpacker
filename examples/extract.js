const path = require("node:path");
const { extractArchive } = require("skill-unpacker");

async function main() {
  const archivePath = process.argv[2];
  const dest = process.argv[3] || "./output-skill";

  if (!archivePath) {
    console.error("Usage: node extract.js <archive-file> [destination]");
    process.exit(1);
  }

  console.log(`Extracting ${archivePath} to ${dest}...`);
  try {
    const result = await extractArchive(archivePath, dest, {
      onProgress: (p) => {
        console.log(`Progress: ${p.percent}% - entry ${p.entryIndex}/${p.totalEntries}`);
      }
    });
    console.log(`Successfully extracted ${result.extractedFiles} files.`);
  } catch (err) {
    console.error(`Extraction failed [${err.code}]:`, err.message);
  }
}

if (require.main === module) {
  main();
}
