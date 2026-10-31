import "server-only";
import { cacheLife } from "next/cache";
import proven from "@/data/proven-managers.json";
import { getEntry, getOverallStandings } from "./api";
import type { GroupManager } from "./types";

/** Today's top 50 in the world, straight from FPL's overall league. */
export async function getTopManagers(): Promise<GroupManager[]> {
  "use cache";
  cacheLife("hours");
  const rows = await getOverallStandings(1);
  return rows.map((r) => ({ teamId: r.entry, teamName: r.entry_name, managerName: r.player_name, rank: r.rank, points: r.total }));
}

/**
 * The proven shortlist (built by scripts/build-proven.mjs from past seasons, which never change)
 * with each manager's live rank and points added.
 */
export async function getProvenManagers(): Promise<GroupManager[]> {
  "use cache";
  cacheLife("hours");
  return Promise.all(
    proven.managers.map(async (m) => {
      const live = await getEntry(m.teamId).catch(() => null);
      return {
        teamId: m.teamId,
        teamName: live?.name ?? m.teamName,
        managerName: live ? `${live.player_first_name} ${live.player_last_name}` : m.managerName,
        rank: live?.summary_overall_rank ?? null,
        points: live?.summary_overall_points ?? 0,
        seasons: m.seasons,
        topFinishes: m.topFinishes,
      };
    }),
  );
}

export const PROVEN_RULE = proven.rule;
