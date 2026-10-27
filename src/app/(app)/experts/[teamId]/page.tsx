"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Crown, Lightbulb, ShieldCheck } from "lucide-react";
import { useManager } from "@/components/app-shell";
import { BarList, ChartCard, ColumnChart, CompareMeter, LineChart, SERIES, compact } from "@/components/charts";
import { ErrorCard, Skeleton, TeamBadge } from "@/components/ui";
import { FEATURED_EXPERTS, captainHeadToHead, useExperts } from "@/lib/experts";
import { fmtRank, fmtSigned, pct } from "@/lib/format";
import type { ExpertDetail, ManagerProfile, Position } from "@/lib/fpl/types";
import { useApi } from "@/lib/use-api";

const CHIP_NAMES: Record<string, string> = { bboost: "Bench Boost", "3xc": "Triple Captain", wildcard: "Wildcard", freehit: "Free Hit", manager: "Assistant Manager" };
const POSITIONS: Position[] = ["GKP", "DEF", "MID", "FWD"];

export default function ExpertDashboardPage() {
  const { teamId: raw } = useParams<{ teamId: string }>();
  const expertId = Number(raw);
  const { teamId, profile } = useManager();
  const { data, error } = useApi<ExpertDetail>(Number.isInteger(expertId) ? `/api/experts/${expertId}` : null);
  // Your own detail powers the style comparison (same analysis, same cache).
  const mine = useApi<ExpertDetail>(teamId ? `/api/experts/${teamId}` : null);
  const { tracked } = useExperts();

  if (error) return <ErrorCard message={error} onRetry={() => location.reload()} />;
  if (!data || !profile) return <DashboardSkeleton />;

  const meta = tracked.find((t) => t.expert.teamId === expertId)?.expert ?? FEATURED_EXPERTS.find((e) => e.teamId === expertId);
  const name = meta?.name ?? data.managerName;
  return <Dashboard d={data} you={profile} yourDetail={mine.data} name={name} meta={meta} />;
}

