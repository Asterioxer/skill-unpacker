const api = window.skillUnpacker;
const $ = (id) => document.getElementById(id);
let selectedArchive = null;
let destination = null;
let currentFolder = null;
let currentEntries = [];

const pages = {
  unpack: ["Unpack a skill package", "Inspect the contents of a .skill or .zip archive before extracting it."],
  validate: ["Validate a skill folder", "Check the package structure and required SKILL.md metadata."],
  pack: ["Repackage a skill", "Create a distributable archive from an edited skill directory."]
};

function toast(message) {
  const el = $("toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove("show"), 3500);
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function showError(error) {
  const msg = error?.message || String(error);
  toast(msg);
}

document.querySelectorAll(".nav-item").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
    button.classList.add("active");
    const view = button.dataset.view;
    $(`view-${view}`).classList.add("active");
    $("page-title").textContent = pages[view][0];
    $("page-subtitle").textContent = pages[view][1];
  });
});

function renderFileList(entries) {
  const listEl = $("file-list");
  if (!entries || entries.length === 0) {
    listEl.innerHTML = `<div class="file-row">No matching entries found.</div>`;
    return;
  }
  const display = entries.slice(0, 600);
  listEl.innerHTML = display.map(entry => `
    <div class="file-row">
      <span class="file-icon">${entry.directory ? "▰" : "▧"}</span>
      <span class="file-name">${escapeHtml(entry.name)}</span>
      <span class="file-size">${entry.directory ? "" : formatBytes(entry.uncompressedSize)}</span>
    </div>`).join("") +
    (entries.length > 600 ? `<div class="file-row">… ${entries.length - 600} more entries</div>` : "");
}

$("file-search").addEventListener("input", (e) => {
  const term = e.target.value.toLowerCase().trim();
  if (!term) {
    renderFileList(currentEntries);
  } else {
    const filtered = currentEntries.filter(entry => entry.name.toLowerCase().includes(term));
    renderFileList(filtered);
  }
});

