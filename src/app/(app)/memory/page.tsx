"use client";

import { useState, type FormEvent } from "react";
import { Check, ExternalLink, Info, Loader2, Search, Undo2 } from "lucide-react";
import { useManager } from "@/components/app-shell";
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
  const shown = active.filter((l) => filter === "all" || l.tone === filter);
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

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {[
          { label: "Lessons", value: active.length },
          { label: "Watch outs", value: count("warning"), dot: "bg-warn" },
          { label: "Strengths", value: count("strength"), dot: "bg-good" },
          {
            label: "Memories on Walrus",
            value: memory.saved,
            hint: memory.pending ? `${memory.pending} saving` : "mainnet",
          },
          { label: "Plans locked", value: locks.length, hint: locks[0]?.sui ? "on Sui" : undefined },
        ].map((s) => (
          <div key={s.label} className="card p-4">
            <dt className="flex items-center gap-1.5 text-xs text-muted">
              {s.dot && <span className={`size-1.5 rounded-full ${s.dot}`} />}
              {s.label}
            </dt>
            <dd className="mt-1 flex items-baseline gap-2">
              <span className="num text-2xl font-semibold tracking-tight">{s.value}</span>
              {s.hint && <span className="text-xs text-faint">{s.hint}</span>}
            </dd>
          </div>
        ))}
      </dl>

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
          {shown.map((l) => (
            <LessonCard
              key={l.id}
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
        <section className="card xl:col-span-8">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="text-sm font-semibold">Memory timeline</h2>
            {memory.pending > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs text-muted">
                <Loader2 size={12} className="animate-spin" /> {memory.pending} saving to Walrus
              </span>
            )}
          </div>
          <ol className="divide-y divide-line">
            {timeline.map((m) => (
              <li key={m.key} className="grid gap-1 px-4 py-3 sm:grid-cols-[9rem_1fr_auto] sm:gap-4">
                <span className="text-xs text-muted">{label(m.key)}</span>
                <span className="text-sm text-text/85">{m.text ? stripTag(m.text) : "—"}</span>
                <WalrusStatus saved={m} />
              </li>
            ))}
            {timeline.length === 0 && <li className="px-4 py-6 text-sm text-muted">Your season is being written to Walrus…</li>}
          </ol>
        </section>

        <section className="card xl:col-span-4">
          <h2 className="border-b border-line px-4 py-3 text-sm font-semibold">Locked plans</h2>
          <ul className="divide-y divide-line">
            {locks.map((p) => (
              <li key={p.gw} className="px-4 py-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">GW{p.gw}</span>
                  {p.sui ? (
                    <a href={p.sui.explorerUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-muted hover:text-text">
                      <Check size={12} className="text-good" /> On Sui <ExternalLink size={11} />
                    </a>
                  ) : (
                    <span className="text-xs text-faint">This device only</span>
                  )}
                </div>
                <p className="mt-0.5 text-muted">
                  Captain {name(p.captain)}
                  {p.transfersIn.length > 0 && ` · in: ${p.transfersIn.map(name).join(", ")}`}
                </p>
              </li>
            ))}
            {locks.length === 0 && <li className="px-4 py-4 text-sm text-muted">Lock a plan on the Deadline page and it appears here.</li>}
          </ul>
        </section>
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

function LessonCard({ lesson, saved, onDismiss }: { lesson: Lesson; saved?: SavedMemory; onDismiss: () => void }) {
  return (
    <article className="card p-4 transition hover:border-line-strong">
      <div className="flex items-center justify-between gap-2">
        <ToneChip tone={lesson.tone} detail={lesson.topic[0].toUpperCase() + lesson.topic.slice(1)} />
        <WalrusStatus saved={saved} />
      </div>
      <h3 className="mt-2 text-[15px] leading-snug font-semibold">{lesson.title}</h3>
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

/** Newest first: plans, then lessons, then reviews within a gameweek. */
function order(key: string) {
  const gw = Number(key.match(/gw(\d+)/)?.[1] ?? 0);
  return gw * 10 + (key.includes("-plan-") ? 3 : key.startsWith("lesson-") ? 2 : 1);
}
