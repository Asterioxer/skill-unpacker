const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fsp = require("node:fs/promises");
const { packSkill, inspectArchive, ValidationError } = require("../src/index");
const { makeTempDir } = require("./fixtures");

test("packSkill - packages a valid skill directory", async () => {
  const tmp = await makeTempDir();
  const skillDir = path.join(tmp, "sample-skill");
  await fsp.mkdir(skillDir, { recursive: true });

  const skillMd = `---
name: sample-skill
description: A sample skill for packaging testing.
---
# Sample Skill
`;
  await fsp.writeFile(path.join(skillDir, "SKILL.md"), skillMd);
  await fsp.writeFile(path.join(skillDir, "file1.txt"), "hello");

  const outZip = path.join(tmp, "sample-skill.skill");
  const res = await packSkill(skillDir, outZip);

  assert.equal(res.outputPath, path.resolve(outZip));
  assert.equal(res.filesPacked, 2);

  const inspection = await inspectArchive(outZip);
  assert.equal(inspection.hasSkillMd, true);
  assert.equal(inspection.entryCount, 2);

  await fsp.rm(tmp, { recursive: true, force: true });
});

test("packSkill - rejects packaging invalid skill by default", async () => {
  const tmp = await makeTempDir();
  const badSkillDir = path.join(tmp, "invalid-skill");
  await fsp.mkdir(badSkillDir, { recursive: true });
  // Missing SKILL.md
  await fsp.writeFile(path.join(badSkillDir, "readme.txt"), "just a readme");

  const outZip = path.join(tmp, "bad.skill");
  await assert.rejects(
    async () => packSkill(badSkillDir, outZip),
    (err) => {
      assert.ok(err instanceof ValidationError || err.code === "ERR_VALIDATION_FAILED");
      return true;
    }
  );

  // Succeeds if skipValidation: true
  const res = await packSkill(badSkillDir, outZip, { skipValidation: true });
  assert.equal(res.filesPacked, 1);

  await fsp.rm(tmp, { recursive: true, force: true });
});
