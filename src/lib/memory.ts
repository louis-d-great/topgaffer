import "server-only";
import { createHash } from "node:crypto";
import { MemWal, MemWalRateLimitedError } from "@mysten-incubation/memwal";
import type { ManagerProfile } from "./fpl/types";

/*
 * Walrus Memory (mainnet). Each FPL team gets its own namespace, so one
 * manager's memories never mix with another's. Memories are short, structured
 * sentences: the Walrus docs note these recall better than raw chat.
 */

let client: MemWal | null = null;

function memwal() {
  if (!client) {
    const key = process.env.MEMWAL_KEY;
    const accountId = process.env.MEMWAL_ACCOUNT_ID;
    if (!key || !accountId) throw new Error("Walrus Memory is not configured (MEMWAL_KEY, MEMWAL_ACCOUNT_ID).");
    client = MemWal.create({
      key,
      accountId,
      serverUrl: process.env.MEMWAL_SERVER_URL ?? "https://relayer.memory.walrus.xyz",
      namespace: "topgaffer",
    });
  }
  return client;
}

const CHIPS: Record<string, string> = { bboost: "Bench Boost", "3xc": "Triple Captain", wildcard: "Wildcard", freehit: "Free Hit" };

export const namespaceFor = (teamId: number) => `topgaffer-team-${teamId}`;

export interface MemoryItem {
  /** Stable key: the same fact for the same gameweek is only ever written once. */
  key: string;
  text: string;
}

/** Everything worth remembering from a manager's season so far. */
export function memoriesFromProfile(p: ManagerProfile): MemoryItem[] {
  const name = (id: number) => p.players[id]?.name ?? "Unknown";
  const tag = (label: string) => `[TopGaffer · ${p.teamName} · ${label}]`;
  const items: MemoryItem[] = [];

  for (const g of p.gameweeks) {
    const moves = p.transfers.find((t) => t.gw === g.gw);
    const parts = [
      `Scored ${g.points} pts (average ${g.average}).`,
      g.captain
        ? `Captain ${name(g.captain.id)} scored ${g.captain.points}` +
          (g.captainMissed > 0 && g.bestCaptain ? `; ${name(g.bestCaptain.id)} would have given ${g.captainMissed} more.` : ", the best choice in the team.")
        : "",
      moves
        ? `Transfers: ${moves.ins.map(name).join(", ")} in for ${moves.outs.map(name).join(", ")}` +
          (moves.hitCost ? ` (−${moves.hitCost} hit)` : "") +
          `, net ${moves.gain >= 0 ? "+" : ""}${moves.gain} pts over ${moves.horizon} GW.` +
          (moves.chasedHaul ? " Bought a player straight after a big haul." : "")
        : "No transfers.",
      g.benchPoints ? `${g.benchPoints} pts left on the bench.` : "",
      g.chip ? `Chip played: ${CHIPS[g.chip] ?? g.chip}.` : "",
    ];
    items.push({ key: `gw${g.gw}-review`, text: `${tag(`GW${g.gw} review`)} ${parts.filter(Boolean).join(" ")}` });
  }

  // Lessons are re-written each gameweek, so the memory shows how the picture changes over time.
  for (const l of p.lessons) {
    items.push({
      key: `lesson-${l.id}-gw${p.currentGw}`,
      text: `${tag(`lesson after GW${p.currentGw} · ${l.topic}`)} ${l.title}. ${l.detail}${l.evidence ? ` Evidence: ${l.evidence}` : ""}`,
    });
  }
  return items;
}

/**
 * Queues memories on Walrus in one bulk request (the relayer allows 60 requests
 * a minute per key). Writing takes ~30s, so this returns once they're accepted.
 */
export async function remember(teamId: number, items: MemoryItem[]) {
  if (!items.length) return [];
  const ns = namespaceFor(teamId);
  const batchKey = createHash("sha256").update(items.map((i) => i.key).join("|")).digest("hex").slice(0, 32);
  const res = await withRetry(() =>
    memwal().rememberBulkAsync(
      items.map((i) => ({ text: i.text, namespace: ns })),
      { idempotencyKey: `${ns}:${batchKey}` },
    ),
  );
  return items.map((item, i) => ({ key: item.key, jobId: res.job_ids[i] }));
}

/** Where each write has got to, in a single request. */
export async function jobStatus(jobIds: string[]) {
  if (!jobIds.length) return [];
  const { results } = await memwal().getRememberBulkStatus(jobIds);
  return results.map((r) => ({ jobId: r.job_id, status: r.status, blobId: r.blob_id ?? null }));
}

export function isRateLimited(err: unknown) {
  return err instanceof MemWalRateLimitedError || (err instanceof Error && /(429)/.test(err.message));
}

/** The relayer connection occasionally drops ("fetch failed"); the idempotency key makes retrying safe. */
async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i >= attempts || !(err instanceof TypeError)) throw err;
      await new Promise((r) => setTimeout(r, 600 * i));
    }
  }
}

export async function recall(teamId: number, query: string, limit = 5) {
  const res = await memwal().recall({ query, namespace: namespaceFor(teamId), limit });
  return res.results.map((m) => ({ text: m.text, blobId: m.blob_id, distance: m.distance }));
}

export async function memoryCount(teamId: number) {
  const ns = namespaceFor(teamId);
  const { namespaces } = await memwal().listNamespaces();
  return namespaces.find((n) => n.name === ns)?.memory_count ?? 0;
}
