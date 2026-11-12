const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");

/**
 * Computes a standard CRC-32 checksum.
 * @param {Buffer} buf
 * @returns {number}
 */
function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    const byte = buf[i];
    crc ^= byte;
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Builds a raw ZIP archive Buffer from specified entry descriptors.
 * Allows creating arbitrary, malformed, or malicious ZIP structures for security testing.
 *
 * @param {Array<{
 *   name: string,
 *   content?: Buffer|string,
 *   compressedSize?: number,
 *   uncompressedSize?: number,
 *   unixMode?: number,
 *   externalAttributes?: number
 * }>} entries
 * @returns {Buffer}
 */
function buildRawZip(entries) {
  const localHeaders = [];
  const centralHeaders = [];
  let offset = 0;

  for (const entry of entries) {
    const data = Buffer.isBuffer(entry.content)
      ? entry.content
      : Buffer.from(entry.content || "", "utf8");
    const nameBuf = Buffer.from(entry.name, "utf8");
    const crc = crc32(data);
    const uncompressedSize = entry.uncompressedSize !== undefined ? entry.uncompressedSize : data.length;
    const compressedSize = entry.compressedSize !== undefined ? entry.compressedSize : data.length;

    // External file attributes
    let extAttrs = entry.externalAttributes || 0;
    if (entry.unixMode !== undefined) {
      extAttrs = (entry.unixMode << 16) >>> 0;
    }

    const compressionMethod = entry.compressionMethod !== undefined ? entry.compressionMethod : 0;

    // Local file header (30 bytes + name length + data length)
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0); // signature
    localHeader.writeUInt16LE(20, 4);         // version needed (2.0)
    localHeader.writeUInt16LE(0, 6);          // flags
    localHeader.writeUInt16LE(compressionMethod, 8); // compression (0 = stored, 8 = deflate)
    localHeader.writeUInt16LE(0x4000, 10);    // mod time
    localHeader.writeUInt16LE(0x4000, 12);    // mod date
    localHeader.writeUInt32LE(crc, 14);       // crc-32
    localHeader.writeUInt32LE(compressedSize, 18);
    localHeader.writeUInt32LE(uncompressedSize, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);         // extra field length

    const localChunk = Buffer.concat([localHeader, nameBuf, data]);
    localHeaders.push(localChunk);

    // Central directory header (46 bytes + name length)
    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0); // signature
    centralHeader.writeUInt16LE(0x031e, 4);     // version made by (Unix 3.0)
    centralHeader.writeUInt16LE(20, 6);         // version needed
    centralHeader.writeUInt16LE(0, 8);          // flags
    centralHeader.writeUInt16LE(compressionMethod, 10); // compression
    centralHeader.writeUInt16LE(0x4000, 12);    // mod time
    centralHeader.writeUInt16LE(0x4000, 14);    // mod date
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(compressedSize, 20);
    centralHeader.writeUInt32LE(uncompressedSize, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);         // extra length
    centralHeader.writeUInt16LE(0, 32);         // comment length
    centralHeader.writeUInt16LE(0, 34);         // disk number
    centralHeader.writeUInt16LE(0, 36);         // internal attrs
    centralHeader.writeUInt32LE(extAttrs, 38);  // external attrs
    centralHeader.writeUInt32LE(offset, 42);    // local header offset

    const centralChunk = Buffer.concat([centralHeader, nameBuf]);
    centralHeaders.push(centralChunk);

    offset += localChunk.length;
  }

  const allLocals = Buffer.concat(localHeaders);
  const allCentrals = Buffer.concat(centralHeaders);
  const centralOffset = allLocals.length;
  const centralSize = allCentrals.length;

  // End of central directory record (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);             // signature
  eocd.writeUInt16LE(0, 4);                      // disk number
  eocd.writeUInt16LE(0, 6);                      // central dir disk
  eocd.writeUInt16LE(entries.length, 8);         // entries on disk
  eocd.writeUInt16LE(entries.length, 10);        // total entries
  eocd.writeUInt32LE(centralSize, 12);           // central dir size
  eocd.writeUInt32LE(centralOffset, 16);         // central dir offset
  eocd.writeUInt16LE(0, 20);                     // comment length

  return Buffer.concat([allLocals, allCentrals, eocd]);
}

/**
 * Creates a temporary directory for testing.
 * @param {string} prefix
 * @returns {Promise<string>}
 */
async function makeTempDir(prefix = "su-test-") {
  const os = require("node:os");
  const tmp = path.join(os.tmpdir(), `${prefix}${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await fsp.mkdir(tmp, { recursive: true });
  return tmp;
}

module.exports = {
  buildRawZip,
  makeTempDir,
  crc32
};
