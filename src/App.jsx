import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";

import { APPS, CATEGORIES } from "./tweaks/apps.js";
import Report from "./Report.jsx";
import { Tweaks, Config, Updates } from "./Pages.jsx";
import { AppTile, ProgressPanel, Rail, TitleBar } from "./components/Shell.jsx";
import { Btn, H1, H2, Main, Scroll, Select, Toolbar } from "./components/ui.jsx";

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
  pmStatus: async () => ({ winget: true, choco: false }),
};

// UI label -> value understood by the Electron main process
const MANAGERS = {
  "Auto (Recommended)": "auto", // WinGet first, Chocolatey as fallback
  WinGet: "winget",
  Chocolatey: "choco",
};

const APP_REFS = APPS.map(({ id, choco }) => ({ id, choco }));
const BY_ID = Object.fromEntries(APPS.map((a) => [a.id, a]));

const CHOCO_INSTALL_SCRIPT =
  "Set-ExecutionPolicy Bypass -Scope Process -Force; " +
  "[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; " +
  "iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))";

const clamp = (n) => Math.min(100, Math.max(0, n));
const errorMessage = (e) => e?.message || String(e);

export default function App() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All categories");
  const [manager, setManager] = useState("Auto (Recommended)");
  const [audience, setAudience] = useState("Everyone");

  const [selected, setSelected] = useState(new Set());
  const [installed, setInstalled] = useState(new Set());

  const [sys, setSys] = useState(null);
  const [pm, setPm] = useState({ winget: true, choco: false });
  const [status, setStatus] = useState("");
  const [tab, setTab] = useState("install");

  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("Ready");

  const [isRunning, setIsRunning] = useState(false);
  const [hasError, setHasError] = useState(false);

  const searchRef = useRef(null);

  const mode = MANAGERS[manager];
  // With Chocolatey selected, apps without a Chocolatey package can't be installed
  const available = useCallback((a) => mode !== "choco" || !!a.choco, [mode]);

  /* ---------------- system info + package managers ---------------- */
  const refreshPm = useCallback(async () => {
    try {
      setPm(await api.pmStatus());
    } catch {
      /* keep the previous value */
    }
  }, []);

  useEffect(() => {
    window.api?.sysInfo?.().then(setSys);
    refreshPm();
  }, [refreshPm]);

  // drop selected apps that the chosen manager can't install
  useEffect(() => {
    setSelected((cur) => {
      const next = new Set([...cur].filter((id) => available(BY_ID[id])));
      return next.size === cur.size ? cur : next;
    });
  }, [available]);

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
      setInstalled(new Set(await api.installed(APP_REFS)));
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

  const selectAll = () => setSelected(new Set(visible.filter(available).map((a) => a.id)));
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
      const result = await api.installed(APP_REFS);
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
    const apps = APPS.filter((a) => selected.has(a.id) && available(a));
    if (!apps.length || isRunning) return;

    begin("Installing applications", ["PS> Starting installation...", ""]);

    try {
      const results = await api.install(apps, mode);
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

  const installChocolatey = async () => {
    const result = await runPs(CHOCO_INSTALL_SCRIPT, "Install Chocolatey");
    await refreshPm();
    return result;
  };

  const upgradeAll = async () => {
    if (isRunning) return;

    begin("Upgrading applications", ["PS> Starting upgrade...", ""]);

    try {
      const result = await api.upgradeAll(mode);
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
    mode === "auto" ? "WinGet, then Chocolatey" : manager;
  const needChoco = mode === "choco" && !pm.choco;

  /* ---------------- render ---------------- */
  return (
    <div className="flex h-full flex-col">
      <TitleBar api={api} title={sys ? `Open Windows Patcher - ${sys.app}` : "Open Windows Patcher"} />

      <div className="flex min-h-0 flex-1">
        <Rail
          tab={tab}
          onTab={setTab}
          selectedCount={selected.size}
          installedCount={installed.size}
          manager={`Installing with ${effectiveManager}`}
        />

        {tab === "tweaks" && <Main><Tweaks run={runPs} /></Main>}
        {tab === "config" && <Main><Config run={runPs} /></Main>}
        {tab === "updates" && <Main><Updates run={runPs} /></Main>}
        {tab === "report" && <Main><Report lastStatus={status} /></Main>}

        {tab === "install" && (
          <Main>
            <H1 aside={`${visible.length} packages`}>Apps</H1>

            <Toolbar>
              <label className="flex h-9 w-[260px] items-center gap-2 rounded-lg border border-line-2 bg-panel px-3 text-muted transition duration-150 hover:border-faint focus-within:border-accent/60 focus-within:bg-panel-2 focus-within:text-accent focus-within:shadow-[0_0_0_3px_rgba(95,208,230,.14)]">
                <Search size={15} />
                <input
                  ref={searchRef}
                  className="min-w-0 flex-1 bg-transparent text-text outline-none placeholder:text-faint disabled:opacity-60"
                  placeholder="Search packages (Ctrl+F)"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Escape" && setQuery("")}
                  disabled={isRunning}
                />
                {query && !isRunning && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    aria-label="Clear search"
                    className="grid size-5 flex-none place-items-center rounded-full text-muted transition hover:bg-white/10 hover:text-text"
                  >
                    <X size={12} />
                  </button>
                )}
              </label>

              <Select label="Category" value={category} onChange={setCategory} options={["All categories", ...CATEGORIES]} />
              <Select label="Package manager" value={manager} onChange={setManager} options={Object.keys(MANAGERS)} />
              <Select label="Audience" value={audience} onChange={setAudience} options={["Everyone", "FOSS only"]} />

              <span className="flex-1" />

              {needChoco && (
                <Btn disabled={isRunning} onClick={installChocolatey} title="Installs Chocolatey with the official script">
                  Install Chocolatey
                </Btn>
              )}
              <Btn variant="ghost" disabled={isRunning} onClick={getInstalled}>Check installed</Btn>
              <Btn variant="danger" disabled={isRunning} onClick={upgradeAll}>Upgrade all</Btn>
            </Toolbar>

            <ProgressPanel
              running={isRunning}
              error={hasError}
              label={progressLabel}
              progress={progress}
              status={status}
            />

            <Scroll>
              {sections.length === 0 ? (
                <div className="flex flex-col items-center gap-1.5 px-4 py-14 text-center text-muted">
                  <strong className="text-base font-semibold text-text">No packages found</strong>
                  <span>Try a different search, or switch the category or audience filter.</span>
                </div>
              ) : (
                sections.map(([cat, items]) => (
                  <section key={cat}>
                    <H2 count={items.length}>{cat}</H2>
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-2.5">
                      {items.map((a) => (
                        <AppTile
                          key={a.id}
                          app={a}
                          checked={selected.has(a.id)}
                          installed={installed.has(a.id)}
                          disabled={isRunning}
                          unavailable={!available(a)}
                          onToggle={toggle}
                        />
                      ))}
                    </div>
                  </section>
                ))
              )}
            </Scroll>

            <div
              className={
                "mb-4 flex flex-none items-center gap-3 rounded-[14px] border border-line-2 bg-panel-2 px-4 py-3 shadow-[0_18px_40px_-20px_rgba(0,0,0,.9)] transition-all duration-300 ease-out-expo " +
                (selected.size ? "mt-3 translate-y-0 opacity-100" : "pointer-events-none mt-0 h-0 translate-y-3 overflow-hidden border-transparent py-0 opacity-0")
              }
              aria-hidden={!selected.size}
            >
              <span className="font-display text-xl font-semibold tabular-nums">{selected.size}</span>
              <span className="text-muted">selected</span>
              <span className="flex-1" />
              <Btn variant="ghost" disabled={isRunning || !visible.length} onClick={selectAll}>Select all</Btn>
              <Btn variant="ghost" disabled={isRunning || !selected.size} onClick={deselectAll}>Clear</Btn>
              <Btn variant="primary" disabled={!selected.size || isRunning} onClick={installSelected}>
                {selected.size ? `Install ${selected.size} ${selected.size === 1 ? "app" : "apps"}` : "Install"}
              </Btn>
            </div>
          </Main>
        )}
      </div>
    </div>
  );
}
