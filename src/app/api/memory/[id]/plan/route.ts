import type { NextRequest } from "next/server";
import { parseId } from "@/lib/fpl/respond";
import { remember, isRateLimited } from "@/lib/memory";
import { decodePlan, encodePlan } from "@/lib/plan-data";

interface PlanMemory {
  teamName: string;
  summary: string;
  /** The structured plan, in the wire shape of plan-data.ts. */
  plan: unknown;
}

/** Remembers a locked deadline plan: a readable summary for the coach, plus the plan itself so any device can restore it. */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/memory/[id]/plan">) {
  const id = parseId((await ctx.params).id);
  const b = (await req.json().catch(() => null)) as Partial<PlanMemory> | null;
  const plan = decodePlan(b?.plan);
  if (!id || !plan) return Response.json({ error: "Invalid plan" }, { status: 400 });
  const clip = (s: unknown, n: number) => (typeof s === "string" ? s.slice(0, n) : "");
  const warnings = plan.warnings ?? [];
  const text =
    `[TopGaffer · ${clip(b?.teamName, 60)} · GW${plan.gw} plan locked] ${clip(b?.summary, 300)} ` +
    `Verdict: ${plan.verdict ?? "unknown"}.` +
    (warnings.length ? ` Warnings shown before locking: ${warnings.map((w) => w.title).join("; ")}.` : "") +
    ` Fingerprint ${plan.fingerprint.slice(0, 16)}. ${encodePlan(plan)}`;
  try {
    const [job] = await remember(id, [{ key: `gw${plan.gw}-plan-${plan.fingerprint.slice(0, 12)}`, text }]);
    return Response.json({ jobId: job.jobId });
  } catch (err) {
    if (isRateLimited(err)) return Response.json({ error: "Walrus Memory is busy. Retrying shortly." }, { status: 429 });
    console.error(err);
    return Response.json({ error: "Couldn't reach Walrus Memory." }, { status: 502 });
  }
}
