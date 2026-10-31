import type { DeadlineData, FixtureRef, ManagerProfile, Player } from "./fpl/types";

/*
 * Transfer suggestions with their working shown. Every option is ranked by one
 * simple, explainable number: a per-game rate (half recent form, half season
 * average) carried across the next three fixtures by how hard each one is.
 * Then the manager's own history adds the context only TopGaffer has.
 */

type Candidate = DeadlineData["players"][number];
export type Owned = Pick<Player, "id" | "teamId" | "pos" | "price" | "status" | "news" | "xp" | "form" | "ppg" | "name"> & {
  run: FixtureRef[][];
  benched?: boolean;
};

export interface Tag {
  tone: "good" | "warn" | "info";
  text: string;
}

export interface Option {
  player: Candidate;
  /** Estimated points over the next three gameweeks. */
  est: number;
  /** Estimate minus the player being replaced. */
  gain: number;
  tags: Tag[];
}

export interface Suggestion<T extends Owned = Owned> {
  out: T;
  outEst: number;
  reason: string;
  urgent: boolean;
  options: Option[];
}

// How much easier or harder a fixture is than an average one (difficulty 3).
const EASE: Record<number, number> = { 1: 1.25, 2: 1.15, 3: 1, 4: 0.85, 5: 0.7 };
const ease = (d: number) => EASE[d] ?? 1;
const MAX_PER_CLUB = 3;
const MIN_GAIN = 1.5;
const OPTIONS = 3;

/**
 * Points over the next three gameweeks. The per-game rate blends FPL's expected points for next week
 * (which tracks recent form and availability) with the season average, so one hot fortnight can't dominate.
 */
export function threeWeekEstimate(p: { xp: number; form: number; ppg: number; run: FixtureRef[][] }) {
  const first = p.run[0] ?? [];
  const recent = first.length ? p.xp / first.reduce((s, f) => s + ease(f.difficulty), 0) : p.form;
  // A flagged player's expected points already include his chance of playing; keep that discount.
  const rate = p.xp === 0 && first.length ? 0 : (recent + p.ppg) / 2;
  return p.run.flat().reduce((s, f) => s + rate * ease(f.difficulty), 0);
}

export function runDifficulty(run: FixtureRef[][]) {
  const all = run.flat();
  return all.length ? all.reduce((s, f) => s + f.difficulty, 0) / all.length : 5;
}

const unavailable = (status: string) => status === "i" || status === "s" || status === "u" || status === "n";

/**
 * Finds the weakest spots in the squad and, for each, the best replacements
 * the manager can afford within FPL's rules (position, budget, three per club).
 */
export function suggestTransfers<T extends Owned>({
  squad,
  players,
  budgetFor,
  locked,
  profile,
  limit = 3,
}: {
  /** The squad as currently planned. */
  squad: T[];
  players: Candidate[];
  /** Money available if this player is sold. */
  budgetFor: (out: T) => number;
  /** Players already part of a planned transfer: not suggested again. */
  locked: Set<number>;
  profile: ManagerProfile;
  limit?: number;
}): Suggestion<T>[] {
  const owned = new Set(squad.map((p) => p.id));
  const perClub = new Map<number, number>();
  for (const p of squad) perClub.set(p.teamId, (perClub.get(p.teamId) ?? 0) + 1);

  const hauls = profile.transfers.filter((t) => t.chasedHaul).length;
  const soldIn = new Map<number, number>();
  for (const t of profile.transfers) for (const id of t.outs) soldIn.set(id, t.gw);

  const tagsFor = (p: Candidate): Tag[] => {
    const tags: Tag[] = [];
    if (p.lastGwPoints >= 10 && hauls > 0)
      tags.push({ tone: "warn", text: `Scored ${p.lastGwPoints} last week. You've bought after a haul ${hauls}× this season` });
    const sold = soldIn.get(p.id);
    if (sold) tags.push({ tone: "info", text: `You sold him in GW${sold}` });
    const doubles = p.run.findIndex((gw) => gw.length > 1);
    if (doubles >= 0) tags.push({ tone: "good", text: `Plays twice in GW${(profile.nextGw?.id ?? profile.currentGw + 1) + doubles}` });
    if (runDifficulty(p.run) <= 2.5) tags.push({ tone: "good", text: "Kind fixtures" });
    if (p.form >= 6) tags.push({ tone: "good", text: `In form: ${p.form.toFixed(1)}` });
    if (p.selectedBy < 5) tags.push({ tone: "info", text: `Differential: ${p.selectedBy}% owned` });
    return tags;
  };

  const out: Suggestion<T>[] = [];
  for (const o of squad) {
    if (locked.has(o.id)) continue;
    const isOut = unavailable(o.status);
    // Bench players only matter when they can't play at all.
    if (o.benched && !isOut) continue;
    const outEst = threeWeekEstimate(o);
    const budget = budgetFor(o);
    const options = players
      .filter(
        (p) =>
          p.pos === o.pos &&
          !owned.has(p.id) &&
          p.status === "a" &&
          p.xp > 0 &&
          p.price <= budget + 1e-9 &&
          (perClub.get(p.teamId) ?? 0) - (p.teamId === o.teamId ? 1 : 0) < MAX_PER_CLUB,
      )
      .map((p) => {
        const est = threeWeekEstimate(p);
        return { player: p, est, gain: est - outEst, tags: tagsFor(p) };
      })
      .sort((a, b) => b.est - a.est)
      .slice(0, OPTIONS);
    if (!options.length || (!isOut && options[0].gain < MIN_GAIN)) continue;

    const opponents = o.run.flat().map((f) => f.opponent);
    const reason = isOut
      ? o.news || "Not expected to play"
      : o.status === "d"
        ? o.news || "Doubtful"
        : runDifficulty(o.run) >= 3.6
          ? `Tough run: ${opponents.join(", ")}`
          : `Expected ${outEst.toFixed(1)} pts over the next 3 gameweeks`;
    out.push({ out: o, outEst, reason, urgent: isOut || o.status === "d", options });
  }

  return out.sort((a, b) => Number(b.urgent) - Number(a.urgent) || b.options[0].gain - a.options[0].gain).slice(0, limit);
}
