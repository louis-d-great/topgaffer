"use client";

import { useState, type FormEvent } from "react";
import { Brain, Check, Fingerprint, Loader2, Network, Search, Sparkles, ThumbsDown, Undo2 } from "lucide-react";
import { useManager } from "@/components/app-shell";
import { ErrorCard, PageHeader, Skeleton, ToneChip } from "@/components/ui";
import type { Lesson } from "@/lib/fpl/types";
import { KEYS, useLocal, type LockedPlan } from "@/lib/store";
import type { SavedMemory } from "@/lib/use-memory-sync";

const SUGGESTIONS = ["Am I bad at captaincy?", "Do my hits pay off?", "Points left on the bench", "Who did I transfer in?"];

export default function MemoryPage() {
  const { teamId, profile, error, memory } = useManager();
  const [dismissed, setDismissed] = useLocal<string[]>(KEYS.dismissed, []);
  const [plans] = useLocal<Record<string, LockedPlan>>(KEYS.plans, {});

  if (error) return <ErrorCard message={error} onRetry={() => location.reload()} />;
  if (!profile || !teamId) return <Skeleton className="h-96" />;

  const active = profile.lessons.filter((l) => !dismissed.includes(l.id));
  const hidden = profile.lessons.filter((l) => dismissed.includes(l.id));
  const locks = Object.values(plans).sort((a, b) => b.gw - a.gw);
  const name = (id: number) => profile.players[id]?.name ?? "Unknown";
  const timeline = Object.entries(memory.ledger)
    .map(([key, m]) => ({ key, ...m, text: m.text ?? memory.items.find((i) => i.key === key)?.text }))
    .sort((a, b) => order(b.key) - order(a.key));

  return (
    <div className="stagger">
      <PageHeader eyebrow={`${active.length} lessons · ${memory.saved} memories on Walrus`} title="What I know about you" />

      <div className="grid items-start gap-5 lg:grid-cols-[1.4fr_1fr] xl:grid-cols-12">
        <AskMemory teamId={teamId} />

        <section className="grid gap-3 xl:col-span-8 2xl:grid-cols-2">
          {active.map((l, i) => (
            <LessonCard
              key={l.id}
              lesson={l}
              index={i}
              saved={memory.ledger[`lesson-${l.id}-gw${profile.currentGw}`]}
              onDismiss={() => setDismissed([...dismissed, l.id])}
            />
          ))}
          {active.length === 0 && (
            <div className="card p-6 text-sm text-muted">No lessons yet. Play a few gameweeks and TopGaffer starts learning.</div>
          )}
          {hidden.length > 0 && (
            <div className="card p-4 2xl:col-span-2">
              <p className="eyebrow">You said these aren&apos;t true</p>
              <ul className="mt-3 space-y-2">
                {hidden.map((l) => (
                  <li key={l.id} className="flex items-center gap-3 text-sm text-muted">
                    <span className="flex-1 line-through">{l.title}</span>
                    <button
                      onClick={() => setDismissed(dismissed.filter((d) => d !== l.id))}
                      className="inline-flex items-center gap-1 text-xs text-volt hover:underline"
                    >
                      <Undo2 size={13} /> Restore
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <section className="card p-5 2xl:col-span-2">
            <div className="flex items-center justify-between">
              <p className="eyebrow">Memory timeline · stored on Walrus</p>
              {memory.pending > 0 && (
                <span className="inline-flex items-center gap-1.5 text-xs text-info">
                  <Loader2 size={13} className="animate-spin" /> {memory.pending} saving
                </span>
              )}
            </div>
            {memory.error && <p className="mt-3 text-sm text-bad">{memory.error}</p>}
            <ol className="mt-4 space-y-2">
              {timeline.map((m) => (
                <li key={m.key} className="rounded-xl border border-line p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="eyebrow text-[10px]">{label(m.key)}</span>
                    <WalrusChip saved={m} />
                  </div>
                  {m.text && <p className="mt-1.5 text-sm text-muted">{stripTag(m.text)}</p>}
                </li>
              ))}
              {timeline.length === 0 && <li className="text-sm text-muted">Your season is being written to Walrus…</li>}
            </ol>
          </section>
        </section>

        <aside className="space-y-5 xl:col-span-4">
          <section className="card relative overflow-hidden p-5">
            <div className="pointer-events-none absolute -top-16 -right-16 size-48 rounded-full bg-good/10 blur-3xl" />
            <p className="eyebrow">Your memory on Walrus</p>
            <div className="mt-3 flex items-end gap-6">
              <div>
                <p className="num font-display text-4xl font-bold text-good">{memory.saved}</p>
                <p className="text-xs text-muted">stored on mainnet</p>
              </div>
              {memory.pending > 0 && (
                <div>
                  <p className="num font-display text-4xl font-bold text-info">{memory.pending}</p>
                  <p className="text-xs text-muted">saving now</p>
                </div>
              )}
            </div>
            <ul className="mt-5 space-y-4 text-sm">
              <li className="flex gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-volt/10 text-volt">
                  <Brain size={17} />
                </span>
                <div>
                  <p className="font-semibold">Walrus remembers</p>
                  <p className="text-muted">Every gameweek, lesson and locked plan is stored encrypted in Walrus Memory and recalled by meaning.</p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-good/10 text-good">
                  <Fingerprint size={17} />
                </span>
                <div>
                  <p className="font-semibold">Sui proves</p>
                  <p className="text-muted">Each locked plan gets a fingerprint on Sui, so nobody can say you changed it after kickoff.</p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-info/10 text-info">
                  <Network size={17} />
                </span>
                <div>
                  <p className="font-semibold">Tatum connects</p>
                  <p className="text-muted">TopGaffer reads and writes Sui through Tatum&apos;s gateway.</p>
                </div>
              </li>
            </ul>
          </section>

          <section className="card p-5">
            <p className="eyebrow">Locked plans</p>
            <ul className="mt-3 space-y-2">
              {locks.map((p) => (
                <li key={p.gw} className="rounded-xl border border-line p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">GW{p.gw}</span>
                    <span className="inline-flex items-center gap-1 text-xs text-good">
                      <Check size={13} /> Locked
                    </span>
                  </div>
                  <p className="mt-1 text-muted">
                    Captain {name(p.captain)}
                    {p.transfersIn.length > 0 && ` · in: ${p.transfersIn.map(name).join(", ")}`}
                  </p>
                  <p className="num mt-1 truncate text-[11px] text-faint">{p.fingerprint}</p>
                  {p.sui && (
                    <a href={p.sui.explorerUrl} target="_blank" rel="noreferrer" className="mt-1.5 inline-block text-xs font-medium text-volt hover:underline">
                      Proof on Sui {p.sui.network} ↗
                    </a>
                  )}
                </li>
              ))}
              {locks.length === 0 && <li className="text-sm text-muted">Lock a plan on the Deadline screen and it shows up here.</li>}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}

function AskMemory({ teamId }: { teamId: number }) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<{ text: string; blobId: string; distance: number }[] | null>(null);
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
    <section className="card p-5 lg:col-span-2 xl:col-span-12">
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          ask(q);
        }}
        className="flex items-center gap-2 rounded-2xl border border-line-strong bg-ink p-1.5 focus-within:border-volt/60"
      >
        <Sparkles size={18} className="ml-2 shrink-0 text-volt" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ask your memory, e.g. “do my hits pay off?”"
          className="min-w-0 flex-1 bg-transparent px-2 py-2.5 outline-none placeholder:text-faint"
        />
        <button
          type="submit"
          disabled={busy || !q.trim()}
          className="inline-flex items-center gap-2 rounded-xl bg-volt px-4 py-2.5 text-sm font-semibold text-ink disabled:opacity-40"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />} Recall
        </button>
      </form>
      <div className="mt-3 flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button key={s} onClick={() => ask(s)} className="rounded-full border border-line px-3 py-1 text-xs text-muted hover:border-line-strong hover:text-text">
            {s}
          </button>
        ))}
      </div>
      {error && <p className="mt-3 text-sm text-bad">{error}</p>}
      {results && (
        <ul className="mt-4 grid gap-2 lg:grid-cols-2">
          {results.map((r, i) => (
            <li key={r.blobId} className="rounded-xl border border-line bg-white/[0.02] p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="eyebrow text-[10px]">{tagOf(r.text)}</span>
                {i === 0 && <span className="rounded-full bg-good/10 px-2 py-0.5 text-[10px] font-semibold text-good">Closest match</span>}
              </div>
              <p className="mt-1 text-sm">{stripTag(r.text)}</p>
              <p className="num mt-1.5 truncate text-[10px] text-faint">blob {r.blobId}</p>
            </li>
          ))}
          {results.length === 0 && <li className="text-sm text-muted">Nothing in memory matches that yet.</li>}
        </ul>
      )}
    </section>
  );
}

