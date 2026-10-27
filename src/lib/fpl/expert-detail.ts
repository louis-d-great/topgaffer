import "server-only";
import { getBootstrap, getHistory, getLivePoints, getPicks } from "./api";
import { buildProfile } from "./profile";
import type { ExpertDetail, Player } from "./types";

/** A player owned by fewer managers than this counts as a differential. */
const DIFFERENTIAL_OWNERSHIP = 10;

/**
 * Everything an expert's dashboard shows, built from their real FPL team.
 * Only finished gameweeks are used: FPL hides upcoming picks until the deadline.
 */
export async function buildExpertDetail(id: number): Promise<ExpertDetail> {
  const [profile, boot, history] = await Promise.all([buildProfile(id), getBootstrap(), getHistory(id)]);
  const byId = new Map(boot.players.map((p) => [p.id, p]));
  const slim = (pid: number) => {
    const p = byId.get(pid);
    return { id: pid, name: p?.name ?? "Unknown", team: p?.team ?? "", pos: p?.pos ?? "MID" };
  };
  const gws = profile.gameweeks.map((g) => g.gw);

  // These calls hit the same cache buildProfile just filled, so they cost nothing extra.
  const [picks, live] = await Promise.all([
    Promise.all(gws.map(async (g) => [g, await getPicks(id, g)] as const)),
    Promise.all([...new Set([...gws, ...gws.map((g) => g + 1), ...gws.map((g) => g + 2)])].map(async (g) => {
      const info = boot.gameweeks.find((x) => x.id === g);
      return [g, info?.finished ? (await getLivePoints(g, true)).points : null] as const;
    })),
  ]);
  const picksByGw = new Map(picks);
  const liveByGw = new Map(live);
  const pts = (gw: number, pid: number) => liveByGw.get(gw)?.[pid] ?? 0;

  // How many gameweeks each player spent in the squad (Free Hit weeks are temporary, so skipped).
  const held = new Map<number, number>();
  for (const p of picksByGw.values()) {
    if (p.active_chip === "freehit") continue;
    for (const pick of p.picks) held.set(pick.element, (held.get(pick.element) ?? 0) + 1);
  }

  const transfers = profile.transfers.map((t) => {
    const end = t.gw + t.horizon - 1;
    const sumPts = (pid: number) => {
      let s = 0;
      for (let g = t.gw; g <= end; g++) s += pts(g, pid);
      return s;
    };
    return {
      gw: t.gw,
      hitCost: t.hitCost,
      gain: t.gain,
      horizon: t.horizon,
      chasedHaul: t.chasedHaul,
      ins: t.ins.map((pid) => ({ ...slim(pid), points: sumPts(pid) })),
      outs: t.outs.map((pid) => ({ ...slim(pid), points: sumPts(pid) })),
    };
  });

  const latestGw = gws.at(-1);
  const latest = latestGw ? picksByGw.get(latestGw) : undefined;
  const squad = (latest?.picks ?? [])
    .map((pick) => {
      const p = byId.get(pick.element);
      if (!p) return null;
      return {
        ...pickFields(p),
        isCaptain: pick.is_captain,
        benched: pick.position > 11,
        heldGws: held.get(p.id) ?? 0,
      };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);

  const xi = squad.filter((p) => !p.benched);
  const normalWeeks = profile.gameweeks.filter((g) => g.chip !== "wildcard" && g.chip !== "freehit");
  const captainOwnership = profile.gameweeks
    .filter((g) => g.captain)
    .map((g) => byId.get(g.captain!.id)?.selectedBy ?? 0);
  const historyByGw = new Map(history.current.map((h) => [h.event, h]));

  return {
    teamId: id,
    teamName: profile.teamName,
    managerName: profile.managerName,
    overallRank: profile.overallRank,
    totalPoints: profile.totalPoints,
    stats: profile.stats,
    gameweeks: profile.gameweeks.map((g) => ({
      gw: g.gw,
      points: g.points,
      average: g.average,
      overallRank: g.overallRank,
      hitCost: g.hitCost,
      transfers: g.transfers,
      benchPoints: g.benchPoints,
      chip: g.chip,
      value: (historyByGw.get(g.gw)?.value ?? 0) / 10,
      captain: g.captain ? { ...slim(g.captain.id), points: g.captain.points, multiplier: g.captain.multiplier } : null,
      best: g.bestCaptain ? { ...slim(g.bestCaptain.id), points: g.bestCaptain.points } : null,
    })),
    transfers,
    squad,
    trusted: [...held.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([pid, n]) => ({ ...slim(pid), gws: n })),
    chips: history.chips.map((c) => ({ name: c.name, gw: c.event })),
    style: {
      xiOwnership: avg(xi.map((p) => p.selectedBy)),
      differentials: xi.filter((p) => p.selectedBy < DIFFERENTIAL_OWNERSHIP).length,
      transfersPerWeek: normalWeeks.length ? normalWeeks.reduce((s, g) => s + g.transfers, 0) / normalWeeks.length : 0,
      captainOwnership: avg(captainOwnership),
      benchPerWeek: profile.gameweeks.length ? profile.stats.benchPoints / profile.gameweeks.length : 0,
    },
  };
}

function pickFields(p: Player) {
  return {
    id: p.id,
    name: p.name,
    team: p.team,
    pos: p.pos,
    price: p.price,
    selectedBy: p.selectedBy,
    form: p.form,
    totalPoints: p.totalPoints,
    status: p.status,
  };
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
