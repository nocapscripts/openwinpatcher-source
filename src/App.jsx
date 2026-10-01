import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Menu,
  Package,
  Wrench,
  Settings,
  Bug,
  RefreshCw,
  Search,
  ChevronDown,
  Minus,
  Square,
  X,
  Check,
  SquareTerminal,
} from "lucide-react";

import { APPS, CATEGORIES } from "./tweaks/apps.js";
import Report from "./Report.jsx";
import { Tweaks, Config, Updates } from "./Pages.jsx";

/* ------------------------------------------------------------------ */
/* Setup                                                               */
/* ------------------------------------------------------------------ */

// Browser fallback so the UI can be previewed without Electron
const api = window.api ?? {
  min() {},
  max() {},
  close() {},
  onProgress() {},
  ps: async () => ({ code: 0 }),
  install: async () => [],
  upgradeAll: async () => true,
  installed: async () => [],
};

const ALL_IDS = APPS.map((a) => a.id);

const TABS = [
  ["install", Package, "Install"],
  ["tweaks", Wrench, "Tweaks"],
  ["config", Settings, "Config"],
  ["updates", RefreshCw, "Updates"],
  ["report", Bug, "Report"],
];

const hue = (s) =>
  [...s].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;

const clamp = (n) => Math.min(100, Math.max(0, n));
const errorMessage = (e) => e?.message || String(e);

/* ------------------------------------------------------------------ */
/* Small components                                                    */
/* ------------------------------------------------------------------ */

function TitleBar({ title }) {
  return (
    <header className="titlebar">
      <span className="title">{title}</span>

      <div className="win-btns">
        <button onClick={api.min} title="Minimize" aria-label="Minimize">
          <Minus size={14} />
        </button>
        <button onClick={api.max} title="Maximize" aria-label="Maximize">
          <Square size={12} />
        </button>
        <button onClick={api.close} title="Close" aria-label="Close">
          <X size={15} />
        </button>
      </div>
    </header>
  );
}

function Rail({ tab, onTab, selectedCount }) {
  return (
    <nav className="rail" aria-label="Sections">
      <Menu size={18} />

      {TABS.map(([id, Icon, title]) => (
        <button
          key={id}
          title={title}
          aria-label={title}
          aria-current={tab === id ? "page" : undefined}
          className={tab === id ? "active" : ""}
          onClick={() => onTab(id)}
        >
          <Icon size={18} />

          {id === "install" && selectedCount > 0 && (
            <span className="badge" key={selectedCount}>
              {selectedCount}
            </span>
          )}
        </button>
      ))}
    </nav>
  );
}

function Select({ value, onChange, options, label }) {
  return (
    <label className="select">
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>

      <ChevronDown size={14} />
    </label>
  );
}

const AppTile = memo(function AppTile({
  app,
  checked,
  installed,
  onToggle,
  disabled,
}) {
  return (
    <button
      className={"tile" + (checked ? " on" : "")}
      aria-pressed={checked}
      onClick={() => onToggle(app.id)}
      disabled={disabled}
    >
      <span
        className="icon"
        style={{ background: `hsl(${hue(app.name)} 55% 45%)` }}
      >
        {app.name[0]}
      </span>

      <span className="label">
        <span className="name">{app.name}</span>
        {app.foss && <span className="tag">FOSS</span>}
      </span>

      {installed && <Check size={14} className="ok" aria-label="Installed" />}
    </button>
  );
});

