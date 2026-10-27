export const fmtRank = (n: number | null) => (n == null ? "—" : n.toLocaleString("en-GB"));

export const fmtSigned = (n: number) => (n > 0 ? `+${n}` : `${n}`);

export const pct = (x: number) => `${Math.round(x * 100)}%`;

export function timeUntil(iso: string, now: number) {
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return "Deadline passed";
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function fmtDeadline(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

