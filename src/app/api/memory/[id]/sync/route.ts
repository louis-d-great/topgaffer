import type { NextRequest } from "next/server";
import { buildProfile } from "@/lib/fpl/profile";
import { parseId } from "@/lib/fpl/respond";
import { memoriesFromProfile, remember, isRateLimited } from "@/lib/memory";

/** Writes any season memories the client hasn't seen confirmed yet. Body: { known: string[] } */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/memory/[id]/sync">) {
  const id = parseId((await ctx.params).id);
  if (!id) return Response.json({ error: "Team ID must be a number" }, { status: 400 });
  const body = (await req.json().catch(() => ({}))) as { known?: unknown };
  const known = new Set(Array.isArray(body.known) ? body.known.filter((k): k is string => typeof k === "string") : []);
  try {
    const items = memoriesFromProfile(await buildProfile(id));
    const fresh = items.filter((i) => !known.has(i.key));
    const accepted = await remember(id, fresh);
    return Response.json({ total: items.length, accepted, items: items.map((i) => ({ key: i.key, text: i.text })) });
  } catch (err) {
    if (isRateLimited(err)) return Response.json({ error: "Walrus Memory is busy. Retrying shortly." }, { status: 429 });
    console.error(err);
    return Response.json({ error: "Couldn't reach Walrus Memory. Try again shortly." }, { status: 502 });
  }
}