function ProgressPanel({ running, error, label, progress, status, onOpenTerminal }) {
  const pct = clamp(progress);

  return (
    <div
      className={
        "progress-panel" + (running ? " is-running" : "") + (error ? " is-error" : "")
      }
      role="status"
      aria-live="polite"
    >
      <div className="progress-header">
        <div className="progress-title">
          {running && <span className="progress-spinner" />}
          <span>{label || "Ready"}</span>
        </div>

        <div className="progress-actions">
          <button
            className="progress-term"
            onClick={onOpenTerminal}
            title="Show the PowerShell output window"
          >
            <SquareTerminal size={13} />
            Terminal
            {running && <span className="live-dot" />}
          </button>

          <strong>{Math.round(pct)}%</strong>
        </div>
      </div>

      <div
        className="progress-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
      >
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>

      <div className="progress-footer">
        <span>{status || "Waiting for operation"}</span>
        <span>{running ? "Running" : error ? "Failed" : "Idle"}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* App                                                                 */
/* ------------------------------------------------------------------ */

export default function App() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All categories");
  const [manager, setManager] = useState("Auto (Recommended)");
  const [audience, setAudience] = useState("Everyone");

  const [selected, setSelected] = useState(new Set());
  const [installed, setInstalled] = useState(new Set());

  const [sys, setSys] = useState(null);
  const [status, setStatus] = useState("");
  const [tab, setTab] = useState("install");

  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("Ready");

  const [isRunning, setIsRunning] = useState(false);
  const [hasError, setHasError] = useState(false);

  const searchRef = useRef(null);

  /* ---------------- system info ---------------- */
  useEffect(() => {
    window.api?.sysInfo?.().then(setSys);
  }, []);

  /* ---------------- keyboard shortcuts ----------------
   * Ctrl+F focuses search, Esc clears it while focused.
   */
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setTab("install");
        // wait for the install page to mount if we came from another tab
        setTimeout(() => searchRef.current?.focus(), 50);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* ---------------- logging helpers ---------------- */
  // output is written to the PowerShell window opened by the main process
  const appendLog = useCallback((...lines) => {
    api.termAppend?.(lines);
  }, []);

  const logError = useCallback(
    (message) => appendLog("", `[ERROR] ${message}`),
    [appendLog]
  );

  /* ---------------- progress / PowerShell events ----------------
   * {
   *   progress: 50,
   *   label: "Installing Firefox",
   *   status: "Installing Firefox...",
   *   done: false
   * }
   */
  useEffect(() => {
    if (!api.onProgress) return;

    const cleanup = api.onProgress((event) => {
      // backwards compatibility: a plain string is just a status
      if (typeof event === "string") {
        setStatus(event);
        return;
      }

      if (!event) return;

      if (event.status !== undefined) setStatus(event.status);
      if (event.label !== undefined) setProgressLabel(event.label);
      if (typeof event.progress === "number") setProgress(clamp(event.progress));

      if (event.done) {
        setIsRunning(false);
        if (typeof event.progress !== "number") setProgress(100);
      }
    });

    return typeof cleanup === "function" ? cleanup : undefined;
  }, [appendLog]);

  /* ---------------- operation helpers ---------------- */
  const begin = (label, firstLines) => {
    setIsRunning(true);
    setHasError(false);
    setProgress(0);
    setProgressLabel(label);
    setStatus(`${label}…`);

    if (firstLines) {
      api.termClear?.();
      api.termAppend?.(firstLines);
    }
  };

  const refreshInstalled = async () => {
    try {
      setInstalled(new Set(await api.installed(ALL_IDS)));
    } catch {
      // the operation itself succeeded, so don't overwrite the status
    }
  };

  /* ---------------- filtering ---------------- */
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();

    return APPS.filter(
      (a) =>
        (category === "All categories" || a.category === category) &&
        (audience === "Everyone" || a.foss) &&
        a.name.toLowerCase().includes(q)
    );
  }, [query, category, audience]);

  /* ---------------- selection ---------------- */
  const toggle = useCallback((id) => {
    setSelected((current) => {
      const next = new Set(current);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const selectAll = () => setSelected(new Set(visible.map((a) => a.id)));
  const deselectAll = () => setSelected(new Set());

  /* ---------------- actions ---------------- */
  const runPs = async (script, label) => {
    if (isRunning) return { code: 1, error: "Another operation is running" };

    begin(label, [`PS> ${label}`, ""]);

    try {
      const result = await api.ps(script);

      if (result?.code === 0) {
        setProgress(100);
        setStatus(`${label}: done`);
      } else {
        setHasError(true);
        setStatus(`${label}: failed (run the app as administrator)`);
      }

      return result;
    } catch (error) {
      const message = errorMessage(error);
      logError(message);
      setHasError(true);
      setStatus(`${label}: failed`);
      return { code: 1, error: message };
    } finally {
      setIsRunning(false);
    }
  };

  const getInstalled = async () => {
    begin("Checking installed apps");

    try {
      const result = await api.installed(ALL_IDS);
      setInstalled(new Set(result));
      setProgress(100);
      setStatus("Installed apps checked");
    } catch (error) {
      const message = errorMessage(error);
      setHasError(true);
      setStatus(`Failed to check installed apps: ${message}`);
      appendLog(`[ERROR] ${message}`);
    } finally {
      setIsRunning(false);
    }
  };

  const installSelected = async () => {
    const apps = APPS.filter((a) => selected.has(a.id));
    if (!apps.length || isRunning) return;

    begin("Installing applications", ["PS> Starting installation...", ""]);

    try {
      const results = await api.install(apps);
      const failed = (Array.isArray(results) ? results : []).filter((r) => !r.ok);

      setProgress(100);

      if (failed.length) {
        const names = failed.map(
          (f) => APPS.find((a) => a.id === f.id)?.name ?? f.id
        );
        setHasError(true);
        setProgressLabel("Installation finished with errors");
        setStatus(
          `${apps.length - failed.length}/${apps.length} installed. Failed: ${names.join(", ")}`
        );
        setSelected(new Set(failed.map((f) => f.id))); // keep failures selected for a retry
      } else {
        setProgressLabel("Installation complete");
        setStatus("Installation completed");
        setSelected(new Set());
      }

      await refreshInstalled();
    } catch (error) {
      const message = errorMessage(error);
      setHasError(true);
      setStatus(`Installation failed: ${message}`);
      logError(message);
    } finally {
      setIsRunning(false);
    }
  };

  const upgradeAll = async () => {
    if (isRunning) return;

    begin("Upgrading applications", ["PS> Starting upgrade...", ""]);

    try {
      const result = await api.upgradeAll();
      if (result === false) throw new Error("Upgrade operation failed");

      setProgress(100);
      setProgressLabel("Upgrade complete");
      setStatus("Upgrade completed");

      await refreshInstalled();
    } catch (error) {
      const message = errorMessage(error);
      setHasError(true);
      setStatus(`Upgrade failed: ${message}`);
      logError(message);
    } finally {
      setIsRunning(false);
    }
  };

  /* ---------------- derived ---------------- */
  const sections = (category === "All categories" ? CATEGORIES : [category])
    .map((cat) => [cat, visible.filter((a) => a.category === cat)])
    .filter(([, items]) => items.length > 0);

  const effectiveManager =
    manager === "Auto (Recommended)" ? "WinGet" : manager;

  /* ---------------- render ---------------- */
  return (
    <div className="app">
      <TitleBar
        title={
          sys ? `Open Windows Patcher - ${sys.app}` : "Open Windows Patcher"
        }
      />

      <div className="body">
        <Rail tab={tab} onTab={setTab} selectedCount={selected.size} />

        {tab === "tweaks" && (
          <main>
            <Tweaks run={runPs} />
          </main>
        )}

        {tab === "config" && (
          <main>
            <Config run={runPs} />
          </main>
        )}

        {tab === "updates" && (
          <main>
            <Updates run={runPs} />
          </main>
        )}

        {tab === "report" && (
          <main>
            <Report lastStatus={status} />
          </main>
        )}

        {tab === "install" && (
          <main>
            <h1>Applications</h1>

            <div className="toolbar">
              <label className="search">
                <Search size={14} />

                <input
                  ref={searchRef}
                  placeholder="Search packages…  (Ctrl+F)"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Escape" && setQuery("")}
                  disabled={isRunning}
                />

                {query && !isRunning && (
                  <button
                    type="button"
                    className="search-clear"
                    onClick={() => setQuery("")}
                    aria-label="Clear search"
                  >
                    <X size={12} />
                  </button>
                )}
              </label>

              <Select
                label="Category"
                value={category}
                onChange={setCategory}
                options={["All categories", ...CATEGORIES]}
              />

              <Select
                label="Package manager"
                value={manager}
                onChange={setManager}
                options={["Auto (Recommended)", "WinGet"]}
              />

              <Select
                label="Audience"
                value={audience}
                onChange={setAudience}
                options={["Everyone", "FOSS only"]}
              />

              <span className="spacer" />

              <button
                className="btn primary"
                disabled={!selected.size || isRunning}
                onClick={installSelected}
              >
                {selected.size
                  ? `Install Selected (${selected.size})`
                  : "Install Selected"}
              </button>

              <button
                className="btn danger"
                disabled={isRunning}
                onClick={upgradeAll}
              >
                Upgrade All
              </button>

              <button
                className="btn"
                disabled={isRunning}
                onClick={getInstalled}
              >
                Get Installed
              </button>

              <button
                className="btn"
                disabled={isRunning || !visible.length}
                onClick={selectAll}
              >
                Select All
              </button>

              <button
                className="btn"
                disabled={isRunning || !selected.size}
                onClick={deselectAll}
              >
                Deselect All
              </button>
            </div>

            <ProgressPanel
              running={isRunning}
              error={hasError}
              label={progressLabel}
              progress={progress}
              status={status}
              onOpenTerminal={() => api.termOpen?.()}
            />

            <div className="scroll">
              {sections.length === 0 ? (
                <div className="empty">
                  <strong>No packages found</strong>
                  <span>
                    Try a different search, or switch the category or audience
                    filter.
                  </span>
                </div>
              ) : (
                sections.map(([cat, items]) => (
                  <section key={cat}>
                    <h2>
                      {cat}
                      <span className="count">{items.length}</span>
                    </h2>

                    <div className="grid">
                      {items.map((a) => (
                        <AppTile
                          key={a.id}
                          app={a}
                          checked={selected.has(a.id)}
                          installed={installed.has(a.id)}
                          disabled={isRunning}
                          onToggle={toggle}
                        />
                      ))}
                    </div>
                  </section>
                ))
              )}
            </div>
          </main>
        )}
      </div>

      <footer className="statusbar">
        <span>
          Selected: <b>{selected.size}</b>
          {"  "}
          Installed: <b>{installed.size}</b>
          {"  "}
          Manager: <b>{effectiveManager}</b>
        </span>

        <span>
          {isRunning && (
            <>
              <span className="status-spinner" />{" "}
            </>
          )}
          {status}
        </span>
      </footer>
    </div>
  );
}
