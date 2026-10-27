"use client";

import { useMemo } from "react";
import type { ExpertProfile, ManagerProfile } from "./fpl/types";
import { KEYS, useLocal, type Expert } from "./store";
import { useApi } from "./use-api";

/**
 * Experts that ship with TopGaffer. Only add one after confirming the team ID
 * from the creator's own public post (X, YouTube, website). The Experts screen
 * shows the FPL team name next to each entry, so a wrong ID is easy to spot.
 */
export const FEATURED_EXPERTS: Expert[] = [
  // Verified 2026-10-27: the FPL entry's own manager/team name matches the creator.
  { teamId: 3054, name: "FPL Harry", handle: "Harry Daniels", platform: "youtube", country: "GB" },
  { teamId: 41, name: "Let's Talk FPL", handle: "Andy", platform: "youtube", country: "IE" },
  { teamId: 120, name: "FPL Mate", handle: "Dan", platform: "youtube", country: "GB" },
  { teamId: 199, name: "FPL Raptor", handle: "Eggspected Goals", platform: "x", country: "GB" },
  { teamId: 246, name: "FPL BlackBox", handle: "Az Phillips", platform: "other", country: "GB" },
  { teamId: 53517, name: "Ben Crellin", handle: "Fixture ticker", platform: "x", country: "GB" },
];

export interface TrackedExpert {
  expert: Expert;
  profile: ExpertProfile;
}

/** Featured + user-added experts, each loaded from their real FPL team. */
export function useExperts() {
  const [mine, setMine] = useLocal<Expert[]>(KEYS.experts, []);
  // Entries from the earlier manual-logging version have no team ID; ignore them.
  const custom = useMemo(() => mine.filter((e) => Number.isInteger(e.teamId)), [mine]);
  const all = useMemo(() => {
    const ids = new Set(FEATURED_EXPERTS.map((e) => e.teamId));
    return [...FEATURED_EXPERTS, ...custom.filter((e) => !ids.has(e.teamId))];
  }, [custom]);

  const ids = all.map((e) => e.teamId).join(",");
  const { data, loading, error } = useApi<{ experts: ExpertProfile[]; missing: number[] }>(
    ids ? `/api/experts?ids=${ids}` : null,
  );

  const tracked = useMemo<TrackedExpert[]>(() => {
    const byId = new Map(data?.experts.map((p) => [p.teamId, p]));
    return all
      .map((expert) => ({ expert, profile: byId.get(expert.teamId)! }))
      .filter((t) => t.profile)
      .sort((a, b) => b.profile.totalPoints - a.profile.totalPoints);
  }, [all, data]);

  return {
    tracked,
    loading: loading && !!ids,
    error,
    missing: data?.missing ?? [],
    add: (e: Expert) => setMine([...custom.filter((x) => x.teamId !== e.teamId), e]),
    remove: (teamId: number) => setMine(custom.filter((x) => x.teamId !== teamId)),
    isCustom: (teamId: number) => custom.some((x) => x.teamId === teamId),
  };
}

export interface HeadToHead {
  weeks: number;
  theyWon: number;
  youWon: number;
  /** Captain points (before the armband) they scored minus yours, summed. */
  margin: number;
}

/** Compares captain picks gameweek by gameweek: the core "who should I trust" memory. */
export function captainHeadToHead(you: ManagerProfile, them: ExpertProfile): HeadToHead {
  const mine = new Map(you.gameweeks.filter((g) => g.captain).map((g) => [g.gw, g.captain!.points]));
  let theyWon = 0;
  let youWon = 0;
  let margin = 0;
  let weeks = 0;
  for (const c of them.captains) {
    const yours = mine.get(c.gw);
    if (yours === undefined) continue;
    weeks++;
    margin += c.points - yours;
    if (c.points > yours) theyWon++;
    else if (c.points < yours) youWon++;
  }
  return { weeks, theyWon, youWon, margin };
}
