"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { SegmentedControl, SegmentedControlItem } from "@/components/base/segmented-control/segmented-control";

/*
 * Hand-rolled SVG charts following the dataviz method: thin marks, hairline
 * solid grids, one axis, a legend for 2+ series, a hover/focus tooltip on every
 * chart, and a table twin so no value is gated behind hover.
 */

export const SERIES = {
  expert: "var(--color-series-expert)",
  you: "var(--color-series-you)",
  average: "var(--color-series-avg)",
  good: "var(--color-good)",
  bad: "var(--color-bad)",
} as const;

export interface Series {
  key: string;
  label: string;
  color: string;
  values: (number | null)[];
}

const AXIS_W = 44;
const PAD_TOP = 12;
const AXIS_H = 24;

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

export const compact = (n: number) =>
  Math.abs(n) >= 1_000_000
    ? `${+(n / 1_000_000).toFixed(1)}M`
    : Math.abs(n) >= 1000
      ? `${+(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}K`
      : `${Math.round(n)}`;

function niceTicks(min: number, max: number, count = 4) {
  if (min === max) return [min];
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const ticks: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) ticks.push(+v.toFixed(6));
  return ticks;
}

/** Keyboard + pointer index tracking shared by every chart. */
function useHoverIndex(length: number) {
  const [index, setIndex] = useState<number | null>(null);
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight") setIndex((i) => Math.min(length - 1, (i ?? -1) + 1));
    else if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, (i ?? length) - 1));
    else if (e.key === "Escape") setIndex(null);
    else return;
    e.preventDefault();
  };
  return { index, setIndex, onKey };
}

/* ------------------------------------------------------------------ cards */

