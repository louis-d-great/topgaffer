import type { NextRequest } from "next/server";
import { buildExpertDetail } from "@/lib/fpl/expert-detail";
import { parseId, respond } from "@/lib/fpl/respond";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/experts/[id]">) {
  const id = parseId((await ctx.params).id);
  if (!id) return Response.json({ error: "Team ID must be a number" }, { status: 400 });
  return respond(() => buildExpertDetail(id), "We couldn't find that team ID");
}
