/**
 * Skill Unpacker Core Engine
 * A reusable Node.js library for safely inspecting, validating, extracting,
 * and repackaging .skill and .zip archives.
 */

const { inspectArchive, openZip } = require("./inspect");
const { extractArchive } = require("./extract");
const { validateSkill, parseFrontmatter, walkFiles } = require("./validate");
const { packSkill } = require("./pack");
const {
  DEFAULT_LIMITS,
  sanitizeEntryName,
  isSymlink,
  isPathInside
} = require("./security");
const errors = require("./errors");

module.exports = {
  // Primary programmatic API
  inspectArchive,
  extractArchive,
  validateSkill,
  packSkill,

  // Utilities
  parseFrontmatter,
  sanitizeEntryName,
  isSymlink,
  isPathInside,
  walkFiles,
  openZip,

  // Configuration & Defaults
  DEFAULT_LIMITS,

  // Error Classes
  ...errors
};
