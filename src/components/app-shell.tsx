"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, createContext, useContext, useEffect, type ReactNode } from "react";
import { Brain, LayoutGrid, Loader2, LogOut, Sparkles, Timer, Users } from "lucide-react";
import { KEYS, useHydrated, useLocal } from "@/lib/store";
import { useApi } from "@/lib/use-api";
import { useNow } from "@/lib/use-now";
import { useMemorySync, type MemorySync } from "@/lib/use-memory-sync";
import { timeUntil } from "@/lib/format";
import type { ManagerProfile } from "@/lib/fpl/types";
import { Avatar as BoardAvatar } from "@/components/base/avatar/avatar";

const NAV = [
  { href: "/home", label: "Home", icon: LayoutGrid },
  { href: "/deadline", label: "Deadline", icon: Timer },
  { href: "/coach", label: "Coach", icon: Sparkles },
  { href: "/experts", label: "Experts", icon: Users },
  { href: "/memory", label: "Memory", icon: Brain },
];

interface ManagerCtx {
  /** Null while the stored team ID is being read (and during prerender). */
  teamId: number | null;
  profile: ManagerProfile | null;
  loading: boolean;
  error: string | null;
  memory: MemorySync;
}

const Ctx = createContext<ManagerCtx | null>(null);

export function useManager() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useManager must be used inside AppShell");
  return ctx;
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="relative grid size-9 place-items-center rounded-xl bg-volt text-ink shadow-[0_0_24px_-6px_var(--color-volt)]">
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
          <path d="M5 8h14M12 8v11" />
          <circle cx="12" cy="8" r="0.6" fill="currentColor" />
        </svg>
      </span>
      {!compact && (
        <span className="font-brand text-xl font-bold tracking-tight">
          Top<span className="text-volt">Gaffer</span>
        </span>
      )}
    </span>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const hydrated = useHydrated();
  const [teamId, setTeamId] = useLocal<number | null>(KEYS.teamId, null);
  const router = useRouter();
  const { data, loading, error } = useApi<ManagerProfile>(teamId ? `/api/manager/${teamId}` : null);
  const memory = useMemorySync(teamId, data);

  useEffect(() => {
    if (hydrated && !teamId) router.replace("/");
  }, [hydrated, teamId, router]);

  // The frame always renders, so navigation is instant; screens show skeletons until data arrives.
  return (
    <Ctx.Provider value={{ teamId, profile: data, loading, error, memory }}>
      <div className="flex min-h-dvh w-full">
        {/* Desktop sidebar */}
        <div className="sticky top-0 hidden h-dvh shrink-0 p-3 pr-0 md:block">
          <aside className="flex h-full w-[272px] flex-col rounded-3xl border border-line bg-surface p-3 shadow-[0_1px_0_0_rgb(255_255_255/0.04)_inset,0_10px_30px_-12px_rgb(0_0_0/0.8)]">
            <Link href="/home" className="flex items-center rounded-2xl px-2 py-2">
              <Logo />
            </Link>
            <p className="section-label mt-6 mb-2 px-3">Menu</p>
            <Suspense fallback={<SideNav active={null} />}>
              <CurrentSideNav />
            </Suspense>
            {data && <GameweekCard profile={data} />}
            <div className="mt-3 flex items-center gap-3 rounded-2xl bg-white/[0.03] p-2.5 ring-1 ring-line">
              <Avatar name={data?.managerName} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{data?.teamName ?? "Loading…"}</p>
                <p className="truncate text-xs text-muted">{data?.managerName ?? (teamId ? `Team ${teamId}` : "")}</p>
              </div>
              <button
                onClick={() => setTeamId(null)}
                className="grid size-8 shrink-0 place-items-center rounded-lg text-faint transition hover:bg-white/[0.06] hover:text-text"
                aria-label="Switch team"
                title="Switch team"
              >
                <LogOut size={16} />
              </button>
            </div>
          </aside>
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Top bar */}
          <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-line bg-ink/80 px-4 backdrop-blur-xl sm:px-6 xl:px-8">
            <div className="flex items-center gap-3">
              <span className="md:hidden">
                <Logo compact />
              </span>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <MemoryPill memory={memory} />
              {data?.nextGw && <DeadlinePill gw={data.nextGw.id} deadline={data.nextGw.deadline} />}
              <span className="hidden items-center gap-2 rounded-full border border-line bg-surface py-1 pr-3 pl-1 text-sm sm:flex">
                <Avatar name={data?.managerName} size={28} />
                <span className="max-w-40 truncate font-medium">{data?.teamName ?? "…"}</span>
              </span>
              <button onClick={() => setTeamId(null)} className="p-1 text-faint hover:text-text md:hidden" aria-label="Switch team">
                <LogOut size={18} />
              </button>
            </div>
          </header>

          <main className="w-full min-w-0 flex-1 overflow-x-clip px-4 pt-6 pb-28 sm:px-6 md:pb-12 xl:px-8">{children}</main>
        </div>

        {/* Mobile tab bar */}
        <Suspense fallback={<MobileNav active={null} />}>
          <CurrentMobileNav />
        </Suspense>
      </div>
    </Ctx.Provider>
  );
}

