import React, { memo } from "react";
import { Package, Wrench, Settings, Bug, RefreshCw, Minus, Square, X, Check } from "lucide-react";
import { cx } from "./ui.jsx";
import logo from "../assets/logo.svg";

export const TABS = [
  ["install", Package, "Apps"],
  ["tweaks", Wrench, "Tweaks"],
  ["config", Settings, "Config"],
  ["updates", RefreshCw, "Updates"],
  ["report", Bug, "Report"],
];

const hue = (s) => [...s].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
const clamp = (n) => Math.min(100, Math.max(0, n));

export function TitleBar({ title, api }) {
  const btn = "grid w-[46px] place-items-center text-muted transition hover:bg-white/8 hover:text-text";
  return (
    <header className="app-drag flex h-8 items-center justify-between bg-chrome pl-3.5">
      <span className="text-xs font-medium text-faint">{title}</span>
      <div className="app-no-drag flex h-full">
        <button className={btn} onClick={api.min} title="Minimize" aria-label="Minimize"><Minus size={14} /></button>
        <button className={btn} onClick={api.max} title="Maximize" aria-label="Maximize"><Square size={12} /></button>
        <button className={cx(btn, "hover:bg-danger hover:text-ink")} onClick={api.close} title="Close" aria-label="Close">
          <X size={15} />
        </button>
      </div>
    </header>
  );
}

