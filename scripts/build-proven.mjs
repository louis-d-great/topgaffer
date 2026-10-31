/*
 * Builds the "Proven managers" shortlist: managers in today's overall top 1,000
 * who also finished inside the top 100k in at least 3 of their last 5 seasons.
 * Past seasons never change, so this runs once (not on every page view):
 *   node scripts/build-proven.mjs
 * The app adds each manager's live rank and points on top.
 */
import { writeFileSync } from "node:fs";

const BASE = "https://fantasy.premierleague.com/api";
const POOL_PAGES = 20; // 50 managers per page
const TOP = 100_000;
const MIN_SEASONS = 3;
const KEEP = 40;

const get = async (path) => {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(BASE + path, { headers: { "User-Agent": "TopGaffer/0.1 (+hackathon project)" } }).catch(() => null);
    if (res?.ok) return res.json();
    if (attempt >= 4) throw new Error(`${path} failed (${res?.status ?? "network"})`);
    await new Promise((r) => setTimeout(r, 600 * attempt));
  }
};

const pool = [];
for (let page = 1; page <= POOL_PAGES; page++) {
  const d = await get(`/leagues-classic/314/standings/?page_standings=${page}`);
  pool.push(...d.standings.results.map((r) => ({ teamId: r.entry, teamName: r.entry_name, managerName: r.player_name })));
}

const proven = [];
for (let i = 0; i < pool.length; i += 6) {
  const rows = await Promise.all(
    pool.slice(i, i + 6).map(async (m) => {
      const h = await get(`/entry/${m.teamId}/history/`).catch(() => null);
      const seasons = (h?.past ?? []).slice(-5).map((s) => ({ season: s.season_name, rank: s.rank }));
      const topFinishes = seasons.filter((s) => s.rank <= TOP).length;
      return topFinishes >= MIN_SEASONS ? { ...m, topFinishes, seasons } : null;
    }),
  );
  proven.push(...rows.filter(Boolean));
  process.stdout.write(`\r${Math.min(i + 6, pool.length)}/${pool.length} checked, ${proven.length} proven`);
}

const avg = (m) => m.seasons.reduce((s, x) => s + x.rank, 0) / m.seasons.length;
proven.sort((a, b) => b.topFinishes - a.topFinishes || avg(a) - avg(b));

writeFileSync(
  new URL("../src/data/proven-managers.json", import.meta.url),
  JSON.stringify({ builtAt: new Date().toISOString(), rule: { pool: POOL_PAGES * 50, top: TOP, minSeasons: MIN_SEASONS, of: 5 }, managers: proven.slice(0, KEEP) }, null, 2) + "\n",
);
console.log(`\nSaved ${Math.min(proven.length, KEEP)} of ${proven.length} proven managers.`);