function Avatar({ name, size = 36 }: { name?: string; size?: number }) {
  const initials = (name ?? "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return <BoardAvatar size={size >= 32 ? "md" : "sm"} initials={initials || "·"} aria-hidden />;
}

function DeadlinePill({ gw, deadline }: { gw: number; deadline: string }) {
  const now = useNow();
  const hoursLeft = (new Date(deadline).getTime() - now) / 3_600_000;
  // Calm lime until the last day, then amber, then red in the final 3 hours.
  const tone = hoursLeft < 3 ? "border-bad/40 bg-bad/10 text-bad" : hoursLeft < 24 ? "border-warn/40 bg-warn/10 text-warn" : "border-line bg-surface text-text";
  const dot = hoursLeft < 3 ? "bg-bad" : hoursLeft < 24 ? "bg-warn" : "bg-good";
  return (
    <Link href="/deadline" className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition hover:brightness-125 ${tone}`}>
      <span className="relative flex size-2">
        <span className={`absolute inline-flex size-full animate-ping rounded-full opacity-60 ${dot}`} />
        <span className={`relative inline-flex size-2 rounded-full ${dot}`} />
      </span>
      <span className="font-medium">GW{gw}</span>
      <span className="num font-semibold">{timeUntil(deadline, now)}</span>
    </Link>
  );
}

function MemoryPill({ memory }: { memory: MemorySync }) {
  if (!memory.saved && !memory.pending && !memory.error) return null;
  return (
    <Link
      href="/memory"
      title={memory.error ?? "Memories stored on Walrus (mainnet)"}
      className="hidden items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-sm text-muted transition hover:text-text lg:inline-flex"
    >
      {memory.pending > 0 ? (
        <Loader2 size={14} className="animate-spin text-info" />
      ) : (
        <Brain size={14} className={memory.error ? "text-bad" : "text-good"} />
      )}
      <span>
        Walrus · <span className="num font-semibold text-text">{memory.saved}</span> saved
        {memory.pending > 0 && <span className="text-info"> · {memory.pending} saving</span>}
      </span>
    </Link>
  );
}

/** Sidebar summary: the next deadline and how last gameweek went. */
function GameweekCard({ profile }: { profile: ManagerProfile }) {
  const now = useNow();
  const last = profile.gameweeks.at(-1);
  const prev = profile.gameweeks.at(-2);
  const move = last && prev ? prev.overallRank - last.overallRank : 0;
  const rows: [string, ReactNode][] = [];
  if (profile.nextGw) rows.push([`GW${profile.nextGw.id} deadline`, timeUntil(profile.nextGw.deadline, now)]);
  if (last) {
    const diff = last.points - last.average;
    rows.push([
      `GW${last.gw} points`,
      <>
        {last.points} <span className={diff >= 0 ? "text-good" : "text-bad"}>{diff >= 0 ? `+${diff}` : diff} vs avg</span>
      </>,
    ]);
    rows.push([
      "Overall rank",
      <>
        {compactRank(last.overallRank)}{" "}
        {move !== 0 && <span className={move > 0 ? "text-good" : "text-bad"}>{move > 0 ? "↑" : "↓"}{compactRank(Math.abs(move))}</span>}
      </>,
    ]);
  }
  return (
    <div className="mt-auto rounded-2xl bg-white/[0.03] p-3 ring-1 ring-line">
      <p className="section-label">This gameweek</p>
      <dl className="mt-2 space-y-1.5">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-2 text-[13px]">
            <dt className="text-muted">{k}</dt>
            <dd className="num font-medium text-text">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function compactRank(n: number) {
  return n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}k` : `${n}`;
}

/*
 * Reading the URL suspends on routes whose params are only known at request time
 * (e.g. /experts/[teamId]), so the parts that highlight the current page sit in
 * their own Suspense boundaries and fall back to an un-highlighted menu.
 */
function useActiveHref() {
  const pathname = usePathname();
  return NAV.find((n) => pathname.startsWith(n.href))?.href ?? null;
}

function CurrentSideNav() {
  return <SideNav active={useActiveHref()} />;
}

function CurrentMobileNav() {
  return <MobileNav active={useActiveHref()} />;
}


function SideNav({ active }: { active: string | null }) {
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map(({ href, label, icon: Icon }) => {
        const on = href === active;
        return (
          <Link
            key={href}
            href={href}
            aria-current={on ? "page" : undefined}
            className={`flex h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-medium transition ${
              on
                ? "bg-linear-to-b from-accent-500 to-accent-600 text-neutral-950 shadow-[0_0_0_1px_var(--color-accent-500),inset_0_1px_0_0_rgb(255_255_255/0.35)]"
                : "text-muted hover:bg-white/[0.05] hover:text-text"
            }`}
          >
            <Icon size={20} strokeWidth={on ? 2.2 : 1.8} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function MobileNav({ active }: { active: string | null }) {
  return (
    <nav className="fixed inset-x-3 bottom-3 z-30 grid grid-cols-5 rounded-xl border border-line-strong bg-pitch/90 p-1 backdrop-blur-xl md:hidden">
      {NAV.map(({ href, label, icon: Icon }) => {
        const on = href === active;
        return (
          <Link
            key={href}
            href={href}
            className={`flex flex-col items-center gap-0.5 rounded-lg py-1.5 text-[10px] font-medium transition ${on ? "bg-white/[0.08] text-text" : "text-muted"}`}
          >
            <Icon size={18} strokeWidth={2} className={on ? "text-volt" : ""} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
