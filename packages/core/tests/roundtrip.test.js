const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fsp = require("node:fs/promises");
const {
  packSkill,
  inspectArchive,
  extractArchive,
  validateSkill
} = require("../src/index");
const { makeTempDir } = require("./fixtures");

test("roundtrip test - pack -> inspect -> extract -> compare", async () => {
  const tmp = await makeTempDir();
  const originalDir = path.join(tmp, "original-skill");
  const packedSkillPath = path.join(tmp, "packed.skill");
  const extractedDir = path.join(tmp, "extracted-output");

  // 1. Create original skill directory with nested files
  await fsp.mkdir(path.join(originalDir, "references"), { recursive: true });
  await fsp.mkdir(path.join(originalDir, "scripts"), { recursive: true });

  const skillMdContent = `---
name: roundtrip-skill
description: Skill used to verify roundtrip pack, inspect, and extract fidelity.
version: 1.0.0
---
# Roundtrip Skill
Testing complete roundtrip workflow.
`;
  const referenceContent = "Important reference documentation content for agent usage.\nLine 2.\nLine 3.";
  const scriptContent = "console.log('Automated skill runner test');";

  await fsp.writeFile(path.join(originalDir, "SKILL.md"), skillMdContent);
  await fsp.writeFile(path.join(originalDir, "references", "guide.txt"), referenceContent);
  await fsp.writeFile(path.join(originalDir, "scripts", "run.js"), scriptContent);

  // Validate original
  const originalValidation = await validateSkill(originalDir);
  assert.equal(originalValidation.valid, true);

  // 2. Pack into .skill
  const packResult = await packSkill(originalDir, packedSkillPath, {
    rootPrefix: "roundtrip-skill"
  });
  assert.equal(packResult.filesPacked, 3);
  assert.ok(packResult.totalBytes > 0);

  // 3. Inspect archive
  const inspection = await inspectArchive(packedSkillPath);
  assert.equal(inspection.hasSkillMd, true);
  assert.equal(inspection.entryCount, 3);
  assert.ok(inspection.skillFiles.includes("roundtrip-skill/SKILL.md"));

  // 4. Extract archive
  const extractResult = await extractArchive(packedSkillPath, extractedDir);
  assert.equal(extractResult.extractedFiles, 3);

  // 5. Compare extracted files byte-for-byte with original
  const extractedSkillMd = await fsp.readFile(
    path.join(extractedDir, "roundtrip-skill", "SKILL.md"),
    "utf8"
  );
  const extractedRef = await fsp.readFile(
    path.join(extractedDir, "roundtrip-skill", "references", "guide.txt"),
    "utf8"
  );
  const extractedScript = await fsp.readFile(
    path.join(extractedDir, "roundtrip-skill", "scripts", "run.js"),
    "utf8"
  );

  assert.equal(extractedSkillMd, skillMdContent, "SKILL.md content matches byte-for-byte");
  assert.equal(extractedRef, referenceContent, "Reference file matches byte-for-byte");
  assert.equal(extractedScript, scriptContent, "Script file matches byte-for-byte");

  // Validate the newly extracted folder
  const extractedValidation = await validateSkill(path.join(extractedDir, "roundtrip-skill"));
  assert.equal(extractedValidation.valid, true);
  assert.equal(extractedValidation.skillMd.name, "roundtrip-skill");

  await fsp.rm(tmp, { recursive: true, force: true });
});
