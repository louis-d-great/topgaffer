import type { NextRequest } from "next/server";
import { lockFingerprint } from "@/lib/sui";

// The app's wallet pays for every lock, so cap how often one team can lock a gameweek.
const MAX_LOCKS_PER_GW = 5;
const locks = new Map<string, number>();

/** Body: { teamId, gw, fingerprint } → records the fingerprint on Sui and returns the transaction. */
export async function POST(req: NextRequest) {
  const b = (await req.json().catch(() => null)) as { teamId?: unknown; gw?: unknown; fingerprint?: unknown } | null;
  const teamId = Number(b?.teamId);
  const gw = Number(b?.gw);
  const fp = typeof b?.fingerprint === "string" ? b.fingerprint : "";
  if (!Number.isInteger(teamId) || teamId <= 0 || !Number.isInteger(gw) || gw < 1 || gw > 38 || !/^[0-9a-f]{64}$/.test(fp)) {
    return Response.json({ error: "Invalid lock request" }, { status: 400 });
  }
  const key = `${teamId}:${gw}`;
  const count = locks.get(key) ?? 0;
  if (count >= MAX_LOCKS_PER_GW) {
    return Response.json({ error: "Too many locks for this gameweek." }, { status: 429 });
  }
  locks.set(key, count + 1);
  try {
    return Response.json(await lockFingerprint(fp, gw));
  } catch (err) {
    locks.set(key, count);
    console.error(err);
    return Response.json({ error: "Couldn't record the lock on Sui. Try again." }, { status: 502 });
  }
}
