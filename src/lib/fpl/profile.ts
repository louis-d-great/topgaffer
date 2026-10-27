import "server-only";
import { getBootstrap, getEntry, getHistory, getLivePoints, getPicks, getTransfers } from "./api";
import type { Lesson, ManagerProfile, PlayedGameweek, TransferWindow } from "./types";

/** Gameweeks after a transfer that count towards judging it. */
const TRANSFER_HORIZON = 3;
/** Points in one gameweek that count as a "haul". */
const HAUL = 10;
/** Transfers made with these chips are not normal decisions. */
const CHIP_RESETS = new Set(["wildcard", "freehit"]);

export async function buildProfile(id: number): Promise<ManagerProfile> {
  const [boot, entry, history, rawTransfers] = await Promise.all([
    getBootstrap(),
    getEntry(id),
    getHistory(id),
    getTransfers(id),
  ]);

  const gwInfo = new Map(boot.gameweeks.map((g) => [g.id, g]));
  const played = history.current.filter((h) => gwInfo.get(h.event)?.finished);
  const gws = played.map((h) => h.event);

  // Live points for every finished gameweek the manager played, plus the previous one (for haul checks).
  const liveGws = [...new Set([...gws, ...gws.map((g) => g - 1)])].filter((g) => g >= 1 && gwInfo.get(g)?.finished);
  const liveEntries = await Promise.all(liveGws.map(async (g) => [g, await getLivePoints(g, true)] as const));
  const live = new Map(liveEntries);
  const picksEntries = await Promise.all(gws.map(async (g) => [g, await getPicks(id, g)] as const));
  const picksByGw = new Map(picksEntries);

  const pts = (gw: number, player: number) => live.get(gw)?.points[player] ?? 0;

  const gameweeks: PlayedGameweek[] = played.map((h) => {
    const picks = picksByGw.get(h.event);
    const xi = picks?.picks.filter((p) => p.multiplier > 0) ?? [];
    const cap = xi.reduce<(typeof xi)[number] | null>((best, p) => (p.multiplier > (best?.multiplier ?? 1) ? p : best), null);
    const best = xi.reduce<{ id: number; points: number } | null>((acc, p) => {
      const points = pts(h.event, p.element);
      return !acc || points > acc.points ? { id: p.element, points } : acc;
    }, null);
    const captainPoints = cap ? pts(h.event, cap.element) : 0;
    const extraMultiplier = cap ? cap.multiplier - 1 : 1;
    return {
      gw: h.event,
      points: h.points,
      average: gwInfo.get(h.event)?.average ?? 0,
      overallRank: h.overall_rank,
      hitCost: h.event_transfers_cost,
      transfers: h.event_transfers,
      benchPoints: Math.max(0, h.points_on_bench),
      chip: picks?.active_chip ?? null,
      captain: cap ? { id: cap.element, points: captainPoints, multiplier: cap.multiplier } : null,
      bestCaptain: best,
      captainMissed: best && cap ? Math.max(0, best.points - captainPoints) * extraMultiplier : 0,
    };
  });

  const chipByGw = new Map(history.chips.map((c) => [c.event, c.name]));
  const lastFinished = Math.max(0, ...gws);
  const hitCostByGw = new Map(played.map((h) => [h.event, h.event_transfers_cost]));

  const grouped = new Map<number, { ins: number[]; outs: number[] }>();
  for (const t of rawTransfers) {
    if (CHIP_RESETS.has(chipByGw.get(t.event) ?? "")) continue;
    if (!gwInfo.get(t.event)?.finished) continue;
    const g = grouped.get(t.event) ?? { ins: [], outs: [] };
    g.ins.push(t.element_in);
    g.outs.push(t.element_out);
    grouped.set(t.event, g);
  }

  const transfers: TransferWindow[] = [...grouped.entries()]
    .sort(([a], [b]) => a - b)
    .map(([gw, { ins, outs }]) => {
      const end = Math.min(gw + TRANSFER_HORIZON - 1, lastFinished);
      let gain = 0;
      for (let g = gw; g <= end; g++) {
        for (const p of ins) gain += pts(g, p);
        for (const p of outs) gain -= pts(g, p);
      }
      return {
        gw,
        ins,
        outs,
        hitCost: hitCostByGw.get(gw) ?? 0,
        gain,
        horizon: end - gw + 1,
        chasedHaul: ins.some((p) => pts(gw - 1, p) >= HAUL),
      };
    });

  const stats = summarise(gameweeks, transfers);
  const nextGw = boot.gameweeks.find((g) => g.isNext);
  const players = Object.fromEntries(
    boot.players.map((p) => [p.id, { id: p.id, name: p.name, team: p.team, pos: p.pos }]),
  );

  return {
    id,
    managerName: `${entry.player_first_name} ${entry.player_last_name}`.trim(),
    teamName: entry.name,
    overallRank: entry.summary_overall_rank,
    totalPoints: entry.summary_overall_points,
    currentGw: entry.current_event ?? lastFinished,
    nextGw: nextGw ? { id: nextGw.id, deadline: nextGw.deadline } : null,
    gameweeks,
    transfers,
    stats,
    lessons: deriveLessons(gameweeks, transfers, stats, (pid) => players[pid]?.name ?? "Unknown", pts),
    players,
  };
}

