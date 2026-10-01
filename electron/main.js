const { app, BrowserWindow, ipcMain, shell } = require("electron");
const { spawn } = require("child_process");
const { registerTerminal, openConsole, log, createSink } = require("./powerShell");
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

  // Show the real error instead of a blank window
  win.webContents.on("did-fail-load", (_e, code, desc, url) => {
    console.error("Load failed:", code, desc, url);
    win.webContents.openDevTools({ mode: "detach" });
  });
}

// One startup block: terminal IPC first, then the window, then the PowerShell window.
app.whenReady().then(() => {
  registerTerminal();
  createWindow();
  openConsole();
  setTimeout(() => win?.focus(), 400); // keep focus on the app, not the console
});

app.on("window-all-closed", () => app.quit());

ipcMain.on("win:min", () => win.minimize());
ipcMain.on("win:max", () => (win.isMaximized() ? win.unmaximize() : win.maximize()));
ipcMain.on("win:close", () => win.close());

const send = (event) => win?.webContents.send("progress", event);

// Runs a command. With stream:true its output is shown live in the PowerShell window.
const run = (cmd, args, { stream = false, options = {} } = {}) =>
  new Promise((resolve) => {
    let out = "";
    const sink = stream ? createSink() : null;
    const p = spawn(cmd, args, options);

    const onData = (d) => {
      out += d;
      sink?.push(d);
    };

    p.stdout.on("data", onData);
    p.stderr.on("data", onData);
    p.on("close", (code) => {
      sink?.flush();
      resolve({ code, out });
    });
    p.on("error", (e) => {
      sink?.flush();
      if (stream) log(`[ERROR] ${e}`);
      resolve({ code: -1, out: String(e) });
    });
  });

const flags = ["--silent", "--accept-package-agreements", "--accept-source-agreements"];

ipcMain.handle("apps:install", async (_e, list) => {
  const results = [];

  for (let i = 0; i < list.length; i++) {
    const app_ = list[i];

    send({
      label: `Installing ${app_.name}`,
      status: `Installing ${i + 1}/${list.length}: ${app_.name}`,
      progress: (i / list.length) * 100,
    });

    log("", `PS> winget install -e --id ${app_.id}`);

    const r = await run("winget", ["install", "-e", "--id", app_.id, ...flags], {
      stream: true,
      options: { shell: true },
    });

    if (r.code !== 0) log(`[ERROR] ${app_.name} exited with code ${r.code}`);

    results.push({ id: app_.id, ok: r.code === 0 });
  }

  return results;
});

ipcMain.handle("apps:upgradeAll", async () => {
  send({ label: "Upgrading applications", status: "Upgrading all packages…" });
  log("", "PS> winget upgrade --all");

  const r = await run("winget", ["upgrade", "--all", ...flags], {
    stream: true,
    options: { shell: true },
  });

  if (r.code !== 0) log(`[ERROR] winget upgrade exited with code ${r.code}`);
  return r.code === 0;
});

ipcMain.handle("apps:installed", async (_e, ids) => {
  const { out } = await run("winget", ["list", "--accept-source-agreements"], {
    options: { shell: true },
  });
  const text = out.toLowerCase();
  return ids.filter((id) => text.includes(id.toLowerCase()));
});

// Run a PowerShell script (no shell quoting issues). Output streams to the PowerShell window.
// The result has no "output" field on purpose: the renderer would print it a second time.
ipcMain.handle("ps:run", async (_e, script) => {
  const r = await run(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script],
    { stream: true }
  );

  if (r.code !== 0) log(`[ERROR] script exited with code ${r.code}`);
  return { code: r.code, out: r.out };
});

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
