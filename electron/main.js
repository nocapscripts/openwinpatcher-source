const { app, BrowserWindow, ipcMain, shell } = require("electron");
const { spawn } = require("child_process");
const { registerTerminal, openConsole, log, createSink } = require("./powerShell");
const path = require("path");
const os = require("os");
const fs = require("fs");
const { CreateLog } = require("./utils/logs");

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

  if (!app.isPackaged) {
     win.webContents.on('console-message', (...args) => {
       const message = args[0]?.message ?? args[2]
       console.log('[renderer]', message)
     })
   }

}

// One startup block: terminal IPC first, then the window, then the PowerShell window.
app.whenReady().then(() => {
  registerTerminal();
  createWindow();
  openConsole();
  CreateLog("info", "UI Start success");
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

const wingetFlags = ["--silent", "--accept-package-agreements", "--accept-source-agreements"];

// Package IDs are passed to a shell for winget, so only allow plain package-id characters.
const SAFE_ID = /^[A-Za-z0-9._+-]+$/;

// Chocolatey exit codes that still mean success (1641/3010 = success, reboot required).
const CHOCO_OK = new Set([0, 1641, 3010]);

// Finds choco.exe at its install location. Looking there (not only on PATH) means it works
// right after "Install Chocolatey", before the app has been restarted.
function chocoPath() {
  const root = process.env.ChocolateyInstall || "C:\\ProgramData\\chocolatey";
  const exe = path.join(root, "bin", "choco.exe");
  return fs.existsSync(exe) ? exe : null;
}



const winget = (args, stream = true) => run("winget", args, { stream, options: { shell: true } });
const choco = (exe, args, stream = true) => run(exe, args, { stream });

async function installWithWinget(a) {
  log("", `PS> winget install -e --id ${a.id}`);
  const r = await winget(["install", "-e", "--id", a.id, ...wingetFlags]);
  if (r.code !== 0) log(`[ERROR] ${a.name} (WinGet) exited with code ${r.code}`);
  return r.code === 0;
}

async function installWithChoco(a, exe) {
  log("", `PS> choco install ${a.choco} -y`);


  const r = await choco(exe, ["install", a.choco, "-y", "--no-progress"]);
  const ok = CHOCO_OK.has(r.code);
  if (!ok) log(`[ERROR] ${a.name} (Chocolatey) exited with code ${r.code}`);
  return ok;
}

// Which package managers are available (used by the UI)
ipcMain.handle("pm:status", async () => {
  const w = await winget(["--version"], false);
  return { winget: w.code === 0, choco: !!chocoPath() };
});

// manager: "auto" (WinGet first, Chocolatey as fallback) | "winget" | "choco"
ipcMain.handle("apps:install", async (_e, list, manager = "auto") => {
  const exe = chocoPath();
  const results = [];

  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    let ok = false;

    send({
      label: `Installing ${a.name}`,
      status: `Installing ${i + 1}/${list.length}: ${a.name}`,
      progress: (i / list.length) * 100,
    });

    if (!SAFE_ID.test(a.id || "")) {
      log(`[ERROR] ${a.name}: invalid package id`);
      results.push({ id: a.id, ok: false });
      continue;
    }

    if (manager !== "choco") ok = await installWithWinget(a);

    if (!ok && manager !== "winget") {
      if (!a.choco || !SAFE_ID.test(a.choco)) {
        if (manager === "choco") log(`[ERROR] ${a.name} has no Chocolatey package`);
      } else if (!exe) {
        log("[ERROR] Chocolatey is not installed. Use the Install Chocolatey button, then retry.");
      } else {
        if (manager === "auto") log("WinGet failed, trying Chocolatey...");
        ok = await installWithChoco(a, exe);
      }
    }

    results.push({ id: a.id, ok });
  }

  return results;
});

ipcMain.handle("apps:upgradeAll", async (_e, manager = "auto") => {
  const exe = chocoPath();
  let ok = true;

  send({ label: "Upgrading applications", status: "Upgrading all packages…" });

  if (manager !== "choco") {
    log("", "PS> winget upgrade --all");
    const r = await winget(["upgrade", "--all", ...wingetFlags]);
    if (r.code !== 0) log(`[ERROR] winget upgrade exited with code ${r.code}`);
    ok = ok && r.code === 0;
  }

  if (manager !== "winget") {
    if (exe) {
      log("", "PS> choco upgrade all -y");
      const r = await choco(exe, ["upgrade", "all", "-y", "--no-progress"]);
      if (!CHOCO_OK.has(r.code)) log(`[ERROR] choco upgrade exited with code ${r.code}`);
      ok = ok && CHOCO_OK.has(r.code);
    } else if (manager === "choco") {
      log("[ERROR] Chocolatey is not installed. Use the Install Chocolatey button first.");
      ok = false;
    }
  }

  return ok;
});

// apps: [{ id, choco }]. Returns the WinGet ids of apps found by WinGet or Chocolatey.
ipcMain.handle("apps:installed", async (_e, apps) => {
  const w = await winget(["list", "--accept-source-agreements"], false);
  const wingetText = w.out.toLowerCase();

  const chocoNames = new Set();
  const exe = chocoPath();
  if (exe) {
    // --local-only: older Chocolatey versions list the online feed without it
    const c = await choco(exe, ["list", "--local-only", "-r"], false);
    for (const line of c.out.split(/\r?\n/)) {
      const [name] = line.split("|");
      if (name) chocoNames.add(name.trim().toLowerCase());
    }
  }

  return apps
    .filter((a) => wingetText.includes(a.id.toLowerCase()) || (a.choco && chocoNames.has(a.choco.toLowerCase())))
    .map((a) => a.id);
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



ipcMain.handle("apps:chocoCheck", async () => {
  const exe = chocoPath();
  return !!exe;
});
