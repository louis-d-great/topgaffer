import type { NextRequest } from "next/server";
import { jobStatus, isRateLimited } from "@/lib/memory";

/** Body: { jobIds: string[] } → where each Walrus write has got to. */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { jobIds?: unknown };
  const ids = Array.isArray(body.jobIds) ? body.jobIds.filter((j): j is string => typeof j === "string").slice(0, 50) : [];
  try {
    return Response.json({ jobs: await jobStatus(ids) });
  } catch (err) {
    if (isRateLimited(err)) return Response.json({ error: "Walrus Memory is busy. Retrying shortly." }, { status: 429 });
    console.error(err);
    return Response.json({ error: "Couldn't reach Walrus Memory." }, { status: 502 });
  }
}
