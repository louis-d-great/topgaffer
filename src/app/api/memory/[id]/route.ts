import type { NextRequest } from "next/server";
import { parseId } from "@/lib/fpl/respond";
import { memoryCount, recall, isRateLimited } from "@/lib/memory";

/** GET ?q=… recalls memories by meaning; without q, returns how many are stored. */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/memory/[id]">) {
  const id = parseId((await ctx.params).id);
  if (!id) return Response.json({ error: "Team ID must be a number" }, { status: 400 });
  const q = req.nextUrl.searchParams.get("q")?.trim().slice(0, 200);
  try {
    if (q) return Response.json({ results: await recall(id, q, 6) });
    return Response.json({ count: await memoryCount(id) });
  } catch (err) {
    if (isRateLimited(err)) return Response.json({ error: "Walrus Memory is busy. Retrying shortly." }, { status: 429 });
    console.error(err);
    return Response.json({ error: "Couldn't reach Walrus Memory." }, { status: 502 });
  }
}
