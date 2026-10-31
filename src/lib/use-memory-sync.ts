"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ManagerProfile } from "./fpl/types";
import { toWire } from "./plan-data";
import { useLocal, type LockedPlan } from "./store";

export interface SavedMemory {
  jobId: string;
  status: "pending" | "running" | "uploaded" | "done" | "failed" | "not_found";
  blobId: string | null;
  text?: string;
}

type Ledger = Record<string, SavedMemory>;

// The relayer allows 60 requests a minute per key, shared by every user: poll gently.
const POLL_MS = 15000;
const BUSY_RETRY_MS = 60000;
const DONE = new Set(["done"]);
const DEAD = new Set(["failed", "not_found"]);
// One sync per team per page load, even if several components mount the hook.
const synced = new Set<number>();

/**
 * Keeps this manager's season in Walrus Memory. The ledger (per device) records
 * which memories were accepted and their blob IDs, so nothing is written twice.
 */
export function useMemorySync(teamId: number | null, profile: ManagerProfile | null) {
  const [ledger, setLedger] = useLocal<Ledger>(`tg.walrus.${teamId ?? 0}`, {});
  const [items, setItems] = useState<{ key: string; text: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const ledgerRef = useRef(ledger);
  useEffect(() => {
    ledgerRef.current = ledger;
  }, [ledger]);

  const merge = useCallback(
    (patch: Ledger) => setLedger({ ...ledgerRef.current, ...patch }),
    [setLedger],
  );

  // Write anything new once the season has loaded.
  useEffect(() => {
    if (!teamId || !profile || synced.has(teamId)) return;
    synced.add(teamId);
    const known = Object.entries(ledgerRef.current)
      .filter(([, m]) => !DEAD.has(m.status))
      .map(([k]) => k);
    fetch(`/api/memory/${teamId}/sync`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ known }),
    })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "Memory sync failed");
        setError(null);
        const texts = new Map<string, string>(body.items.map((i: { key: string; text: string }) => [i.key, i.text]));
        setItems(body.items);
        const patch: Ledger = {};
        for (const a of body.accepted as { key: string; jobId: string }[]) {
          patch[a.key] = { jobId: a.jobId, status: "pending", blobId: null, text: texts.get(a.key) };
        }
        merge(patch);
      })
      .catch((err: Error) => {
        synced.delete(teamId);
        setError(err.message);
        // Try again once the relayer rate limit has reset.
        setTimeout(() => setRetry((n) => n + 1), BUSY_RETRY_MS);
      });
  }, [teamId, profile, merge, retry]);

  // Poll unfinished writes until Walrus confirms them.
  const pendingIds = Object.values(ledger)
    .filter((m) => !DONE.has(m.status) && !DEAD.has(m.status))
    .map((m) => m.jobId)
    .join(",");
  useEffect(() => {
    if (!pendingIds) return;
    const t = setInterval(async () => {
      try {
        const res = await fetch("/api/memory/status", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ jobIds: pendingIds.split(",") }),
        });
        if (!res.ok) return;
        const { jobs } = (await res.json()) as { jobs: { jobId: string; status: SavedMemory["status"]; blobId: string | null }[] };
        const byJob = new Map(jobs.map((j) => [j.jobId, j]));
        const patch: Ledger = {};
        for (const [key, m] of Object.entries(ledgerRef.current)) {
          const j = byJob.get(m.jobId);
          if (j && (j.status !== m.status || j.blobId !== m.blobId)) patch[key] = { ...m, status: j.status, blobId: j.blobId };
        }
        if (Object.keys(patch).length) merge(patch);
      } catch {
        // Network hiccup: try again on the next tick.
      }
    }, POLL_MS);
    return () => clearInterval(t);
  }, [pendingIds, merge]);

  /** Remembers a locked plan (with the warnings shown) on Walrus. */
  const rememberPlan = useCallback(
    async ({ plan, ...rest }: { teamName: string; summary: string; plan: LockedPlan }) => {
      if (!teamId) return;
      let res: Response;
      let body: { jobId?: string; error?: string };
      for (let attempt = 1; ; attempt++) {
        res = await fetch(`/api/memory/${teamId}/plan`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...rest, plan: toWire(plan) }),
        });
        body = await res.json();
        if (res.status !== 429 || attempt >= 3) break;
        await new Promise((r) => setTimeout(r, BUSY_RETRY_MS / 2));
      }
      if (!res.ok || !body.jobId) throw new Error(body.error ?? "Couldn't save the plan to memory");
      merge({ [`gw${plan.gw}-plan-${plan.fingerprint.slice(0, 12)}`]: { jobId: body.jobId, status: "pending", blobId: null, text: rest.summary } });
    },
    [teamId, merge],
  );

  /** Writes a one-off note (e.g. a plan review) once; the ledger stops it being written twice. */
  const pendingNotes = useRef(new Set<string>());
  const rememberNote = useCallback(
    async (key: string, label: string, text: string) => {
      if (!teamId || ledgerRef.current[key] || pendingNotes.current.has(key)) return;
      pendingNotes.current.add(key);
      try {
        const res = await fetch(`/api/memory/${teamId}/note`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ key, label, text }),
        });
        const body = await res.json();
        if (!res.ok || !body.jobId) throw new Error(body.error ?? "Couldn't save the note to memory");
        merge({ [key]: { jobId: body.jobId, status: "pending", blobId: null, text: `[TopGaffer · ${label}] ${text}` } });
      } finally {
        pendingNotes.current.delete(key);
      }
    },
    [teamId, merge],
  );

  const all = Object.values(ledger);
  return {
    ledger,
    items,
    error,
    saved: all.filter((m) => DONE.has(m.status)).length,
    pending: all.filter((m) => !DONE.has(m.status) && !DEAD.has(m.status)).length,
    rememberPlan,
    rememberNote,
  };
}

export type MemorySync = ReturnType<typeof useMemorySync>;
