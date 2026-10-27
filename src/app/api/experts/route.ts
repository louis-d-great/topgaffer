import type { NextRequest } from "next/server";
import { FplError } from "@/lib/fpl/api";
import { buildProfile } from "@/lib/fpl/profile";
import type { ExpertProfile } from "@/lib/fpl/types";

const MAX_EXPERTS = 25;

/**
 * Experts are tracked by their real FPL team, so their record updates itself
 * every gameweek. GET /api/experts?ids=123,456
 */
export async function GET(req: NextRequest) {
  const ids = [
    ...new Set(
      (req.nextUrl.searchParams.get("ids") ?? "")
        .split(",")
        .map(Number)
        .filter((n) => Number.isInteger(n) && n > 0),
    ),
  ].slice(0, MAX_EXPERTS);
  if (!ids.length) return Response.json({ experts: [], missing: [] });

  const results = await Promise.all(
    ids.map(async (id) => {
      try {
        return toExpert(await buildProfile(id));
      } catch (err) {
        if (!(err instanceof FplError && err.status === 404)) console.error(err);
        return id;
      }
    }),
  );
  return Response.json({
    experts: results.filter((r): r is ExpertProfile => typeof r !== "number"),
    missing: results.filter((r): r is number => typeof r === "number"),
  });
}

function toExpert(p: Awaited<ReturnType<typeof buildProfile>>): ExpertProfile {
  return {
    teamId: p.id,
    teamName: p.teamName,
    managerName: p.managerName,
    overallRank: p.overallRank,
    totalPoints: p.totalPoints,
    stats: p.stats,
    captains: p.gameweeks
      .filter((g) => g.captain)
      .map((g) => ({
        gw: g.gw,
        id: g.captain!.id,
        name: p.players[g.captain!.id]?.name ?? "Unknown",
        points: g.captain!.points,
        missed: g.captainMissed,
      })),
  };
}