function Dashboard({
  d,
  you,
  yourDetail,
  name,
  meta,
}: {
  d: ExpertDetail;
  you: ManagerProfile;
  yourDetail: ExpertDetail | null;
  name: string;
  meta?: { handle: string; platform: string; country: string };
}) {
  const labels = d.gameweeks.map((g) => `GW${g.gw}`);
  const yourByGw = new Map(you.gameweeks.map((g) => [g.gw, g]));
  const h2h = captainHeadToHead(you, {
    teamId: d.teamId,
    teamName: d.teamName,
    managerName: d.managerName,
    overallRank: d.overallRank,
    totalPoints: d.totalPoints,
    stats: d.stats,
    captains: d.gameweeks.filter((g) => g.captain).map((g) => ({ gw: g.gw, id: g.captain!.id, name: g.captain!.name, points: g.captain!.points, missed: 0 })),
  });
  const lead = d.totalPoints - you.totalPoints;
  const insights = buildInsights(d, name);
  const tags = styleTags(d);

  return (
    <div className="stagger space-y-5">
      <Link href="/experts" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-text">
        <ArrowLeft size={15} /> All experts
      </Link>

      {/* Hero */}
      <section className="card relative overflow-hidden p-6">
        <div className="pointer-events-none absolute -top-24 -right-16 size-80 rounded-full bg-[var(--color-series-expert)]/15 blur-3xl" />
        <div className="relative flex flex-wrap items-start gap-5">
          <div className="grid size-16 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[var(--color-series-expert)] to-info font-display text-2xl font-bold text-white">
            {name
              .split(" ")
              .map((w) => w[0])
              .slice(0, 2)
              .join("")}
          </div>
          <div className="min-w-0 flex-1">
            <p className="eyebrow">
              {meta ? `${meta.platform === "youtube" ? "YouTube" : meta.platform === "x" ? "X" : "Creator"} · ${meta.country}` : "Tracked manager"} · FPL team {d.teamId}
            </p>
            <h1 className="mt-1 font-display text-3xl font-bold tracking-tight sm:text-4xl">{name}</h1>
            <p className="mt-1 text-sm text-muted">
              {d.teamName} · {d.managerName}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {tags.map((t) => (
                <span key={t} className="rounded-full border border-line-strong bg-white/[0.03] px-2.5 py-1 text-xs text-text/90">
                  {t}
                </span>
              ))}
            </div>
          </div>
          <dl className="grid w-full grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-3 lg:w-auto lg:grid-cols-6">
            {[
              { label: "Points", value: d.totalPoints.toLocaleString("en-GB") },
              { label: "Overall rank", value: fmtRank(d.overallRank) },
              { label: "Vs you", value: `${fmtSigned(lead)} pts`, tone: lead > 0 ? "text-warn" : "text-good" },
              { label: "Captain avg", value: `${d.stats.captainAvg}` },
              { label: "Hits paid off", value: d.stats.hits ? `${d.stats.hitsPaidOff}/${d.stats.hits}` : "None taken" },
              { label: "Transfer weeks won", value: d.stats.transferWindows ? pct(d.stats.transferSuccess) : "—" },
            ].map((k) => (
              <div key={k.label} className="bg-surface px-4 py-3">
                <dt className="text-[11px] text-muted">{k.label}</dt>
                <dd className={`mt-0.5 font-display text-xl font-semibold ${k.tone ?? ""}`}>{k.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <ul className="relative mt-6 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          {insights.map((i) => (
            <li key={i} className="flex gap-2.5 rounded-xl border border-line bg-black/20 p-3 text-sm">
              <Lightbulb size={16} className="mt-0.5 shrink-0 text-volt" />
              <span className="text-text/90">{i}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-5 xl:grid-cols-12">
        <ChartCard
          className="xl:col-span-8"
          title="Points by gameweek"
          subtitle={`${name} vs you vs the average manager`}
          legend={[
            { label: name, color: SERIES.expert },
            { label: "You", color: SERIES.you },
            { label: "Average", color: SERIES.average },
          ]}
          table={{
            head: ["GW", name, "You", "Average"],
            rows: d.gameweeks.map((g) => [`GW${g.gw}`, g.points, yourByGw.get(g.gw)?.points ?? "—", g.average]),
          }}
        >
          <LineChart
            ariaLabel={`Points per gameweek for ${name}, you and the average`}
            labels={labels}
            series={[
              { key: "expert", label: name, color: SERIES.expert, values: d.gameweeks.map((g) => g.points) },
              { key: "you", label: "You", color: SERIES.you, values: d.gameweeks.map((g) => yourByGw.get(g.gw)?.points ?? null) },
              { key: "avg", label: "Average", color: SERIES.average, values: d.gameweeks.map((g) => g.average) },
            ]}
            height={320}
          />
        </ChartCard>

        <section className="card p-5 xl:col-span-4">
          <p className="eyebrow">Style · {name} vs you</p>
          <p className="mt-1 text-sm text-muted">How they play, measured from their real team.</p>
          <div className="mt-4 space-y-4">
            <CompareMeter
              label="Ownership of starting XI"
              hint="higher = more template"
              a={{ label: name.split(" ")[0], value: d.style.xiOwnership, color: SERIES.expert }}
              b={yourDetail ? { label: "You", value: yourDetail.style.xiOwnership, color: SERIES.you } : null}
              max={60}
              format={(n) => `${n.toFixed(0)}%`}
            />
            <CompareMeter
              label="Differentials in XI"
              hint="players under 10% owned"
              a={{ label: name.split(" ")[0], value: d.style.differentials, color: SERIES.expert }}
              b={yourDetail ? { label: "You", value: yourDetail.style.differentials, color: SERIES.you } : null}
              max={6}
              format={(n) => `${n}`}
            />
            <CompareMeter
              label="Transfers per week"
              hint="excludes chip weeks"
              a={{ label: name.split(" ")[0], value: d.style.transfersPerWeek, color: SERIES.expert }}
              b={yourDetail ? { label: "You", value: yourDetail.style.transfersPerWeek, color: SERIES.you } : null}
              max={2}
              format={(n) => n.toFixed(1)}
            />
            <CompareMeter
              label="Captain ownership"
              hint="popular vs brave armbands"
              a={{ label: name.split(" ")[0], value: d.style.captainOwnership, color: SERIES.expert }}
              b={yourDetail ? { label: "You", value: yourDetail.style.captainOwnership, color: SERIES.you } : null}
              max={80}
              format={(n) => `${n.toFixed(0)}%`}
            />
            <CompareMeter
              label="Bench points per week"
              hint="lower is better"
              a={{ label: name.split(" ")[0], value: d.style.benchPerWeek, color: SERIES.expert }}
              b={yourDetail ? { label: "You", value: yourDetail.style.benchPerWeek, color: SERIES.you } : null}
              max={15}
              format={(n) => n.toFixed(1)}
            />
          </div>
        </section>

        <ChartCard
          className="xl:col-span-6"
          title="Rank journey"
          subtitle="Overall rank after each gameweek (higher on the chart is better)"
          legend={[
            { label: name, color: SERIES.expert },
            { label: "You", color: SERIES.you },
          ]}
          table={{
            head: ["GW", name, "You"],
            rows: d.gameweeks.map((g) => [`GW${g.gw}`, g.overallRank.toLocaleString("en-GB"), yourByGw.get(g.gw)?.overallRank.toLocaleString("en-GB") ?? "—"]),
          }}
        >
          <LineChart
            ariaLabel={`Overall rank by gameweek for ${name} and you`}
            labels={labels}
            invert
            log
            format={(n) => compact(n)}
            series={[
              { key: "expert", label: name, color: SERIES.expert, values: d.gameweeks.map((g) => g.overallRank) },
              { key: "you", label: "You", color: SERIES.you, values: d.gameweeks.map((g) => yourByGw.get(g.gw)?.overallRank ?? null) },
            ]}
          />
        </ChartCard>

        <ChartCard
          className="xl:col-span-6"
          title="Captaincy"
          subtitle={
            h2h.weeks
              ? `Their captain outscored yours ${h2h.theyWon} of ${h2h.weeks} weeks (${fmtSigned(h2h.margin)} pts)`
              : "Captain points before the armband"
          }
          legend={[
            { label: "Their captain", color: SERIES.expert, shape: "rect" },
            { label: "Best option in their XI", color: "var(--color-text)", shape: "ring" },
          ]}
          table={{
            head: ["GW", "Captain", "Pts", "Best option", "Pts", "Your captain"],
            rows: d.gameweeks.map((g) => [
              `GW${g.gw}`,
              g.captain?.name ?? "—",
              g.captain?.points ?? 0,
              g.best?.name ?? "—",
              g.best?.points ?? 0,
              yourByGw.get(g.gw)?.captain ? `${you.players[yourByGw.get(g.gw)!.captain!.id]?.name} (${yourByGw.get(g.gw)!.captain!.points})` : "—",
            ]),
          }}
        >
          <ColumnChart
            ariaLabel={`Captain points per gameweek for ${name}`}
            columns={d.gameweeks.map((g) => {
              const mineCap = yourByGw.get(g.gw)?.captain;
              return {
                label: `${g.gw}`,
                value: g.captain?.points ?? 0,
                marker: g.best?.points,
                color: SERIES.expert,
                tip: (
                  <>
                    <p className="font-semibold text-muted">GW{g.gw}{g.chip === "3xc" ? " · Triple Captain" : ""}</p>
                    <p className="mt-1">
                      <span className="num font-semibold">{g.captain?.points ?? 0}</span> <span className="text-muted">{g.captain?.name} (C)</span>
                    </p>
                    {g.best && g.best.id !== g.captain?.id && (
                      <p className="mt-0.5">
                        <span className="num font-semibold">{g.best.points}</span> <span className="text-muted">best: {g.best.name}</span>
                      </p>
                    )}
                    {mineCap && (
                      <p className="mt-0.5">
                        <span className="num font-semibold">{mineCap.points}</span> <span className="text-muted">you: {you.players[mineCap.id]?.name}</span>
                      </p>
                    )}
                  </>
                ),
              };
            })}
          />
        </ChartCard>

        <TransferLog d={d} name={name} />

        <section className="card p-5 xl:col-span-4">
          <p className="eyebrow">Players they trust most</p>
          <p className="mt-1 text-sm text-muted">Gameweeks in their squad this season (Free Hit weeks excluded).</p>
          <div className="mt-4">
            <BarList
              color={SERIES.expert}
              unit="GW"
              max={Math.max(...d.trusted.map((t) => t.gws), 1)}
              rows={d.trusted.map((t) => ({
                key: t.id,
                value: t.gws,
                label: (
                  <span className="flex items-center gap-2">
                    <TeamBadge team={t.team} size={20} />
                    {t.name}
                  </span>
                ),
              }))}
            />
          </div>
          <ChipStrip chips={d.chips} gws={d.gameweeks.map((g) => g.gw)} />
        </section>

        <SquadCard d={d} name={name} />
      </div>
    </div>
  );
}

function TransferLog({ d, name }: { d: ExpertDetail; name: string }) {
  const net = d.transfers.reduce((s, t) => s + t.gain - t.hitCost, 0);
  return (
    <ChartCard
      className="xl:col-span-8"
      title="Transfers and what happened next"
      subtitle={
        d.transfers.length
          ? `Each move judged on points scored by players in vs players out over the next 3 gameweeks. Net: ${fmtSigned(net)} pts after hits.`
          : `${name} hasn't made a normal transfer yet (chip weeks excluded).`
      }
      legend={[
        { label: "Gained points", color: SERIES.good, shape: "rect" },
        { label: "Lost points", color: SERIES.bad, shape: "rect" },
      ]}
      table={{
        head: ["GW", "Out", "In", "Hit", "Net"],
        rows: d.transfers.map((t) => [
          `GW${t.gw}`,
          t.outs.map((p) => `${p.name} (${p.points})`).join(", "),
          t.ins.map((p) => `${p.name} (${p.points})`).join(", "),
          t.hitCost ? `−${t.hitCost}` : "",
          fmtSigned(t.gain - t.hitCost),
        ]),
      }}
    >
      {d.transfers.length > 0 && (
        <ColumnChart
          ariaLabel="Net points gained by each transfer week"
          height={170}
          columns={d.transfers.map((t) => {
            const v = t.gain - t.hitCost;
            return {
              label: `GW${t.gw}`,
              value: v,
              color: v >= 0 ? SERIES.good : SERIES.bad,
              tip: (
                <>
                  <p className="font-semibold text-muted">GW{t.gw} · over {t.horizon} GW</p>
                  <p className="mt-1">
                    <span className="num font-semibold">{fmtSigned(v)}</span> <span className="text-muted">net{t.hitCost ? ` after −${t.hitCost} hit` : ""}</span>
                  </p>
                </>
              ),
            };
          })}
        />
      )}
      <ul className="mt-4 space-y-2">
        {[...d.transfers].reverse().map((t) => {
          const v = t.gain - t.hitCost;
          return (
            <li key={t.gw} className="grid grid-cols-[3rem_1fr_auto] items-center gap-3 rounded-xl border border-line p-3 text-sm">
              <span className="num text-xs text-faint">GW{t.gw}</span>
              <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                <span className="flex flex-wrap gap-1.5">
                  {t.outs.map((p) => (
                    <span key={p.id} className="inline-flex items-center gap-1 rounded-md bg-bad/10 px-1.5 py-0.5 text-xs text-text/90">
                      <TeamBadge team={p.team} size={16} /> {p.name} <span className="num text-muted">{p.points}</span>
                    </span>
                  ))}
                </span>
                <ArrowRight size={14} className="text-faint" />
                <span className="flex flex-wrap gap-1.5">
                  {t.ins.map((p) => (
                    <span key={p.id} className="inline-flex items-center gap-1 rounded-md bg-good/10 px-1.5 py-0.5 text-xs text-text/90">
                      <TeamBadge team={p.team} size={16} /> {p.name} <span className="num text-muted">{p.points}</span>
                    </span>
                  ))}
                </span>
                {t.hitCost > 0 && <span className="text-xs text-bad">−{t.hitCost} hit</span>}
                {t.chasedHaul && <span className="text-xs text-warn">bought after a big haul</span>}
              </div>
              <span className={`num rounded-md px-2 py-1 text-xs font-semibold ${v > 0 ? "bg-good/15 text-good" : v < 0 ? "bg-bad/15 text-bad" : "bg-white/5 text-muted"}`}>
                {fmtSigned(v)}
              </span>
            </li>
          );
        })}
      </ul>
    </ChartCard>
  );
}

function ChipStrip({ chips, gws }: { chips: ExpertDetail["chips"]; gws: number[] }) {
  const last = Math.max(...gws, 1);
  return (
    <div className="mt-6">
      <p className="eyebrow">Chips played</p>
      <div className="mt-3 flex gap-1">
        {Array.from({ length: last }, (_, i) => i + 1).map((gw) => {
          const chip = chips.find((c) => c.gw === gw);
          return (
            <div key={gw} className="flex flex-1 flex-col items-center gap-1" title={chip ? `GW${gw}: ${CHIP_NAMES[chip.name] ?? chip.name}` : `GW${gw}`}>
              <span className={`h-6 w-full rounded-md ${chip ? "bg-volt" : "bg-white/[0.05]"}`} />
              <span className="num text-[9px] text-faint">{gw}</span>
            </div>
          );
        })}
      </div>
      <ul className="mt-2 space-y-0.5 text-xs text-muted">
        {chips.map((c) => (
          <li key={c.name + c.gw}>
            <span className="num text-text">GW{c.gw}</span> · {CHIP_NAMES[c.name] ?? c.name}
          </li>
        ))}
        {chips.length === 0 && <li>No chips played yet.</li>}
      </ul>
    </div>
  );
}

function SquadCard({ d, name }: { d: ExpertDetail; name: string }) {
  const lastGw = d.gameweeks.at(-1)?.gw;
  return (
    <section className="card p-5 xl:col-span-12">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="eyebrow">{name}&apos;s squad · GW{lastGw}</p>
          <p className="mt-1 text-sm text-muted">FPL reveals the next gameweek&apos;s team at the deadline. Ownership shows how template each pick is.</p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs text-muted">
          <ShieldCheck size={13} className="text-good" /> From their real FPL team
        </span>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {POSITIONS.map((pos) => (
          <div key={pos} className="rounded-2xl border border-line bg-black/20 p-3">
            <p className="eyebrow mb-2">{pos}</p>
            <ul className="space-y-1.5">
              {d.squad
                .filter((p) => p.pos === pos)
                .map((p) => (
                  <li key={p.id} className={`flex items-center gap-2.5 rounded-xl px-2 py-1.5 ${p.benched ? "opacity-55" : "bg-white/[0.02]"}`}>
                    <TeamBadge team={p.team} size={26} />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1 truncate text-sm font-semibold">
                        {p.name}
                        {p.isCaptain && <Crown size={12} className="text-volt" />}
                        {p.benched && <span className="text-[10px] font-normal text-faint">bench</span>}
                      </p>
                      <p className="text-[11px] text-muted">
                        £{p.price.toFixed(1)}m · held {p.heldGws} GW
                      </p>
                    </div>
                    <span
                      className={`num rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${p.selectedBy < 10 ? "bg-volt/15 text-volt" : "bg-white/5 text-muted"}`}
                      title="Owned by this share of FPL managers"
                    >
                      {p.selectedBy.toFixed(1)}%
                    </span>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Plain-language findings from the numbers. The AI coach will expand on these later. */
function buildInsights(d: ExpertDetail, name: string) {
  const out: string[] = [];
  const first = name.split(" ")[0];
  const caps = d.gameweeks.filter((g) => g.captain);
  const counts = new Map<string, number>();
  for (const g of caps) counts.set(g.captain!.name, (counts.get(g.captain!.name) ?? 0) + 1);
  const [topCap, topN] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? ["", 0];
  if (topCap) out.push(`Captained ${topCap} in ${topN} of ${caps.length} gameweeks; picked the best option in their team ${pct(d.stats.captainBestRate)} of the time.`);

  const net = d.transfers.reduce((s, t) => s + t.gain - t.hitCost, 0);
  if (d.transfers.length) {
    const best = [...d.transfers].sort((a, b) => b.gain - b.hitCost - (a.gain - a.hitCost))[0];
    out.push(
      `Transfers netted ${fmtSigned(net)} pts after hits. Best move: ${best.ins.map((p) => p.name).join(" + ")} in for ${best.outs.map((p) => p.name).join(" + ")} (GW${best.gw}, ${fmtSigned(best.gain - best.hitCost)}).`,
    );
  } else out.push(`${first} has barely touched the team outside chip weeks.`);

  out.push(
    d.style.xiOwnership >= 30
      ? `Plays it safe: the starting XI averages ${d.style.xiOwnership.toFixed(0)}% ownership, with ${d.style.differentials} differential${d.style.differentials === 1 ? "" : "s"}.`
      : `Goes against the crowd: the starting XI averages only ${d.style.xiOwnership.toFixed(0)}% ownership.`,
  );
  out.push(
    d.stats.hits
      ? `Took ${d.stats.hits} hit${d.stats.hits === 1 ? "" : "s"}; ${d.stats.hitsPaidOff} paid off. Leaves ${d.style.benchPerWeek.toFixed(1)} pts a week on the bench.`
      : `Never takes hits. Leaves ${d.style.benchPerWeek.toFixed(1)} pts a week on the bench.`,
  );
  return out;
}

function styleTags(d: ExpertDetail) {
  const tags = [
    d.style.xiOwnership >= 30 ? "Template player" : "Differential hunter",
    d.style.transfersPerWeek < 0.8 ? "Patient" : d.style.transfersPerWeek > 1.2 ? "Very active" : "Steady trader",
    d.stats.hits === 0 ? "Avoids hits" : d.stats.hitsPaidOff * 2 >= d.stats.hits ? "Hits that pay" : "Costly hits",
    d.style.captainOwnership >= 40 ? "Safe captains" : "Brave captains",
  ];
  return tags;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-64" />
      <div className="grid gap-5 xl:grid-cols-12">
        <Skeleton className="h-80 xl:col-span-8" />
        <Skeleton className="h-80 xl:col-span-4" />
      </div>
    </div>
  );
}

