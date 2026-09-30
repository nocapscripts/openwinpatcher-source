const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("api", {
  min: () => ipcRenderer.send("win:min"),
  max: () => ipcRenderer.send("win:max"),
  close: () => ipcRenderer.send("win:close"),
  install: (list) => ipcRenderer.invoke("apps:install", list),
  upgradeAll: () => ipcRenderer.invoke("apps:upgradeAll"),
  installed: (ids) => ipcRenderer.invoke("apps:installed", ids),
  ps: (script) => ipcRenderer.invoke("ps:run", script),
  onProgress: (cb) => ipcRenderer.on("progress", (_e, msg) => cb(msg)),
  sysInfo: () => ipcRenderer.invoke("sys:info"),
  openExternal: (url) => ipcRenderer.invoke("open:external", url),
});
