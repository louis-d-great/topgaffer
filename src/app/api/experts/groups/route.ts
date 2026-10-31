import type { NextRequest } from "next/server";
import { getProvenManagers, getTopManagers, PROVEN_RULE } from "@/lib/fpl/groups";
import { respond } from "@/lib/fpl/respond";

/** GET /api/experts/groups?group=top|proven → the managers in that group. */
export async function GET(req: NextRequest) {
  const group = req.nextUrl.searchParams.get("group");
  if (group === "top") return respond(async () => ({ group, managers: await getTopManagers() }));
  if (group === "proven") return respond(async () => ({ group, managers: await getProvenManagers(), rule: PROVEN_RULE }));
  return Response.json({ error: "Unknown group" }, { status: 400 });
}
