const path = require("node:path");
const { packSkill } = require("skill-unpacker");

async function main() {
  const folder = process.argv[2];
  const output = process.argv[3] || "./my-packaged-skill.skill";

  if (!folder) {
    console.error("Usage: node pack.js <skill-folder> [output-archive]");
    process.exit(1);
  }

  console.log(`Packaging folder ${folder} to ${output}...`);
  try {
    const result = await packSkill(folder, output, {
      onProgress: (p) => {
        console.log(`Packing [${p.percent}%]: ${p.file}`);
      }
    });
    console.log(`Successfully packed ${result.filesPacked} files to ${result.outputPath}`);
  } catch (err) {
    console.error(`Packaging failed [${err.code}]:`, err.message);
  }
}

if (require.main === module) {
  main();
}
