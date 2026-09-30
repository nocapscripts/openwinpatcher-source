const { app, BrowserWindow, ipcMain, shell } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const os = require("os");

let win;
function createWindow() {
  win = new BrowserWindow({
    width: 1280, height: 780, frame: false, backgroundColor: "#1c2029",
    icon: path.join(__dirname, "../build/icon.ico"),
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true },
  });
  if (process.env.NODE_ENV === "development") win.loadURL("http://localhost:5173");
  else win.loadFile(path.join(__dirname, "../dist/index.html"));
}
app.whenReady().then(createWindow);
app.on("window-all-closed", () => app.quit());

ipcMain.on("win:min", () => win.minimize());
ipcMain.on("win:max", () => (win.isMaximized() ? win.unmaximize() : win.maximize()));
ipcMain.on("win:close", () => win.close());

const run = (cmd, args) =>
  new Promise((resolve) => {
    let out = "";
    const p = spawn(cmd, args, { shell: true });
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (out += d));
    p.on("close", (code) => resolve({ code, out }));
    p.on("error", (e) => resolve({ code: -1, out: String(e) }));
  });

const flags = ["--silent", "--accept-package-agreements", "--accept-source-agreements"];

ipcMain.handle("apps:install", async (_e, list) => {
  const results = [];
  for (let i = 0; i < list.length; i++) {
    win.webContents.send("progress", `Installing ${i + 1}/${list.length}: ${list[i].name}`);
    const r = await run("winget", ["install", "-e", "--id", list[i].id, ...flags]);
    results.push({ id: list[i].id, ok: r.code === 0 });
  }
  win.webContents.send("progress", "");
  return results;
});

ipcMain.handle("apps:upgradeAll", async () => {
  win.webContents.send("progress", "Upgrading all packages…");
  const r = await run("winget", ["upgrade", "--all", ...flags]);
  win.webContents.send("progress", "");
  return r.code === 0;
});

ipcMain.handle("apps:installed", async (_e, ids) => {
  const { out } = await run("winget", ["list", "--accept-source-agreements"]);
  const text = out.toLowerCase();
  return ids.filter((id) => text.includes(id.toLowerCase()));
});

// Run a PowerShell script (no shell quoting issues)
ipcMain.handle("ps:run", (_e, script) =>
  new Promise((resolve) => {
    let out = "";
    const p = spawn("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script]);
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (out += d));
    p.on("close", (code) => resolve({ code, out }));
    p.on("error", (e) => resolve({ code: -1, out: String(e) }));
  })
);


ipcMain.handle("sys:info", () => ({
  app: app.getVersion(),
  electron: process.versions.electron,
  os: `${os.type()} ${os.release()} ${os.arch()}`,
}));

// Only allow opening GitHub links from the renderer
ipcMain.handle("open:external", (_e, url) => {
  if (typeof url !== "string" || !url.startsWith("https://github.com/")) return false;
  shell.openExternal(url);
  return true;
});
