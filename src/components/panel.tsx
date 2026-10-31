"use client";

import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import { ChevronRight } from "@/components/icons";

/*
 * Structured panels: a header bar (title + action or count), flush rows split
 * by hairlines, and stat cards with a context line and a footer link.
 */

export type Tone = "warning" | "bad" | "info" | "good" | "neutral";

const TILE: Record<Tone, string> = {
  warning: "bg-warn/12 text-warn",
  bad: "bg-bad/12 text-bad",
  info: "bg-info/12 text-info",
  good: "bg-good/12 text-good",
  neutral: "bg-fg/[0.06] text-muted",
};

const BADGE: Record<Tone, string> = {
  warning: "bg-warn/15 text-warn",
  bad: "bg-bad text-white",
  info: "bg-info/15 text-info",
  good: "bg-good/15 text-good",
  neutral: "bg-fg/[0.08] text-muted",
};

type Icon = ComponentType<{ size?: number | string; className?: string }>;

export function Panel({
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card flex flex-col overflow-hidden ${className}`}>
      <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div className="min-w-0">
          <h2 className="truncate text-[0.9375rem] font-semibold">{title}</h2>
          {subtitle && <p className="mt-0.5 truncate text-xs text-muted">{subtitle}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

/** "View all →" style header action. */
export function PanelLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-muted transition hover:text-text">
      {children} <ChevronRight size={14} />
    </Link>
  );
}

export function CountBadge({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
  return <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${BADGE[tone]}`}>{children}</span>;
}

export function IconTile({ icon: Icon, tone = "neutral", size = "md" }: { icon: Icon; tone?: Tone; size?: "md" | "lg" }) {
  return (
    <span className={`grid shrink-0 place-items-center rounded-xl ${TILE[tone]} ${size === "lg" ? "size-12" : "size-9"}`}>
      <Icon size={size === "lg" ? 22 : 17} />
    </span>
  );
}

/** Small uppercase-free group label inside a panel. */
export function RowGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="px-5 pt-4 pb-1 text-xs font-medium text-faint">{label}</p>
      <ul className="divide-y divide-line">{children}</ul>
    </div>
  );
}

/** A list row that reads as an action: icon tile, title, one-line reason, and a trailing chevron or value. */
export function ActionRow({
  icon,
  tone = "neutral",
  title,
  subtitle,
  right,
  onClick,
  href,
  leading,
}: {
  icon?: Icon;
  tone?: Tone;
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  onClick?: () => void;
  href?: string;
  /** Replaces the icon tile, e.g. a coloured gameweek label. */
  leading?: ReactNode;
}) {
  const interactive = Boolean(onClick || href);
  const body = (
    <>
      {leading ?? (icon && <IconTile icon={icon} tone={tone} />)}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{title}</span>
        {subtitle && <span className="mt-0.5 block text-xs text-muted">{subtitle}</span>}
      </span>
      {right ?? (interactive && <ChevronRight size={16} className="shrink-0 text-faint transition group-hover:translate-x-0.5 group-hover:text-text" />)}
    </>
  );
  const cls = `group flex w-full items-center gap-3 px-5 py-3.5 text-left ${interactive ? "transition hover:bg-fg/[0.03]" : ""}`;
  return (
    <li>
      {href ? (
        <Link href={href} className={cls}>
          {body}
        </Link>
      ) : onClick ? (
        <button type="button" onClick={onClick} className={cls}>
          {body}
        </button>
      ) : (
        <div className={cls}>{body}</div>
      )}
    </li>
  );
}

/** Stat card: label with an icon, a big value, a coloured context line, and an optional footer link. */
export function StatCard({
  label,
  icon: Icon,
  value,
  unit,
  context,
  footer,
}: {
  label: string;
  icon?: Icon;
  value: ReactNode;
  unit?: string;
  context?: { text: ReactNode; tone?: Tone };
  footer?: { label: string; href: string };
}) {
  const contextColor =
    context?.tone === "good"
      ? "text-good"
      : context?.tone === "bad"
        ? "text-bad"
        : context?.tone === "warning"
          ? "text-warn"
          : context?.tone === "info"
            ? "text-info"
            : "text-muted";
  return (
    <section className="card flex flex-col overflow-hidden">
      <div className="flex-1 p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-muted">{label}</p>
          {Icon && <Icon size={16} className="text-faint" />}
        </div>
        <p className="mt-2 text-3xl font-semibold tracking-tight">
          {value}
          {unit && <span className="ml-1 text-base font-normal text-muted">{unit}</span>}
        </p>
        {context && <p className={`mt-1 text-xs font-medium ${contextColor}`}>{context.text}</p>}
      </div>
      {footer && (
        <Link href={footer.href} className="group flex items-center justify-between border-t border-line px-5 py-3 text-xs font-medium text-muted transition hover:text-text">
          {footer.label}
          <ChevronRight size={14} className="transition group-hover:translate-x-0.5" />
        </Link>
      )}
    </section>
  );
}
