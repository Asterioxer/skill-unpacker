const { contextBridge, ipcRenderer, webUtils } = require("electron");

contextBridge.exposeInMainWorld("skillUnpacker", {
  openArchive: () => ipcRenderer.invoke("dialog:open-archive"),
  getDroppedFilePath: (file) => webUtils.getPathForFile(file),
  chooseFolder: (title) => ipcRenderer.invoke("dialog:choose-folder", title),
  savePackage: (name) => ipcRenderer.invoke("dialog:save-package", name),
  inspect: (archivePath) => ipcRenderer.invoke("archive:inspect", archivePath),
  extract: (archivePath, destination) => ipcRenderer.invoke("archive:extract", archivePath, destination),
  cancelExtract: () => ipcRenderer.invoke("archive:cancel-extract"),
  onExtractProgress: (callback) => {
    const handler = (_event, progress) => callback(progress);
    ipcRenderer.on("archive:extract-progress", handler);
    return () => ipcRenderer.removeListener("archive:extract-progress", handler);
  },
  validate: (folderPath) => ipcRenderer.invoke("skill:validate", folderPath),
  pack: (folderPath, outputPath) => ipcRenderer.invoke("skill:pack", folderPath, outputPath),
  openPath: (targetPath) => ipcRenderer.invoke("shell:open-path", targetPath)
});
