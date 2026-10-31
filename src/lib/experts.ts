"use client";

import { useMemo } from "react";
import proven from "@/data/proven-managers.json";
import type { ExpertGroup, ExpertProfile, GroupManager, ManagerProfile } from "./fpl/types";
import { KEYS, useLocal, type Expert } from "./store";
import { useApi } from "./use-api";

/**
 * Experts that ship with TopGaffer. Only add one after confirming the team ID
 * from the creator's own public post (X, YouTube, website). The Experts screen
 * shows the FPL team name next to each entry, so a wrong ID is easy to spot.
 */
export const FEATURED_EXPERTS: Expert[] = [
  // Verified 2026-10-27: the FPL entry's own manager/team name matches the creator.
  { teamId: 3054, name: "FPL Harry", handle: "Harry Daniels", platform: "youtube", country: "GB", group: "creator" },
  { teamId: 41, name: "Let's Talk FPL", handle: "Andy", platform: "youtube", country: "IE", group: "creator" },
  { teamId: 120, name: "FPL Mate", handle: "Dan", platform: "youtube", country: "GB", group: "creator" },
  { teamId: 199, name: "FPL Raptor", handle: "Eggspected Goals", platform: "x", country: "GB", group: "creator" },
  { teamId: 246, name: "FPL BlackBox", handle: "Az Phillips", platform: "other", country: "GB", group: "creator" },
  { teamId: 53517, name: "Ben Crellin", handle: "Fixture ticker", platform: "x", country: "GB", group: "creator" },
];

/** A manager from one of the data-driven groups, as an expert you can follow. */
export function expertFromManager(m: GroupManager, group: Exclude<ExpertGroup, "creator">): Expert {
  return { teamId: m.teamId, name: m.managerName, handle: m.teamName, platform: "fpl", country: "XX", group, topFinishes: m.topFinishes };
}

/** The three strongest proven managers are followed from the start, so the leaderboard holds real elite managers too. */
export const DEFAULT_PROVEN: Expert[] = proven.managers
  .slice(0, 3)
  .map((m) => expertFromManager({ ...m, rank: null, points: 0 }, "proven"));

/** One honest line on why someone is in the list. */
export function expertLabel(e: Expert) {
  if (e.group === "proven") return `Proven · top 100k in ${e.topFinishes ?? 3} of last 5 seasons`;
  if (e.group === "top") return "Top 50 this season";
  const where = e.platform === "youtube" ? "YouTube" : e.platform === "x" ? "X" : "Web";
  return `Creator · ${where}${e.country !== "XX" ? ` · ${e.country}` : ""}`;
}

/** Managers in a data-driven group, with their live rank. */
export function useGroup(group: Exclude<ExpertGroup, "creator"> | null) {
  return useApi<{ managers: GroupManager[] }>(group ? `/api/experts/groups?group=${group}` : null);
}

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
    const base = [...FEATURED_EXPERTS, ...DEFAULT_PROVEN];
    const ids = new Set(base.map((e) => e.teamId));
    return [...base, ...custom.filter((e) => !ids.has(e.teamId))];
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
    isFollowing: (teamId: number) => all.some((x) => x.teamId === teamId),
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
