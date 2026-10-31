import type { LockedPlan } from "./store";

/*
 * A locked plan travels inside its Walrus memory as a compact JSON tag, so any
 * device can rebuild the plan from Walrus. The salt never leaves the browser:
 * it is what keeps the plan hidden behind its Sui fingerprint.
 */

const TAG = "Plan data:";

export interface Wire {
  gw: number;
  c: number;
  in: number[];
  out: number[];
  hit?: number;
  v?: string;
  w?: { id: string; t: string }[];
  fp: string;
  at: string;
  sui?: { d: string; n: string; u: string };
}

const ints = (x: unknown) => Array.isArray(x) && x.length <= 15 && x.every((n) => Number.isInteger(n) && n > 0);
const str = (x: unknown, n: number) => (typeof x === "string" ? x.slice(0, n) : undefined);

export function toWire(p: LockedPlan): Wire {
  return {
    gw: p.gw,
    c: p.captain,
    in: p.transfersIn,
    out: p.transfersOut,
    hit: p.hitCost || undefined,
    v: p.verdict,
    w: p.warnings?.map((w) => ({ id: w.id, t: w.title })),
    fp: p.fingerprint,
    at: p.savedAt,
    sui: p.sui && { d: p.sui.digest, n: p.sui.network, u: p.sui.explorerUrl },
  };
}

export function encodePlan(p: LockedPlan): string {
  return `${TAG} ${JSON.stringify(toWire(p))}`;
}

/** Validates an incoming plan (from the browser or from Walrus) and returns it, or null. */
export function decodePlan(raw: unknown): LockedPlan | null {
  const w = raw as Partial<Wire> | null;
  if (!w || !Number.isInteger(w.gw) || w.gw! < 1 || w.gw! > 38 || !Number.isInteger(w.c) || !ints(w.in) || !ints(w.out)) return null;
  if (typeof w.fp !== "string" || !/^[0-9a-f]{64}$/.test(w.fp)) return null;
  const warnings = Array.isArray(w.w)
    ? w.w.slice(0, 8).flatMap((x) => (str(x?.id, 40) && str(x?.t, 160) ? [{ id: str(x.id, 40)!, title: str(x.t, 160)! }] : []))
    : [];
  const sui = w.sui && str(w.sui.d, 100) && str(w.sui.n, 20) && str(w.sui.u, 300)?.startsWith("https://")
    ? { digest: w.sui.d, network: w.sui.n, explorerUrl: w.sui.u }
    : undefined;
  return {
    gw: w.gw!,
    captain: w.c!,
    transfersIn: w.in!,
    transfersOut: w.out!,
    salt: "",
    fingerprint: w.fp,
    savedAt: str(w.at, 40) ?? new Date(0).toISOString(),
    sui,
    verdict: str(w.v, 40),
    hitCost: Number.isInteger(w.hit) && w.hit! >= 0 && w.hit! <= 40 ? w.hit : 0,
    warnings,
  };
}

/** Pulls the plan back out of a memory's text. */
export function planFromMemory(text: string): LockedPlan | null {
  const at = text.lastIndexOf(TAG);
  if (at < 0) return null;
  try {
    return decodePlan(JSON.parse(text.slice(at + TAG.length).trim()));
  } catch {
    return null;
  }
}

/** One plan per gameweek: the most recently locked wins. */
export function latestPerGameweek(plans: LockedPlan[]) {
  const out: Record<string, LockedPlan> = {};
  for (const p of plans) if (!out[p.gw] || out[p.gw].savedAt < p.savedAt) out[p.gw] = p;
  return out;
}
