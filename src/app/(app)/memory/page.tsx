"use client";

import { useState, type FormEvent } from "react";
import { AlertTriangle, CalendarDays, Check, CheckCircle2, Database, ExternalLink, Info, Lightbulb, Loader2, Lock, Search, Sparkles, Undo2 } from "lucide-react";
import { useManager } from "@/components/app-shell";
import { ActionRow, CountBadge, Panel, PanelLink, StatCard, type Tone } from "@/components/panel";
import { ErrorCard, PageHeader, Skeleton, ToneChip } from "@/components/ui";
import type { Lesson, LessonTone } from "@/lib/fpl/types";
import { KEYS, useLocal, type LockedPlan } from "@/lib/store";
import type { SavedMemory } from "@/lib/use-memory-sync";
import { Button } from "@/components/base/buttons/button";
import { SegmentedControl, SegmentedControlItem } from "@/components/base/segmented-control/segmented-control";

const Spinner = ({ className }: { className?: string }) => <Loader2 className={`animate-spin ${className ?? ""}`} />;

const SUGGESTIONS = ["Am I bad at captaincy?", "Do my hits pay off?", "Points left on the bench", "Who did I transfer in?"];
const FILTERS: { key: "all" | LessonTone; label: string }[] = [
  { key: "all", label: "All" },
  { key: "warning", label: "Watch out" },
  { key: "info", label: "Patterns" },
  { key: "strength", label: "Strengths" },
];