function WalrusChip({ saved }: { saved?: SavedMemory }) {
  if (!saved) return null;
  if (saved.status === "done")
    return (
      <span className="inline-flex max-w-[60%] items-center gap-1 rounded-full bg-good/10 px-2 py-0.5 text-[10px] font-medium text-good" title={saved.blobId ?? ""}>
        <Check size={11} /> On Walrus <span className="num truncate opacity-70">{saved.blobId?.slice(0, 8)}</span>
      </span>
    );
  if (saved.status === "failed" || saved.status === "not_found")
    return <span className="rounded-full bg-bad/10 px-2 py-0.5 text-[10px] font-medium text-bad">Retrying next visit</span>;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-info/10 px-2 py-0.5 text-[10px] font-medium text-info">
      <Loader2 size={11} className="animate-spin" /> Saving to Walrus
    </span>
  );
}

function LessonCard({ lesson, index, saved, onDismiss }: { lesson: Lesson; index: number; saved?: SavedMemory; onDismiss: () => void }) {
  return (
    <article className="card group relative overflow-hidden p-5">
      <span className="num absolute top-4 right-5 font-display text-4xl font-bold text-white/[0.04]">{String(index + 1).padStart(2, "0")}</span>
      <div className="flex flex-wrap items-center gap-2 pr-12">
        <ToneChip tone={lesson.tone} />
        <span className="text-[11px] tracking-wider text-faint uppercase">{lesson.topic}</span>
        <WalrusChip saved={saved} />
      </div>
      <h2 className="mt-3 pr-10 font-display text-xl leading-snug font-semibold">{lesson.title}</h2>
      <p className="mt-1.5 text-sm text-muted">{lesson.detail}</p>
      {lesson.evidence && (
        <p className="mt-3 rounded-xl border-l-2 border-volt/50 bg-white/[0.03] px-3 py-2 text-xs text-text/80">{lesson.evidence}</p>
      )}
      <button onClick={onDismiss} className="mt-4 inline-flex items-center gap-1.5 text-xs text-faint transition hover:text-text">
        <ThumbsDown size={13} /> Not true for me
      </button>
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
  if (key.startsWith("lesson-")) return `Lesson after GW${gw} · ${key.split("-")[1]}`;
  return key;
}

/** Newest first: plans, then lessons, then reviews within a gameweek. */
function order(key: string) {
  const gw = Number(key.match(/gw(\d+)/)?.[1] ?? 0);
  return gw * 10 + (key.includes("-plan-") ? 3 : key.startsWith("lesson-") ? 2 : 1);
}
