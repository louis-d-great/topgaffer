"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ArrowUpRight, Check, Loader2, Search, Trash2, Trophy, UserPlus, X } from "lucide-react";
import { useManager } from "@/components/app-shell";
import { ErrorCard, PageHeader, Skeleton } from "@/components/ui";
import { captainHeadToHead, useExperts, type TrackedExpert } from "@/lib/experts";
import { fmtRank, fmtSigned, pct } from "@/lib/format";
import type { ExpertProfile, ManagerProfile } from "@/lib/fpl/types";
import type { Expert } from "@/lib/store";

const COUNTRIES: [string, string][] = [
  ["NG", "Nigeria"],
  ["GB", "United Kingdom"],
  ["US", "United States"],
  ["IN", "India"],
  ["CN", "China"],
  ["GH", "Ghana"],
  ["KE", "Kenya"],
  ["EG", "Egypt"],
  ["NO", "Norway"],
  ["IE", "Ireland"],
  ["MY", "Malaysia"],
  ["ID", "Indonesia"],
  ["XX", "Other"],
];

export default function ExpertsPage() {
  const { profile } = useManager();
  const experts = useExperts();
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);

  if (experts.error) return <ErrorCard message={experts.error} onRetry={() => location.reload()} />;

  const active = experts.tracked.find((t) => t.expert.teamId === selected) ?? experts.tracked[0];

  return (
    <div className="stagger">
      <PageHeader eyebrow="Tracked from their real FPL teams · updates every gameweek" title="Expert tracker">
        <button
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-volt px-4 py-2.5 text-sm font-semibold text-ink"
        >
          <UserPlus size={16} /> Add expert
        </button>
      </PageHeader>

      {experts.loading || !profile ? (
        <div className="grid gap-5 xl:grid-cols-12">
          <Skeleton className="h-96 xl:col-span-8" />
          <Skeleton className="h-96 xl:col-span-4" />
        </div>
      ) : experts.tracked.length === 0 ? (
        <EmptyState onAdd={() => setAdding(true)} />
      ) : (
        <div className="grid items-start gap-5 xl:grid-cols-12">
          <Leaderboard
            tracked={experts.tracked}
            you={profile}
            activeId={active?.expert.teamId}
            onSelect={setSelected}
            canRemove={experts.isCustom}
            onRemove={experts.remove}
          />
          {active && <HeadToHeadPanel tracked={active} you={profile} />}
        </div>
      )}

      {adding && (
        <AddExpert
          onClose={() => setAdding(false)}
          onSave={(e) => {
            experts.add(e);
            setSelected(e.teamId);
            setAdding(false);
          }}
        />
      )}
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="card flex flex-col items-center px-6 py-14 text-center">
      <div className="grid size-14 place-items-center rounded-2xl bg-volt/10 text-volt">
        <Trophy size={26} />
      </div>
      <p className="mt-5 font-display text-2xl font-semibold">Track experts by what they actually do</p>
      <p className="mt-2 max-w-lg text-sm text-muted">
        Add an expert&apos;s FPL team ID. TopGaffer reads their real captains, transfers and hits from GW1, scores them, and keeps
        their record up to date every gameweek. No typing in picks.
      </p>
      <button onClick={onAdd} className="mt-6 rounded-xl bg-volt px-5 py-3 text-sm font-semibold text-ink">
        Add an expert by team ID
      </button>
    </div>
  );
}

