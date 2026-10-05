import React, { useCallback, useEffect, useState } from "react";
import { TWEAKS, FEATURES, PREFS, FIXES, PANELS, UPDATES } from "./tweaks/tweaks.js";
import {
  Btn, Checkbox, Grid, H1, H2, List, Note, Row, RowText, Scroll, Switch, Tile, Toolbar,
} from "./components/ui.jsx";

// Reads system state through the main process (reg/fs, no PowerShell) once on mount and again whenever refresh() is called.
function useStatus(features = false) {
  const [status, setStatus] = useState({});
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setStatus(await window.api.getStatus({ features }));
    } catch {
      setStatus({});
    }
    setLoading(false);
  }, [features]);

  useEffect(() => { refresh(); }, [refresh]);
  return { status, loading, refresh };
}

// Small pill shown on each row. Items with no check (undefined) show nothing.
function Badge({ value }) {
  if (value === undefined) return null;
  return <span className={`badge ${value ? "badge-on" : "badge-off"}`}>{value ? "Applied" : "Not applied"}</span>;
}

function Checklist({ items, run, actions, status = {}, refresh }) {
  const [sel, setSel] = useState(new Set());

  const toggle = (id) =>
    setSel((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const chosen = () => items.filter((i) => sel.has(i.id));

  const go = async (label, key) => {
    await run(chosen().filter((i) => i[key]).map((i) => i[key]).join("\n"), label);
    refresh?.(); // re-check so the badges update after the run finishes
  };

  return (
    <>
      <Toolbar>
        {actions.map(([label, key, danger]) => (
          <Btn key={label} variant={danger ? "danger" : "default"} disabled={!sel.size} onClick={() => go(label, key)}>
            {label}
          </Btn>
        ))}
        <Btn onClick={() => setSel(new Set(items.map((i) => i.id)))}>Select All</Btn>
        <Btn onClick={() => setSel(new Set())}>Deselect All</Btn>
        {refresh && <Btn onClick={refresh}>Refresh Status</Btn>}
      </Toolbar>

      <List>
        {items.map((i) => (
          <Row key={i.id}>
            <Checkbox checked={sel.has(i.id)} onChange={() => toggle(i.id)} />
            <RowText title={i.name} desc={i.desc} />
            <Badge value={status[i.id]} />
          </Row>
        ))}
      </List>
    </>
  );
}

export function Tweaks({ run }) {
  const { status, loading, refresh } = useStatus(false);
  return (
    <>
      <H1>Tweaks</H1>
      <Note>
        Changes need admin rights. Create a restore point first.
        {loading && " Checking current state..."}
      </Note>
      <Scroll>
        <Checklist
          items={TWEAKS}
          run={run}
          status={status}
          refresh={refresh}
          actions={[["Run Tweaks", "apply"], ["Undo Selected", "undo"]]}
        />
      </Scroll>
    </>
  );
}

function Switches({ run, status, refresh }) {
  const [on, setOn] = useState({});
  return (
    <List>
      {PREFS.map((p) => (
        <Row key={p.id}>
          <Switch
            // real system state wins; local state covers the moment before the re-check finishes
            checked={status[p.id] ?? !!on[p.id]}
            onChange={async (e) => {
              const v = e.target.checked;
              setOn({ ...on, [p.id]: v });
              await run(v ? p.on : p.off, p.name);
              refresh();
            }}
          />
          <RowText title={p.name} />
        </Row>
      ))}
    </List>
  );
}

export function Config({ run }) {
  const { status, refresh } = useStatus(true); // true = also check Windows features

  return (
    <Scroll>
      <H1>Config</H1>
      <H2>Features</H2>
      <Checklist items={FEATURES} run={run} actions={[["Install Features", "apply"]]} status={status} refresh={refresh} />

      <H2>Customize Preferences</H2>
      <Switches run={run} status={status} refresh={refresh} />

      <H2>Fixes</H2>
      <Grid>
        {FIXES.map((f) => (
          <Tile key={f.name} col onClick={() => run(f.run, f.name)}>
            <b>{f.name}</b>
            <small className="text-xs text-muted">{f.desc}</small>
          </Tile>
        ))}
      </Grid>

      <H2>Legacy Windows Panels</H2>
      <Grid>
        {PANELS.map((p) => (
          <Tile key={p.name} onClick={() => run(p.run, p.name)}>
            <b>{p.name}</b>
          </Tile>
        ))}
      </Grid>
    </Scroll>
  );
}

export function Updates({ run }) {
  return (
    <>
      <H1>Updates</H1>
      <Toolbar>
        <Btn onClick={() => run("Start-Process ms-settings:windowsupdate", "Open Windows Update")}>
          Open Windows Update
        </Btn>
      </Toolbar>
      <Grid wide>
        {UPDATES.map((u) => (
          <Tile key={u.name} col bad={u.danger} onClick={() => run(u.run, u.name)}>
            <b>{u.name}</b>
            <small className="text-xs text-muted">{u.desc}</small>
          </Tile>
        ))}
      </Grid>
    </>
  );
}
