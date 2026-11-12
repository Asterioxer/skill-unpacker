const fsp = require("node:fs/promises");
const path = require("node:path");
const { SymlinkError } = require("./errors");

const SKILL_NAME_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SENSITIVE_FILE_PATTERNS = [
  /(^|\/)\.env(\..+)?$/i,
  /(^|\/)id_rsa(\.pub)?$/i,
  /\.(pem|key|pfx|p12)$/i,
  /(^|\/)\.git\//i,
  /(^|\/)node_modules\//i
];

/**
 * Safe, zero-dependency YAML frontmatter parser tailored for skill manifests.
 * Correctly handles block scalars (> and |), quoted strings, lists, and nested mappings.
 *
 * @param {string} content
 * @returns {{ frontmatter: Record<string, any>, rawFrontmatter: string, body: string } | null}
 */
function parseFrontmatter(content) {
  if (typeof content !== "string") return null;

  const match = content.match(/^---\s*\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/);
  if (!match) return null;

  const rawFrontmatter = match[1];
  const body = match[2];
  const lines = rawFrontmatter.split(/\r?\n/);
  const result = {};

  let currentKey = null;
  let multilineType = null; // '>' or '|' or 'indent'
  let multilineLines = [];

  function flushMultiline() {
    if (currentKey && multilineLines.length > 0) {
      if (multilineType === ">") {
        result[currentKey] = multilineLines.join(" ").trim();
      } else if (multilineType === "|") {
        result[currentKey] = multilineLines.join("\n").trim();
      } else {
        result[currentKey] = multilineLines.join("\n").trim();
      }
      multilineLines = [];
      multilineType = null;
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines and full-line comments
    if (!trimmed || trimmed.startsWith("#")) {
      if (multilineType) multilineLines.push("");
      continue;
    }

    // Check for key-value pair at root indentation
    const keyMatch = line.match(/^([a-zA-Z0-9_-]+)\s*:\s*(.*)$/);
    if (keyMatch) {
      flushMultiline();
      currentKey = keyMatch[1];
      const rest = keyMatch[2].trim();

      if (rest === ">" || rest === ">-" || rest === ">+") {
        multilineType = ">";
      } else if (rest === "|" || rest === "|-" || rest === "|+") {
        multilineType = "|";
      } else if (rest === "") {
        multilineType = "indent";
      } else {
        // Scalar value: strip quotes if present
        let val = rest;
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        result[currentKey] = val;
        currentKey = null;
      }
      continue;
    }

    // Continuation line (indented)
    if (currentKey && /^\s+/.test(line)) {
      multilineLines.push(trimmed);
      continue;
    }

    // If we hit an unindented non-key line, flush
    flushMultiline();
    currentKey = null;
  }

  flushMultiline();

  return {
    frontmatter: result,
    rawFrontmatter,
    body
  };
}

/**
 * Recursively walks a folder, collecting all relative file paths.
 * Rejects symbolic links.
 *
 * @param {string} root
 * @param {string} [current]
 * @param {string[]} [output]
 * @returns {Promise<string[]>}
 */
async function walkFiles(root, current = root, output = []) {
  const items = await fsp.readdir(current, { withFileTypes: true });
  for (const item of items) {
    const full = path.join(current, item.name);
    if (item.isSymbolicLink()) {
      throw new SymlinkError(path.relative(root, full).split(path.sep).join("/"));
    }
    if (item.isDirectory()) {
      await walkFiles(root, full, output);
    } else if (item.isFile()) {
      output.push(full);
    }
  }
  return output;
}

/**
 * Validates a skill directory structure and metadata against Claude skill specifications.
 *
 * @param {string} folderPath
 * @returns {Promise<ValidationResult>}
 */
async function validateSkill(folderPath) {
  const root = path.resolve(folderPath);
  const result = {
    valid: false,
    folderPath: root,
    skillPath: null,
    errors: [],
    warnings: [],
    files: [],
    skillMd: null
  };

  let stat;
  try {
    stat = await fsp.stat(root);
  } catch (err) {
    result.errors.push(`Directory does not exist: ${root}`);
    return result;
  }

  if (!stat.isDirectory()) {
    result.errors.push(`Selected path is not a directory: ${root}`);
    return result;
  }

  let filePaths;
  try {
    filePaths = await walkFiles(root);
  } catch (err) {
    result.errors.push(err.message);
    return result;
  }

  result.files = filePaths.map((f) => path.relative(root, f).split(path.sep).join("/"));

  // Check for sensitive or forbidden files
  for (const rel of result.files) {
    for (const pattern of SENSITIVE_FILE_PATTERNS) {
      if (pattern.test(rel)) {
        result.warnings.push(`Potentially sensitive or development file found: ${rel}`);
      }
    }
  }

  // Find SKILL.md (check root first, or single subfolder)
  let skillFilePath = path.join(root, "SKILL.md");
  let content = null;

  try {
    content = await fsp.readFile(skillFilePath, "utf8");
    result.skillPath = skillFilePath;
  } catch {
    // Check if there's a top-level directory containing SKILL.md
    const subSkills = result.files.filter((f) => /(^|\/)SKILL\.md$/i.test(f));
    if (subSkills.length === 1) {
      skillFilePath = path.join(root, subSkills[0]);
      try {
        content = await fsp.readFile(skillFilePath, "utf8");
        result.skillPath = skillFilePath;
        result.warnings.push(`SKILL.md is located at "${subSkills[0]}" instead of the directory root.`);
      } catch {}
    }
  }

  if (!content) {
    result.errors.push("Required SKILL.md file is missing from the skill root.");
    return result;
  }

  const parsed = parseFrontmatter(content);
  if (!parsed) {
    result.errors.push("SKILL.md must begin with YAML frontmatter delimited by ---.");
    return result;
  }

  const fm = parsed.frontmatter;
  const name = typeof fm.name === "string" ? fm.name.trim() : null;
  const description = typeof fm.description === "string" ? fm.description.trim() : null;
  const version = typeof fm.version === "string" ? fm.version.trim() : null;
  const lineCount = content.split(/\r?\n/).length;

  // Validate name
  if (!name) {
    result.errors.push("Frontmatter is missing required field: name.");
  } else {
    if (!SKILL_NAME_REGEX.test(name)) {
      result.warnings.push(
        `Skill name "${name}" should use lowercase alphanumeric characters and single hyphens (e.g. my-skill).`
      );
    }
    if (name.length > 64) {
      result.warnings.push(`Skill name "${name}" exceeds recommended 64-character limit.`);
    }
  }

  // Validate description
  if (!description) {
    result.errors.push("Frontmatter is missing required field: description.");
  } else {
    if (description.length < 15) {
      result.warnings.push("Description is very short; provide a clear summary of what the skill does and when to use it.");
    }
    if (description.length > 1024) {
      result.warnings.push("Description is unusually long (>1024 chars); consider moving details to the body or references.");
    }
  }

  // Validate SKILL.md length
  if (lineCount > 500) {
    result.warnings.push(
      `SKILL.md has ${lineCount} lines. Consider moving detailed reference material to a references/ folder.`
    );
  }

  result.skillMd = {
    name,
    description,
    version,
    lines: lineCount,
    rawFrontmatter: parsed.rawFrontmatter,
    attributes: fm
  };

  // Structural suggestions
  const hasReferences = result.files.some((f) => f.toLowerCase().startsWith("references/"));
  const hasScripts = result.files.some((f) => f.toLowerCase().startsWith("scripts/"));

  if (!hasReferences) {
    result.warnings.push("No references/ directory found. This is optional but recommended for extensive documentation.");
  }
  if (!hasScripts) {
    result.warnings.push("No scripts/ directory found. This is optional.");
  }

  result.valid = result.errors.length === 0;
  return result;
}

module.exports = {
  validateSkill,
  parseFrontmatter,
  walkFiles
};
