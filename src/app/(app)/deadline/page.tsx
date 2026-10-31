"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ArrowDownUp, Check, CheckCircle2, Crown, ExternalLink, Fingerprint, Loader2, Lock, Minus, Plus, RotateCcw, ShieldAlert, ShieldCheck, Users, Wallet, X } from "@/components/icons";
import { useManager } from "@/components/app-shell";
import { PlayerPicker } from "@/components/player-picker";
import { FDR, FixtureChip, Jersey } from "@/components/kit";
import { ErrorCard, FdrPill, PageHeader, Skeleton, TeamBadge } from "@/components/ui";
import { useExperts } from "@/lib/experts";
import { ActionRow, CountBadge, IconTile, Panel, RowGroup, type Tone } from "@/components/panel";
import { fmtDeadline } from "@/lib/format";
import type { DeadlineData, ManagerProfile, Position, SquadPlayer } from "@/lib/fpl/types";
import type { LockedPlan } from "@/lib/store";
import { usePlans } from "@/lib/use-plans";
import { useApi } from "@/lib/use-api";
import { suggestTransfers, type Suggestion } from "@/lib/suggest";
import { fingerprint, judgePlan, type Note, type Verdict } from "@/lib/verdict";
import { Button } from "@/components/base/buttons/button";

const Spinner = ({ className }: { className?: string }) => <Loader2 className={`animate-spin ${className ?? ""}`} />;

export default function DeadlinePage() {
  const { teamId, profile, error: profileError } = useManager();
  const { data, error } = useApi<DeadlineData>(teamId ? `/api/deadline/${teamId}` : null);
  if (error || profileError) return <ErrorCard message={(error ?? profileError)!} onRetry={() => location.reload()} />;
  if (!data || !profile || !teamId) return <DeadlineSkeleton />;
  return <DeadlineCheck data={data} profile={profile} teamId={teamId} />;
}

interface Swap {
  out: number;
  in: number | null;
}

const ROWS: Position[] = ["GKP", "DEF", "MID", "FWD"];

