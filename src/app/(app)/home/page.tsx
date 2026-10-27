"use client";

import Link from "next/link";
import { ArrowRight, ArrowUpRight, Timer } from "lucide-react";
import { useManager } from "@/components/app-shell";
import { CountUp, ErrorCard, Skeleton, Stat, TeamBadge, ToneChip } from "@/components/ui";
import { fmtDeadline, fmtRank, fmtSigned, pct, timeUntil } from "@/lib/format";
import type { ManagerProfile } from "@/lib/fpl/types";
import { useNow } from "@/lib/use-now";

export default function HomePage() {
  const { profile, loading, error } = useManager();
  if (error) return <ErrorCard message={error} onRetry={() => location.reload()} />;
  if (loading || !profile) return <HomeSkeleton />;
  return <Home profile={profile} />;
}

function Home({ profile }: { profile: ManagerProfile }) {
  const { stats } = profile;
  const now = useNow();
  const first = profile.managerName.split(" ")[0];
  const last = profile.gameweeks.at(-1);
  const breakdown = [
    { label: "Captain misses", value: stats.captainMissed, color: "bg-warn" },
    { label: "Left on bench", value: stats.benchPoints, color: "bg-info" },
    { label: "Hits that didn't pay", value: stats.hitLoss, color: "bg-bad" },
  ];
  const total = Math.max(1, stats.pointsLost);

  const lastGw = profile.gameweeks.at(-1);

  return (
    <div className="stagger space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-volt">
            GW{profile.currentGw} · {profile.teamName}
          </p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            {greeting(now)}, {first}.
          </h1>
        </div>
        <dl className="grid grid-cols-3 divide-x divide-line rounded-2xl border border-line bg-surface/70">
          {[
            { label: "Total points", value: profile.totalPoints.toLocaleString("en-GB") },
            { label: "Overall rank", value: fmtRank(profile.overallRank) },
            { label: `GW${lastGw?.gw ?? "–"} points`, value: lastGw?.points ?? "–" },
          ].map((k) => (
            <div key={k.label} className="px-4 py-2.5 sm:px-6">
              <dt className="eyebrow text-[10px]">{k.label}</dt>
              <dd className="num mt-0.5 text-lg font-semibold sm:text-xl">{k.value}</dd>
            </div>
          ))}
        </dl>
      </header>

      <div className="grid gap-5 xl:grid-cols-12">
        {/* The one number that matters */}
        <section className="card relative overflow-hidden p-6 sm:p-7 xl:col-span-5">
          <div className="pointer-events-none absolute -top-20 -right-20 size-64 rounded-full bg-warn/10 blur-3xl" />
          <p className="eyebrow">Points lost to your decisions</p>
          <p className="mt-3 font-display text-7xl font-bold tracking-tight text-warn 2xl:text-8xl">
            <span className="mr-1 align-top text-5xl 2xl:text-6xl">−</span>
            <CountUp value={stats.pointsLost} />
          </p>
          <p className="mt-2 max-w-md text-sm text-muted">
            That&apos;s {(stats.pointsLost / Math.max(1, profile.gameweeks.length)).toFixed(1)} pts a week, compared with making the
            best call available from your own squad.
          </p>
          <div className="mt-6 flex h-2.5 overflow-hidden rounded-full bg-white/5">
            {breakdown.map((b) => (
              <div key={b.label} className={`${b.color} transition-all`} style={{ width: `${(b.value / total) * 100}%` }} />
            ))}
          </div>
          <dl className="mt-4 grid grid-cols-3 gap-3">
            {breakdown.map((b) => (
              <div key={b.label}>
                <dt className="flex items-center gap-1.5 text-xs text-muted">
                  <span className={`size-2 shrink-0 rounded-full ${b.color}`} />
                  {b.label}
                </dt>
                <dd className="num mt-1 text-lg font-semibold">{b.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Deadline call to action */}
        {profile.nextGw && (
          <Link
            href="/deadline"
            className="card group relative flex flex-col justify-between overflow-hidden p-6 transition hover:border-volt/40 xl:col-span-3"
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(30rem_14rem_at_100%_0%,rgb(212_255_58/0.12),transparent)]" />
            <div className="relative flex items-center justify-between">
              <p className="eyebrow">GW{profile.nextGw.id} deadline</p>
              <Timer size={18} className="text-volt" />
            </div>
            <div className="relative my-6">
              <p className="num font-display text-5xl font-bold text-volt">{timeUntil(profile.nextGw.deadline, now)}</p>
              <p className="mt-1 text-sm text-muted">{fmtDeadline(profile.nextGw.deadline)}</p>
            </div>
            <span className="relative inline-flex items-center justify-between rounded-xl bg-volt px-4 py-3 font-semibold text-ink">
              Run deadline check
              <ArrowRight size={18} className="transition group-hover:translate-x-1" />
            </span>
          </Link>
        )}

        <div className="grid grid-cols-2 gap-3 xl:col-span-4">
          <Stat label="Captain average" value={stats.captainAvg} suffix="pts" hint="before the armband" />
          <Stat
            label="Best captain"
            value={pct(stats.captainBestRate)}
            tone={stats.captainBestRate >= 0.5 ? "strength" : "warning"}
            hint="of gameweeks"
          />
          <Stat
            label="Hits paid off"
            value={stats.hits ? `${stats.hitsPaidOff}/${stats.hits}` : "—"}
            tone={stats.hits === 0 ? undefined : stats.hitsPaidOff * 2 >= stats.hits ? "strength" : "warning"}
            hint={stats.hits ? `${stats.hitCost} pts spent` : "No hits taken"}
          />
          <Stat
            label="Transfers won"
            value={stats.transferWindows ? pct(stats.transferSuccess) : "—"}
            tone={stats.transferWindows === 0 ? undefined : stats.transferSuccess >= 0.5 ? "strength" : "warning"}
            hint={`over ${stats.transferWindows} weeks`}
          />
        </div>

        <div className="xl:col-span-8">
          <SeasonChart profile={profile} />
        </div>
        <div className="xl:col-span-4">{last && <LastGameweek profile={profile} />}</div>

        <section className="card p-6 xl:col-span-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="eyebrow">What I&apos;ve learned about you</p>
              <p className="mt-1 text-sm text-muted">From {profile.gameweeks.length} gameweeks of your real decisions.</p>
            </div>
            <Link href="/memory" className="inline-flex items-center gap-1 text-sm font-semibold text-volt hover:underline">
              All memories <ArrowUpRight size={15} />
            </Link>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {profile.lessons.slice(0, 6).map((l) => (
              <div key={l.id} className="rounded-2xl border border-line bg-white/[0.02] p-4 transition hover:border-line-strong">
                <ToneChip tone={l.tone} />
                <p className="mt-2 font-display text-base leading-snug font-semibold">{l.title}</p>
                <p className="mt-1 text-sm text-muted">{l.detail}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="xl:col-span-4">
          <RankJourney profile={profile} />
        </div>
      </div>
    </div>
  );
}

/** Overall rank by gameweek. Lower is better, so the line rises as rank improves. */
function RankJourney({ profile }: { profile: ManagerProfile }) {
  const pts = profile.gameweeks.map((g) => ({ gw: g.gw, rank: g.overallRank }));
  if (pts.length < 2) return null;
  const logs = pts.map((p) => Math.log10(p.rank));
  const lo = Math.min(...logs);
  const hi = Math.max(...logs);
  const W = 300;
  const H = 120;
  const x = (i: number) => (i / (pts.length - 1)) * W;
  const y = (v: number) => (hi === lo ? H / 2 : ((v - lo) / (hi - lo)) * (H - 16) + 8);
  const line = logs.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const first = pts[0].rank;
  const latest = pts[pts.length - 1].rank;
  const improved = latest < first;
  return (
    <section className="card h-full p-6">
      <div className="flex items-center justify-between">
        <p className="eyebrow">Rank journey</p>
        <span className={`num text-xs font-semibold ${improved ? "text-good" : "text-bad"}`}>
          {improved ? "▲" : "▼"} {Math.abs(first - latest).toLocaleString("en-GB")}
        </span>
      </div>
      <p className="num mt-3 font-display text-3xl font-semibold">{fmtRank(latest)}</p>
      <p className="text-xs text-muted">from {fmtRank(first)} after GW{pts[0].gw}</p>
      <svg viewBox={`0 -4 ${W} ${H + 8}`} className="mt-4 h-32 w-full overflow-visible" preserveAspectRatio="none" aria-hidden>
        <defs>
          <linearGradient id="rankFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--color-volt)" stopOpacity="0.25" />
            <stop offset="1" stopColor="var(--color-volt)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${line} L${W},${H} L0,${H} Z`} fill="url(#rankFill)" />
        <path d={line} fill="none" stroke="var(--color-volt)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-faint">
        <span className="num">GW{pts[0].gw}</span>
        <span className="num">GW{pts[pts.length - 1].gw}</span>
      </div>
    </section>
  );
}

function SeasonChart({ profile }: { profile: ManagerProfile }) {
  const max = Math.max(...profile.gameweeks.map((g) => Math.max(g.points, g.average)), 1);
  return (
    <section className="card h-full p-6">
      <div className="flex items-center justify-between">
        <p className="eyebrow">Your season</p>
        <div className="flex items-center gap-4 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-sm bg-volt" /> You
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-3 bg-white/50" /> Average
          </span>
        </div>
      </div>
      <div className="mt-6 flex h-44 items-end gap-1.5 sm:gap-2.5">
        {profile.gameweeks.map((g) => {
          const above = g.points >= g.average;
          return (
            <div key={g.gw} className="group relative flex h-full flex-1 flex-col justify-end">
              <div
                className="absolute inset-x-0 z-10 h-0.5 bg-white/50"
                style={{ bottom: `${(g.average / max) * 100}%` }}
                aria-hidden
              />
              <div
                className={`rounded-t-md transition-all group-hover:brightness-125 ${above ? "bg-volt" : "bg-volt/35"}`}
                style={{ height: `${(g.points / max) * 100}%` }}
              />
              <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden -translate-x-1/2 rounded-lg border border-line-strong bg-raised px-2.5 py-1.5 text-xs whitespace-nowrap group-hover:block">
                <span className="num font-semibold">{g.points}</span> pts · avg {g.average}
                {g.chip && <span className="ml-1 text-volt uppercase">{g.chip}</span>}
              </div>
              <span className="num mt-2 text-center text-[10px] text-faint">{g.gw}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function LastGameweek({ profile }: { profile: ManagerProfile }) {
  const g = profile.gameweeks.at(-1)!;
  const name = (id: number) => profile.players[id]?.name ?? "Unknown";
  const team = (id: number) => profile.players[id]?.team ?? "";
  const moves = profile.transfers.find((t) => t.gw === g.gw);
  const diff = g.points - g.average;

  return (
    <section className="card h-full p-6">
      <div className="flex items-center justify-between">
        <p className="eyebrow">GW{g.gw} review</p>
        <span className={`num text-sm font-semibold ${diff >= 0 ? "text-good" : "text-bad"}`}>{fmtSigned(diff)} vs avg</span>
      </div>
      <p className="mt-3 font-display text-5xl font-bold">
        <span className="num">{g.points}</span>
        <span className="ml-1 text-lg font-medium text-muted">pts</span>
      </p>
      <ul className="mt-5 space-y-3 text-sm">
        {g.captain && (
          <li className="flex items-center gap-3">
            <TeamBadge team={team(g.captain.id)} />
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                Captain {name(g.captain.id)} · <span className="num">{g.captain.points * g.captain.multiplier}</span> pts
              </p>
              <p className="text-xs text-muted">
                {g.captainMissed === 0
                  ? "The best captain in your team. Good call."
                  : `${name(g.bestCaptain!.id)} would have given ${g.captainMissed} more.`}
              </p>
            </div>
          </li>
        )}
        {moves && (
          <li className="flex items-center gap-3">
            <TeamBadge team={team(moves.ins[0])} />
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {moves.ins.map(name).join(", ")} in
                {moves.hitCost > 0 && <span className="text-bad"> (−{moves.hitCost})</span>}
              </p>
              <p className="text-xs text-muted">
                {fmtSigned(moves.gain)} pts vs {moves.outs.map(name).join(", ")} so far
              </p>
            </div>
          </li>
        )}
        <li className="flex items-center justify-between border-t border-line pt-3 text-muted">
          <span>Bench points</span>
          <span className="num">{g.benchPoints}</span>
        </li>
      </ul>
    </section>
  );
}

function HomeSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-14 w-72" />
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    </div>
  );
}

function greeting(now: number) {
  const h = new Date(now).getHours();
  return h < 12 ? "Morning" : h < 17 ? "Afternoon" : "Evening";
}
