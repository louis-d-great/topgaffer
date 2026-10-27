import type { NextRequest } from "next/server";
import { buildDeadline } from "@/lib/fpl/deadline";
import { parseId, respond } from "@/lib/fpl/respond";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/deadline/[id]">) {
  const id = parseId((await ctx.params).id);
  if (!id) return Response.json({ error: "Team ID must be a number" }, { status: 400 });
  return respond(() => buildDeadline(id), "No upcoming deadline for this team");
}
