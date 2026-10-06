import React, { useCallback, useEffect, useState } from "react";
import { TWEAKS, FEATURES, PREFS, FIXES, PANELS, UPDATES } from "./tweaks/tweaks.js";
import {
  Btn, Checkbox, Grid, H1, H2, List, Note, Row, RowText, Scroll, Switch, Tile, Toolbar,
} from "./components/ui.jsx";

import { ProgressPanel } from "./components/Shell.jsx";


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
  const allSelected = items.length > 0 && sel.size === items.length;

  const go = async (label, key) => {
    await run(chosen().filter((i) => i[key]).map((i) => i[key]).join("\n"), label);
    refresh?.(); // re-check so the badges update after the run finishes
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Selection header (fixed) */}
      <div className="flex flex-none items-center justify-between gap-3 pb-2">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-muted select-none">
          <Checkbox
            checked={allSelected}
            onChange={() => setSel(allSelected ? new Set() : new Set(items.map((i) => i.id)))}
          />
          {allSelected ? "Deselect all" : "Select all"}
        </label>
        {refresh && (
          <Btn onClick={refresh}>Refresh Status</Btn>
        )}
      </div>

      {/* Only this part scrolls */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <List>
          {items.map((i) => (
            <Row key={i.id}>
              <Checkbox checked={sel.has(i.id)} onChange={() => toggle(i.id)} />
              <RowText title={i.name} desc={i.desc} />
              <Badge value={status[i.id]} />
            </Row>
          ))}
        </List>
      </div>

      {/* Action bar (fixed) */}
      <div className="flex flex-none items-center justify-between gap-3 border-t border-line bg-panel/80 px-1 pt-3 backdrop-blur">
        <span className="text-sm text-muted tabular-nums">
          {sel.size ? `${sel.size} of ${items.length} selected` : "Nothing selected"}
        </span>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {sel.size > 0 && <Btn onClick={() => setSel(new Set())}>Clear</Btn>}
          {actions.map(([label, key, danger]) => (
            <Btn
              key={label}
              variant={danger ? "danger" : "default"}
              disabled={!sel.size}
              onClick={() => go(label, key)}
            >
              {label}
            </Btn>
          ))}
        </div>
      </div>
    </div>
  );
}

export function Tweaks({ run }) {
  const { status, loading, refresh } = useStatus(false);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header (fixed) */}
      <div className="flex flex-none items-center justify-between gap-4">
        <H1>Tweaks</H1>
        {loading && (
          <span className="flex items-center gap-2 text-xs text-muted">
            <span className="inline-block size-3 animate-spin-fast rounded-full border-2 border-accent/20 border-t-accent" />
            Checking current state…
          </span>
        )}
      </div>

      {/* Warning callout (fixed) */}
      <div
        role="note"
        className="mb-4 flex flex-none items-start gap-3 rounded-lg border border-danger/30 bg-danger/5 px-3.5 py-2.5 text-[13px] text-muted"
      >
        <span aria-hidden className="mt-px text-danger-strong">⚠</span>
        <p>
          <span className="font-medium text-danger-strong">Admin rights required.</span>{" "}
          Create a restore point before applying tweaks so you can roll back if something breaks.
        </p>
      </div>

      {/* Checklist owns the scroll area and the action bar */}
      <div className="min-h-0 flex-1">
        <Checklist
          items={TWEAKS}
          run={run}
          status={status}
          refresh={refresh}
          actions={[
            ["Run Tweaks", "apply"],
            ["Undo Selected", "undo"],
          ]}
        />
      </div>
    </div>
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
