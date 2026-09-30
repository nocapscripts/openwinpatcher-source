import React, { useState } from "react";
import { TWEAKS, FEATURES, PREFS, FIXES, PANELS, UPDATES } from "./tweaks/tweaks.js";

function Checklist({ items, run, actions }) {
  const [sel, setSel] = useState(new Set());
  const toggle = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const chosen = () => items.filter((i) => sel.has(i.id));
  return (
    <>
      <div className="toolbar">
        {actions.map(([label, key, danger]) => (
          <button key={label} className={"btn" + (danger ? " danger" : "")} disabled={!sel.size}
            onClick={() => run(chosen().filter((i) => i[key]).map((i) => i[key]).join("\n"), label)}>{label}</button>
        ))}
        <button className="btn" onClick={() => setSel(new Set(items.map((i) => i.id)))}>Select All</button>
        <button className="btn" onClick={() => setSel(new Set())}>Deselect All</button>
      </div>
      <div className="list scroll">
        {items.map((i) => (
          <label key={i.id} className="row">
            <input type="checkbox" checked={sel.has(i.id)} onChange={() => toggle(i.id)} />
            <span><b>{i.name}</b>{i.desc && <small>{i.desc}</small>}</span>
          </label>
        ))}
      </div>
    </>
  );
}

export function Tweaks({ run }) {
  return (<><h1>Tweaks</h1><p className="note">Changes need admin rights. Create a restore point first.</p>
    <Checklist items={TWEAKS} run={run} actions={[["Run Tweaks", "apply"], ["Undo Selected", "undo"]]} /></>);
}

function Switches({ run }) {
  const [on, setOn] = useState({});
  return (
    <div className="list">
      {PREFS.map((p) => (
        <label key={p.id} className="row">
          <input type="checkbox" className="switch" checked={!!on[p.id]}
            onChange={(e) => { setOn({ ...on, [p.id]: e.target.checked }); run(e.target.checked ? p.on : p.off, p.name); }} />
          <span><b>{p.name}</b></span>
        </label>
      ))}
    </div>
  );
}

export function Config({ run }) {
  return (
    <div className="scroll">
      <h1>Config</h1>
      <h2>Features</h2>
      <Checklist items={FEATURES} run={run} actions={[["Install Features", "apply"]]} />
      <h2>Customize Preferences</h2>
      <Switches run={run} />
      <h2>Fixes</h2>
      <div className="grid">{FIXES.map((f) => (
        <button key={f.name} className="tile col" onClick={() => run(f.run, f.name)}><b>{f.name}</b><small>{f.desc}</small></button>))}</div>
      <h2>Legacy Windows Panels</h2>
      <div className="grid">{PANELS.map((p) => (
        <button key={p.name} className="tile" onClick={() => run(p.run, p.name)}><b>{p.name}</b></button>))}</div>
    </div>
  );
}

export function Updates({ run }) {
  return (
    <>
      <h1>Updates</h1>
      <div className="toolbar"><button className="btn" onClick={() => run("Start-Process ms-settings:windowsupdate", "Open Windows Update")}>Open Windows Update</button></div>
      <div className="grid wide">{UPDATES.map((u) => (
        <button key={u.name} className={"tile col" + (u.danger ? " bad" : "")} onClick={() => run(u.run, u.name)}><b>{u.name}</b><small>{u.desc}</small></button>))}</div>
    </>
  );
}
