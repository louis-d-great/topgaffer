"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, ArrowUpRight, Brain, CheckCircle2, Info } from "@/components/icons";
import { useManager } from "@/components/app-shell";
import { ChartCard, ColumnChart, LineChart, SERIES, Sparkline, compact } from "@/components/charts";
import { CountUp, ErrorCard, Skeleton, TeamBadge } from "@/components/ui";
import { fmtDeadline, fmtRank, fmtSigned, pct, timeUntil } from "@/lib/format";
import type { Lesson, ManagerProfile } from "@/lib/fpl/types";
import type { PlanReview } from "@/lib/plan-review";
import { useNow } from "@/lib/use-now";

export default function HomePage() {
  const { profile, loading, error, reviews } = useManager();
  if (error) return <ErrorCard message={error} onRetry={() => location.reload()} />;
  if (loading || !profile) return <HomeSkeleton />;
  return <Home profile={profile} lastReview={reviews[0]} />;
}

/*
 * Home is organised around three questions, in reading order:
 *   1. Decisions: what needs attention before the next deadline (the featured panel)
 *   2. Performance: how the season is going (points lost, trend cards, season chart)
 *   3. Insights: what TopGaffer has learned (lessons, rank journey)
 */
function Home({ profile, lastReview }: { profile: ManagerProfile; lastReview?: PlanReview }) {
  const now = useNow();
  const first = profile.managerName.split(" ")[0];
  const gws = profile.gameweeks;
  const last = gws.at(-1);
  const prev = gws.at(-2);
  const ranked = rankLessons(profile.lessons);

  return (
    <div className="stagger space-y-6">
      <header>
        <p className="text-sm text-muted">
          {greeting(now)}, {first}
        </p>
        <h1 className="mt-0.5 text-3xl font-semibold tracking-tight">Dashboard</h1>
      </header>

      {/* 1 · Decisions + headline performance */}
      <div className="grid gap-5 xl:grid-cols-12">
        <FocusPanel profile={profile} topLesson={ranked[0]} lastReview={lastReview} now={now} />
        <PointsLost profile={profile} />
      </div>

      {/* 2 · Performance at a glance: each card a number with its season trend */}
      {last && (
        <div className="grid grid-cols-2 gap-5 xl:grid-cols-4">
          <TrendCard
            label={`GW${last.gw} points`}
            value={last.points}
            delta={{ text: `${fmtSigned(last.points - last.average)} vs avg`, good: last.points >= last.average }}
            trend={gws.map((g) => g.points)}
            trendLabel="Points per gameweek"
          />
          <TrendCard
            label="Overall rank"
            value={fmtRank(profile.overallRank)}
            delta={
              prev
                ? {
                    text: `${prev.overallRank >= last.overallRank ? "↑" : "↓"} ${compact(Math.abs(prev.overallRank - last.overallRank))} this week`,
                    good: prev.overallRank >= last.overallRank,
                  }
                : undefined
            }
            trend={gws.map((g) => g.overallRank)}
            invert
            trendLabel="Overall rank per gameweek"
          />
          <TrendCard
            label="Captain average"
            value={profile.stats.captainAvg}
            unit="pts"
            delta={{ text: `best pick ${pct(profile.stats.captainBestRate)} of weeks`, good: profile.stats.captainBestRate >= 0.5 }}
            trend={gws.map((g) => g.captain?.points ?? 0)}
            trendLabel="Captain points per gameweek"
          />
          <TrendCard
            label="Left on bench"
            value={profile.stats.benchPoints}
            unit="pts"
            delta={{ text: `${(profile.stats.benchPoints / Math.max(1, gws.length)).toFixed(1)} a week`, good: false }}
            trend={gws.map((g) => g.benchPoints)}
            color="var(--color-info)"
            trendLabel="Bench points per gameweek"
          />
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-12">
        <ChartCard
          className="xl:col-span-8"
          title="Your season"
          subtitle="Points per gameweek. The ring marks the average manager."
          legend={[
            { label: "You", color: SERIES.you, shape: "rect" },
            { label: "Average", color: "var(--color-text)", shape: "ring" },
          ]}
          table={{
            head: ["GW", "You", "Average", "Captain", "Chip"],
            rows: gws.map((g) => [`GW${g.gw}`, g.points, g.average, g.captain ? `${profile.players[g.captain.id]?.name} (${g.captain.points})` : "—", g.chip ?? ""]),
          }}
        >
          <ColumnChart
            ariaLabel="Your points per gameweek against the average"
            height={240}
            markerColor="var(--color-text)"
            columns={gws.map((g) => ({
              label: `${g.gw}`,
              value: g.points,
              marker: g.average,
              color: SERIES.you,
              tip: (
                <>
                  <p className="font-semibold text-muted">GW{g.gw}</p>
                  <p className="mt-1">
                    <span className="num font-semibold">{g.points}</span> <span className="text-muted">you</span>
                  </p>
                  <p>
                    <span className="num font-semibold">{g.average}</span> <span className="text-muted">average</span>
                  </p>
                  {g.captain && (
                    <p className="mt-1 text-muted">
                      Captain {profile.players[g.captain.id]?.name} · {g.captain.points}
                    </p>
                  )}
                </>
              ),
            }))}
          />
        </ChartCard>
        {last && <LastGameweek profile={profile} />}
      </div>

      {/* 3 · Insights */}
      <div className="grid gap-5 xl:grid-cols-12">
        <Insights profile={profile} lessons={ranked} />
        <RankJourney profile={profile} />
      </div>
    </div>
  );
}

/** The featured panel: the next decision, the lesson that matters most for it, and the action. */
function FocusPanel({ profile, topLesson, lastReview, now }: { profile: ManagerProfile; topLesson?: Lesson; lastReview?: PlanReview; now: number }) {
  const next = profile.nextGw;
  return (
    <section className="relative overflow-hidden rounded-[1.25rem] bg-volt p-6 text-neutral-950 xl:col-span-5">
      <div className="pointer-events-none absolute -right-16 -bottom-24 size-72 rounded-full bg-white/25 blur-3xl" />
      <div className="relative flex h-full flex-col">
        <p className="text-sm font-medium text-neutral-900/70">{next ? `GW${next.id} deadline` : "Season"}</p>
        {next ? (
          <>
            <p className="mt-1 text-5xl font-semibold tracking-tight">{timeUntil(next.deadline, now)}</p>
            <p className="mt-1 text-sm text-neutral-900/70">{fmtDeadline(next.deadline)}</p>
          </>
        ) : (
          <p className="mt-1 text-3xl font-semibold tracking-tight">No upcoming deadline</p>
        )}

        {(lastReview || topLesson) && (
          <div className="mt-6 rounded-2xl bg-neutral-950/[0.08] p-4">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-neutral-900/70">
              <Brain size={14} /> {lastReview ? `From your GW${lastReview.gw} plan review` : "Before you decide"}
            </p>
            <p className="mt-1 text-[0.9375rem] leading-snug font-semibold">{lastReview ? lastReview.lesson : topLesson!.title}</p>
          </div>
        )}

        <Link
          href="/deadline"
          className="group mt-6 inline-flex items-center justify-between rounded-xl bg-neutral-950 px-4 py-3 text-sm font-semibold text-volt transition hover:bg-neutral-900 xl:mt-auto"
        >
          Run deadline check
          <ArrowRight size={18} className="transition group-hover:translate-x-1" />
        </Link>
      </div>
    </section>
  );
}

function PointsLost({ profile }: { profile: ManagerProfile }) {
  const { stats } = profile;
  const parts = [
    { label: "Captain misses", value: stats.captainMissed, color: "bg-warn" },
    { label: "Left on bench", value: stats.benchPoints, color: "bg-info" },
    { label: "Hits that didn't pay", value: stats.hitLoss, color: "bg-bad" },
  ];
  const total = Math.max(1, stats.pointsLost);
  return (
    <section className="card flex flex-col p-6 xl:col-span-7">
      <p className="text-sm font-medium text-muted">Points lost to your decisions</p>
      <p className="mt-1 text-6xl font-semibold tracking-tight text-warn">
        −<CountUp value={stats.pointsLost} />
      </p>
      <p className="mt-2 max-w-lg text-sm text-muted">
        About {(stats.pointsLost / Math.max(1, profile.gameweeks.length)).toFixed(1)} pts a week, compared with making the best call available
        from your own squad.
      </p>
      <div className="mt-auto pt-8">
        <div className="flex h-3 gap-0.5 overflow-hidden rounded-full">
          {parts
            .filter((p) => p.value > 0)
            .map((p) => (
              <div key={p.label} className={`${p.color} first:rounded-l-full last:rounded-r-full`} style={{ width: `${(p.value / total) * 100}%` }} />
            ))}
        </div>
        <dl className="mt-5 grid grid-cols-3 gap-4">
          {parts.map((p) => (
            <div key={p.label}>
              <dt className="flex items-center gap-1.5 text-xs text-muted">
                <span className={`size-2 shrink-0 rounded-full ${p.color}`} />
                {p.label}
              </dt>
              <dd className="num mt-1 text-2xl font-semibold tracking-tight">{p.value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-5 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
          <span>
            Hits paid off: <span className="text-text">{stats.hits ? `${stats.hitsPaidOff}/${stats.hits}` : "none taken"}</span>
          </span>
          <span>
            Transfer weeks won:{" "}
            <span className="text-text">{stats.transferWindows ? `${pct(stats.transferSuccess)} of ${stats.transferWindows}` : "—"}</span>
          </span>
        </p>
      </div>
    </section>
  );
}

function TrendCard({
  label,
  value,
  unit,
  delta,
  trend,
  invert,
  color,
  trendLabel,
}: {
  label: string;
  value: number | string;
  unit?: string;
  delta?: { text: string; good: boolean };
  trend: number[];
  invert?: boolean;
  color?: string;
  trendLabel: string;
}) {
  return (
    <section className="card flex flex-col p-5">
      <p className="text-sm font-medium text-muted">{label}</p>
      <p className="mt-1 text-3xl font-semibold tracking-tight">
        {typeof value === "number" ? value.toLocaleString("en-GB") : value}
        {unit && <span className="ml-1 text-base font-normal text-muted">{unit}</span>}
      </p>
      {delta && <p className={`mt-0.5 text-xs font-medium ${delta.good ? "text-good" : "text-muted"}`}>{delta.text}</p>}
      <div className="mt-auto pt-4">
        <Sparkline values={trend} invert={invert} color={color} label={trendLabel} />
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
    <section className="card flex flex-col p-6 xl:col-span-4">
      <p className="text-sm font-medium text-muted">GW{g.gw} review</p>
      <div className="mt-1 flex items-baseline gap-3">
        <p className="text-4xl font-semibold tracking-tight">
          {g.points}
          <span className="ml-1 text-base font-normal text-muted">pts</span>
        </p>
        <span className={`rounded-md px-1.5 py-0.5 text-xs font-semibold ${diff >= 0 ? "bg-good/15 text-good" : "bg-fg/[0.06] text-muted"}`}>
          {fmtSigned(diff)} vs avg {g.average}
        </span>
      </div>
      <ul className="mt-6 space-y-4 text-sm">
        {g.captain && (
          <li className="flex gap-3">
            <TeamBadge team={team(g.captain.id)} size={32} />
            <div className="min-w-0">
              <p className="font-medium">
                Captain {name(g.captain.id)} · {g.captain.points * g.captain.multiplier} pts
              </p>
              <p className="text-xs text-muted">
                {g.captainMissed === 0 ? "The best captain in your team." : `${name(g.bestCaptain!.id)} would have given ${g.captainMissed} more.`}
              </p>
            </div>
          </li>
        )}
        {moves && (
          <li className="flex gap-3">
            <TeamBadge team={team(moves.ins[0])} size={32} />
            <div className="min-w-0">
              <p className="font-medium">
                {moves.ins.map(name).join(", ")} in{moves.hitCost > 0 && <span className="text-bad"> (−{moves.hitCost})</span>}
              </p>
              <p className="text-xs text-muted">
                {fmtSigned(moves.gain)} pts vs {moves.outs.map(name).join(", ")} so far
              </p>
            </div>
          </li>
        )}
      </ul>
      <p className="mt-auto flex items-center justify-between pt-6 text-sm text-muted">
        Bench points <span className="text-base font-semibold text-text">{g.benchPoints}</span>
      </p>
    </section>
  );
}

const TONE_ICON = {
  warning: { icon: AlertTriangle, cls: "text-warn", bg: "bg-warn/10" },
  info: { icon: Info, cls: "text-info", bg: "bg-info/10" },
  strength: { icon: CheckCircle2, cls: "text-good", bg: "bg-good/10" },
} as const;

/** Warnings first: they are what should change the next decision. */
function rankLessons(lessons: Lesson[]) {
  const order = { warning: 0, info: 1, strength: 2 };
  return [...lessons].sort((a, b) => order[a.tone] - order[b.tone]);
}

function Insights({ profile, lessons }: { profile: ManagerProfile; lessons: Lesson[] }) {
  const [top, ...rest] = lessons;
  return (
    <section className="card p-6 xl:col-span-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">What TopGaffer has learned</h2>
          <p className="mt-0.5 text-sm text-muted">From {profile.gameweeks.length} gameweeks of your real decisions</p>
        </div>
        <Link href="/memory" className="inline-flex shrink-0 items-center gap-1 text-sm text-muted hover:text-text">
          All memories <ArrowUpRight size={15} />
        </Link>
      </div>
      {top ? (
        <>
          <LessonRow lesson={top} featured />
          <ul className="mt-2 divide-y divide-line">
            {rest.map((l) => (
              <LessonRow key={l.id} lesson={l} />
            ))}
          </ul>
        </>
      ) : (
        <p className="mt-6 text-sm text-muted">Play a few gameweeks and TopGaffer starts learning.</p>
      )}
    </section>
  );
}

function LessonRow({ lesson, featured = false }: { lesson: Lesson; featured?: boolean }) {
  const t = TONE_ICON[lesson.tone];
  const Icon = t.icon;
  if (featured) {
    return (
      <div className="mt-5 flex gap-4 rounded-2xl bg-fg/[0.03] p-5">
        <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${t.bg} ${t.cls}`}>
          <Icon size={20} />
        </span>
        <div className="min-w-0">
          <p className="text-lg leading-snug font-semibold">{lesson.title}</p>
          <p className="mt-1 text-sm text-muted">{lesson.detail}</p>
          {lesson.evidence && <p className="mt-2 text-xs text-faint">{lesson.evidence}</p>}
        </div>
      </div>
    );
  }
  return (
    <li className="flex gap-4 px-1 py-4">
      <span className={`grid size-8 shrink-0 place-items-center rounded-lg ${t.bg} ${t.cls}`}>
        <Icon size={16} />
      </span>
      <div className="min-w-0">
        <p className="text-[0.9375rem] leading-snug font-semibold">{lesson.title}</p>
        <p className="mt-0.5 text-sm text-muted">{lesson.detail}</p>
      </div>
    </li>
  );
}

/** Overall rank by gameweek on a log scale; higher on the chart is better. */
function RankJourney({ profile }: { profile: ManagerProfile }) {
  const gws = profile.gameweeks;
  if (gws.length < 2) return null;
  const firstRank = gws[0].overallRank;
  const latest = gws[gws.length - 1].overallRank;
  const prev = gws[gws.length - 2].overallRank;
  const week = prev - latest;
  return (
    <section className="card flex flex-col p-6 xl:col-span-4">
      <p className="text-sm font-medium text-muted">Rank journey</p>
      <p className="mt-1 text-3xl font-semibold tracking-tight">{fmtRank(latest)}</p>
      <p className={`mt-0.5 text-xs font-medium ${week >= 0 ? "text-good" : "text-bad"}`}>
        {week >= 0 ? "Up" : "Down"} {compact(Math.abs(week))} places this week · {fmtRank(firstRank)} after GW{gws[0].gw}
      </p>
      <div className="mt-auto pt-4">
        <LineChart
          ariaLabel="Overall rank by gameweek"
          labels={gws.map((g) => `GW${g.gw}`)}
          invert
          log
          height={190}
          format={(n) => compact(n)}
          series={[{ key: "rank", label: "Overall rank", color: SERIES.you, values: gws.map((g) => g.overallRank) }]}
        />
      </div>
    </section>
  );
}

function HomeSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-14 w-60" />
      <div className="grid gap-5 xl:grid-cols-12">
        <Skeleton className="h-80 xl:col-span-5" />
        <Skeleton className="h-80 xl:col-span-7" />
      </div>
      <div className="grid grid-cols-2 gap-5 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-40" />
        ))}
      </div>
    </div>
  );
}

function greeting(now: number) {
  const h = new Date(now).getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}
