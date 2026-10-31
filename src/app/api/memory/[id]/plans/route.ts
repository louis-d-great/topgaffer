import type { NextRequest } from "next/server";
import { parseId } from "@/lib/fpl/respond";
import { isRateLimited, recall } from "@/lib/memory";
import { latestPerGameweek, planFromMemory } from "@/lib/plan-data";

/** Rebuilds a manager's locked plans from Walrus, so they follow the manager to any device. */
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/memory/[id]/plans">) {
  const id = parseId((await ctx.params).id);
  if (!id) return Response.json({ error: "Invalid team ID" }, { status: 400 });
  try {
    const found = await recall(id, "plan locked captain transfers fingerprint Plan data", 40);
    const plans = found.flatMap((m) => {
      const p = planFromMemory(m.text);
      return p ? [p] : [];
    });
    return Response.json({ plans: latestPerGameweek(plans) });
  } catch (err) {
    if (isRateLimited(err)) return Response.json({ error: "Walrus Memory is busy. Retrying shortly." }, { status: 429 });
    console.error(err);
    return Response.json({ error: "Couldn't reach Walrus Memory." }, { status: 502 });
  }
}
