const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");
const {
  inspectArchive,
  extractArchive,
  packSkill,
  validateSkill
} = require("skill-unpacker");

let mainWindow;
let activeExtractAbortController = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 790,
    minWidth: 900,
    minHeight: 620,
    backgroundColor: "#0b1020",
    title: "Skill Unpacker",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    },
    autoHideMenuBar: true,
    show: false
  });
  mainWindow.loadFile(path.join(__dirname, "index.html"));
  mainWindow.once("ready-to-show", () => mainWindow.show());
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

ipcMain.handle("dialog:open-archive", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Open skill package",
    properties: ["openFile"],
    filters: [
      { name: "Skill packages and ZIP archives", extensions: ["skill", "zip"] },
      { name: "All files", extensions: ["*"] }
    ]
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle("dialog:choose-folder", async (_event, title = "Choose destination folder") => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title,
    properties: ["openDirectory", "createDirectory"]
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle("dialog:save-package", async (_event, suggestedName) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: "Save skill package",
    defaultPath: suggestedName || "my-skill.skill",
    filters: [
      { name: "Claude skill package", extensions: ["skill"] },
      { name: "ZIP archive", extensions: ["zip"] }
    ]
  });
  return result.canceled ? null : result.filePath;
});

ipcMain.handle("archive:inspect", async (_event, archivePath) => {
  return inspectArchive(archivePath);
});

ipcMain.handle("archive:extract", async (_event, archivePath, destination) => {
  activeExtractAbortController = new AbortController();
  try {
    return await extractArchive(archivePath, destination, {
      signal: activeExtractAbortController.signal,
      onProgress: (progress) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("archive:extract-progress", progress);
        }
      }
    });
  } finally {
    activeExtractAbortController = null;
  }
});

ipcMain.handle("archive:cancel-extract", async () => {
  if (activeExtractAbortController) {
    activeExtractAbortController.abort();
    return true;
  }
  return false;
});

ipcMain.handle("skill:validate", async (_event, folderPath) => {
  return validateSkill(folderPath);
});

ipcMain.handle("skill:pack", async (_event, folderPath, outputPath) => {
  return packSkill(folderPath, outputPath);
});

ipcMain.handle("shell:open-path", async (_event, targetPath) => {
  const resolved = path.resolve(targetPath);
  const stat = await fs.stat(resolved);
  if (stat.isDirectory() || stat.isFile()) {
    return shell.openPath(resolved);
  }
  throw new Error("The selected path does not exist.");
});