function Leaderboard({
  tracked,
  you,
  activeId,
  onSelect,
  canRemove,
  onRemove,
}: {
  tracked: TrackedExpert[];
  you: ManagerProfile;
  activeId?: number;
  onSelect: (id: number) => void;
  canRemove: (id: number) => boolean;
  onRemove: (id: number) => void;
}) {
  return (
    <section className="card overflow-hidden xl:col-span-8">
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <p className="eyebrow">Leaderboard · this season</p>
        <p className="text-xs text-faint">Click a name for the full dashboard</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="text-left text-[11px] tracking-wider text-faint uppercase">
              <th className="py-3 pl-5 font-medium">#</th>
              <th className="py-3 font-medium">Expert</th>
              <th className="py-3 text-right font-medium">Points</th>
              <th className="py-3 text-right font-medium">Rank</th>
              <th className="py-3 text-right font-medium">Captain avg</th>
              <th className="py-3 text-right font-medium">Hits paid</th>
              <th className="py-3 pr-5 text-right font-medium">Captains vs you</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {/* You, for reference */}
            <tr className="border-t border-line bg-volt/[0.04]">
              <td className="py-3 pl-5 text-faint">–</td>
              <td className="py-3">
                <p className="font-semibold text-volt">You</p>
                <p className="text-xs text-muted">{you.teamName}</p>
              </td>
              <td className="num py-3 text-right">{you.totalPoints}</td>
              <td className="num py-3 text-right">{fmtRank(you.overallRank)}</td>
              <td className="num py-3 text-right">{you.stats.captainAvg}</td>
              <td className="num py-3 text-right">{you.stats.hits ? `${you.stats.hitsPaidOff}/${you.stats.hits}` : "—"}</td>
              <td className="py-3 pr-5" />
              <td />
            </tr>
            {tracked.map((t, i) => {
              const h2h = captainHeadToHead(you, t.profile);
              const active = t.expert.teamId === activeId;
              return (
                <tr
                  key={t.expert.teamId}
                  onClick={() => onSelect(t.expert.teamId)}
                  className={`group cursor-pointer border-t border-line transition ${active ? "bg-white/[0.04]" : "hover:bg-white/[0.02]"}`}
                >
                  <td className={`num py-3 pl-5 font-display font-bold ${i === 0 ? "text-volt" : "text-faint"}`}>{i + 1}</td>
                  <td className="py-3">
                    <ExpertName expert={t.expert} profile={t.profile} />
                  </td>
                  <td className="num py-3 text-right font-semibold">{t.profile.totalPoints}</td>
                  <td className="num py-3 text-right">{fmtRank(t.profile.overallRank)}</td>
                  <td className="num py-3 text-right">{t.profile.stats.captainAvg}</td>
                  <td className="num py-3 text-right">
                    {t.profile.stats.hits ? `${t.profile.stats.hitsPaidOff}/${t.profile.stats.hits}` : "—"}
                  </td>
                  <td className="py-3 pr-5 text-right">
                    <span
                      className={`num rounded-md px-2 py-1 text-xs font-semibold ${
                        h2h.theyWon > h2h.youWon ? "bg-warn/15 text-warn" : h2h.youWon > h2h.theyWon ? "bg-good/15 text-good" : "bg-white/5 text-muted"
                      }`}
                    >
                      {h2h.theyWon}–{h2h.youWon}
                    </span>
                  </td>
                  <td className="pr-3">
                    {canRemove(t.expert.teamId) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemove(t.expert.teamId);
                        }}
                        className="p-1 text-faint opacity-0 transition group-hover:opacity-100 hover:text-bad"
                        aria-label={`Remove ${t.expert.name}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ExpertName({ expert, profile }: { expert: Expert; profile: ExpertProfile }) {
  return (
    <div className="flex items-center gap-3">
      <span className="num grid size-8 shrink-0 place-items-center rounded-lg bg-white/[0.06] text-[10px] font-semibold text-muted ring-1 ring-line">
        {expert.country === "XX" ? "··" : expert.country}
      </span>
      <div className="min-w-0">
        <Link
          href={`/experts/${expert.teamId}`}
          onClick={(e) => e.stopPropagation()}
          className="truncate font-semibold hover:text-volt hover:underline"
        >
          {expert.name}
        </Link>
        <p className="truncate text-xs text-muted">
          {expert.handle} · {expert.platform === "x" ? "X" : expert.platform === "youtube" ? "YouTube" : "Web"} · {profile.teamName}
        </p>
      </div>
    </div>
  );
}

function HeadToHeadPanel({ tracked, you }: { tracked: TrackedExpert; you: ManagerProfile }) {
  const { expert, profile } = tracked;
  const h2h = captainHeadToHead(you, profile);
  const yours = new Map(you.gameweeks.filter((g) => g.captain).map((g) => [g.gw, g.captain!]));
  const rows = [...profile.captains].reverse();
  const name = (id: number) => you.players[id]?.name ?? "Unknown";

  return (
    <section className="card p-5 xl:sticky xl:top-24 xl:col-span-4">
      <div className="flex items-center justify-between gap-3">
        <p className="eyebrow">Captains: {expert.name} vs you</p>
        <Link
          href={`/experts/${expert.teamId}`}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-volt px-2.5 py-1.5 text-xs font-semibold text-ink"
        >
          Full dashboard <ArrowUpRight size={13} />
        </Link>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl bg-black/25 p-3 text-center">
        <div>
          <p className="num font-display text-2xl font-bold text-warn">{h2h.theyWon}</p>
          <p className="text-[11px] text-muted">their weeks</p>
        </div>
        <div>
          <p className="num font-display text-2xl font-bold">{h2h.weeks - h2h.theyWon - h2h.youWon}</p>
          <p className="text-[11px] text-muted">level</p>
        </div>
        <div>
          <p className="num font-display text-2xl font-bold text-good">{h2h.youWon}</p>
          <p className="text-[11px] text-muted">your weeks</p>
        </div>
      </div>
      <p className="mt-3 text-sm text-muted">
        {h2h.margin > 0
          ? `Their captains scored ${h2h.margin} more points than yours this season.`
          : h2h.margin < 0
            ? `Your captains scored ${-h2h.margin} more points than theirs this season.`
            : "Your captains have scored the same as theirs this season."}{" "}
        Best captain in their own team {pct(profile.stats.captainBestRate)} of weeks.
      </p>

      <ul className="mt-4 space-y-1.5">
        {rows.map((c) => {
          const mine = yours.get(c.gw);
          const diff = mine ? c.points - mine.points : null;
          return (
            <li key={c.gw} className="grid grid-cols-[3rem_1fr_1fr] items-center gap-2 rounded-xl border border-line px-3 py-2 text-xs">
              <span className="num text-faint">GW{c.gw}</span>
              <span className={`truncate ${diff !== null && diff > 0 ? "font-semibold text-text" : "text-muted"}`}>
                {c.name} <span className="num">{c.points}</span>
              </span>
              <span className={`truncate text-right ${diff !== null && diff < 0 ? "font-semibold text-text" : "text-muted"}`}>
                {mine ? (
                  <>
                    {name(mine.id)} <span className="num">{mine.points}</span>
                  </>
                ) : (
                  "—"
                )}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-[11px] text-faint">
        Points before the armband. Left: {expert.name}. Right: you. Difference this season: {fmtSigned(h2h.margin)}.
      </p>
    </section>
  );
}

const field = "w-full rounded-xl border border-line-strong bg-ink px-3 py-2.5 text-sm outline-none focus:border-volt/60 placeholder:text-faint";

function AddExpert({ onClose, onSave }: { onClose: () => void; onSave: (e: Expert) => void }) {
  const [teamId, setTeamId] = useState("");
  const [found, setFound] = useState<ExpertProfile | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [platform, setPlatform] = useState<Expert["platform"]>("x");
  const [country, setCountry] = useState("NG");

  async function check(e: FormEvent) {
    e.preventDefault();
    setChecking(true);
    setError(null);
    setFound(null);
    try {
      const res = await fetch(`/api/experts?ids=${Number(teamId)}`);
      const body = (await res.json()) as { experts: ExpertProfile[] };
      const p = body.experts[0];
      if (!p) throw new Error("No FPL team with that ID.");
      setFound(p);
      setName((n) => n || p.managerName);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setChecking(false);
    }
  }

  function save() {
    if (!found || !name.trim()) return;
    onSave({ teamId: found.teamId, name: name.trim(), handle: handle.trim() || "—", platform, country });
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="card w-full max-w-md animate-rise rounded-b-none p-5 sm:rounded-b-[1.25rem]">
        <div className="mb-4 flex items-center justify-between">
          <p className="font-display text-xl font-semibold">Add an expert</p>
          <button onClick={onClose} className="rounded-full p-2 text-muted hover:bg-white/5" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={check} className="flex gap-2">
          <input
            autoFocus
            inputMode="numeric"
            value={teamId}
            onChange={(e) => setTeamId(e.target.value.replace(/\D/g, ""))}
            placeholder="Their FPL team ID"
            className={`${field} num`}
          />
          <button
            type="submit"
            disabled={!teamId || checking}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-white/10 px-4 text-sm font-semibold hover:bg-white/15 disabled:opacity-40"
          >
            {checking ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />} Check
          </button>
        </form>
        <p className="mt-2 text-xs text-faint">Creators usually share it in their posts or video descriptions.</p>
        {error && <p className="mt-3 text-sm text-bad">{error}</p>}

        {found && (
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-3 rounded-xl border border-good/30 bg-good/[0.07] p-3 text-sm">
              <Check size={17} className="shrink-0 text-good" />
              <div className="min-w-0">
                <p className="truncate font-semibold">{found.teamName}</p>
                <p className="truncate text-xs text-muted">
                  {found.managerName} · {found.totalPoints} pts · rank {fmtRank(found.overallRank)}
                </p>
              </div>
            </div>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name to show" className={field} />
            <input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@handle or channel" className={field} />
            <div className="grid grid-cols-3 gap-2">
              {(["x", "youtube", "other"] as const).map((p) => (
                <button
                  type="button"
                  key={p}
                  onClick={() => setPlatform(p)}
                  className={`rounded-xl border py-2 text-sm font-medium ${platform === p ? "border-volt bg-volt/10 text-volt" : "border-line-strong text-muted"}`}
                >
                  {p === "x" ? "X" : p === "youtube" ? "YouTube" : "Other"}
                </button>
              ))}
            </div>
            <select value={country} onChange={(e) => setCountry(e.target.value)} className={field}>
              {COUNTRIES.map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>
            <button onClick={save} disabled={!name.trim()} className="w-full rounded-xl bg-volt py-3 font-semibold text-ink disabled:opacity-40">
              Track this expert
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
