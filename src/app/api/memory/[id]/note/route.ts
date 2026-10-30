import type { NextRequest } from "next/server";
import { parseId } from "@/lib/fpl/respond";
import { isRateLimited, remember } from "@/lib/memory";

/** Body: { key: "gw9-plan-review", label, text } → one memory, written once per key. */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/memory/[id]/note">) {
  const id = parseId((await ctx.params).id);
  const b = (await req.json().catch(() => null)) as { key?: unknown; label?: unknown; text?: unknown } | null;
  const key = typeof b?.key === "string" ? b.key : "";
  if (!id || !/^gw\d{1,2}-plan-review$/.test(key) || typeof b?.text !== "string" || !b.text.trim()) {
    return Response.json({ error: "Invalid note" }, { status: 400 });
  }
  const label = typeof b.label === "string" ? b.label.slice(0, 80) : "note";
  const text = `[TopGaffer · ${label}] ${b.text.slice(0, 600)}`;
  try {
    const [job] = await remember(id, [{ key, text }]);
    return Response.json({ jobId: job.jobId });
  } catch (err) {
    if (isRateLimited(err)) return Response.json({ error: "Walrus Memory is busy. Retrying shortly." }, { status: 429 });
    console.error(err);
    return Response.json({ error: "Couldn't reach Walrus Memory." }, { status: 502 });
  }
}
