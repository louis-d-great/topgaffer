"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, Brain, Loader2, Lock, Users } from "lucide-react";
import { Logo } from "@/components/app-shell";
import { ToneChip } from "@/components/ui";
import { KEYS, useHydrated, useLocal } from "@/lib/store";
import { prefetch } from "@/lib/use-api";

const STEPS = ["Reading your season", "Checking every captain pick", "Scoring your transfers", "Writing your first memories"];

export default function Welcome() {
  const router = useRouter();
  const hydrated = useHydrated();
  const [teamId, setTeamId] = useLocal<number | null>(KEYS.teamId, null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (hydrated && teamId && !busy) router.replace("/home");
  }, [hydrated, teamId, busy, router]);

  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 900);
    return () => clearInterval(t);
  }, [busy]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const id = Number(input.trim());
    if (!Number.isInteger(id) || id <= 0) {
      setError("Your team ID is the number in your FPL points page link.");
      return;
    }
    setError(null);
    setStep(0);
    setBusy(true);
    try {
      await prefetch(`/api/manager/${id}`);
      setTeamId(id);
      router.push("/home");
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto grid min-h-dvh max-w-6xl items-center gap-12 px-5 py-10 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="stagger">
        <Logo />
        <h1 className="mt-10 font-display text-5xl leading-[0.95] font-bold tracking-tight sm:text-7xl">
          Stop making the
          <br />
          <span className="text-volt">same FPL mistakes.</span>
        </h1>
        <p className="mt-6 max-w-lg text-lg text-muted">
          TopGaffer remembers every captain, transfer and hit you&apos;ve made, and every expert you&apos;ve listened to. Before
          the deadline, it tells you when you&apos;re about to repeat a bad call.
        </p>

        <form onSubmit={submit} className="mt-10 max-w-md">
          <label htmlFor="team" className="eyebrow">
            Your FPL team ID
          </label>
          <div className="mt-2 flex items-center gap-2 rounded-2xl border border-line-strong bg-surface p-1.5 focus-within:border-volt/60">
            <input
              id="team"
              inputMode="numeric"
              autoComplete="off"
              placeholder="e.g. 1234567"
              value={input}
              onChange={(e) => setInput(e.target.value.replace(/\D/g, ""))}
              disabled={busy}
              className="num min-w-0 flex-1 bg-transparent px-3 py-2.5 text-lg outline-none placeholder:text-faint"
            />
            <button
              type="submit"
              disabled={busy || !input}
              className="inline-flex items-center gap-2 rounded-xl bg-volt px-5 py-3 font-semibold text-ink transition hover:bg-volt-deep disabled:opacity-40"
            >
              {busy ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
              {busy ? "Reading" : "Start"}
            </button>
          </div>
          {busy ? (
            <p className="mt-3 text-sm text-volt" aria-live="polite">
              {STEPS[step]}…
            </p>
          ) : error ? (
            <p className="mt-3 text-sm text-bad">{error}</p>
          ) : (
            <p className="mt-3 text-sm text-faint">
              Find it on the FPL site: open <b className="text-muted">Points</b>, and copy the number after{" "}
              <span className="num text-muted">/entry/</span> in the link. No login needed.
            </p>
          )}
        </form>

        <ul className="mt-12 grid max-w-lg gap-4 text-sm sm:grid-cols-3">
          {[
            { icon: Brain, text: "Learns your habits from this season" },
            { icon: Users, text: "Keeps score on the experts you follow" },
            { icon: Lock, text: "Locks your plan before kickoff" },
          ].map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-start gap-2 text-muted">
              <Icon size={16} className="mt-0.5 shrink-0 text-volt" />
              {text}
            </li>
          ))}
        </ul>
      </section>

      {/* Preview of what the agent says: illustrative, not real data. */}
      <section aria-label="Example" className="relative hidden lg:block">
        <div className="absolute -inset-10 -z-10 animate-glow rounded-full bg-volt/10 blur-3xl" />
        <div className="stagger space-y-4">
          <div className="card rotate-[-1.5deg] p-5 shadow-2xl shadow-black/50">
            <div className="flex items-center justify-between">
              <p className="eyebrow">Deadline check · GW9</p>
              <ToneChip tone="warning" />
            </div>
            <p className="mt-3 font-display text-xl font-semibold">You&apos;re taking a -4 again.</p>
            <p className="mt-1 text-sm text-muted">Your last 5 hits returned an average of -1 pt. Roll the transfer instead?</p>
          </div>
          <div className="card ml-10 rotate-[1deg] p-5 shadow-2xl shadow-black/50">
            <p className="eyebrow">What I know about you</p>
            <p className="mt-3 font-display text-lg font-semibold">You buy players right after a big haul.</p>
            <p className="mt-1 text-sm text-muted">Those moves lost 18 pts against the players you sold.</p>
          </div>
          <div className="card mr-8 rotate-[-0.5deg] p-5 shadow-2xl shadow-black/50">
            <p className="eyebrow">Expert record</p>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Expert A · captains</span>
                <span className="num text-good">6 / 8</span>
              </div>
              <div className="flex justify-between">
                <span>Expert B · captains</span>
                <span className="num text-bad">3 / 8</span>
              </div>
            </div>
          </div>
          <p className="text-center text-xs text-faint">Example of what TopGaffer tells you</p>
        </div>
      </section>
    </div>
  );
}