export default function MemoryPage() {
  const { teamId, profile, error, memory } = useManager();
  const [dismissed, setDismissed] = useLocal<string[]>(KEYS.dismissed, []);
  const [plans] = useLocal<Record<string, LockedPlan>>(KEYS.plans, {});
  const [filter, setFilter] = useState<"all" | LessonTone>("all");

  if (error) return <ErrorCard message={error} onRetry={() => location.reload()} />;
  if (!profile || !teamId) return <Skeleton className="h-96" />;

  const active = profile.lessons.filter((l) => !dismissed.includes(l.id));
  const hidden = profile.lessons.filter((l) => dismissed.includes(l.id));
  // Warnings first: they are what should change the next decision.
  const toneOrder = { warning: 0, info: 1, strength: 2 };
  const shown = active.filter((l) => filter === "all" || l.tone === filter).sort((a, b) => toneOrder[a.tone] - toneOrder[b.tone]);
  const locks = Object.values(plans).sort((a, b) => b.gw - a.gw);
  const name = (id: number) => profile.players[id]?.name ?? "Unknown";
  const timeline = Object.entries(memory.ledger)
    .map(([key, m]) => ({ key, ...m, text: m.text ?? memory.items.find((i) => i.key === key)?.text }))
    .sort((a, b) => order(b.key) - order(a.key));
  const count = (tone: LessonTone) => active.filter((l) => l.tone === tone).length;

  return (
    <div className="stagger space-y-5">
      <PageHeader title="Memory" eyebrow={`What TopGaffer has learned from ${profile.gameweeks.length} gameweeks of your decisions`}>
        <TechNote />
      </PageHeader>

      <AskMemory teamId={teamId} />

      <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Lessons" icon={Lightbulb} value={active.length} context={{ text: `from ${profile.gameweeks.length} gameweeks` }} />
        <StatCard label="Watch outs" icon={AlertTriangle} value={count("warning")} context={{ text: "patterns costing you points", tone: count("warning") ? "warning" : undefined }} />
        <StatCard label="Strengths" icon={CheckCircle2} value={count("strength")} context={{ text: "keep doing these", tone: count("strength") ? "good" : undefined }} />
        <StatCard
          label="Memories on Walrus"
          icon={Database}
          value={memory.saved}
          context={{ text: memory.pending ? `${memory.pending} saving now` : "stored on mainnet", tone: memory.pending ? "info" : "good" }}
        />
        <StatCard
          label="Plans locked"
          icon={Lock}
          value={locks.length}
          context={{ text: locks[0]?.sui ? "latest proven on Sui" : "lock one before the deadline" }}
          footer={{ label: "Go to deadline", href: "/deadline" }}
        />
      </div>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SegmentedControl
            aria-label="Filter lessons"
            selectedKeys={[filter]}
            onSelectionChange={(keys) => setFilter([...keys][0] as "all" | LessonTone)}
          >
            {FILTERS.map((f) => (
              <SegmentedControlItem key={f.key} id={f.key}>
                {f.label}
              </SegmentedControlItem>
            ))}
          </SegmentedControl>
          {memory.error && <p className="text-xs text-bad">{memory.error}</p>}
        </div>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          {shown.map((l, i) => (
            <LessonCard
              key={l.id}
              featured={i === 0 && shown.length > 1}
              lesson={l}
              saved={memory.ledger[`lesson-${l.id}-gw${profile.currentGw}`]}
              onDismiss={() => setDismissed([...dismissed, l.id])}
            />
          ))}
          {shown.length === 0 && <p className="text-sm text-muted">Nothing here yet.</p>}
        </div>
        {hidden.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-faint">
            <span>Marked not true:</span>
            {hidden.map((l) => (
              <button key={l.id} onClick={() => setDismissed(dismissed.filter((d) => d !== l.id))} className="inline-flex items-center gap-1 hover:text-text">
                <Undo2 size={12} /> {l.title}
              </button>
            ))}
          </div>
        )}
      </section>

      <div className="grid items-start gap-5 xl:grid-cols-12">
        <Panel
          className="xl:col-span-8"
          title="Memory timeline"
          subtitle="Everything TopGaffer has written to Walrus for your team"
          action={memory.pending > 0 ? <CountBadge tone="info">{memory.pending} saving</CountBadge> : <CountBadge>{timeline.length} entries</CountBadge>}
        >
          <ul className="divide-y divide-line">
            {timeline.map((m) => {
              const kind = kindOf(m.key);
              return (
                <ActionRow
                  key={m.key}
                  icon={kind.icon}
                  tone={kind.tone}
                  title={label(m.key)}
                  subtitle={m.text ? stripTag(m.text) : undefined}
                  right={<WalrusStatus saved={m} />}
                />
              );
            })}
            {timeline.length === 0 && <li className="px-5 py-6 text-sm text-muted">Your season is being written to Walrus…</li>}
          </ul>
        </Panel>

        <Panel className="xl:col-span-4" title="Locked plans" subtitle="Fingerprints frozen on Sui" action={<PanelLink href="/deadline">Deadline</PanelLink>}>
          <ul className="divide-y divide-line">
            {locks.map((p) => (
              <ActionRow
                key={p.gw}
                leading={<span className="w-11 shrink-0 text-sm font-semibold text-volt-text">GW{p.gw}</span>}
                title={`Captain ${name(p.captain)}`}
                subtitle={p.transfersIn.length > 0 ? `In: ${p.transfersIn.map(name).join(", ")}` : "No transfers"}
                right={
                  p.sui ? (
                    <a href={p.sui.explorerUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-good hover:underline">
                      On Sui <ExternalLink size={11} />
                    </a>
                  ) : (
                    <span className="text-xs text-faint">This device</span>
                  )
                }
              />
            ))}
            {locks.length === 0 && <li className="px-5 py-6 text-sm text-muted">Lock a plan on the Deadline page and it appears here.</li>}
          </ul>
        </Panel>
      </div>
    </div>
  );
}

/** The tech explanation, available on demand instead of taking up the page. */
function TechNote() {
  return (
    <details className="group relative">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs text-muted hover:text-text">
        <span className="size-1.5 rounded-full bg-good" /> Secured on Walrus + Sui <Info size={12} />
      </summary>
      <div className="absolute right-0 z-20 mt-2 w-80 rounded-xl border border-line-strong bg-raised p-4 text-xs leading-relaxed text-muted shadow-2xl shadow-black/50">
        <p>
          <span className="font-medium text-text">Walrus Memory</span> stores every gameweek review, lesson, locked plan and coach conversation for
          your team, encrypted, on mainnet. TopGaffer recalls them by meaning before it advises you.
        </p>
        <p className="mt-2">
          <span className="font-medium text-text">Sui</span> holds a frozen fingerprint of each locked plan, written through Tatum&apos;s gateway, so it
          provably existed before kickoff.
        </p>
      </div>
    </details>
  );
}

