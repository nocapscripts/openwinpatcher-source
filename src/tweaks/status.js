// Runs in the Electron MAIN process. Reads real system state with reg.exe, fs, schtasks, powercfg and dism.
// Nothing here goes through PowerShell, so nothing shows up in the output terminal.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import { BLOAT, FEATURES } from "./tweaks.js";
import { CHECKS, PREF_CHECKS } from "./checks.js";

const exec = promisify(execFile);
const run = (cmd, args) => exec(cmd, args, { windowsHide: true, maxBuffer: 64 * 1024 * 1024 }).then((r) => r.stdout).catch(() => null);

// ---- registry (one `reg query` per key, cached per run) ----
const PKG_KEY = "HKCU\\Software\\Classes\\Local Settings\\Software\\Microsoft\\Windows\\CurrentVersion\\AppModel\\Repository\\Packages";
const VAL = /^\s+(.+?)\s{2,}(REG_[A-Z_]+)\s*(.*)$/;

const readKey = async (key) => {
  const out = await run("reg", ["query", key]);
  if (out === null) return { exists: false, values: {}, subkeys: [] };
  const values = {}, subkeys = [];
  out.split(/\r?\n/).filter(Boolean).slice(1).forEach((line) => {
    if (line.startsWith("HKEY_")) return subkeys.push(line.slice(line.lastIndexOf("\\") + 1));
    const m = line.match(VAL);
    if (!m) return;
    const [, name, type, raw] = m;
    const data = type === "REG_DWORD" || type === "REG_QWORD" ? parseInt(raw, 16) : raw.trim();
    values[name.toLowerCase()] = { type, data };
  });
  return { exists: true, values, subkeys };
};

const cache = new Map();
const regKey = (key) => (cache.has(key) ? cache.get(key) : (cache.set(key, readKey(key)), cache.get(key)));

// ---- helpers ----
const wild = (p) => new RegExp("^" + p.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$", "i");
const expand = (s) => s.replace(/%(\w+)%/g, (_, v) => process.env[v] ?? "");
const installedNames = async () => (await regKey(PKG_KEY)).subkeys.map((n) => n.split("_")[0]);

const taskDisabled = async (t) => {
  const xml = await run("schtasks", ["/Query", "/TN", t, "/XML"]);
  if (!xml) return true; // task doesn't exist on this build, nothing left to disable
  const settings = xml.match(/<Settings>[\s\S]*?<\/Settings>/)?.[0] ?? "";
  return /<Enabled>\s*false\s*<\/Enabled>/i.test(settings);
};

async function evalCheck(c) {
  if (Array.isArray(c)) return (await Promise.all(c.map(evalCheck))).every(Boolean);
  if (c.key) {
    const v = (await regKey(c.key)).values[c.name.toLowerCase()];
    return v !== undefined && v.data === c.eq;
  }
  if (c.keyExists) return (await regKey(c.keyExists)).exists;
  if (c.pathsMissing) return c.pathsMissing.every((p) => !fs.existsSync(expand(p)));
  if (c.tasksDisabled) return (await Promise.all(c.tasksDisabled.map(taskDisabled))).every(Boolean);
  if (c.bloatGone) {
    const names = await installedNames();
    return !c.bloatGone.some((p) => names.some((n) => wild(p).test(n)));
  }
  if (c.powerPlan) return new RegExp(c.powerPlan, "i").test((await run("powercfg", ["/getactivescheme"])) ?? "");
  return undefined;
}

// DISM output is localised, so unknown words give `undefined` (no badge) instead of a wrong answer.
async function featureStates() {
  const out = await run("dism", ["/online", "/Get-Features", "/Format:Table"]);
  const map = {};
  (out ?? "").split(/\r?\n/).forEach((l) => {
    const m = l.match(/^(\S+)\s*\|\s*(.+?)\s*$/);
    if (m) map[m[1]] = /disabled/i.test(m[2]) ? false : /enabled/i.test(m[2]) ? true : undefined;
  });
  return map;
}

// ---- public API ----
// Returns { telemetry: true, ads: false, dark: true, NetFx3: false, ..., bloatLeft: ["king.com.*", ...] }
export async function getStatus({ features = false } = {}) {
  cache.clear();
  const all = { ...CHECKS, ...PREF_CHECKS };
  const ids = Object.keys(all);
  const [results, names, feat] = await Promise.all([
    Promise.all(ids.map((id) => evalCheck(all[id]).catch(() => undefined))),
    installedNames(),
    features ? featureStates() : {},
  ]);
  const status = Object.fromEntries(ids.map((id, i) => [id, results[i]]));
  if (features) FEATURES.forEach((f) => (status[f.id] = feat[f.id]));
  status.bloatLeft = BLOAT.map((a) => a.pkg).filter((p) => names.some((n) => wild(p).test(n)));
  return status;
}
