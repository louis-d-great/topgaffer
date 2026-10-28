"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { Brain, ChevronDown, Loader2, RotateCcw, Send, Sparkles } from "lucide-react";
import { useManager } from "@/components/app-shell";
import { PageHeader, Skeleton } from "@/components/ui";
import { useExperts } from "@/lib/experts";
import { useLocal } from "@/lib/store";
import { Button } from "@/components/base/buttons/button";

interface Message {
  role: "user" | "coach";
  text: string;
  memories?: { text: string; blobId: string }[];
  model?: string;
  status?: "thinking" | "retrying" | "fallback";
}

const SUGGESTIONS = [
  "Who should I captain this week?",
  "Should I take a hit this week?",
  "What's my biggest weakness as a manager?",
  "Which expert's style suits me best?",
  "Rate my team for the next gameweek",
];

export default function CoachPage() {
  const { teamId, profile, memory } = useManager();
  const { tracked } = useExperts();
  const [messages, setMessages] = useLocal<Message[]>(`tg.coach.${teamId ?? 0}`, []);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  if (!teamId || !profile) return <Skeleton className="h-96" />;

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    setInput("");
    setError(null);
    setBusy(true);
    const history = [...messages.filter((m) => m.status !== "fallback"), { role: "user" as const, text: q }];
    let current: Message = { role: "coach", text: "", status: "thinking" };
    const render = () => setMessages([...history, current].slice(-40));
    render();

    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          teamId,
          messages: history.map(({ role, text }) => ({ role, text })),
          experts: tracked.map((t) => ({ id: t.expert.teamId, name: t.expert.name })),
        }),
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "The coach couldn't answer right now.");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, nl);
          buffer = buffer.slice(nl + 1);
          if (!line.trim()) continue;
          const e = JSON.parse(line);
          if (e.type === "memories") current = { ...current, memories: e.items };
          else if (e.type === "model") current = { ...current, model: e.model ?? e.name };
          else if (e.type === "text") current = { ...current, status: undefined, text: current.text + e.delta };
          else if (e.type === "reset") current = { ...current, text: "", status: "retrying" };
          else if (e.type === "fallback") {
            current = {
              ...current,
              status: "fallback",
              text: current.memories?.length
                ? "The AI coach is busy right now (free tier). Here's what your memory says about this:"
                : "The AI coach is busy right now (free tier). Try again in a minute.",
            };
          }
          render();
        }
      }
    } catch (err) {
      setError((err as Error).message);
      setMessages(history.slice(0, -1));
      setInput(q);
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    ask(input);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      ask(input);
    }
  }

  return (
    <div className="stagger">
      <PageHeader eyebrow="Your FPL coach with a memory" title="Ask TopGaffer">
        {messages.length > 0 && (
          <Button variant="secondary" size="small" leadingIcon={RotateCcw} onClick={() => setMessages([])}>
            New chat
          </Button>
        )}
      </PageHeader>

      <div className="grid items-start gap-5 xl:grid-cols-12">
        <section className="card flex min-h-[32rem] flex-col xl:col-span-8">
          <div className="flex-1 space-y-5 p-5">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-center">
                <div className="grid size-12 place-items-center rounded-xl bg-fg/[0.06] text-volt-text ring-1 ring-line">
                  <Sparkles size={22} />
                </div>
                <p className="mt-4 text-lg font-semibold">What do you want to know, {profile.managerName.split(" ")[0]}?</p>
                <p className="mt-2 max-w-md text-sm text-muted">
                  I know your whole season, your squad for GW{profile.nextGw?.id ?? profile.currentGw + 1}, the experts you follow, and every memory saved on Walrus.
                </p>
                <div className="mt-6 flex max-w-xl flex-wrap justify-center gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} onClick={() => ask(s)} className="rounded-lg border border-line px-3 py-1.5 text-sm text-muted transition hover:border-line-strong hover:text-text">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m, i) => <Bubble key={i} m={m} />)
            )}
            <div ref={endRef} />
          </div>

          <form onSubmit={onSubmit} className="sticky bottom-24 rounded-b-[1.25rem] border-t border-line bg-surface/90 p-3 backdrop-blur md:bottom-0">
            {error && <p className="mb-2 px-1 text-sm text-bad">{error}</p>}
            <div className="flex items-end gap-2 rounded-xl border border-line-strong bg-ink p-1.5 focus-within:border-volt/60">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                rows={1}
                maxLength={1000}
                placeholder="Ask about captains, transfers, hits, experts…"
                className="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-faint"
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                className="grid size-10 shrink-0 place-items-center rounded-xl bg-volt text-neutral-950 transition hover:bg-volt-deep disabled:opacity-40"
                aria-label="Send"
              >
                {busy ? <Loader2 size={18} className="animate-spin" /> : <Send size={17} />}
              </button>
            </div>
          </form>
        </section>

        <aside className="space-y-5 xl:sticky xl:top-24 xl:col-span-4">
          <section className="card p-5">
            <p className="eyebrow">What the coach knows</p>
            <ul className="mt-4 space-y-3 text-sm">
              <Fact label="Gameweeks of your history" value={profile.gameweeks.length} />
              <Fact label="Lessons learned about you" value={profile.lessons.length} />
              <Fact label="Memories on Walrus" value={memory.saved} />
              <Fact label="Experts tracked" value={tracked.length} />
            </ul>
            <p className="mt-4 text-xs text-faint">
              Every answer is built from your real FPL data. The coach recalls the most relevant memories from Walrus first, and each conversation is saved back to memory.
            </p>
          </section>
          <section className="card p-5">
            <p className="eyebrow">Good questions to ask</p>
            <ul className="mt-3 space-y-1.5">
              {SUGGESTIONS.map((s) => (
                <li key={s}>
                  <button onClick={() => ask(s)} disabled={busy} className="text-left text-sm text-muted hover:text-text disabled:opacity-50">
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: number }) {
  return (
    <li className="flex items-center justify-between">
      <span className="text-muted">{label}</span>
      <span className="num font-semibold">{value}</span>
    </li>
  );
}

function Bubble({ m }: { m: Message }) {
  const [showMemories, setShowMemories] = useState(false);
  if (m.role === "user") {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] animate-rise rounded-xl rounded-br-md bg-volt/15 px-4 py-2.5 text-sm whitespace-pre-wrap ring-1 ring-volt/25">{m.text}</p>
      </div>
    );
  }
  return (
    <div className="flex animate-rise gap-3">
      <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-fg/[0.06] text-volt-text ring-1 ring-line">
        <Sparkles size={16} />
      </div>
      <div className="min-w-0 flex-1">
        {m.status === "thinking" || m.status === "retrying" ? (
          <p className="flex items-center gap-2 text-sm text-muted">
            <Loader2 size={15} className="animate-spin text-volt-text" />
            {m.status === "retrying"
              ? "That model got overloaded mid-answer. Trying another…"
              : m.memories?.length
                ? `Recalled ${m.memories.length} memories from Walrus. Thinking…`
                : "Reading your season…"}
          </p>
        ) : (
          <div className="rounded-xl rounded-tl-md bg-fg/[0.03] px-4 py-3 text-sm leading-relaxed ring-1 ring-line">
            <RichText text={m.text} />
            {m.status === "fallback" && m.memories && (
              <ul className="mt-2 space-y-1.5">
                {m.memories.map((mem) => (
                  <li key={mem.blobId} className="rounded-lg bg-sunken px-3 py-2 text-xs text-text/85">
                    {mem.text.replace(/^\[[^\]]+\]\s*/, "")}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {m.memories && m.memories.length > 0 && m.status !== "fallback" && m.status !== "thinking" && (
          <div className="mt-2">
            <button onClick={() => setShowMemories(!showMemories)} className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-text">
              <Brain size={13} className="text-good" /> Used {m.memories.length} memories from Walrus
              <ChevronDown size={13} className={`transition ${showMemories ? "rotate-180" : ""}`} />
            </button>
            {showMemories && (
              <ul className="mt-2 space-y-1.5">
                {m.memories.map((mem) => (
                  <li key={mem.blobId} className="rounded-lg bg-fg/[0.04] px-3 py-2 text-xs text-muted">
                    {mem.text.replace(/^\[[^\]]+\]\s*/, "")}
                    <span className="num mt-1 block truncate text-[10px] text-faint">blob {mem.blobId}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {m.model && !m.status && <p className="mt-1 text-[10px] text-faint">Answered by {m.model}</p>}
      </div>
    </div>
  );
}

/** Minimal markdown: paragraphs, "- " bullets and **bold**. Text is rendered as React text, never as HTML. */
function RichText({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];
  const flush = () => {
    if (bullets.length) {
      blocks.push(
        <ul key={blocks.length} className="my-2 list-disc space-y-1 pl-5 marker:text-faint">
          {bullets.map((b, i) => (
            <li key={i}>{bold(b)}</li>
          ))}
        </ul>,
      );
      bullets = [];
    }
  };
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (/^[-*•]\s+/.test(line)) bullets.push(line.replace(/^[-*•]\s+/, ""));
    else {
      flush();
      if (line) blocks.push(<p key={blocks.length} className="mt-2 first:mt-0">{bold(line)}</p>);
    }
  }
  flush();
  return <>{blocks}</>;
}

function bold(s: string) {
  return s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i} className="font-semibold text-text">
        {part.slice(2, -2)}
      </strong>
    ) : (
      part
    ),
  );
}
