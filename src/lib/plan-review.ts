import type { ManagerProfile } from "./fpl/types";
import type { LockedPlan } from "./store";

/*
 * After a locked gameweek finishes, compare the plan with what the manager
 * actually did on FPL and what each choice scored. The result is the lesson
 * that closes the memory loop: did ignoring a warning cost points?
 */

export interface WarningOutcome {
  title: string;
  /** Points the warned-about choice produced: negative = the warning was right. */
  points: number | null;
  verdict: "right" | "wrong" | "unknown";
  detail: string;
}

export interface PlanReview {
  gw: number;
  followedCaptain: boolean;
  followedTransfers: boolean;
  plannedCaptain: { id: number; points: number };
  actualCaptain: { id: number; points: number } | null;
  /** Net points of the planned transfers this gameweek, after any hit. */
  plannedTransferNet: number | null;
  warnings: WarningOutcome[];
  /** The one-sentence lesson, written to Walrus and shown at the next deadline. */
  lesson: string;
  tone: "warning" | "strength" | "info";
}

export function reviewPlan(plan: LockedPlan, profile: ManagerProfile, live: Record<number, number>): PlanReview | null {
  const g = profile.gameweeks.find((x) => x.gw === plan.gw);
  if (!g) return null;
  const name = (id: number) => profile.players[id]?.name ?? "Unknown";
  const pts = (id: number) => live[id] ?? 0;

  const actualMoves = profile.transfers.find((t) => t.gw === plan.gw);
  const sameSet = (a: number[], b: number[]) => a.length === b.length && a.every((x) => b.includes(x));
  const followedTransfers = sameSet(plan.transfersIn, actualMoves?.ins ?? []) && sameSet(plan.transfersOut, actualMoves?.outs ?? []);
  const actualCaptain = g.captain ? { id: g.captain.id, points: g.captain.points } : null;
  const followedCaptain = actualCaptain?.id === plan.captain;

  const plannedTransferNet = plan.transfersIn.length
    ? plan.transfersIn.reduce((s, id) => s + pts(id), 0) - plan.transfersOut.reduce((s, id) => s + pts(id), 0) - (plan.hitCost ?? 0)
    : null;

  const warnings: WarningOutcome[] = (plan.warnings ?? []).map((w) => {
    const pid = Number(w.id.split("-")[1]);
    if (w.id === "hit" && plannedTransferNet !== null) {
      return {
        title: w.title,
        points: plannedTransferNet,
        verdict: plannedTransferNet < 0 ? "right" : "wrong",
        detail:
          plannedTransferNet < 0
            ? `The hit lost ${-plannedTransferNet} pts this gameweek.`
            : `The hit paid off: ${plannedTransferNet >= 0 ? "+" : ""}${plannedTransferNet} pts after the cost.`,
      };
    }
    if (w.id.startsWith("chase-")) {
      const p = pts(pid);
      return {
        title: w.title,
        points: p,
        verdict: p < 4 ? "right" : "wrong",
        detail: p < 4 ? `${name(pid)} scored only ${p} after the haul.` : `${name(pid)} kept going: ${p} pts.`,
      };
    }
    if (w.id.startsWith("flag-")) {
      const p = pts(pid);
      return {
        title: w.title,
        points: p,
        verdict: p <= 1 ? "right" : "wrong",
        detail: p <= 1 ? `${name(pid)} returned ${p} pt${p === 1 ? "" : "s"}.` : `${name(pid)} played through it: ${p} pts.`,
      };
    }
    return { title: w.title, points: null, verdict: "unknown", detail: "" };
  });

  const right = warnings.filter((w) => w.verdict === "right");
  const wrong = warnings.filter((w) => w.verdict === "wrong");
  const plannedCaptain = { id: plan.captain, points: pts(plan.captain) };

  let lesson: string;
  let tone: PlanReview["tone"];
  if (right.length) {
    lesson = `You locked through ${right.length === 1 ? "a warning" : `${right.length} warnings`} and ${right.length === 1 ? "it was" : "they were"} right. ${right
      .map((w) => w.detail)
      .join(" ")}`;
    tone = "warning";
  } else if (wrong.length) {
    lesson = `You trusted your own call over ${wrong.length === 1 ? "a warning" : `${wrong.length} warnings`}, and it paid off. ${wrong.map((w) => w.detail).join(" ")}`;
    tone = "strength";
  } else {
    lesson = `${followedCaptain ? "You followed your plan" : `You switched captain from ${name(plan.captain)} to ${actualCaptain ? name(actualCaptain.id) : "no one"}`}. ${name(plan.captain)} scored ${plannedCaptain.points}${
      actualCaptain && !followedCaptain ? `, ${name(actualCaptain.id)} scored ${actualCaptain.points}` : ""
    }.`;
    tone = !followedCaptain && actualCaptain && actualCaptain.points < plannedCaptain.points ? "warning" : "info";
  }

  return { gw: plan.gw, followedCaptain, followedTransfers, plannedCaptain, actualCaptain, plannedTransferNet, warnings, lesson, tone };
}
