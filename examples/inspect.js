const path = require("node:path");
const { inspectArchive } = require("skill-unpacker");

async function main() {
  const target = process.argv[2] || path.join(__dirname, "../packages/core/tests/fixtures.js");
  console.log(`Inspecting archive: ${target}`);

  try {
    const info = await inspectArchive(target);
    console.log("Inspection Results:");
    console.log(`- Archive: ${info.archiveName}`);
    console.log(`- Entries: ${info.entryCount}`);
    console.log(`- Has SKILL.md: ${info.hasSkillMd}`);
    console.log(`- Total uncompressed bytes: ${info.totalUncompressedBytes}`);
  } catch (err) {
    console.error(`Inspection failed [${err.code}]:`, err.message);
  }
}

if (require.main === module) {
  main();
}
