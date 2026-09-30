import React, { useEffect, useMemo, useState } from "react";
import { Menu, Package, Wrench, Settings, Bug, RefreshCw, Search, ChevronDown, Minus, Square, X, Check } from "lucide-react";
import { APPS, CATEGORIES } from "./tweaks/apps.js";
import Report from "./Report.jsx";
import { Tweaks, Config, Updates } from "./Pages.jsx";

// Browser fallback so the UI can be previewed without Electron
const api = window.api ?? {
  min() {}, max() {}, close() {}, onProgress() {},
  ps: async () => ({ code: 0 }), install: async () => [], upgradeAll: async () => true, installed: async () => [],
};

const hue = (s) => [...s].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;

function Select({ value, onChange, options }) {
  return (
    <label className="select">
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o}>{o}</option>)}
      </select>
      <ChevronDown size={14} />
    </label>
  );
}

function AppTile({ app, checked, installed, onToggle }) {
  return (
    <button className={"tile" + (checked ? " on" : "")} onClick={onToggle}>
      <span className="icon" style={{ background: `hsl(${hue(app.name)} 55% 45%)` }}>{app.name[0]}</span>
      <span className="label">
        <span className="name">{app.name}</span>
        {app.foss && <span className="tag">FOSS</span>}
      </span>
      {installed && <Check size={14} className="ok" />}
    </button>
  );
}

export default function App() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All categories");
  const [manager, setManager] = useState("Auto (Recommended)");
  const [audience, setAudience] = useState("Everyone");
  const [selected, setSelected] = useState(new Set());
  const [installed, setInstalled] = useState(new Set());
  const [status, setStatus] = useState("");
  const [tab, setTab] = useState("install");
  const runPs = async (script, label) => {
    setStatus(`${label}…`);
    const r = await api.ps(script);
    setStatus(r.code === 0 ? `${label}: done` : `${label}: failed (run the app as administrator)`);
    return r;
  };

  useEffect(() => { api.onProgress(setStatus); }, []);

  const visible = useMemo(() => APPS.filter((a) =>
    (category === "All categories" || a.category === category) &&
    (audience === "Everyone" || a.foss) &&
    a.name.toLowerCase().includes(query.toLowerCase())
  ), [query, category, audience]);

  const toggle = (id) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const getInstalled = async () => {
    setStatus("Checking installed apps…");
    setInstalled(new Set(await api.installed(APPS.map((a) => a.id))));
    setStatus("");
  };
  const installSelected = async () => {
    await api.install(APPS.filter((a) => selected.has(a.id)));
    setSelected(new Set());
    getInstalled();
  };

  return (
    <div className="app">
      <header className="titlebar">
        <span className="title">WinBox</span>
        <div className="win-btns">
          <button onClick={api.min}><Minus size={14} /></button>
          <button onClick={api.max}><Square size={12} /></button>
          <button onClick={api.close}><X size={15} /></button>
        </div>
      </header>

      <div className="body">
        <nav className="rail">
          <Menu size={18} />
          {/* CHANGED: added the Report entry */}
          {[["install", Package, "Install"], ["tweaks", Wrench, "Tweaks"], ["config", Settings, "Config"], ["updates", RefreshCw, "Updates"], ["report", Bug, "Report"]].map(([id, Icon, t]) => (
            <button key={id} title={t} className={tab === id ? "active" : ""} onClick={() => setTab(id)}><Icon size={18} /></button>
          ))}
        </nav>

        {/* CHANGED: Report is now part of the page switch */}
        {tab !== "install" && (
          <main>
            {tab === "tweaks" ? <Tweaks run={runPs} />
              : tab === "config" ? <Config run={runPs} />
              : tab === "updates" ? <Updates run={runPs} />
              : <Report lastStatus={status} />}
          </main>
        )}
        {tab === "install" && <main>
          <h1>Applications</h1>
          <div className="toolbar">
            <label className="search">
              <Search size={14} />
              <input placeholder="Search packages…" value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
            <Select value={category} onChange={setCategory} options={["All categories", ...CATEGORIES]} />
            <Select value={manager} onChange={setManager} options={["Auto (Recommended)", "WinGet"]} />
            <Select value={audience} onChange={setAudience} options={["Everyone", "FOSS only"]} />
            <span className="spacer" />
            <button className="btn" disabled={!selected.size} onClick={installSelected}>Install Selected</button>
            <button className="btn danger" onClick={() => api.upgradeAll()}>Upgrade All</button>
            <button className="btn" onClick={getInstalled}>Get Installed</button>
            <button className="btn" onClick={() => setSelected(new Set(visible.map((a) => a.id)))}>Select All</button>
            <button className="btn" onClick={() => setSelected(new Set())}>Deselect All</button>
          </div>

          <div className="scroll">
            {(category === "All categories" ? CATEGORIES : [category]).map((cat) => {
              const items = visible.filter((a) => a.category === cat);
              if (!items.length) return null;
              return (
                <section key={cat}>
                  <h2>{cat}</h2>
                  <div className="grid">
                    {items.map((a) => (
                      <AppTile key={a.id} app={a} checked={selected.has(a.id)} installed={installed.has(a.id)} onToggle={() => toggle(a.id)} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </main>}
      </div>

      <footer className="statusbar">
        <span>Selected: <b>{selected.size}</b>  Manager: <b>WinGet</b></span>
        <span>{status}</span>
      </footer>
    </div>
  );
}
