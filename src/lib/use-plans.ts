"use client";

import { useEffect } from "react";
import { latestPerGameweek } from "./plan-data";
import { KEYS, useLocal, writeLocal, type LockedPlan } from "./store";
import { fingerprint } from "./verdict";

type Plans = Record<string, LockedPlan>;

/** This team's locked plans, keyed by gameweek. The browser keeps a copy; Walrus keeps the original. */
export function usePlans(teamId: number | null) {
  return useLocal<Plans>(KEYS.plansFor(teamId ?? 0), {});
}

const restored = new Set<number>();
const LEGACY_KEY = "tg.plans";

/** Plans saved before they were kept per team: each one's fingerprint says which team it belongs to. */
async function legacyPlansFor(teamId: number): Promise<LockedPlan[]> {
  let old: Plans = {};
  try {
    old = JSON.parse(window.localStorage.getItem(LEGACY_KEY) ?? "{}") as Plans;
  } catch {
    return [];
  }
  const mine: LockedPlan[] = [];
  for (const p of Object.values(old)) {
    const fp = await fingerprint(teamId, p.gw, { captain: p.captain, ins: p.transfersIn, outs: p.transfersOut, freeTransfers: 0 }, p.salt).catch(() => "");
    if (fp === p.fingerprint) mine.push(p);
  }
  return mine;
}

/**
 * Once per visit, rebuilds any locked plan this browser is missing from Walrus,
 * so a plan locked on a laptop is reviewed on a phone too.
 */
export function useRestorePlans(teamId: number | null) {
  const [plans] = usePlans(teamId);
  useEffect(() => {
    if (!teamId || restored.has(teamId)) return;
    restored.add(teamId);
    Promise.all([
      fetch(`/api/memory/${teamId}/plans`).then((r) => (r.ok ? (r.json() as Promise<{ plans: Plans }>) : null)),
      legacyPlansFor(teamId),
    ])
      .then(([body, legacy]) => {
        if (!body) restored.delete(teamId);
        const fromWalrus = Object.values(body?.plans ?? {}).map((p) => ({ ...p, restored: true }));
        const local = [...legacy, ...Object.values(plans)];
        const merged = latestPerGameweek([...fromWalrus, ...local]);
        // A plan locked in this browser keeps its salt, so prefer it over the restored copy of the same lock.
        for (const p of local) if (merged[p.gw].fingerprint === p.fingerprint) merged[p.gw] = p;
        if (Object.keys(merged).some((gw) => merged[gw] !== plans[gw])) writeLocal(KEYS.plansFor(teamId), merged);
      })
      .catch(() => restored.delete(teamId));
    // `plans` is read once, at restore time; later local locks are already newest.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);
}
