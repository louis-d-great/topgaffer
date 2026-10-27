import type { NextRequest } from "next/server";
import { getBootstrap, getLivePoints } from "@/lib/fpl/api";
import { parseId, respond } from "@/lib/fpl/respond";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/live/[gw]">) {
  const gw = parseId((await ctx.params).gw);
  if (!gw) return Response.json({ error: "Gameweek must be a number" }, { status: 400 });
  return respond(async () => {
    const info = (await getBootstrap()).gameweeks.find((g) => g.id === gw);
    if (!info || (!info.finished && !info.isCurrent)) return null;
    return { gw, finished: info.finished, ...(await getLivePoints(gw, info.finished)) };
  }, "That gameweek hasn't been played yet");
}