function summarise(gameweeks: PlayedGameweek[], transfers: TransferWindow[]): ManagerProfile["stats"] {
  const withCaptain = gameweeks.filter((g) => g.captain);
  const captainAvg = avg(withCaptain.map((g) => g.captain!.points));
  const bestPicks = withCaptain.filter((g) => g.captainMissed === 0).length;
  const captainMissed = sum(gameweeks.map((g) => g.captainMissed));
  const benchPoints = sum(gameweeks.filter((g) => g.chip !== "bboost").map((g) => g.benchPoints));
  const hitWindows = transfers.filter((t) => t.hitCost > 0);
  const hitsPaidOff = hitWindows.filter((t) => t.gain - t.hitCost > 0).length;
  const hitLoss = sum(hitWindows.map((t) => Math.max(0, t.hitCost - t.gain)));
  const judged = transfers.filter((t) => t.horizon > 0);
  return {
    captainAvg: round1(captainAvg),
    captainBestRate: withCaptain.length ? bestPicks / withCaptain.length : 0,
    captainMissed,
    benchPoints,
    hits: hitWindows.length,
    hitCost: sum(hitWindows.map((t) => t.hitCost)),
    hitsPaidOff,
    hitLoss,
    transferSuccess: judged.length ? judged.filter((t) => t.gain > 0).length / judged.length : 0,
    transferWindows: judged.length,
    pointsLost: captainMissed + benchPoints + hitLoss,
  };
}

/**
 * Turns the numbers into plain-language lessons. These are the candidates
 * that get written to Walrus Memory, so each one carries its evidence.
 */
function deriveLessons(
  gameweeks: PlayedGameweek[],
  transfers: TransferWindow[],
  stats: ManagerProfile["stats"],
  name: (id: number) => string,
  pts: (gw: number, player: number) => number,
): Lesson[] {
  const lessons: Lesson[] = [];
  const n = gameweeks.length;
  if (!n) return lessons;

  const capCount = gameweeks.filter((g) => g.captain).length;
  const bestCount = Math.round(stats.captainBestRate * capCount);
  const worst = [...gameweeks].sort((a, b) => b.captainMissed - a.captainMissed)[0];
  lessons.push({
    id: "captaincy",
    topic: "captaincy",
    tone: stats.captainBestRate >= 0.5 ? "strength" : "warning",
    title:
      stats.captainBestRate >= 0.5
        ? `Your captain calls are sharp: best pick ${bestCount} of ${capCount} weeks`
        : `Your captain was the best option only ${bestCount} of ${capCount} weeks`,
    detail: `Captains averaged ${stats.captainAvg} pts before the armband. Better picks in your own XI would have added ${stats.captainMissed} pts.`,
    evidence:
      worst && worst.captainMissed > 0 && worst.captain && worst.bestCaptain
        ? `GW${worst.gw}: ${name(worst.captain.id)} (${worst.captain.points}) over ${name(worst.bestCaptain.id)} (${worst.bestCaptain.points}).`
        : "No costly captain misses yet.",
  });

  if (stats.hits > 0) {
    const hitWindows = transfers.filter((t) => t.hitCost > 0);
    const worstHit = [...hitWindows].sort((a, b) => a.gain - a.hitCost - (b.gain - b.hitCost))[0];
    lessons.push({
      id: "hits",
      topic: "hits",
      tone: stats.hitsPaidOff * 2 >= stats.hits ? "strength" : "warning",
      title: `Your hits paid off ${stats.hitsPaidOff} of ${stats.hits} times`,
      detail: `You spent ${stats.hitCost} pts on hits. Judged over the next ${TRANSFER_HORIZON} gameweeks, ${stats.hitLoss} pts never came back.`,
      evidence: worstHit
        ? `GW${worstHit.gw}: -${worstHit.hitCost} for ${worstHit.ins.map(name).join(", ")}, net ${signed(worstHit.gain - worstHit.hitCost)}.`
        : "",
    });
  }

  const chases = transfers.filter((t) => t.chasedHaul);
  if (chases.length >= 2) {
    const netGain = sum(chases.map((t) => t.gain));
    const example = chases[chases.length - 1];
    const hauler = example.ins.find((p) => pts(example.gw - 1, p) >= HAUL);
    lessons.push({
      id: "chasing",
      topic: "chasing",
      tone: netGain < 0 ? "warning" : "info",
      title: `You buy players right after a big haul (${chases.length} times)`,
      detail:
        netGain < 0
          ? `Those moves lost ${Math.abs(netGain)} pts against the players you sold. Last week's points rarely repeat.`
          : `So far it has worked: +${netGain} pts against the players you sold. Keep an eye on it.`,
      evidence: hauler ? `GW${example.gw}: bought ${name(hauler)} after ${pts(example.gw - 1, hauler)} pts the week before.` : "",
    });
  }

  if (stats.benchPoints >= 15) {
    const worstBench = [...gameweeks].sort((a, b) => b.benchPoints - a.benchPoints)[0];
    lessons.push({
      id: "bench",
      topic: "bench",
      tone: "warning",
      title: `${stats.benchPoints} pts left on your bench this season`,
      detail: `That's about ${round1(stats.benchPoints / n)} pts a week. Your starting XI choices are costing you.`,
      evidence: `Worst: GW${worstBench.gw}, ${worstBench.benchPoints} pts on the bench.`,
    });
  }

  if (stats.transferWindows >= 2) {
    const rate = Math.round(stats.transferSuccess * 100);
    lessons.push({
      id: "transfers",
      topic: "transfers",
      tone: rate >= 50 ? "strength" : "warning",
      title: `${rate}% of your transfer weeks gained points`,
      detail: `Players you bought outscored the ones you sold in ${Math.round(stats.transferSuccess * stats.transferWindows)} of ${stats.transferWindows} transfer weeks.`,
      evidence: "",
    });
  }

  return lessons;
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const avg = (xs: number[]) => (xs.length ? sum(xs) / xs.length : 0);
const round1 = (x: number) => Math.round(x * 10) / 10;
const signed = (x: number) => (x > 0 ? `+${x}` : `${x}`);