export function Rail({ tab, onTab, selectedCount, installedCount = 0, manager = "" }) {
  return (
    <nav className="flex w-[188px] flex-none flex-col bg-rail px-3 pt-5 pb-3" aria-label="Sections">
      <div className="mb-7 flex items-center gap-2.5 px-2">
        <img src={logo} alt="" className="size-7 flex-none" draggable={false} />
        <span className="font-display text-[19px] leading-none font-semibold tracking-wide">OpenWinPatcher</span>
      </div>

      <div className="flex flex-col gap-0.5">
        {TABS.map(([id, Icon, title]) => {
          const active = tab === id;
          return (
            <button
              key={id}
              aria-current={active ? "page" : undefined}
              onClick={() => onTab(id)}
              className={cx(
                "relative flex h-10 items-center gap-3 rounded-lg px-3 text-left font-medium transition duration-150",
                active ? "bg-panel-2 text-text" : "text-muted hover:bg-panel hover:text-text"
              )}
            >
              <span
                className={cx(
                  "absolute top-2 bottom-2 left-0 w-[3px] rounded-r bg-accent transition-opacity duration-200",
                  active ? "opacity-100" : "opacity-0"
                )}
              />
              <Icon size={17} className={active ? "text-accent" : undefined} />
              <span className="flex-1">{title}</span>
              {id === "install" && selectedCount > 0 && (
                <span
                  key={selectedCount}
                  className="grid h-5 min-w-5 animate-pop place-items-center rounded-full bg-accent-strong px-1.5 text-[11px] leading-none font-semibold text-ink tabular-nums"
                >
                  {selectedCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <dl className="mt-auto grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 rounded-[10px] border border-line px-3 py-3 text-[13px]">
        <dt className="text-muted">Selected</dt>
        <dd className="text-right font-medium tabular-nums">{selectedCount}</dd>
        <dt className="text-muted">Installed</dt>
        <dd className="text-right font-medium tabular-nums">{installedCount}</dd>
        <dt className="col-span-2 mt-1 border-t border-line pt-2 text-xs leading-snug text-muted">{manager}</dt>
      </dl>
    </nav>
  );
}

export const AppTile = memo(function AppTile({ app, checked, installed, onToggle, disabled, unavailable }) {
  return (
    <button
      aria-pressed={checked}
      disabled={disabled || unavailable}
      title={unavailable ? "No Chocolatey package for this app. Switch to WinGet or Auto." : undefined}
      onClick={() => onToggle(app.id)}
      className={cx(
        "relative flex min-h-[64px] items-center gap-3 rounded-[10px] border px-3.5 text-left transition duration-150 active:enabled:translate-y-px disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "border-accent/50 bg-accent/8" : "border-line bg-panel hover:border-line-2 hover:bg-panel-2"
      )}
    >
      <span
        className="grid size-9 flex-none place-items-center rounded-lg font-display text-[19px] font-semibold text-white/95"
        style={{ background: `hsl(${hue(app.name)} 38% 34%)` }}
      >
        {app.name[0]}
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-px">
        <span className="truncate font-medium">{app.name}</span>
        {unavailable ? (
          <span className="text-xs text-faint">WinGet only</span>
        ) : (
          <span className="text-xs text-muted">
            {installed ? "Installed" : app.foss ? "Open source" : "\u00A0"}
          </span>
        )}
      </span>

      <span
        className={cx(
          "grid size-[18px] flex-none place-items-center rounded-full border transition duration-150",
          checked ? "border-transparent bg-accent text-ink" : installed ? "border-ok/50 text-ok" : "border-line-2 text-transparent"
        )}
        aria-hidden="true"
      >
        <Check size={11} strokeWidth={3.5} />
      </span>
    </button>
  );
});

export function ProgressPanel({ running, error, label, progress, status }) {
  const pct = clamp(progress);
  const tone = error ? "text-danger-strong" : running ? "text-accent" : "text-faint";

  return (
    <div
      role="status"
      aria-live="polite"
      className={cx(
        "my-4 rounded-xl border bg-panel px-4 py-3 transition-colors duration-300",
        error ? "border-danger/50" : running ? "border-accent/40" : "border-line"
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2.5 font-medium">
          {running && (
            <span className="inline-block size-3 flex-none animate-spin-fast rounded-full border-2 border-accent/20 border-t-accent" />
          )}
          <span className="truncate">{label || "Ready"}</span>
          <span className={cx("flex-none text-xs font-normal", tone)}>
            {running ? "Running" : error ? "Failed" : "Idle"}
          </span>
        </div>
        <strong className="font-display text-[22px] leading-none font-semibold tabular-nums">{Math.round(pct)}%</strong>
      </div>

      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-white/6"
      >
        <div
          style={{ width: `${pct}%` }}
          className={cx(
            "h-full rounded-full transition-[width,background] duration-[600ms] ease-out-expo",
            error ? "bg-danger" : running ? "progress-stripes min-w-1.5" : "bg-accent-strong"
          )}
        />
      </div>

      <p className="mt-2 truncate text-[13px] text-muted">{status || "Waiting for operation"}</p>
    </div>
  );
}





export function StandardProgress({ running, error, label, progress, status }) {
  const pct = clamp(progress);
  const done = !running && !error && pct >= 100;

  return (
    <div role="status" aria-live="polite" className="my-4 w-full">
      <div className="mb-2 flex items-baseline justify-between gap-4">
        <span className="min-w-0 truncate text-sm font-medium">{label || "Ready"}</span>
        <span
          className={cx(
            "flex-none text-sm font-semibold tabular-nums transition-colors duration-300",
            error ? "text-danger-strong" : running || done ? "text-accent" : "text-faint"
          )}
        >
          {Math.round(pct)}%
        </span>
      </div>

      <div
        role="progressbar"
        aria-label={label || "Progress"}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        className="relative h-2.5 w-full overflow-hidden rounded-full bg-white/8"
      >
        <div
          style={{ width: `${pct}%` }}
          className={cx(
            "relative h-full rounded-full transition-[width,background-color,box-shadow] duration-500 ease-out-expo",
            error
              ? "bg-danger shadow-[0_0_12px_-2px] shadow-danger/60"
              : running
                ? "progress-stripes min-w-2.5 shadow-[0_0_12px_-2px] shadow-accent/60"
                : "bg-accent-strong"
          )}
        >
          {/* soft highlight on top edge for a glossy look */}
          <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-full bg-white/20" />
        </div>
      </div>

      <p className={cx("mt-2 truncate text-xs", error ? "text-danger-strong" : "text-muted")}>
        {status || "Waiting for operation"}
      </p>
    </div>
  );
}



export function TweaksProgress({ running, error, label, progress, status }) {
  const pct = clamp(progress);
  const done = !running && !error && pct >= 100;

  const state = error ? "Failed" : running ? "Running" : done ? "Done" : "Idle";

  const dot = error
    ? "bg-danger"
    : running
      ? "bg-accent animate-pulse"
      : done
        ? "bg-accent-strong"
        : "bg-faint";

  return (
    <div
      role="status"
      aria-live="polite"
      className={cx(
        "mt-3 mb-4 flex-none overflow-hidden rounded-xl border bg-panel transition-colors duration-300",
        error ? "border-danger/40" : running ? "border-accent/30" : "border-line"
      )}
    >
      {/* Edge-to-edge bar */}
      <div
        role="progressbar"
        aria-label={label || "Progress"}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        className="h-1 w-full bg-white/6"
      >
        <div
          style={{ width: `${pct}%` }}
          className={cx(
            "h-full transition-[width,background-color] duration-500 ease-out-expo",
            error ? "bg-danger" : running ? "progress-stripes min-w-1.5" : "bg-accent-strong"
          )}
        />
      </div>

      <div className="flex items-center gap-3 px-4 py-2.5">
        <span className={cx("size-2 flex-none rounded-full", dot)} aria-hidden />

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="truncate text-sm font-medium">{label || "Ready"}</span>
            <span
              className={cx(
                "flex-none text-[11px] font-medium tracking-wide uppercase",
                error ? "text-danger-strong" : running || done ? "text-accent" : "text-faint"
              )}
            >
              {state}
            </span>
          </div>
          <p className={cx("truncate text-xs", error ? "text-danger-strong" : "text-muted")}>
            {status || "Waiting for operation"}
          </p>
        </div>

        <strong className="flex-none font-display text-lg leading-none font-semibold tabular-nums">
          {Math.round(pct)}%
        </strong>
      </div>
    </div>
  );
}
