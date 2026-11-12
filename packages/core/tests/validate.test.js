const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fsp = require("node:fs/promises");
const { validateSkill, parseFrontmatter } = require("../src/index");
const { makeTempDir } = require("./fixtures");

test("validateSkill - validates fully conforming skill", async () => {
  const tmp = await makeTempDir();
  const skillDir = path.join(tmp, "good-skill");
  await fsp.mkdir(path.join(skillDir, "references"), { recursive: true });
  await fsp.mkdir(path.join(skillDir, "scripts"), { recursive: true });

  const skillMd = `---
name: good-skill
description: A well-structured Claude skill that follows all best practices.
version: 1.0.0
---
# Good Skill
Instructions go here.
`;
  await fsp.writeFile(path.join(skillDir, "SKILL.md"), skillMd);
  await fsp.writeFile(path.join(skillDir, "references", "guide.md"), "# Guide");
  await fsp.writeFile(path.join(skillDir, "scripts", "run.js"), "console.log('hi');");

  const res = await validateSkill(skillDir);
  assert.equal(res.valid, true);
  assert.equal(res.errors.length, 0);
  assert.equal(res.skillMd.name, "good-skill");
  assert.equal(res.skillMd.version, "1.0.0");
  assert.ok(res.files.includes("SKILL.md"));

  await fsp.rm(tmp, { recursive: true, force: true });
});

test("validateSkill - fails when SKILL.md is missing", async () => {
  const tmp = await makeTempDir();
  const emptySkillDir = path.join(tmp, "empty-skill");
  await fsp.mkdir(emptySkillDir, { recursive: true });
  await fsp.writeFile(path.join(emptySkillDir, "readme.txt"), "no skill here");

  const res = await validateSkill(emptySkillDir);
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes("SKILL.md file is missing")));

  await fsp.rm(tmp, { recursive: true, force: true });
});

test("validateSkill - fails when required frontmatter fields are missing", async () => {
  const tmp = await makeTempDir();
  const skillDir = path.join(tmp, "bad-frontmatter");
  await fsp.mkdir(skillDir, { recursive: true });

  // Missing description
  const content = `---
name: test-skill
---
# Missing description
`;
  await fsp.writeFile(path.join(skillDir, "SKILL.md"), content);

  const res = await validateSkill(skillDir);
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes("description")));

  await fsp.rm(tmp, { recursive: true, force: true });
});

test("validateSkill - fails when YAML frontmatter delimiters are missing or invalid", async () => {
  const tmp = await makeTempDir();
  const skillDir = path.join(tmp, "no-frontmatter");
  await fsp.mkdir(skillDir, { recursive: true });

  const content = `# Just markdown without YAML frontmatter\nname: test`;
  await fsp.writeFile(path.join(skillDir, "SKILL.md"), content);

  const res = await validateSkill(skillDir);
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes("YAML frontmatter delimited by ---")));

  await fsp.rm(tmp, { recursive: true, force: true });
});

test("validateSkill - warns on long SKILL.md and missing recommended directories", async () => {
  const tmp = await makeTempDir();
  const skillDir = path.join(tmp, "long-skill");
  await fsp.mkdir(skillDir, { recursive: true });

  const lines = [
    "---",
    "name: long-skill",
    "description: A very long skill file designed to test warnings.",
    "---"
  ];
  for (let i = 0; i < 550; i++) {
    lines.push(`Line ${i}: Some detailed content that should be in references.`);
  }
  await fsp.writeFile(path.join(skillDir, "SKILL.md"), lines.join("\n"));

  const res = await validateSkill(skillDir);
  assert.equal(res.valid, true); // valid, but with warnings
  assert.ok(res.warnings.some((w) => w.includes("lines")));
  assert.ok(res.warnings.some((w) => w.includes("references/")));

  await fsp.rm(tmp, { recursive: true, force: true });
});

test("parseFrontmatter - parses multiline block scalars", () => {
  const content = `---
name: folded-skill
description: >
  This is a multiline description that
  is folded into a single line.
version: 2.1.0
---
Body text`;

  const parsed = parseFrontmatter(content);
  assert.ok(parsed);
  assert.equal(parsed.frontmatter.name, "folded-skill");
  assert.equal(
    parsed.frontmatter.description,
    "This is a multiline description that is folded into a single line."
  );
  assert.equal(parsed.frontmatter.version, "2.1.0");
});