function DeadlineCheck({ data, profile, teamId }: { data: DeadlineData; profile: ManagerProfile; teamId: number }) {
  const gw = data.gw.id;
  const [plans, setPlans] = usePlans(teamId);
  const { tracked } = useExperts();
  const { memory, reviews } = useManager();
  const locked = plans[gw];

  const [captain, setCaptain] = useState(() => locked?.captain ?? data.squad.find((p) => p.isCaptain)?.id ?? data.squad[0].id);
  const [swaps, setSwaps] = useState<Swap[]>(() =>
    locked ? locked.transfersOut.map((out, i) => ({ out, in: locked.transfersIn[i] ?? null })) : [],
  );
  const [ft, setFt] = useState(data.estimatedFreeTransfers);
  const [selected, setSelected] = useState<number | null>(null);
  const [picking, setPicking] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(!locked);
  const [lockError, setLockError] = useState<string | null>(null);

  const byId = useMemo(() => new Map(data.players.map((p) => [p.id, p])), [data.players]);
  const complete = swaps.filter((s): s is { out: number; in: number } => s.in !== null);
  const plan = { captain, outs: complete.map((s) => s.out), ins: complete.map((s) => s.in), freeTransfers: ft };
  const verdict = judgePlan(plan, data, profile, tracked, reviews[0]);

  // The squad as it would look after the planned transfers.
  const squad: (SquadPlayer & { incoming: boolean })[] = data.squad.map((p) => {
    const swap = complete.find((s) => s.out === p.id);
    const inc = swap && byId.get(swap.in);
    return inc ? { ...p, ...inc, isCaptain: false, isVice: false, incoming: true } : { ...p, incoming: false };
  });
  const starters = squad.filter((p) => !p.benched);
  const bench = squad.filter((p) => p.benched);

  const pickingFor = picking !== null ? data.squad.find((p) => p.id === picking) : undefined;
  // Money available to replace `out`: today's bank plus whatever currently fills that slot.
  const budgetFor = (out: SquadPlayer) => {
    const existing = complete.find((s) => s.out === out.id);
    return verdict.bankAfter + (existing ? (byId.get(existing.in)?.price ?? 0) : out.price);
  };

  function sell(id: number) {
    setSelected(null);
    setPicking(id);
  }

  function choose(inId: number) {
    if (picking === null) return;
    setSwaps((prev) => [...prev.filter((s) => s.out !== picking), { out: picking, in: inId }]);
    if (captain === picking) setCaptain(inId);
    setPicking(null);
  }

  function applySuggestion(out: number, inId: number) {
    setSwaps((prev) => [...prev.filter((s) => s.out !== out), { out, in: inId }]);
    if (captain === out) setCaptain(inId);
    setSelected(null);
  }

  function undoSwap(out: number) {
    const swap = complete.find((s) => s.out === out);
    setSwaps((prev) => prev.filter((s) => s.out !== out));
    if (swap && captain === swap.in) setCaptain(out);
  }

  async function lock() {
    setSaving(true);
    const salt = crypto.randomUUID();
    const fp = await fingerprint(teamId, gw, plan, salt);
    const entry: LockedPlan = {
      gw,
      captain,
      transfersIn: plan.ins,
      transfersOut: plan.outs,
      salt,
      fingerprint: fp,
      savedAt: new Date().toISOString(),
      verdict: LEVELS[verdict.level].label,
      hitCost: verdict.hitCost,
      warnings: verdict.notes.filter((n) => n.tone === "warning" || n.tone === "blocker").map((n) => ({ id: n.id, title: n.title })),
    };
    setLockError(null);
    try {
      entry.sui = await recordOnSui(teamId, gw, fp);
    } catch (err) {
      // Keep the local lock either way; the panel offers a retry for the Sui record.
      setLockError((err as Error).message);
    }
    setPlans({ ...plans, [gw]: entry });
    setSaving(false);
    setEditing(false);

    // The plan and the warnings shown become memory: after the gameweek, TopGaffer can tell whether ignoring them paid off.
    const nm = (id: number) => byId.get(id)?.name ?? "Unknown";
    const moves = complete.map((s) => `${nm(s.in)} in for ${nm(s.out)}`).join(", ");
    memory
      .rememberPlan({
        teamName: profile.teamName,
        summary:
          `Captain ${nm(captain)}. ${moves ? `Transfers: ${moves}` : "No transfers"}${verdict.hitCost ? ` (−${verdict.hitCost} hit)` : ""}.` +
          (entry.sui ? ` Locked on Sui ${entry.sui.network}, transaction ${entry.sui.digest}.` : ""),
        plan: entry,
      })
      .catch(() => {
        // The lock itself is saved locally; only the memory copy of this plan is missing.
      });
  }

  async function retrySui() {
    if (!locked || locked.sui) return;
    setSaving(true);
    setLockError(null);
    try {
      const receipt = await recordOnSui(teamId, gw, locked.fingerprint);
      setPlans({ ...plans, [gw]: { ...locked, sui: receipt } });
    } catch (err) {
      setLockError((err as Error).message);
    }
    setSaving(false);
  }

  const originalId = (p: { id: number }) => complete.find((s) => s.in === p.id)?.out ?? p.id;

  return (
    <div className="stagger">
      <PageHeader eyebrow={`Gameweek ${gw} · ${fmtDeadline(data.gw.deadline)}`} title="Deadline check">
        <div className="flex items-center gap-2 rounded-xl border border-line bg-surface p-1.5 text-sm">
          <span className="pl-2 text-muted">Free transfers</span>
          <button onClick={() => setFt(Math.max(0, ft - 1))} className="rounded-lg p-1.5 hover:bg-fg/5" aria-label="Fewer">
            <Minus size={14} />
          </button>
          <span className="num w-4 text-center font-semibold">{ft}</span>
          <button onClick={() => setFt(Math.min(5, ft + 1))} className="rounded-lg p-1.5 hover:bg-fg/5" aria-label="More">
            <Plus size={14} />
          </button>
        </div>
      </PageHeader>

      <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr] xl:grid-cols-12">
        <section className="min-w-0 xl:col-span-7">
          {/* Pitch: mown stripes, vignette, floodlit centre */}
          <div className="relative overflow-hidden rounded-t-xl bg-[repeating-linear-gradient(180deg,#17603a_0_56px,#124d2b_56px_112px)] px-2 pt-6 pb-8 shadow-[inset_0_0_140px_rgba(0,0,0,0.65),0_20px_40px_-20px_rgba(0,0,0,0.8)] ring-1 ring-white/10 sm:px-4">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_45%_at_50%_45%,rgba(212,255,58,0.08),transparent_70%)]" />
            <PitchLines />
            <div className="relative space-y-5 sm:space-y-7">
              {ROWS.map((pos, row) => (
                <div key={pos} className="flex justify-center gap-1 sm:gap-4">
                  {starters
                    .filter((p) => p.pos === pos)
                    .map((p, i) => (
                      <PlayerChip
                        key={p.id}
                        p={p}
                        order={row * 5 + i}
                        tipBelow={row === 0}
                        captain={p.id === captain}
                        selected={selected === originalId(p)}
                        onClick={() => editing && setSelected(selected === originalId(p) ? null : originalId(p))}
                      />
                    ))}
                </div>
              ))}
            </div>
          </div>

          {/* Bench: the dugout, a separate strip below the pitch */}
          <div className="relative rounded-b-xl border border-t-0 border-line bg-[linear-gradient(180deg,#0d1114,#0a0d10)] px-3 pt-4 pb-4">
            <p className="eyebrow mb-3 text-center text-faint">Dugout</p>
            <div className="flex justify-center gap-1 sm:gap-4">
              {bench.map((p, i) => (
                <PlayerChip
                  key={p.id}
                  p={p}
                  order={20 + i}
                  captain={false}
                  selected={selected === originalId(p)}
                  onClick={() => editing && setSelected(selected === originalId(p) ? null : originalId(p))}
                />
              ))}
            </div>
          </div>

          {/* Actions for the selected player */}
          {editing && selected !== null && (
            <SelectedBar
              player={squad.find((p) => originalId(p) === selected)!}
              isCaptain={squad.find((p) => originalId(p) === selected)!.id === captain}
              swapped={complete.some((s) => s.out === selected)}
              onCaptain={() => {
                const p = squad.find((x) => originalId(x) === selected)!;
                if (!p.benched) setCaptain(p.id);
                setSelected(null);
              }}
              onSell={() => sell(selected)}
              onUndo={() => {
                undoSwap(selected);
                setSelected(null);
              }}
              onClose={() => setSelected(null)}
            />
          )}

          {complete.length > 0 && (
            <div className="card mt-4 space-y-2 p-4">
              <p className="eyebrow">Planned transfers</p>
              {complete.map((s) => (
                <div key={s.out} className="flex items-center gap-2 text-sm">
                  <span className="text-bad">{byId.get(s.out)?.name}</span>
                  <ArrowDownUp size={14} className="text-faint" />
                  <span className="font-semibold text-good">{byId.get(s.in)?.name}</span>
                  {editing && (
                    <button onClick={() => undoSwap(s.out)} className="ml-auto text-faint hover:text-text" aria-label="Undo transfer">
                      <X size={15} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          {editing && <p className="mt-3 text-center text-xs text-faint">Tap a player to make him captain or sell him.</p>}
          {editing && (
            <Suggestions
              suggestions={suggestTransfers({
                squad,
                players: data.players,
                budgetFor,
                locked: new Set(complete.flatMap((x) => [x.out, x.in])),
                profile,
              })}
              freeTransfers={ft}
              planned={complete.length}
              onUse={applySuggestion}
            />
          )}
        </section>

        <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start xl:col-span-5">
          <VerdictPanel
            verdict={verdict}
            captain={byId.get(captain)?.name ?? ""}
            transfers={complete.length}
            locked={editing ? undefined : locked}
            saving={saving}
            onLock={lock}
            onEdit={() => setEditing(true)}
            lockError={lockError}
            onRetrySui={retrySui}
            onNote={(n) => {
              // Notes about a player select that player on the pitch, ready to captain or sell.
              const pid = n.id.startsWith("flag-") || n.id.startsWith("chase-") ? Number(n.id.split("-")[1]) : n.id.startsWith("cap-") ? captain : null;
              if (!editing || pid === null) return undefined;
              const target = squad.find((p) => p.id === pid);
              return target ? () => setSelected(originalId(target)) : undefined;
            }}
          />
        </aside>
      </div>

      <PlayerPicker
        open={pickingFor !== undefined}
        title={pickingFor ? `Replace ${pickingFor.name}` : ""}
        players={data.players}
        position={pickingFor?.pos}
        maxPrice={pickingFor ? budgetFor(pickingFor) : undefined}
        exclude={squad.map((p) => p.id)}
        onPick={(p) => choose(p.id)}
        onClose={() => setPicking(null)}
      />
    </div>
  );
}

function PitchLines() {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-25" preserveAspectRatio="none" viewBox="0 0 100 140" aria-hidden>
      <g fill="none" stroke="white" strokeWidth="0.35" vectorEffect="non-scaling-stroke">
        <rect x="3" y="2" width="94" height="136" rx="0.5" />
        <line x1="3" y1="70" x2="97" y2="70" />
        <circle cx="50" cy="70" r="10" />
        <rect x="24" y="2" width="52" height="20" />
        <rect x="37" y="2" width="26" height="7" />
        <path d="M40 22 Q50 29 60 22" />
        <rect x="24" y="118" width="52" height="20" />
        <rect x="37" y="131" width="26" height="7" />
        <path d="M40 118 Q50 111 60 118" />
      </g>
    </svg>
  );
}

function PlayerChip({
  p,
  order,
  tipBelow = false,
  captain,
  selected,
  onClick,
}: {
  p: SquadPlayer & { incoming: boolean };
  order: number;
  tipBelow?: boolean;
  captain: boolean;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{ animationDelay: `${order * 35}ms` }}
      className="group relative flex w-[4.4rem] min-w-0 shrink animate-rise flex-col items-center rounded-xl pt-1 pb-1 outline-none focus-visible:ring-2 focus-visible:ring-volt sm:w-24"
    >
      <span className="relative grid place-items-center transition duration-200 group-hover:-translate-y-1">
        {captain && <span className="absolute inset-0 -m-2 animate-glow rounded-full bg-volt/35 blur-lg" aria-hidden />}
        <span
          className={`relative rounded-full p-1 transition ${
            selected ? "bg-volt/25 ring-2 ring-volt" : captain ? "ring-2 ring-volt/80" : "ring-1 ring-transparent"
          }`}
        >
          <Jersey team={p.team} code={p.teamCode} pos={p.pos} size={54} />
        </span>
        {captain && (
          <span className="absolute -top-0.5 -right-1 grid size-5 place-items-center rounded-full bg-volt text-[10px] font-black text-neutral-950 shadow-[0_0_12px_var(--color-volt)]">
            C
          </span>
        )}
        {!captain && p.isVice && (
          <span className="absolute -top-0.5 -right-1 grid size-5 place-items-center rounded-full bg-white/90 text-[10px] font-black text-neutral-950">V</span>
        )}
        {p.incoming && (
          <span className="absolute -top-0.5 -left-1 rounded-full bg-good px-1.5 text-[9px] font-black text-neutral-950">IN</span>
        )}
        {!p.incoming && p.status !== "a" && (
          <span className="absolute -top-0.5 -left-1 grid size-5 place-items-center rounded-full bg-warn text-neutral-950">
            <ShieldAlert size={12} />
          </span>
        )}
      </span>
      <span
        className={`mt-1 max-w-full truncate rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-white ring-1 backdrop-blur sm:text-xs ${
          p.incoming ? "bg-good/30 ring-good/60" : "bg-black/60 ring-white/10"
        }`}
      >
        {p.name}
      </span>
      <FixtureChip fixture={p.fixture} />

      {/* Hover card */}
      <span className={`pointer-events-none absolute left-1/2 z-20 hidden w-44 ${tipBelow ? "top-full mt-1" : "bottom-full mb-1"} -translate-x-1/2 rounded-xl border border-line-strong bg-raised/95 p-2.5 text-left shadow-2xl shadow-black/60 backdrop-blur sm:group-hover:block sm:group-focus-visible:block`}>
        <span className="block text-xs font-semibold text-text">{p.fullName}</span>
        <span className="mt-1.5 grid grid-cols-3 gap-1 text-center">
          {[
            ["Price", `£${p.price.toFixed(1)}`],
            ["Form", p.form.toFixed(1)],
            ["xP", p.xp.toFixed(1)],
          ].map(([k, v]) => (
            <span key={k} className="rounded-md bg-white/5 py-1">
              <span className="block text-[9px] text-faint">{k}</span>
              <span className="num block text-xs font-semibold text-text">{v}</span>
            </span>
          ))}
        </span>
        <span className="mt-1.5 block text-[10px] text-muted">{p.selectedBy}% owned</span>
        {p.news && <span className="mt-1 block text-[10px] text-warn">{p.news}</span>}
      </span>
    </button>
  );
}

function SelectedBar({
  player,
  isCaptain,
  swapped,
  onCaptain,
  onSell,
  onUndo,
  onClose,
}: {
  player: SquadPlayer;
  isCaptain: boolean;
  swapped: boolean;
  onCaptain: () => void;
  onSell: () => void;
  onUndo: () => void;
  onClose: () => void;
}) {
  return (
    <div className="card mt-4 flex animate-rise flex-wrap items-center gap-3 p-3">
      <TeamBadge team={player.team} size={36} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{player.name}</p>
        <p className="flex items-center gap-1.5 text-xs text-muted">
          £{player.price.toFixed(1)}m · form {player.form.toFixed(1)}
          {player.fixture && <FdrPill difficulty={player.fixture.difficulty} />}
        </p>
      </div>
      {!player.benched && !isCaptain && (
        <button onClick={onCaptain} className="inline-flex items-center gap-1.5 rounded-xl bg-volt px-3 py-2 text-sm font-semibold text-neutral-950">
          <Crown size={15} /> Captain
        </button>
      )}
      {swapped ? (
        <button onClick={onUndo} className="inline-flex items-center gap-1.5 rounded-xl bg-fg/10 px-3 py-2 text-sm font-semibold">
          <RotateCcw size={15} /> Undo
        </button>
      ) : (
        <button onClick={onSell} className="inline-flex items-center gap-1.5 rounded-xl bg-fg/10 px-3 py-2 text-sm font-semibold hover:bg-fg/15">
          <ArrowDownUp size={15} /> Sell
        </button>
      )}
      <button onClick={onClose} className="p-1 text-faint hover:text-text" aria-label="Close">
        <X size={16} />
      </button>
    </div>
  );
}

const LEVELS = {
  solid: { label: "Good to go", sub: "Nothing here repeats a past mistake.", cls: "text-good", tone: "good", icon: ShieldCheck },
  think: { label: "Think twice", sub: "You've been here before. Here's what happened.", cls: "text-warn", tone: "warning", icon: AlertTriangle },
  blocked: { label: "Fix this first", sub: "This plan breaks an FPL rule.", cls: "text-bad", tone: "bad", icon: ShieldAlert },
} as const;

const NOTE_TONE: Record<Note["tone"], { tone: Tone; icon: typeof AlertTriangle }> = {
  blocker: { tone: "bad", icon: ShieldAlert },
  warning: { tone: "warning", icon: AlertTriangle },
  info: { tone: "info", icon: Users },
  strength: { tone: "good", icon: CheckCircle2 },
};

/**
 * The verdict as an "attention required" list: what to fix or check first, then what's worth knowing.
 * Rows about a specific player select that player on the pitch.
 */
function VerdictPanel({
  verdict,
  captain,
  transfers,
  locked,
  saving,
  onLock,
  onEdit,
  lockError,
  onRetrySui,
  onNote,
}: {
  verdict: Verdict;
  captain: string;
  transfers: number;
  locked?: LockedPlan;
  saving: boolean;
  onLock: () => void;
  onEdit: () => void;
  lockError: string | null;
  onRetrySui: () => void;
  /** Returns a handler when the note points at a player who can be selected. */
  onNote: (note: Note) => (() => void) | undefined;
}) {
  const level = LEVELS[verdict.level];
  const [showDetails, setShowDetails] = useState(false);
  // Only claim "you've been here before" when a warning actually comes from the manager's history.
  const fromMemory = verdict.notes.some((n) => n.tone === "warning" && (n.id === "hit" || n.id.startsWith("chase-")));
  const sub = verdict.level === "think" && !fromMemory ? "A few things to check before you lock." : level.sub;
  const attention = verdict.notes.filter((n) => n.tone === "blocker" || n.tone === "warning");
  const context = verdict.notes.filter((n) => n.tone === "info" || n.tone === "strength");

  const row = (n: Note) => {
    const t = NOTE_TONE[n.tone];
    return (
      <ActionRow
        key={n.id}
        icon={t.icon}
        tone={t.tone}
        title={n.title}
        onClick={onNote(n)}
        subtitle={
          n.people && n.people.length > 0 ? (
            <span className="mt-1 flex flex-wrap gap-1">
              {n.people.map((name) => (
                <span key={name} className="inline-flex items-center gap-1 rounded-full bg-fg/[0.05] py-0.5 pr-2 pl-0.5 text-[11px] text-text/80">
                  <span className="grid size-4 place-items-center rounded-full bg-[var(--color-series-expert)] text-[8px] font-bold text-white">
                    {name
                      .split(" ")
                      .map((w) => w[0])
                      .slice(0, 2)
                      .join("")}
                  </span>
                  {name}
                </span>
              ))}
            </span>
          ) : (
            n.because
          )
        }
      />
    );
  };

  return (
    <Panel
      title="TopGaffer's verdict"
      subtitle="Checked against your own history"
      action={
        <CountBadge tone={attention.length ? (verdict.level === "blocked" ? "bad" : "warning") : "good"}>
          {attention.length ? `${attention.length} to check` : "All clear"}
        </CountBadge>
      }
    >
      <div className="flex items-center gap-4 px-5 py-5">
        <IconTile icon={level.icon} tone={level.tone} size="lg" />
        <div className="min-w-0">
          <p className={`text-2xl font-semibold tracking-tight ${level.cls}`}>{level.label}</p>
          <p className="mt-0.5 text-sm text-muted">{sub}</p>
        </div>
      </div>

      <dl className="grid grid-cols-3 divide-x divide-line border-y border-line">
        {[
          { label: "Captain", value: captain, icon: Crown },
          {
            label: "Transfers",
            value: (
              <>
                {transfers}
                {verdict.hitCost > 0 && <span className="ml-1 text-sm text-bad">−{verdict.hitCost}</span>}
              </>
            ),
            icon: ArrowDownUp,
          },
          { label: "Bank after", value: `£${verdict.bankAfter.toFixed(1)}m`, icon: Wallet, bad: verdict.bankAfter < 0 },
        ].map(({ label, value, icon: Icon, bad }) => (
          <div key={label} className="min-w-0 px-5 py-3.5">
            <dt className="flex items-center gap-1 text-xs text-muted">
              <Icon size={12} /> {label}
            </dt>
            <dd className={`mt-1 truncate text-lg font-semibold ${bad ? "text-bad" : ""}`}>{value}</dd>
          </div>
        ))}
      </dl>

      {attention.length > 0 && <RowGroup label="Needs attention">{attention.map(row)}</RowGroup>}
      {context.length > 0 && <RowGroup label="Good to know">{context.map(row)}</RowGroup>}
      {verdict.notes.length === 0 && (
        <p className="px-5 py-5 text-sm text-muted">
          No red flags from your history. Make a transfer or change your captain to see what TopGaffer remembers.
        </p>
      )}

      <div className="mt-auto border-t border-line p-5">
        {locked ? (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-2 text-sm font-semibold text-good">
                <Check size={16} /> Plan locked
                <span className="text-xs font-normal text-muted">
                  {new Date(locked.savedAt).toLocaleString("en-GB", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}
                </span>
              </p>
              <button onClick={onEdit} className="text-sm text-muted hover:text-text">
                Change plan
              </button>
            </div>
            {locked.sui ? (
              <a
                href={locked.sui.explorerUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 flex w-fit items-center gap-1.5 rounded-lg bg-fg/[0.05] px-3 py-2 text-xs font-semibold text-text hover:bg-fg/[0.08]"
              >
                <ShieldCheck size={14} className="text-good" /> Proof on Sui {locked.sui.network}
                <ExternalLink size={12} className="text-muted" />
              </a>
            ) : (
              <div className="mt-3">
                <p className="text-xs text-warn">{lockError ?? "Saved, but not yet recorded on Sui."}</p>
                <Button size="small" onClick={onRetrySui} disabled={saving} leadingIcon={saving ? Spinner : ShieldCheck} className="mt-2">
                  {saving ? "Recording on Sui…" : "Record on Sui now"}
                </Button>
              </div>
            )}
            <button onClick={() => setShowDetails(!showDetails)} className="mt-3 flex items-center gap-1 text-[11px] text-faint hover:text-muted">
              <Fingerprint size={12} /> {showDetails ? "Hide details" : "Details"}
            </button>
            {showDetails && (
              <p className="num mt-1 break-all text-[11px] text-faint">
                Fingerprint {locked.fingerprint}
                {locked.sui && (
                  <>
                    <br />
                    Transaction {locked.sui.digest}
                  </>
                )}
              </p>
            )}
          </div>
        ) : (
          <Button onClick={onLock} disabled={verdict.level === "blocked" || saving} leadingIcon={saving ? Spinner : Lock} className="w-full">
            {saving ? "Locking on Sui…" : verdict.level === "think" ? "Lock it anyway" : "Lock my plan"}
          </Button>
        )}
      </div>
    </Panel>
  );
}

function DeadlineSkeleton() {
  return (
    <div>
      <Skeleton className="mb-6 h-14 w-72" />
      <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr] xl:grid-cols-12">
        <Skeleton className="h-[34rem]" />
        <Skeleton className="h-96" />
      </div>
    </div>
  );
}

async function recordOnSui(teamId: number, gw: number, fingerprint: string) {
  const res = await fetch("/api/lock", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ teamId, gw, fingerprint }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? "Couldn't record the lock on Sui");
  return body as { digest: string; network: string; explorerUrl: string };
}

/** Weak spots in the squad, each with affordable replacements and the numbers behind them. */
function Suggestions({
  suggestions,
  freeTransfers,
  planned,
  onUse,
}: {
  suggestions: Suggestion[];
  freeTransfers: number;
  planned: number;
  onUse: (out: number, inId: number) => void;
}) {
  const free = Math.max(0, freeTransfers - planned);
  return (
    <Panel
      className="mt-5"
      title="Suggested transfers"
      subtitle="Your weakest spots, and who could replace them"
      action={<CountBadge tone={suggestions.length ? "warning" : "good"}>{suggestions.length ? `${suggestions.length} weak spot${suggestions.length > 1 ? "s" : ""}` : "Squad looks fine"}</CountBadge>}
    >
      {suggestions.length === 0 ? (
        <p className="px-5 py-6 text-sm text-muted">No move clearly beats what you have over the next 3 gameweeks. Rolling the transfer is a fair call.</p>
      ) : (
        <>
          <p className="border-b border-line px-5 py-3 text-xs text-muted">
            {free > 0 ? `You have ${free} free transfer${free > 1 ? "s" : ""} left. ` : "No free transfers left: each move costs 4 pts. "}
            Options are ranked by points expected over the next 3 gameweeks (recent form and season average, adjusted for fixture difficulty). Only take a move if its gain beats the cost. You decide; the verdict checks whatever you pick.
          </p>
          <ul className="divide-y divide-line">
            {suggestions.map((s) => (
              <li key={s.out.id} className="px-5 py-4">
                <div className="flex items-start gap-3">
                  <IconTile tone={s.urgent ? "warning" : "neutral"} icon={s.urgent ? AlertTriangle : ArrowDownUp} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">Replace {s.out.name}</p>
                    <p className="text-xs text-muted">
                      {s.reason} · <span className="num">{s.outEst.toFixed(1)}</span> pts expected over 3 GWs
                    </p>
                  </div>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  {s.options.map((o) => (
                    <div key={o.player.id} className="flex min-w-0 flex-col rounded-2xl bg-fg/[0.03] p-3 ring-1 ring-line">
                      <div className="flex items-center gap-2.5">
                        <Jersey team={o.player.team} code={o.player.teamCode} pos={o.player.pos} size={34} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{o.player.name}</p>
                          <p className="num text-xs text-muted">
                            {o.player.team} · £{o.player.price.toFixed(1)}m
                          </p>
                        </div>
                      </div>
                      <div className="mt-2.5 flex items-baseline gap-1.5">
                        <span className="num text-xl font-semibold tracking-tight">{o.est.toFixed(1)}</span>
                        <span className="text-xs text-muted">pts in 3 GWs</span>
                        <span className={`num ml-auto text-xs font-semibold ${o.gain > 0 ? "text-good" : "text-faint"}`}>
                          {o.gain > 0 ? "+" : ""}
                          {o.gain.toFixed(1)}
                        </span>
                      </div>
                      <dl className="num mt-1 flex gap-3 text-[11px] text-muted">
                        <div>
                          <dt className="inline">Season avg </dt>
                          <dd className="inline font-semibold text-text">{o.player.ppg.toFixed(1)}</dd>
                        </div>
                        <div>
                          <dt className="inline">Form </dt>
                          <dd className="inline font-semibold text-text">{o.player.form.toFixed(1)}</dd>
                        </div>
                        <div>
                          <dt className="inline">Owned </dt>
                          <dd className="inline font-semibold text-text">{o.player.selectedBy}%</dd>
                        </div>
                      </dl>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {o.player.run.map((gw, i) =>
                          gw.length === 0 ? (
                            <span key={i} className="rounded-md bg-fg/[0.06] px-1.5 py-0.5 text-[10px] text-faint">
                              Blank
                            </span>
                          ) : (
                            gw.map((f, j) => {
                              const c = FDR[f.difficulty] ?? FDR[3];
                              return (
                                <span
                                  key={`${i}-${j}`}
                                  className="rounded-md px-1.5 py-0.5 text-[10px] font-bold"
                                  style={{ background: c.bg, color: c.fg }}
                                  title={`Difficulty ${f.difficulty} of 5`}
                                >
                                  {f.opponent} ({f.home ? "H" : "A"})
                                </span>
                              );
                            })
                          ),
                        )}
                      </div>
                      {o.tags.length > 0 && (
                        <ul className="mt-2 space-y-1">
                          {o.tags.slice(0, 3).map((t) => (
                            <li
                              key={t.text}
                              className={`text-[11px] leading-snug ${t.tone === "warn" ? "text-warn" : t.tone === "good" ? "text-good" : "text-muted"}`}
                            >
                              {t.text}
                            </li>
                          ))}
                        </ul>
                      )}
                      <button
                        onClick={() => onUse(s.out.id, o.player.id)}
                        className="mt-auto w-full rounded-lg bg-fg/[0.07] py-2 text-xs font-semibold transition hover:bg-volt hover:text-neutral-950 [&:not(:first-child)]:mt-3"
                      >
                        Use this
                      </button>
                    </div>
                  ))}
                </div>
              </li>
            ))}
          </ul>
          <p className="border-t border-line px-5 py-3 text-[11px] text-faint">
            Estimates use today&apos;s prices; your selling price can be a little lower. They come from form, season average and fixtures: a guide, not a guarantee.
          </p>
        </>
      )}
    </Panel>
  );
}
