import React from "react";
import { ChevronDown } from "lucide-react";

export const cx = (...c) => c.filter(Boolean).join(" ");

const RING = "focus-visible:border-accent/60 focus-visible:shadow-[0_0_0_3px_rgba(95,208,230,.14)]";

/* ---------------- Typography ---------------- */
export const H1 = ({ children, aside }) => (
  <div className="mb-4 flex items-end justify-between gap-4">
    <h1 className="font-display text-[30px] leading-none font-semibold tracking-tight">{children}</h1>
    {aside && <span className="pb-0.5 text-[13px] text-muted">{aside}</span>}
  </div>
);

export const H2 = ({ children, count }) => (
  <h2 className="mt-7 mb-3 flex items-center gap-3 font-display text-[17px] font-medium tracking-wide text-text/90 after:h-px after:flex-1 after:bg-line after:content-['']">
    <span>
      {children}
      {count !== undefined && <span className="ml-2 font-sans text-xs text-faint tabular-nums">{count}</span>}
    </span>
  </h2>
);

export const Note = ({ children }) => <p className="mb-4 max-w-[66ch] text-[13.5px] leading-relaxed text-muted">{children}</p>;

/* ---------------- Layout ---------------- */
export const Main = ({ children }) => (
  <main className="flex min-h-0 min-w-0 flex-1 animate-page-in flex-col overflow-y-auto bg-bg px-7 pt-6">
    {children}
  </main>
);

export const Toolbar = ({ children }) => <div className="flex flex-wrap items-center gap-2">{children}</div>;
export const Scroll = ({ children, className }) => (
  <div className={cx("-mr-3 flex-1 overflow-y-auto pr-3", className)}>{children}</div>
);

/* ---------------- Buttons ---------------- */
const btnBase =
  "h-9 rounded-lg border px-4 font-medium transition duration-150 " +
  "active:enabled:translate-y-px disabled:cursor-not-allowed disabled:opacity-45";

const variants = {
  default:
    "border-line-2 bg-panel text-text " +
    "shadow-[0_1px_2px_rgba(0,0,0,.18)] " +
    "hover:enabled:border-white/15 hover:enabled:bg-panel-2 hover:enabled:text-white " +
    "active:enabled:bg-panel active:enabled:scale-[.98] " +
    "disabled:border-line disabled:bg-panel disabled:text-faint disabled:opacity-60",

  ghost:
    "border-transparent bg-transparent text-muted " +
    "hover:enabled:border-line-2 hover:enabled:bg-panel-2 hover:enabled:text-text " +
    "active:enabled:bg-panel active:enabled:scale-[.98] " +
    "disabled:text-faint disabled:opacity-50",

  primary:
    "border-accent/50 bg-accent-strong text-ink font-semibold " +
    "shadow-[0_0_18px_rgba(95,208,230,.12)] " +
    "hover:enabled:border-accent hover:enabled:bg-accent " +
    "hover:enabled:shadow-[0_0_24px_rgba(95,208,230,.22)] " +
    "active:enabled:scale-[.97] active:enabled:bg-accent-strong " +
    "disabled:border-line disabled:bg-panel disabled:text-faint disabled:shadow-none disabled:opacity-60",

  danger:
    "border-danger/40 bg-danger/10 text-danger-strong " +
    "shadow-[0_0_14px_rgba(239,68,68,.06)] " +
    "hover:enabled:border-danger/70 hover:enabled:bg-danger hover:enabled:text-ink " +
    "hover:enabled:shadow-[0_0_20px_rgba(239,68,68,.18)] " +
    "active:enabled:scale-[.97] " +
    "disabled:border-line disabled:bg-panel disabled:text-faint disabled:shadow-none disabled:opacity-60",

  success:
    "border-success/40 bg-success/10 text-success-strong " +
    "shadow-[0_0_14px_rgba(34,197,94,.06)] " +
    "hover:enabled:border-success/70 hover:enabled:bg-success hover:enabled:text-ink " +
    "hover:enabled:shadow-[0_0_20px_rgba(34,197,94,.18)] " +
    "active:enabled:scale-[.97] " +
    "disabled:border-line disabled:bg-panel disabled:text-faint disabled:shadow-none disabled:opacity-60",

  warning:
    "border-warning/40 bg-warning/10 text-warning-strong " +
    "shadow-[0_0_14px_rgba(245,158,11,.06)] " +
    "hover:enabled:border-warning/70 hover:enabled:bg-warning hover:enabled:text-ink " +
    "hover:enabled:shadow-[0_0_20px_rgba(245,158,11,.18)] " +
    "active:enabled:scale-[.97] " +
    "disabled:border-line disabled:bg-panel disabled:text-faint disabled:shadow-none disabled:opacity-60",

  info:
    "border-info/40 bg-info/10 text-info-strong " +
    "shadow-[0_0_14px_rgba(59,130,246,.06)] " +
    "hover:enabled:border-info/70 hover:enabled:bg-info hover:enabled:text-ink " +
    "hover:enabled:shadow-[0_0_20px_rgba(59,130,246,.18)] " +
    "active:enabled:scale-[.97] " +
    "disabled:border-line disabled:bg-panel disabled:text-faint disabled:shadow-none disabled:opacity-60",

  purple:
    "border-purple-500/40 bg-purple-500/10 text-purple-300 " +
    "shadow-[0_0_14px_rgba(168,85,247,.06)] " +
    "hover:enabled:border-purple-400/70 hover:enabled:bg-purple-500 hover:enabled:text-white " +
    "hover:enabled:shadow-[0_0_20px_rgba(168,85,247,.18)] " +
    "active:enabled:scale-[.97] " +
    "disabled:border-line disabled:bg-panel disabled:text-faint disabled:shadow-none disabled:opacity-60",

  orange:
    "border-orange-500/40 bg-orange-500/10 text-orange-300 " +
    "shadow-[0_0_14px_rgba(249,115,22,.06)] " +
    "hover:enabled:border-orange-400/70 hover:enabled:bg-orange-500 hover:enabled:text-white " +
    "hover:enabled:shadow-[0_0_20px_rgba(249,115,22,.18)] " +
    "active:enabled:scale-[.97] " +
    "disabled:border-line disabled:bg-panel disabled:text-faint disabled:shadow-none disabled:opacity-60",

  red:
    "border-red-500/40 bg-red-500/10 text-red-300 " +
    "shadow-[0_0_14px_rgba(239,68,68,.06)] " +
    "hover:enabled:border-red-400/70 hover:enabled:bg-red-500 hover:enabled:text-white " +
    "hover:enabled:shadow-[0_0_20px_rgba(239,68,68,.18)] " +
    "active:enabled:scale-[.97] " +
    "disabled:border-line disabled:bg-panel disabled:text-faint disabled:shadow-none disabled:opacity-60",

  teal:
    "border-teal-500/40 bg-teal-500/10 text-teal-300 " +
    "shadow-[0_0_14px_rgba(100,116,139,.06)] " +
    "hover:enabled:border-teal-400/70 hover:enabled:bg-teal-500 hover:enabled:text-white " +
    "hover:enabled:shadow-[0_0_20px_rgba(100,116,139,.18)] " +
    "active:enabled:scale-[.97] " +
    "disabled:border-line disabled:bg-panel disabled:text-faint disabled:shadow-none disabled:opacity-60",
};