export function ChartCard({
  title,
  subtitle,
  legend,
  table,
  children,
  className = "",
  action,
}: {
  title: string;
  subtitle?: ReactNode;
  legend?: { label: string; color: string; shape?: "line" | "rect" | "ring" }[];
  table?: { head: string[]; rows: (string | number)[][] };
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  const [view, setView] = useState<"chart" | "table">("chart");
  return (
    <section className={`card flex flex-col p-5 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">{title}</p>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-3">
          {action}
          {table && (
            <SegmentedControl
              aria-label="View as"
              selectedKeys={[view]}
              onSelectionChange={(keys) => setView([...keys][0] as "chart" | "table")}
            >
              <SegmentedControlItem id="chart">Chart</SegmentedControlItem>
              <SegmentedControlItem id="table">Table</SegmentedControlItem>
            </SegmentedControl>
          )}
        </div>
      </div>
      {legend && legend.length > 1 && view === "chart" && (
        <ul className="mt-3 flex flex-wrap gap-4 text-xs text-muted">
          {legend.map((l) => (
            <li key={l.label} className="flex items-center gap-1.5">
              {l.shape === "rect" ? (
                <span className="size-2.5 rounded-sm" style={{ background: l.color }} />
              ) : l.shape === "ring" ? (
                <span className="size-2.5 rounded-full border-2" style={{ borderColor: l.color }} />
              ) : (
                <span className="h-0.5 w-4 rounded-full" style={{ background: l.color }} />
              )}
              {l.label}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 flex-1">
        {view === "chart" || !table ? (
          children
        ) : (
          <div className="max-h-72 overflow-auto rounded-xl border border-line">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-raised text-left text-faint">
                <tr>
                  {table.head.map((h) => (
                    <th key={h} className="px-3 py-2 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((r, i) => (
                  <tr key={i} className="border-t border-line">
                    {r.map((c, j) => (
                      <td key={j} className={`px-3 py-1.5 ${typeof c === "number" ? "num" : ""}`}>
                        {c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

function Tooltip({ x, width, children }: { x: number; width: number; children: ReactNode }) {
  const left = Math.min(Math.max(x, 80), width - 80);
  return (
    <div
      role="status"
      className="pointer-events-none absolute top-0 z-10 min-w-36 -translate-x-1/2 rounded-xl border border-line-strong bg-raised/95 px-3 py-2 text-xs shadow-xl shadow-black/40 backdrop-blur"
      style={{ left }}
    >
      {children}
    </div>
  );
}

function TipRow({ color, label, value }: { color: string; label: string; value: ReactNode }) {
  return (
    <div className="mt-1 flex items-center gap-2">
      <span className="h-0.5 w-3 rounded-full" style={{ background: color }} />
      <span className="num font-semibold text-text">{value}</span>
      <span className="text-muted">{label}</span>
    </div>
  );
}

/* ------------------------------------------------------------- line chart */

export function LineChart({
  labels,
  series,
  height = 220,
  invert = false,
  log = false,
  format = (n: number) => `${Math.round(n)}`,
  ariaLabel,
}: {
  labels: string[];
  series: Series[];
  height?: number;
  /** Higher values drawn lower (for ranks, where 1 is best). */
  invert?: boolean;
  log?: boolean;
  format?: (n: number) => string;
  ariaLabel: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const { index, setIndex, onKey } = useHoverIndex(labels.length);
  const all = series.flatMap((s) => s.values.filter((v): v is number => v !== null && (!log || v > 0)));
  const t = (v: number) => (log ? Math.log10(v) : v);
  // Linear charts span their clean tick range (from zero); log charts span the data.
  const linearTicks = log ? [] : niceTicks(Math.min(0, ...all), Math.max(1, ...all));
  const lo = log ? (all.length ? Math.min(...all.map(t)) : 0) : linearTicks[0];
  const hi = log ? (all.length ? Math.max(...all.map(t)) : 1) : Math.max(linearTicks.at(-1) ?? 1, ...all);
  const span = hi - lo || 1;
  const plotW = Math.max(0, width - AXIS_W - 8);
  const plotH = height - PAD_TOP - AXIS_H;
  const x = (i: number) => AXIS_W + (labels.length <= 1 ? plotW / 2 : (i / (labels.length - 1)) * plotW);
  const y = (v: number) => {
    const r = (t(v) - lo) / span;
    return PAD_TOP + (invert ? r : 1 - r) * plotH;
  };

  const ticks = log ? [...new Set(niceLogTicks(10 ** lo, 10 ** hi))] : linearTicks;
  const xEvery = Math.ceil(labels.length / Math.max(1, Math.floor(plotW / 44)));

  return (
    <div ref={ref} className="relative" style={{ height }}>
      {width > 0 && (
        <>
          <svg
            width={width}
            height={height}
            role="img"
            aria-label={ariaLabel}
            tabIndex={0}
            onKeyDown={onKey}
            onBlur={() => setIndex(null)}
            className="overflow-visible outline-none focus-visible:ring-2 focus-visible:ring-volt/50 rounded-lg"
          >
            {ticks
              .filter((v) => (log ? t(v) >= lo - 1e-9 && t(v) <= hi + 1e-9 : true))
              .map((v) => (
                <g key={v}>
                  <line x1={AXIS_W} x2={width - 8} y1={y(v)} y2={y(v)} stroke="var(--color-line)" />
                  <text x={AXIS_W - 8} y={y(v)} dy="0.32em" textAnchor="end" className="num fill-faint text-[10px]">
                    {log ? compact(v) : format(v)}
                  </text>
                </g>
              ))}
            {labels.map((l, i) =>
              i % xEvery === 0 || i === labels.length - 1 ? (
                <text key={l} x={x(i)} y={height - 6} textAnchor="middle" className="num fill-faint text-[10px]">
                  {l}
                </text>
              ) : null,
            )}
            {index !== null && <line x1={x(index)} x2={x(index)} y1={PAD_TOP} y2={PAD_TOP + plotH} stroke="var(--color-line-strong)" />}
            {series.map((s) => {
              const d = s.values
                .map((v, i) => (v === null || (log && v <= 0) ? null : `${x(i).toFixed(1)},${y(v).toFixed(1)}`))
                .reduce<string>((acc, p, i, arr) => (p ? acc + (i === 0 || !arr[i - 1] ? "M" : "L") + p : acc), "");
              return <path key={s.key} d={d} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />;
            })}
            {/* End markers on the latest value */}
            {series.map((s) => {
              const last = s.values.length - 1;
              const v = s.values[last];
              if (v === null || v === undefined || index !== null) return null;
              return <circle key={s.key} cx={x(last)} cy={y(v)} r={4} fill={s.color} stroke="var(--color-surface)" strokeWidth={2} />;
            })}
            {index !== null &&
              series.map((s) => {
                const v = s.values[index];
                return v === null || v === undefined ? null : (
                  <circle key={s.key} cx={x(index)} cy={y(v)} r={4.5} fill={s.color} stroke="var(--color-surface)" strokeWidth={2} />
                );
              })}
            <rect
              x={AXIS_W}
              y={0}
              width={plotW}
              height={height}
              fill="transparent"
              onPointerMove={(e) => {
                const r = (e.currentTarget as SVGRectElement).getBoundingClientRect();
                const rel = (e.clientX - r.left) / Math.max(1, r.width);
                setIndex(Math.round(rel * (labels.length - 1)));
              }}
              onPointerLeave={() => setIndex(null)}
            />
          </svg>
          {index !== null && (
            <Tooltip x={x(index)} width={width}>
              <p className="font-semibold text-muted">{labels[index]}</p>
              {series.map((s) => {
                const v = s.values[index];
                return v === null || v === undefined ? null : <TipRow key={s.key} color={s.color} label={s.label} value={format(v)} />;
              })}
            </Tooltip>
          )}
        </>
      )}
    </div>
  );
}

function niceLogTicks(min: number, max: number) {
  const out: number[] = [];
  for (let p = Math.floor(Math.log10(min)); p <= Math.ceil(Math.log10(max)); p++) {
    for (const m of [1, 3]) {
      const v = m * 10 ** p;
      if (v >= min * 0.8 && v <= max * 1.25) out.push(v);
    }
  }
  return out.length ? out : [min, max];
}

/* ----------------------------------------------------------- column chart */

export interface Column {
  label: string;
  value: number;
  color: string;
  /** Optional reference marker drawn as a ring (e.g. the best option available). */
  marker?: number;
  tip: ReactNode;
}

/**
 * Columns from a single baseline at zero; negative values hang below it.
 * Rounded at the data end, square at the baseline, capped at 24px wide.
 */
export function ColumnChart({ columns, height = 200, ariaLabel, markerColor }: { columns: Column[]; height?: number; ariaLabel: string; markerColor?: string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const { index, setIndex, onKey } = useHoverIndex(columns.length);
  const vals = columns.flatMap((c) => [c.value, c.marker ?? c.value]);
  const max = Math.max(0, ...vals);
  const min = Math.min(0, ...vals);
  const ticks = niceTicks(min, max || 1);
  const top = Math.max(max, ticks.at(-1) ?? 1);
  const bottom = Math.min(min, ticks[0] ?? 0);
  const plotW = Math.max(0, width - AXIS_W - 8);
  const plotH = height - PAD_TOP - AXIS_H;
  const band = plotW / Math.max(1, columns.length);
  const barW = Math.min(24, band * 0.6);
  const y = (v: number) => PAD_TOP + ((top - v) / (top - bottom || 1)) * plotH;
  const cx = (i: number) => AXIS_W + band * i + band / 2;

  return (
    <div ref={ref} className="relative" style={{ height }}>
      {width > 0 && (
        <>
          <svg width={width} height={height} role="img" aria-label={ariaLabel} tabIndex={0} onKeyDown={onKey} onBlur={() => setIndex(null)} className="overflow-visible rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-volt/50">
            {ticks.map((v) => (
              <g key={v}>
                <line x1={AXIS_W} x2={width - 8} y1={y(v)} y2={y(v)} stroke={v === 0 ? "var(--color-line-strong)" : "var(--color-line)"} />
                <text x={AXIS_W - 8} y={y(v)} dy="0.32em" textAnchor="end" className="num fill-faint text-[10px]">
                  {compact(v)}
                </text>
              </g>
            ))}
            {columns.map((c, i) => {
              const y0 = y(0);
              const y1 = y(c.value);
              const h = Math.abs(y1 - y0);
              const up = c.value >= 0;
              const r = Math.min(4, h, barW / 2);
              const left = cx(i) - barW / 2;
              // Rounded at the data end only.
              const d = up
                ? `M${left},${y0} V${y1 + r} Q${left},${y1} ${left + r},${y1} H${left + barW - r} Q${left + barW},${y1} ${left + barW},${y1 + r} V${y0} Z`
                : `M${left},${y0} V${y1 - r} Q${left},${y1} ${left + r},${y1} H${left + barW - r} Q${left + barW},${y1} ${left + barW},${y1 - r} V${y0} Z`;
              return (
                <g key={c.label} opacity={index === null || index === i ? 1 : 0.45}>
                  {h > 0 && <path d={d} fill={c.color} />}
                  {c.marker !== undefined && c.marker !== c.value && (
                    <circle cx={cx(i)} cy={y(c.marker)} r={4.5} fill="var(--color-surface)" stroke={markerColor ?? "var(--color-text)"} strokeWidth={2} />
                  )}
                  <text x={cx(i)} y={height - 6} textAnchor="middle" className="num fill-faint text-[10px]">
                    {c.label}
                  </text>
                  <rect
                    x={cx(i) - band / 2}
                    y={0}
                    width={band}
                    height={height}
                    fill="transparent"
                    onPointerEnter={() => setIndex(i)}
                    onPointerLeave={() => setIndex(null)}
                  />
                </g>
              );
            })}
          </svg>
          {index !== null && (
            <Tooltip x={cx(index)} width={width}>
              {columns[index].tip}
            </Tooltip>
          )}
        </>
      )}
    </div>
  );
}

/* -------------------------------------------------------- horizontal bars */

export function BarList({ rows, max, color, unit }: { rows: { label: ReactNode; value: number; key: string | number }[]; max: number; color: string; unit: string }) {
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.key} className="grid grid-cols-[8rem_1fr_auto] items-center gap-3 text-sm">
          <span className="truncate">{r.label}</span>
          <span className="h-2 overflow-hidden rounded-full bg-white/[0.05]">
            <span className="block h-full rounded-full" style={{ width: `${(r.value / Math.max(1, max)) * 100}%`, background: color }} />
          </span>
          <span className="num w-14 text-right text-xs text-muted">
            {r.value} {unit}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Two values for the same measure, side by side on one scale. */
export function CompareMeter({
  label,
  hint,
  a,
  b,
  max,
  format,
}: {
  label: string;
  hint: string;
  a: { label: string; value: number; color: string };
  b: { label: string; value: number; color: string } | null;
  max: number;
  format: (n: number) => string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-[11px] text-faint">{hint}</p>
      </div>
      {[a, b].filter((x): x is NonNullable<typeof x> => x !== null).map((x) => (
        <div key={x.label} className="mt-1.5 grid grid-cols-[3.5rem_1fr_3rem] items-center gap-2 text-xs">
          <span className="flex items-center gap-1.5 text-muted">
            <span className="size-2 rounded-sm" style={{ background: x.color }} />
            {x.label}
          </span>
          <span className="h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
            <span className="block h-full rounded-full" style={{ width: `${Math.min(100, (x.value / Math.max(max, 1e-9)) * 100)}%`, background: x.color }} />
          </span>
          <span className="num text-right">{format(x.value)}</span>
        </div>
      ))}
    </div>
  );
}
