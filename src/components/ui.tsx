"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info } from "@/components/icons";
import type { LessonTone } from "@/lib/fpl/types";
import { FDR, KITS } from "./kit";

export function TeamBadge({ team, size = 28 }: { team: string; size?: number }) {
  const [bg, fg] = KITS[team] ?? ["#2a3238", "#ffffff"];
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-lg font-mono font-semibold ring-1 ring-fg/10"
      style={{ background: bg, color: fg, width: size, height: size, fontSize: size * 0.32 }}
      aria-hidden
    >
      {team}
    </span>
  );
}

export function useCountUp(target: number, duration = 900) {
  const [value, setValue] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const start = performance.now();
    const origin = from.current;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(origin + (target - origin) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

export function CountUp({ value, className }: { value: number; className?: string }) {
  const shown = useCountUp(value);
  return <span className={`num ${className ?? ""}`}>{shown.toLocaleString("en-GB")}</span>;
}

export function Stat({
  label,
  value,
  suffix,
  hint,
  tone,
}: {
  label: string;
  value: ReactNode;
  suffix?: string;
  hint?: ReactNode;
  tone?: LessonTone;
}) {
  const color = tone === "warning" ? "text-warn" : tone === "strength" ? "text-good" : "text-text";
  return (
    <div className="card p-5">
      <p className="eyebrow">{label}</p>
      <p className={`mt-1 text-3xl font-semibold tracking-tight ${color}`}>
        {value}
        {suffix && <span className="ml-1 text-sm font-normal text-muted">{suffix}</span>}
      </p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export const TONE = {
  warning: { icon: AlertTriangle, text: "text-warn", dot: "bg-warn", bg: "bg-warn/10", ring: "ring-warn/25", label: "Watch out" },
  strength: { icon: CheckCircle2, text: "text-good", dot: "bg-good", bg: "bg-good/10", ring: "ring-good/25", label: "Strength" },
  info: { icon: Info, text: "text-info", dot: "bg-info", bg: "bg-info/10", ring: "ring-info/25", label: "Pattern" },
} as const;

/** Status shown quietly: a coloured dot and a label, never colour alone. */
export function ToneChip({ tone, detail }: { tone: LessonTone; detail?: string }) {
  const t = TONE[tone];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted">
      <span className={`size-1.5 rounded-full ${t.dot}`} />
      {t.label}
      {detail && <span className="text-faint">· {detail}</span>}
    </span>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-fg/[0.04] ${className}`} />;
}

export function FdrPill({ difficulty }: { difficulty: number }) {
  const c = FDR[difficulty] ?? FDR[3];
  return (
    <span className="num rounded-md px-1.5 py-0.5 text-[10px] font-bold" style={{ background: c.bg, color: c.fg }}>
      FDR {difficulty}
    </span>
  );
}

export function PageHeader({ eyebrow, title, children }: { eyebrow: string; title: ReactNode; children?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-sm text-muted">{eyebrow}</p>
        <h1 className="mt-0.5 text-3xl font-semibold tracking-tight">{title}</h1>
      </div>
      {children}
    </header>
  );
}

export function ErrorCard({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="card flex flex-col items-start gap-3 p-6">
      <p className="text-base font-semibold">Couldn&apos;t load your data</p>
      <p className="text-sm text-muted">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="rounded-lg bg-fg/10 px-4 py-2 text-sm font-semibold hover:bg-fg/15">
          Try again
        </button>
      )}
    </div>
  );
}