async function inspect(path) {
  try {
    const info = await api.inspect(path);
    selectedArchive = path;
    destination = null;
    currentEntries = info.entries || [];
    $("file-search").value = "";

    $("archive-panel").classList.remove("hidden");
    $("archive-name").textContent = info.archiveName;
    $("archive-stats").innerHTML = `
      <div class="stat"><b>${info.entryCount}</b><span>ARCHIVE ENTRIES</span></div>
      <div class="stat"><b>${formatBytes(info.archiveBytes)}</b><span>COMPRESSED SIZE</span></div>
      <div class="stat"><b>${formatBytes(info.totalUncompressedBytes)}</b><span>EXPANDED SIZE</span></div>`;
    $("entry-count").textContent = `${info.entryCount} items`;

    renderFileList(currentEntries);

    let checkHtml = "";
    if (info.hasSkillMd) {
      checkHtml += `<div class="check-row"><span class="check-dot good"></span><span><strong>SKILL.md found</strong><br>At least one skill definition file is present (${info.skillFiles.join(", ")}).</span></div>`;
    } else {
      checkHtml += `<div class="check-row"><span class="check-dot"></span><span><strong>SKILL.md not found</strong><br>This may be a generic ZIP rather than a Claude skill package.</span></div>`;
    }

    if (info.duplicateEntries && info.duplicateEntries.length > 0) {
      checkHtml += `<div class="check-row"><span class="check-dot"></span><span><strong>Duplicate entries detected</strong><br>${info.duplicateEntries.slice(0, 3).join(", ")}</span></div>`;
    } else {
      checkHtml += `<div class="check-row"><span class="check-dot good"></span><span><strong>Archive metadata inspected</strong><br>Entry names, expansion limits, and path traversal passed preflight.</span></div>`;
    }

    $("package-check").innerHTML = checkHtml;
    $("destination-label").textContent = "No destination selected";
    $("extract-btn").disabled = true;
    $("extract-progress-container").classList.add("hidden");
    toast("Archive inspected successfully.");
  } catch (error) {
    showError(error);
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
}

$("browse-btn").addEventListener("click", async () => {
  const path = await api.openArchive();
  if (path) inspect(path);
});

$("clear-btn").addEventListener("click", () => {
  selectedArchive = null;
  destination = null;
  currentEntries = [];
  $("archive-panel").classList.add("hidden");
});

$("destination-btn").addEventListener("click", async () => {
  const path = await api.chooseFolder("Choose extraction destination");
  if (path) {
    destination = path;
    $("destination-label").textContent = path;
    $("extract-btn").disabled = !selectedArchive;
  }
});

// Setup extraction progress listener
api.onExtractProgress((p) => {
  const container = $("extract-progress-container");
  container.classList.remove("hidden");
  $("extract-progress-fill").style.width = `${p.percent}%`;
  $("extract-progress-label").textContent = `Extracting ${p.percent}% (${p.entryIndex}/${p.totalEntries})`;
});

$("cancel-extract-btn").addEventListener("click", async () => {
  await api.cancelExtract();
  toast("Cancelling extraction…");
});

$("extract-btn").addEventListener("click", async () => {
  if (!selectedArchive || !destination) return;
  $("extract-btn").disabled = true;
  $("extract-btn").textContent = "Extracting…";
  $("extract-progress-container").classList.remove("hidden");
  $("extract-progress-fill").style.width = "0%";
  $("extract-progress-label").textContent = "Starting extraction…";

  try {
    const result = await api.extract(selectedArchive, destination);
    $("extract-progress-fill").style.width = "100%";
    $("extract-progress-label").textContent = "Extraction complete!";
    toast(`Extracted ${result.extractedFiles} files.`);
    await api.openPath(result.destination);
  } catch (error) {
    showError(error);
  } finally {
    $("extract-btn").disabled = false;
    $("extract-btn").innerHTML = 'Extract package <span>→</span>';
    setTimeout(() => {
      $("extract-progress-container").classList.add("hidden");
    }, 2000);
  }
});

function renderValidation(result) {
  const panel = $("validation-result");
  panel.classList.remove("hidden");
  panel.innerHTML = `<div class="panel-head"><div><span class="eyebrow">VALIDATION REPORT</span><h2>${result.valid ? "Skill structure looks valid" : "Validation needs attention"}</h2></div><span class="${result.valid ? "result-good" : "result-error"}">${result.valid ? "PASS" : "FAIL"}</span></div>`;
  if (result.skillMd) {
    panel.innerHTML += `<div class="result-line"><strong>Name:</strong> ${escapeHtml(result.skillMd.name || "—")}</div>
      <div class="result-line"><strong>Description:</strong> ${escapeHtml(result.skillMd.description || "—")}</div>
      <div class="result-line"><strong>SKILL.md lines:</strong> ${result.skillMd.lines}</div>`;
  }
  result.errors.forEach(e => panel.innerHTML += `<div class="result-line result-error">✕ ${escapeHtml(e)}</div>`);
  result.warnings.forEach(e => panel.innerHTML += `<div class="result-line result-warning">! ${escapeHtml(e)}</div>`);
  panel.innerHTML += `<div class="result-line"><strong>Files discovered:</strong> ${result.files.length}</div>`;
}

$("validate-btn").addEventListener("click", async () => {
  try {
    const folder = await api.chooseFolder("Select extracted skill folder");
    if (!folder) return;
    currentFolder = folder;
    renderValidation(await api.validate(folder));
  } catch (error) {
    showError(error);
  }
});

$("pack-btn").addEventListener("click", async () => {
  try {
    const folder = await api.chooseFolder("Select skill folder to package");
    if (!folder) return;
    currentFolder = folder;
    const validation = await api.validate(folder);
    renderPackValidation(validation);
    if (!validation.valid) return toast("Fix validation errors before packaging.");
    const suggested = `${folder.split(/[\\/]/).filter(Boolean).pop()}.skill`;
    const output = await api.savePackage(suggested);
    if (!output) return;
    const result = await api.pack(folder, output);
    $("pack-result").classList.remove("hidden");
    $("pack-result").innerHTML = `<div class="result-line result-good"><strong>Package created successfully.</strong></div><div class="result-line">${escapeHtml(result.outputPath)}</div><div class="result-line">${result.filesPacked} files packaged.</div><button class="secondary" id="open-package">Open output folder</button>`;
    $("open-package").addEventListener("click", () => api.openPath(output));
    toast("Skill package created.");
  } catch (error) {
    showError(error);
  }
});

function renderPackValidation(result) {
  const panel = $("pack-result");
  panel.classList.remove("hidden");
  panel.innerHTML = `<div class="result-line ${result.valid ? "result-good" : "result-error"}"><strong>${result.valid ? "Validation passed." : "Validation failed."}</strong></div>`;
  [...result.errors, ...result.warnings].forEach(e => panel.innerHTML += `<div class="result-line">${escapeHtml(e)}</div>`);
}

// Native file drag/drop. Only the main process reads archive bytes.
const dropzone = $("dropzone");
dropzone.addEventListener("dragover", event => { event.preventDefault(); dropzone.classList.add("dragover"); });
dropzone.addEventListener("dragleave", () => dropzone.classList.remove("dragover"));
dropzone.addEventListener("drop", event => {
  event.preventDefault();
  dropzone.classList.remove("dragover");
  const file = event.dataTransfer.files?.[0];
  const filePath = file ? api.getDroppedFilePath(file) : "";
  if (filePath && /\.(skill|zip)$/i.test(file.name)) inspect(filePath);
  else toast("Drop a .skill or .zip archive.");
});
