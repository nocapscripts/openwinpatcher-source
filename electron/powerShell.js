// Main process: opens a real PowerShell window when the app starts and streams all
// operation output into it. Output is written to a temp log file that the window tails.
const fs = require("fs");
const path = require("path");
const { spawn, spawnSync } = require("child_process");
const { app, ipcMain } = require("electron");

const TITLE = "Open Windows Patcher - Output";

let child = null;
let logFile = null;

function ensureLog() {
  if (!logFile) {
    logFile = path.join(app.getPath("temp"), `owp-output-${process.pid}.log`);
    fs.writeFileSync(logFile, "", "utf8");
  }
  return logFile;
}

function openConsole() {
  if (process.platform !== "win32" || child) return;

  const file = ensureLog().replace(/'/g, "''");

  const script = `
$Host.UI.RawUI.WindowTitle = '${TITLE}'
Clear-Host
Write-Host 'Open Windows Patcher - live output' -ForegroundColor Cyan
Write-Host ''
Get-Content -LiteralPath '${file}' -Wait -Tail 200 -Encoding UTF8 | ForEach-Object {
  if ($_.StartsWith('PS>')) { Write-Host $_ -ForegroundColor Cyan }
  elseif ($_.StartsWith('[ERROR]')) { Write-Host $_ -ForegroundColor Red }
  else { Write-Host $_ }
}
`;

  const encoded = Buffer.from(script, "utf16le").toString("base64");

  const c = spawn(
    "powershell.exe",
    ["-NoLogo", "-NoProfile", "-NoExit", "-ExecutionPolicy", "Bypass", "-EncodedCommand", encoded],
    // detached on Windows gives the child its own visible console window
    { detached: true, stdio: "ignore", windowsHide: false }
  );

  child = c;
  c.on("exit", () => { if (child === c) child = null; });
  c.on("error", () => { if (child === c) child = null; });
  c.unref();
}

function closeConsole() {
  if (child) {
    try { spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], { windowsHide: true }); } catch {}
    child = null;
  }
  if (logFile) {
    try { fs.unlinkSync(logFile); } catch {}
    logFile = null;
  }
}

// Write whole lines to the console window.
function log(...lines) {
  try {
    fs.appendFileSync(ensureLog(), lines.map(String).join("\r\n") + "\r\n", "utf8");
  } catch {}
}

// Turns raw process output (chunks) into clean lines: strips colour codes,
// keeps only the final state of "\r" progress redraws, drops lone spinner characters.
function createSink() {
  let buf = "";

  const clean = (l) =>
    (l.split("\r").filter(Boolean).pop() ?? "")
      .replace(/\x1b\[[0-9;?]*[A-Za-z]/g, "")
      .trimEnd();

  const emit = (lines) => {
    const out = lines.map(clean).filter((l) => !/^\s*[-\\|/]\s*$/.test(l));
    if (out.length) log(...out);
  };

  return {
    push(chunk) {
      buf += chunk.toString();
      const parts = buf.split("\n");
      buf = parts.pop();
      emit(parts);
    },
    flush() {
      if (buf) emit([buf]);
      buf = "";
    },
  };
}

// Call once, right after app.whenReady() and before the window loads.
function registerTerminal() {
  ipcMain.handle("term:open", () => openConsole()); // reopen if the user closed the window
  ipcMain.on("term:append", (_e, lines) => {
    if (Array.isArray(lines) && lines.length) log(...lines);
  });
  ipcMain.on("term:clear", () => log("", "-".repeat(48))); // separator between operations
  app.on("before-quit", closeConsole);
}

module.exports = { registerTerminal, openConsole, closeConsole, log, createSink };