function AskMemory({ teamId }: { teamId: number }) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<{ text: string; blobId: string }[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function ask(query: string) {
    if (!query.trim()) return;
    setQ(query);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/memory/${teamId}?q=${encodeURIComponent(query)}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Recall failed");
      setResults(body.results);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          ask(q);
        }}
        className="flex items-center gap-2 rounded-lg border border-line bg-surface p-1 focus-within:border-line-strong"
      >
        <Search size={16} className="ml-2.5 shrink-0 text-faint" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search your memory, e.g. “do my hits pay off?”"
          className="min-w-0 flex-1 bg-transparent px-1 py-2 text-sm outline-none placeholder:text-faint"
        />
        <Button type="submit" size="small" disabled={busy || !q.trim()} leadingIcon={busy ? Spinner : undefined}>
          Recall
        </Button>
      </form>
      <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-faint">
        Try:
        {SUGGESTIONS.map((s) => (
          <button key={s} onClick={() => ask(s)} className="text-muted underline-offset-2 hover:text-text hover:underline">
            {s}
          </button>
        ))}
      </p>
      {error && <p className="mt-2 text-sm text-bad">{error}</p>}
      {results && (
        <ul className="card mt-3 divide-y divide-line">
          {results.map((r, i) => (
            <li key={r.blobId} className="px-4 py-3">
              <p className="flex items-center gap-2 text-xs text-muted">
                {tagOf(r.text)}
                {i === 0 && <span className="rounded bg-good/10 px-1.5 py-0.5 text-[10px] font-medium text-good">Closest match</span>}
              </p>
              <p className="mt-1 text-sm">{stripTag(r.text)}</p>
            </li>
          ))}
          {results.length === 0 && <li className="px-4 py-3 text-sm text-muted">Nothing in memory matches that yet.</li>}
        </ul>
      )}
    </section>
  );
}

function WalrusStatus({ saved }: { saved?: SavedMemory }) {
  if (!saved) return null;
  if (saved.status === "done")
    return (
      <span className="inline-flex items-center gap-1 text-xs text-faint" title={saved.blobId ?? ""}>
        <Check size={12} className="text-good" /> Walrus
      </span>
    );
  if (saved.status === "failed" || saved.status === "not_found") return <span className="text-xs text-bad">Retrying</span>;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-faint">
      <Loader2 size={12} className="animate-spin" /> Saving
    </span>
  );
}

function LessonCard({ lesson, saved, onDismiss, featured = false }: { lesson: Lesson; saved?: SavedMemory; onDismiss: () => void; featured?: boolean }) {
  return (
    <article className={`card transition hover:border-line-strong ${featured ? "p-6 lg:col-span-2" : "p-5"}`}>
      <div className="flex items-center justify-between gap-2">
        <ToneChip tone={lesson.tone} detail={lesson.topic[0].toUpperCase() + lesson.topic.slice(1)} />
        <WalrusStatus saved={saved} />
      </div>
      <h3 className={`mt-2 leading-snug font-semibold ${featured ? "text-xl" : "text-[15px]"}`}>{lesson.title}</h3>
      <p className="mt-1 text-sm text-muted">{lesson.detail}</p>
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-xs text-faint">{lesson.evidence}</span>
        <button onClick={onDismiss} className="shrink-0 text-xs text-faint hover:text-text">
          Not true for me
        </button>
      </div>
    </article>
  );
}

/** "[TopGaffer · Team · GW8 review] text" → "GW8 review" */
function tagOf(text: string) {
  const m = text.match(/^\[([^\]]+)\]/);
  return m ? (m[1].split(" · ").at(-1) ?? "") : "";
}

function stripTag(text: string) {
  return text.replace(/^\[[^\]]+\]\s*/, "");
}

function label(key: string) {
  const gw = key.match(/gw(\d+)/)?.[1];
  if (key.endsWith("-review")) return `GW${gw} review`;
  if (key.includes("-plan-")) return `GW${gw} plan locked`;
  if (key.startsWith("lesson-")) return `Lesson · ${key.split("-")[1]}`;
  if (key.startsWith("coach-")) return "Coach chat";
  return key;
}

function kindOf(key: string): { icon: typeof Lock; tone: Tone } {
  if (key.includes("-plan-")) return { icon: Lock, tone: "good" };
  if (key.startsWith("lesson-")) return { icon: Lightbulb, tone: "warning" };
  if (key.startsWith("coach-")) return { icon: Sparkles, tone: "info" };
  return { icon: CalendarDays, tone: "neutral" };
}

/** Newest first: plans, then lessons, then reviews within a gameweek. */
function order(key: string) {
  const gw = Number(key.match(/gw(\d+)/)?.[1] ?? 0);
  return gw * 10 + (key.includes("-plan-") ? 3 : key.startsWith("lesson-") ? 2 : 1);
}