export const Btn = ({ variant = "default", className, ...p }) => (
  <button className={cx(btnBase, variants[variant], className)} {...p} />
);

/* ---------------- Inputs ---------------- */
export const Select = ({ value, onChange, options, label }) => (
  <label className="group relative flex items-center">
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cx(
        "h-9 min-w-[150px] cursor-pointer appearance-none rounded-lg border border-line-2 bg-panel pr-8 pl-3 transition duration-150 hover:border-faint focus-visible:outline-none",
        RING
      )}
    >
      {options.map((o) => (
        <option key={o} className="bg-panel-2 text-text">{o}</option>
      ))}
    </select>
    <ChevronDown
      size={14}
      className="pointer-events-none absolute right-3 text-muted transition group-hover:text-text group-focus-within:text-accent"
    />
  </label>
);

export const textField =
  "rounded-lg border border-line-2 bg-panel px-3 py-2.5 outline-none transition duration-150 " +
  "hover:border-faint focus:border-accent/60 focus:bg-panel-2 focus:shadow-[0_0_0_3px_rgba(95,208,230,.14)]";

/* ---------------- Tiles ---------------- */
const tileBase =
  "relative flex min-h-[64px] items-center gap-3 rounded-[10px] border px-4 text-left transition duration-150 " +
  "active:enabled:translate-y-px disabled:cursor-not-allowed disabled:opacity-55";

export const Tile = ({ on, bad, col, className, ...p }) => (
  <button
    className={cx(
      tileBase,
      col && "flex-col items-start justify-center gap-1 py-3.5",
      on ? "border-accent/50 bg-accent/8" : "border-line bg-panel hover:border-line-2 hover:bg-panel-2",
      bad && "hover:border-danger/60 hover:bg-danger/8",
      className
    )}
    {...p}
  />
);

export const Grid = ({ wide, children }) => (
  <div
    className={cx(
      "grid gap-2.5",
      wide ? "mt-3 grid-cols-[repeat(auto-fill,minmax(290px,1fr))]" : "grid-cols-[repeat(auto-fill,minmax(210px,1fr))]"
    )}
  >
    {children}
  </div>
);

/* ---------------- Checklist row ---------------- */
export const Row = ({ children }) => (
  <label className="flex cursor-pointer items-center gap-3.5 rounded-[10px] border border-line bg-panel px-4 py-3 transition duration-150 hover:border-line-2 hover:bg-panel-2 has-checked:border-accent/35 has-checked:bg-accent/6">
    {children}
  </label>
);

export const RowText = ({ title, desc }) => (
  <span className="flex flex-col gap-0.5">
    <b className="font-medium">{title}</b>
    {desc && <small className="text-[13px] text-muted">{desc}</small>}
  </span>
);

export const Checkbox = (p) => (
  <input type="checkbox" className="size-4 flex-none accent-accent-strong" {...p} />
);

export const Switch = (p) => (
  <input
    type="checkbox"
    className="relative h-[22px] w-10 flex-none cursor-pointer appearance-none rounded-full border border-line-2 bg-panel-3 transition-colors duration-200 checked:border-transparent checked:bg-accent-strong after:absolute after:top-[2px] after:left-[2px] after:size-4 after:rounded-full after:bg-text after:transition-transform after:duration-[240ms] after:ease-spring after:content-[''] checked:after:translate-x-[18px] checked:after:bg-ink"
    {...p}
  />
);

export const List = ({ children }) => <div className="my-3 flex max-w-[780px] flex-col gap-2">{children}</div>;
