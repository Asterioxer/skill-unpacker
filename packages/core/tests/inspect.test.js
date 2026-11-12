const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fsp = require("node:fs/promises");
const {
  inspectArchive,
  PathTraversalError,
  UnsafePathError,
  SymlinkError,
  OversizedArchiveError,
  CompressionRatioError,
  DuplicateEntryError,
  InvalidArchiveError
} = require("../src/index");
const { buildRawZip, makeTempDir } = require("./fixtures");

test("inspectArchive - inspects valid archive with SKILL.md", async () => {
  const tmp = await makeTempDir();
  const zipPath = path.join(tmp, "valid-skill.skill");

  const skillContent = `---\nname: test-skill\ndescription: A test skill for validation.\n---\n# Test Skill\n`;
  const buf = buildRawZip([
    { name: "test-skill/SKILL.md", content: skillContent },
    { name: "test-skill/references/notes.txt", content: "Some notes" }
  ]);
  await fsp.writeFile(zipPath, buf);

  const res = await inspectArchive(zipPath);
  assert.equal(res.archiveName, "valid-skill.skill");
  assert.equal(res.entryCount, 2);
  assert.equal(res.hasSkillMd, true);
  assert.equal(res.skillFiles.length, 1);
  assert.equal(res.skillFiles[0], "test-skill/SKILL.md");
  assert.equal(res.duplicateEntries.length, 0);
  assert.ok(res.totalUncompressedBytes > 0);
  assert.ok(res.archiveBytes > 0);

  await fsp.rm(tmp, { recursive: true, force: true });
});

test("inspectArchive - rejects path traversal entries", async () => {
  const tmp = await makeTempDir();
  const zipPath = path.join(tmp, "traversal.zip");

  const buf = buildRawZip([
    { name: "skills/../../evil.sh", content: "malicious code" }
  ]);
  await fsp.writeFile(zipPath, buf);

  await assert.rejects(
    async () => inspectArchive(zipPath),
    (err) => {
      assert.ok(err instanceof PathTraversalError || err.code === "ERR_PATH_TRAVERSAL");
      return true;
    }
  );

  await fsp.rm(tmp, { recursive: true, force: true });
});

test("inspectArchive - rejects absolute and drive paths", async () => {
  const tmp = await makeTempDir();
  const zipPath1 = path.join(tmp, "absolute.zip");
  const zipPath2 = path.join(tmp, "drive.zip");

  const buf1 = buildRawZip([{ name: "/etc/passwd", content: "root:x:0:0" }]);
  await fsp.writeFile(zipPath1, buf1);

  await assert.rejects(
    async () => inspectArchive(zipPath1),
    (err) => {
      assert.ok(err instanceof UnsafePathError || err.code === "ERR_UNSAFE_PATH");
      return true;
    }
  );

  const buf2 = buildRawZip([{ name: "C:/windows/system32/calc.exe", content: "fake" }]);
  await fsp.writeFile(zipPath2, buf2);

  await assert.rejects(
    async () => inspectArchive(zipPath2),
    (err) => {
      assert.ok(err instanceof UnsafePathError || err.code === "ERR_UNSAFE_PATH");
      return true;
    }
  );

  await fsp.rm(tmp, { recursive: true, force: true });
});

test("inspectArchive - rejects symbolic links", async () => {
  const tmp = await makeTempDir();
  const zipPath = path.join(tmp, "symlink.zip");

  const buf = buildRawZip([
    {
      name: "symlink-target",
      content: "/etc/shadow",
      unixMode: 0o120777 // S_IFLNK
    }
  ]);
  await fsp.writeFile(zipPath, buf);

  await assert.rejects(
    async () => inspectArchive(zipPath),
    (err) => {
      assert.ok(err instanceof SymlinkError || err.code === "ERR_SYMLINK_REJECTED");
      return true;
    }
  );

  await fsp.rm(tmp, { recursive: true, force: true });
});

test("inspectArchive - rejects oversized archive exceeding limits", async () => {
  const tmp = await makeTempDir();
  const zipPath = path.join(tmp, "oversized.zip");

  const buf = buildRawZip([
    {
      name: "huge.dat",
      content: "small content",
      uncompressedSize: 600 * 1024 * 1024 // 600 MB declared
    }
  ]);
  await fsp.writeFile(zipPath, buf);

  await assert.rejects(
    async () => inspectArchive(zipPath, { limits: { maxTotalBytes: 500 * 1024 * 1024 } }),
    (err) => {
      assert.ok(err instanceof OversizedArchiveError || err.code === "ERR_OVERSIZED_ARCHIVE");
      return true;
    }
  );

  await fsp.rm(tmp, { recursive: true, force: true });
});

test("inspectArchive - rejects suspicious compression ratios", async () => {
  const tmp = await makeTempDir();
  const zipPath = path.join(tmp, "bomb.zip");

  const buf = buildRawZip([
    {
      name: "bomb.txt",
      content: "x",
      compressedSize: 1,
      uncompressedSize: 500000 // ratio 500,000 : 1
    }
  ]);
  await fsp.writeFile(zipPath, buf);

  await assert.rejects(
    async () => inspectArchive(zipPath, { limits: { maxCompressionRatio: 200 } }),
    (err) => {
      assert.ok(err instanceof CompressionRatioError || err.code === "ERR_COMPRESSION_RATIO");
      return true;
    }
  );

  await fsp.rm(tmp, { recursive: true, force: true });
});

test("inspectArchive - detects duplicate entries and rejects by default", async () => {
  const tmp = await makeTempDir();
  const zipPath = path.join(tmp, "duplicate.zip");

  const buf = buildRawZip([
    { name: "file.txt", content: "first version" },
    { name: "file.txt", content: "second version" }
  ]);
  await fsp.writeFile(zipPath, buf);

  await assert.rejects(
    async () => inspectArchive(zipPath),
    (err) => {
      assert.ok(err instanceof DuplicateEntryError || err.code === "ERR_DUPLICATE_ENTRY");
      return true;
    }
  );

  await fsp.rm(tmp, { recursive: true, force: true });
});

test("inspectArchive - rejects malformed or truncated ZIP file", async () => {
  const tmp = await makeTempDir();
  const zipPath = path.join(tmp, "corrupted.zip");

  await fsp.writeFile(zipPath, Buffer.from("NOT_A_VALID_ZIP_HEADER_CONTENT"));

  await assert.rejects(
    async () => inspectArchive(zipPath),
    (err) => {
      assert.ok(err instanceof InvalidArchiveError || err.code === "ERR_INVALID_ARCHIVE");
      return true;
    }
  );

  await fsp.rm(tmp, { recursive: true, force: true });
});
