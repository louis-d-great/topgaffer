"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ManagerProfile } from "./fpl/types";
import { reviewPlan, type PlanReview } from "./plan-review";
import { usePlans, useRestorePlans } from "./use-plans";
import { prefetch } from "./use-api";
import type { MemorySync } from "./use-memory-sync";

/** Final points per player for each finished gameweek in the list. */
function useLivePoints(gws: number[]) {
  const [live, setLive] = useState<Record<number, Record<number, number>>>({});
  const key = [...new Set(gws)].sort((a, b) => a - b).join(",");
  useEffect(() => {
    if (!key) return;
    let alive = true;
    Promise.all(
      key.split(",").map((g) =>
        prefetch(`/api/live/${g}`)
          .then((d) => d as { gw: number; points: Record<number, number> })
          .catch(() => null),
      ),
    ).then((rows) => {
      if (!alive) return;
      const next: Record<number, Record<number, number>> = {};
      for (const r of rows) if (r) next[r.gw] = r.points;
      setLive(next);
    });
    return () => {
      alive = false;
    };
  }, [key]);
  return live;
}

/**
 * Reviews every locked plan whose gameweek has finished, and writes each review
 * to Walrus once. The newest review feeds the next deadline's verdict.
 */
export function usePlanReviews(teamId: number | null, profile: ManagerProfile | null, memory: MemorySync) {
  useRestorePlans(teamId);
  const [plans] = usePlans(teamId);
  const finished = useMemo(
    () => (profile ? Object.values(plans).filter((p) => profile.gameweeks.some((g) => g.gw === p.gw)) : []),
    [plans, profile],
  );
  const live = useLivePoints(finished.map((p) => p.gw));

  const reviews = useMemo(() => {
    if (!profile) return [] as PlanReview[];
    return finished
      .filter((p) => live[p.gw])
      .map((p) => reviewPlan(p, profile, live[p.gw]))
      .filter((r): r is PlanReview => r !== null)
      .sort((a, b) => b.gw - a.gw);
  }, [finished, live, profile]);

  const { ledger, rememberNote, rememberPlan } = memory;

  // A plan whose memory never reached Walrus (e.g. locked during an outage) is sent again.
  // Only plans locked in this browser (they hold the salt) are resent; restored ones are already on Walrus.
  const resent = useRef(new Set<string>());
  useEffect(() => {
    if (!teamId || !profile) return;
    const name = (id: number) => profile.players[id]?.name ?? `player ${id}`;
    for (const p of Object.values(plans)) {
      const key = `gw${p.gw}-plan-${p.fingerprint.slice(0, 12)}`;
      const saved = ledger[key];
      if (!p.salt || p.restored || resent.current.has(key) || (saved && saved.status !== "failed" && saved.status !== "not_found")) continue;
      resent.current.add(key);
      const moves = p.transfersIn.map((id, i) => `${name(id)} in for ${name(p.transfersOut[i])}`).join(", ");
      rememberPlan({
        teamName: profile.teamName,
        summary: `Captain ${name(p.captain)}. ${moves ? `Transfers: ${moves}` : "No transfers"}${p.hitCost ? ` (−${p.hitCost} hit)` : ""}.`,
        plan: p,
      }).catch(() => resent.current.delete(key));
    }
  }, [plans, ledger, rememberPlan, teamId, profile]);
  useEffect(() => {
    if (!teamId || !profile) return;
    for (const r of reviews) {
      const key = `gw${r.gw}-plan-review`;
      if (ledger[key]) continue;
      rememberNote(key, `${profile.teamName} · GW${r.gw} plan review`, r.lesson).catch(() => {
        // Retried on the next visit; the review still shows locally.
      });
    }
  }, [reviews, ledger, rememberNote, teamId, profile]);

  return reviews;
}
