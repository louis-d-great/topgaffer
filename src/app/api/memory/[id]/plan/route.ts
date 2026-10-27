import type { NextRequest } from "next/server";
import { parseId } from "@/lib/fpl/respond";
import { remember, isRateLimited } from "@/lib/memory";

interface PlanMemory {
  gw: number;
  teamName: string;
  summary: string;
  verdict: string;
  warnings: string[];
  fingerprint: string;
}

/** Remembers a locked deadline plan, including the warnings the manager chose to ignore. */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/memory/[id]/plan">) {
  const id = parseId((await ctx.params).id);
  const b = (await req.json().catch(() => null)) as Partial<PlanMemory> | null;
  if (!id || !b || !Number.isInteger(b.gw) || typeof b.fingerprint !== "string" || !/^[0-9a-f]{64}$/.test(b.fingerprint)) {
    return Response.json({ error: "Invalid plan" }, { status: 400 });
  }
  const clip = (s: unknown, n: number) => (typeof s === "string" ? s.slice(0, n) : "");
  const warnings = Array.isArray(b.warnings) ? b.warnings.slice(0, 6).map((w) => clip(w, 160)).filter(Boolean) : [];
  const text =
    `[TopGaffer · ${clip(b.teamName, 60)} · GW${b.gw} plan locked] ${clip(b.summary, 300)} ` +
    `Verdict: ${clip(b.verdict, 40)}.` +
    (warnings.length ? ` Warnings shown before locking: ${warnings.join("; ")}.` : "") +
    ` Fingerprint ${b.fingerprint.slice(0, 16)}.`;
  try {
    const [job] = await remember(id, [{ key: `gw${b.gw}-plan-${b.fingerprint.slice(0, 12)}`, text }]);
    return Response.json({ jobId: job.jobId });
  } catch (err) {
    if (isRateLimited(err)) return Response.json({ error: "Walrus Memory is busy. Retrying shortly." }, { status: 429 });
    console.error(err);
    return Response.json({ error: "Couldn't reach Walrus Memory." }, { status: 502 });
  }
}
