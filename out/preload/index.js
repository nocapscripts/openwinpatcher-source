"use strict";
const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("api", {
  min: () => ipcRenderer.send("win:min"),
  max: () => ipcRenderer.send("win:max"),
  close: () => ipcRenderer.send("win:close"),
  install: (list, manager) => ipcRenderer.invoke("apps:install", list, manager),
  upgradeAll: (manager) => ipcRenderer.invoke("apps:upgradeAll", manager),
  installed: (apps) => ipcRenderer.invoke("apps:installed", apps),
  pmStatus: () => ipcRenderer.invoke("pm:status"),
  ps: (script) => ipcRenderer.invoke("ps:run", script),
  // Returns an unsubscribe function so React can clean up (no duplicate listeners
  // when the effect re-runs, e.g. in dev StrictMode).
  onProgress: (cb) => {
    const handler = (_e, msg) => cb(msg);
    ipcRenderer.on("progress", handler);
    return () => ipcRenderer.removeListener("progress", handler);
  },
  sysInfo: () => ipcRenderer.invoke("sys:info"),
  openExternal: (url) => ipcRenderer.invoke("open:external", url),
  // PowerShell output window
  termOpen: () => ipcRenderer.invoke("term:open"),
  termAppend: (lines) => ipcRenderer.send("term:append", lines),
  termClear: () => ipcRenderer.send("term:clear"),
  chocoReinstall: () => ipcRenderer.invoke("apps:chocoReinstall"),
  chocoCheck: () => ipcRenderer.invoke("apps:chocoCheck")
});
