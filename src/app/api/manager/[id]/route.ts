import type { NextRequest } from "next/server";
import { buildProfile } from "@/lib/fpl/profile";
import { parseId, respond } from "@/lib/fpl/respond";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/manager/[id]">) {
  const id = parseId((await ctx.params).id);
  if (!id) return Response.json({ error: "Team ID must be a number" }, { status: 400 });
  return respond(() => buildProfile(id), "We couldn't find that team ID");
}
