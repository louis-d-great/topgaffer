"use client";

import { useCallback, useSyncExternalStore } from "react";

/*
 * Per-device state. Locked plans are also kept on Walrus and restored from there.
 * Every read and write is wrapped: storage can be blocked (private mode, previews).
 */

const listeners = new Set<() => void>();
const cache = new Map<string, { raw: string | null; value: unknown }>();

function read<T>(key: string, fallback: T): T {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(key);
  } catch {
    return fallback;
  }
  const hit = cache.get(key);
  if (hit && hit.raw === raw) return hit.value as T;
  let value: T = fallback;
  try {
    if (raw !== null) value = JSON.parse(raw) as T;
  } catch {
    value = fallback;
  }
  cache.set(key, { raw, value });
  return value;
}

export function writeLocal<T>(key: string, value: T | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable: the change lives only for this page view.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = () => listener();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useLocal<T>(key: string, fallback: T) {
  const value = useSyncExternalStore(
    subscribe,
    () => read(key, fallback),
    () => fallback,
  );
  const set = useCallback((next: T | null) => writeLocal(key, next), [key]);
  return [value, set] as const;
}

/** True once the client has hydrated and local storage is readable. */
export function useHydrated() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}

export const KEYS = {
  teamId: "tg.teamId",
  experts: "tg.experts.v2",
  /** Locked plans, per team: one browser can follow several teams. */
  plansFor: (teamId: number) => `tg.plans.${teamId}`,
  dismissed: "tg.dismissedLessons",
} as const;

/** An expert is tracked through their real FPL team, so their record updates itself. */
export interface Expert {
  teamId: number;
  name: string;
  handle: string;
  /** "fpl" for managers known only by their FPL record (top 50, proven). */
  platform: "x" | "youtube" | "other" | "fpl";
  /** ISO 3166 alpha-2, e.g. "NG", "GB", "US"; "XX" when unknown. */
  country: string;
  group?: "top" | "proven" | "creator";
  /** Proven managers: top-100k finishes in their last five seasons. */
  topFinishes?: number;
}

export interface LockedPlan {
  gw: number;
  captain: number;
  transfersIn: number[];
  transfersOut: number[];
  /** Secret mixed into the fingerprint so the plan stays hidden until it is revealed. */
  salt: string;
  fingerprint: string;
  savedAt: string;
  /** Set once the fingerprint is recorded (and frozen) on Sui. */
  sui?: { digest: string; network: string; explorerUrl: string };
  /** What the deadline check said when the plan was locked, so the review can judge it after the gameweek. */
  verdict?: string;
  hitCost?: number;
  warnings?: { id: string; title: string }[];
  /** Rebuilt from Walrus on this device (no salt, so it can't be re-proved here). */
  restored?: boolean;
}
