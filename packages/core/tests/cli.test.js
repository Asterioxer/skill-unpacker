const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fsp = require("node:fs/promises");
const { spawnSync } = require("node:child_process");
const { makeTempDir } = require("./fixtures");

const cliPath = path.resolve(__dirname, "../bin/skill-unpacker.js");

function runCli(args) {
  const result = spawnSync(process.execPath, [cliPath, ...args], {
    encoding: "utf8"
  });
  return result;
}

test("cli - --version outputs version", () => {
  const res = runCli(["--version"]);
  assert.equal(res.status, 0);
  assert.match(res.stdout.trim(), /^\d+\.\d+\.\d+/);
});

test("cli - --help outputs usage information", () => {
  const res = runCli(["--help"]);
  assert.equal(res.status, 0);
  assert.ok(res.stdout.includes("USAGE:"));
  assert.ok(res.stdout.includes("COMMANDS:"));
});

test("cli - validate and pack workflow", async () => {
  const tmp = await makeTempDir();
  const skillDir = path.join(tmp, "cli-skill");
  await fsp.mkdir(skillDir, { recursive: true });

  const skillMd = `---
name: cli-test
description: Testing CLI commands
---
# CLI Test
`;
  await fsp.writeFile(path.join(skillDir, "SKILL.md"), skillMd);

  // 1. validate command
  const valRes = runCli(["validate", skillDir, "--json"]);
  assert.equal(valRes.status, 0);
  const valJson = JSON.parse(valRes.stdout);
  assert.equal(valJson.valid, true);
  assert.equal(valJson.skillMd.name, "cli-test");

  // 2. pack command
  const outZip = path.join(tmp, "cli-out.skill");
  const packRes = runCli(["pack", skillDir, "-o", outZip, "--json"]);
  assert.equal(packRes.status, 0);
  const packJson = JSON.parse(packRes.stdout);
  assert.equal(packJson.filesPacked, 1);

  // 3. inspect command
  const inspectRes = runCli(["inspect", outZip, "--json"]);
  assert.equal(inspectRes.status, 0);
  const inspectJson = JSON.parse(inspectRes.stdout);
  assert.equal(inspectJson.hasSkillMd, true);
  assert.equal(inspectJson.entryCount, 1);

  // 4. extract command
  const extractDir = path.join(tmp, "cli-extracted");
  const extractRes = runCli(["extract", outZip, "-o", extractDir, "--json"]);
  assert.equal(extractRes.status, 0);
  const extractJson = JSON.parse(extractRes.stdout);
  assert.equal(extractJson.extractedFiles, 1);

  await fsp.rm(tmp, { recursive: true, force: true });
});
