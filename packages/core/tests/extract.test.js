const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fsp = require("node:fs/promises");
const {
  extractArchive,
  FileExistsError,
  AbortError
} = require("../src/index");
const { buildRawZip, makeTempDir } = require("./fixtures");

test("extractArchive - extracts valid archive correctly", async () => {
  const tmp = await makeTempDir();
  const zipPath = path.join(tmp, "package.skill");
  const destDir = path.join(tmp, "extracted");

  const skillContent = "---\nname: my-skill\ndescription: Test description\n---\n# My Skill";
  const refContent = "Reference content";

  const buf = buildRawZip([
    { name: "my-skill/SKILL.md", content: skillContent },
    { name: "my-skill/references/doc.txt", content: refContent }
  ]);
  await fsp.writeFile(zipPath, buf);

  const progressEvents = [];
  const res = await extractArchive(zipPath, destDir, {
    onProgress: (p) => progressEvents.push(p)
  });

  assert.equal(res.extractedFiles, 2);
  assert.ok(progressEvents.length >= 2);

  const extractedSkill = await fsp.readFile(path.join(destDir, "my-skill", "SKILL.md"), "utf8");
  const extractedRef = await fsp.readFile(path.join(destDir, "my-skill", "references", "doc.txt"), "utf8");

  assert.equal(extractedSkill, skillContent);
  assert.equal(extractedRef, refContent);

  await fsp.rm(tmp, { recursive: true, force: true });
});

test("extractArchive - existing file collision throws FileExistsError when overwrite is false", async () => {
  const tmp = await makeTempDir();
  const zipPath = path.join(tmp, "package.skill");
  const destDir = path.join(tmp, "extracted");

  const buf = buildRawZip([
    { name: "file.txt", content: "new archive content" }
  ]);
  await fsp.writeFile(zipPath, buf);

  // Create pre-existing file
  await fsp.mkdir(destDir, { recursive: true });
  const existingFilePath = path.join(destDir, "file.txt");
  await fsp.writeFile(existingFilePath, "original content");

  await assert.rejects(
    async () => extractArchive(zipPath, destDir, { overwrite: false }),
    (err) => {
      assert.ok(err instanceof FileExistsError || err.code === "ERR_FILE_EXISTS");
      return true;
    }
  );

  // Original file must remain untouched
  const content = await fsp.readFile(existingFilePath, "utf8");
  assert.equal(content, "original content");

  // When overwrite is true, it should succeed
  const res = await extractArchive(zipPath, destDir, { overwrite: true });
  assert.equal(res.extractedFiles, 1);
  const updatedContent = await fsp.readFile(existingFilePath, "utf8");
  assert.equal(updatedContent, "new archive content");

  await fsp.rm(tmp, { recursive: true, force: true });
});

test("extractArchive - partial output cleanup cleans up created files on failure without deleting pre-existing files", async () => {
  const tmp = await makeTempDir();
  const zipPath = path.join(tmp, "fail-midway.skill");
  const destDir = path.join(tmp, "extracted");

  // Pre-create user's existing file
  await fsp.mkdir(destDir, { recursive: true });
  const userFile = path.join(destDir, "pre-existing-user-file.txt");
  await fsp.writeFile(userFile, "precious user data");

  // Archive with 1 valid file, and 1 oversized file that triggers an error during stream
  const buf = buildRawZip([
    { name: "part1.txt", content: "some text" },
    {
      name: "part2.txt",
      content: "trigger limit",
      compressedSize: 13,
      uncompressedSize: 50 * 1024 * 1024 // triggers single file limit with lower custom limit
    }
  ]);
  await fsp.writeFile(zipPath, buf);

  await assert.rejects(
    async () => extractArchive(zipPath, destDir, {
      limits: { maxSingleFileBytes: 1024 } // 1KB limit
    })
  );

  // part1.txt must have been rolled back / cleaned up
  const part1Exists = await fsp.stat(path.join(destDir, "part1.txt")).then(() => true).catch(() => false);
  assert.equal(part1Exists, false, "Rolled back partially extracted file");

  // User's pre-existing file must STILL exist!
  const userContent = await fsp.readFile(userFile, "utf8");
  assert.equal(userContent, "precious user data", "Pre-existing file remains intact");

  await fsp.rm(tmp, { recursive: true, force: true });
});

test("extractArchive - handles AbortSignal cancellation", async () => {
  const tmp = await makeTempDir();
  const zipPath = path.join(tmp, "cancel.skill");
  const destDir = path.join(tmp, "extracted");

  const buf = buildRawZip([
    { name: "file1.txt", content: "data1" },
    { name: "file2.txt", content: "data2" }
  ]);
  await fsp.writeFile(zipPath, buf);

  const controller = new AbortController();
  controller.abort(); // already aborted

  await assert.rejects(
    async () => extractArchive(zipPath, destDir, { signal: controller.signal }),
    (err) => {
      assert.ok(err instanceof AbortError || err.code === "ERR_ABORTED");
      return true;
    }
  );

  await fsp.rm(tmp, { recursive: true, force: true });
});
