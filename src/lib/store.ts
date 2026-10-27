"use client";

import { useCallback, useSyncExternalStore } from "react";

/*
 * Local, per-device state until Supabase + Walrus are wired in.
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
  plans: "tg.plans",
  dismissed: "tg.dismissedLessons",
} as const;

/** An expert is tracked through their real FPL team, so their record updates itself. */
export interface Expert {
  teamId: number;
  name: string;
  handle: string;
  platform: "x" | "youtube" | "other";
  /** ISO 3166 alpha-2, e.g. "NG", "GB", "US". */
  country: string;
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
}
