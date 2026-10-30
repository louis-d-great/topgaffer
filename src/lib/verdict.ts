import { captainHeadToHead, type TrackedExpert } from "./experts";
import type { PlanReview } from "./plan-review";
import type { DeadlineData, LessonTone, ManagerProfile, Player } from "./fpl/types";

export interface Plan {
  captain: number;
  outs: number[];
  ins: number[];
  freeTransfers: number;
}

export interface Note {
  id: string;
  tone: LessonTone | "blocker";
  title: string;
  because?: string;
  /** Experts this note is about, shown as avatar chips. */
  people?: string[];
}

export interface Verdict {
  level: "solid" | "think" | "blocked";
  hitCost: number;
  bankAfter: number;
  notes: Note[];
}

const HAUL = 10;
const MAX_PER_TEAM = 3;

/**
 * Checks a deadline plan against the manager's own history ("memory") and the
 * experts they trust. Every warning says *why*, citing a past decision.
 */
export function judgePlan(
  plan: Plan,
  deadline: DeadlineData,
  profile: ManagerProfile,
  experts: TrackedExpert[],
  lastReview?: PlanReview,
): Verdict {
  const byId = new Map<number, Player>(deadline.players.map((p) => [p.id, p]));
  const notes: Note[] = [];
  const lesson = (id: string) => profile.lessons.find((l) => l.id === id);

  // Budget and squad rules first: these block locking.
  const priceOut = plan.outs.reduce((s, id) => s + (byId.get(id)?.price ?? 0), 0);
  const priceIn = plan.ins.reduce((s, id) => s + (byId.get(id)?.price ?? 0), 0);
  const bankAfter = Math.round((deadline.bank + priceOut - priceIn) * 10) / 10;
  if (bankAfter < 0) {
    notes.push({ id: "budget", tone: "blocker", title: `Over budget by £${Math.abs(bankAfter).toFixed(1)}m` });
  }
  const squadAfter = [...deadline.squad.map((p) => p.id).filter((id) => !plan.outs.includes(id)), ...plan.ins];
  const perTeam = new Map<string, number>();
  for (const id of squadAfter) {
    const team = byId.get(id)?.team ?? "";
    perTeam.set(team, (perTeam.get(team) ?? 0) + 1);
  }
  for (const [team, count] of perTeam) {
    if (count > MAX_PER_TEAM) notes.push({ id: `team-${team}`, tone: "blocker", title: `${count} players from ${team} (max 3)` });
  }

  // Hits, judged against this manager's own hit record.
  const extra = Math.max(0, plan.outs.length - plan.freeTransfers);
  const hitCost = extra * 4;
  if (hitCost > 0) {
    const s = profile.stats;
    if (s.hits > 0) {
      const bad = s.hitsPaidOff * 2 < s.hits;
      notes.push({
        id: "hit",
        tone: bad ? "warning" : "info",
        title: bad ? `You're taking a −${hitCost} again` : `A −${hitCost} hit. Your hits usually work`,
        because: `Your hits paid off ${s.hitsPaidOff} of ${s.hits} times this season; ${s.hitLoss} pts never came back.`,
      });
    } else {
      notes.push({
        id: "hit",
        tone: "info",
        title: `Your first hit of the season (−${hitCost})`,
        because: "Your new player needs to outscore the one you sell by 4+ pts to break even.",
      });
    }
  }

  // Chasing last week's haul.
  const chase = lesson("chasing");
  for (const id of plan.ins) {
    const p = byId.get(id);
    if (!p || p.lastGwPoints < HAUL) continue;
    notes.push({
      id: `chase-${id}`,
      tone: chase?.tone === "warning" ? "warning" : "info",
      title: `${p.name} scored ${p.lastGwPoints} last week`,
      because:
        chase?.tone === "warning"
          ? `${chase.title}. ${chase.detail}`
          : "Big hauls rarely repeat. Check his next fixtures, not last week's points.",
    });
  }

  // Injured or doubtful starters you're keeping.
  for (const p of deadline.squad) {
    if (p.benched || plan.outs.includes(p.id) || p.status === "a") continue;
    notes.push({
      id: `flag-${p.id}`,
      tone: p.id === plan.captain ? "blocker" : "warning",
      title: p.id === plan.captain ? `Your captain ${p.name} is flagged` : `${p.name} is flagged`,
      because: p.news || "Availability is in doubt.",
    });
  }

  // Captain: own history, fixture, and what trusted experts say.
  const cap = byId.get(plan.captain);
  if (cap) {
    const past = profile.gameweeks.filter((g) => g.captain?.id === cap.id);
    if (past.length >= 2) {
      const avg = past.reduce((s, g) => s + g.captain!.points, 0) / past.length;
      notes.push({
        id: "cap-history",
        tone: avg >= 6 ? "strength" : "info",
        title: `You've captained ${cap.name} ${past.length} times`,
        because: `He averaged ${avg.toFixed(1)} pts before the armband for you.`,
      });
    }
    const fixture = deadline.players.find((p) => p.id === cap.id)?.fixture;
    if (fixture && fixture.difficulty >= 4) {
      notes.push({
        id: "cap-fixture",
        tone: "info",
        title: `Tough fixture for ${cap.name}: ${fixture.opponent} (${fixture.home ? "H" : "A"})`,
        because: `Fixture difficulty ${fixture.difficulty} of 5.`,
      });
    }
    // What the experts you track actually did with their own teams.
    const lastGw = profile.currentGw;
    const sameCaptain = experts.filter((t) => t.profile.captains.find((c) => c.gw === lastGw)?.id === cap.id);
    if (experts.length >= 2 && sameCaptain.length > 0) {
      notes.push({
        id: "cap-crowd",
        tone: "info",
        title: `${sameCaptain.length} of your ${experts.length} experts captained ${cap.name} in GW${lastGw}`,
        because: sameCaptain.map((t) => t.expert.name).join(", "),
        people: sameCaptain.map((t) => t.expert.name),
      });
    }
    const ranked = experts
      .map((t) => ({ t, h2h: captainHeadToHead(profile, t.profile) }))
      .filter((x) => x.h2h.weeks >= 3)
      .sort((x, y) => y.h2h.margin - x.h2h.margin);
    const best = ranked[0];
    if (best && best.h2h.theyWon > best.h2h.youWon) {
      const recent = best.t.profile.captains.slice(-3).reverse();
      notes.push({
        id: "cap-expert",
        tone: "info",
        title: `${best.t.expert.name}'s captains beat yours ${best.h2h.theyWon} of ${best.h2h.weeks} weeks`,
        because: `+${best.h2h.margin} captain pts over you this season. Their recent captains: ${recent.map((c) => `${c.name} (GW${c.gw})`).join(", ")}.`,
      });
    }
  }

  // What happened last time you locked a plan: the memory loop closing.
  if (lastReview) {
    notes.push({
      id: "last-review",
      tone: lastReview.tone === "warning" ? "warning" : lastReview.tone === "strength" ? "strength" : "info",
      title: lastReview.tone === "warning" ? `In GW${lastReview.gw} you ignored a warning, and it was right` : `What your GW${lastReview.gw} plan review found`,
      because: lastReview.lesson,
    });
  }

  const captaincy = lesson("captaincy");
  if (captaincy?.tone === "warning" && !notes.some((n) => n.id.startsWith("cap-"))) {
    notes.push({ id: "cap-lesson", tone: "info", title: "Double-check your captain", because: captaincy.title + "." });
  }

  const level = notes.some((n) => n.tone === "blocker")
    ? "blocked"
    : notes.some((n) => n.tone === "warning")
      ? "think"
      : "solid";

  const order = { blocker: 0, warning: 1, info: 2, strength: 3 };
  notes.sort((a, b) => order[a.tone] - order[b.tone]);
  return { level, hitCost, bankAfter, notes };
}

/** SHA-256 of the plan plus a secret salt: proves the plan later without revealing it now. */
export async function fingerprint(teamId: number, gw: number, plan: Plan, salt: string) {
  const payload = JSON.stringify({ teamId, gw, captain: plan.captain, ins: plan.ins, outs: plan.outs, salt });
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
