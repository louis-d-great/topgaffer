import "server-only";
import { cacheLife } from "next/cache";
import type { Fixture, GameweekInfo, Player, Position, Team } from "./types";

// The FPL API is public but undocumented. It must be called from the server (no CORS).
const BASE = "https://fantasy.premierleague.com/api";
const POSITIONS: Position[] = ["GKP", "DEF", "MID", "FWD"];

export class FplError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

// Loading several seasons at once fires many requests; FPL drops some if they all go at once.
const MAX_CONCURRENT = 6;
const RETRIES = 3;
let active = 0;
const queue: (() => void)[] = [];

async function slot<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= MAX_CONCURRENT) await new Promise<void>((r) => queue.push(r));
  active++;
  try {
    return await fn();
  } finally {
    active--;
    queue.shift()?.();
  }
}

async function get<T>(path: string): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await slot(() =>
        fetch(`${BASE}${path}`, { headers: { "User-Agent": "TopGaffer/0.1 (+hackathon project)" } }),
      );
      if (res.status === 404) throw new FplError("Not found", 404);
      if (res.status === 429 || res.status >= 500) throw new FplError(`FPL responded ${res.status}`, 502);
      if (!res.ok) throw new FplError(`FPL responded ${res.status}`, 502);
      return (await res.json()) as T;
    } catch (err) {
      const retryable = err instanceof TypeError || (err instanceof FplError && err.status === 502);
      if (!retryable || attempt >= RETRIES) throw err;
      await new Promise((r) => setTimeout(r, 400 * attempt));
    }
  }
}

interface RawBootstrap {
  events: {
    id: number;
    deadline_time: string;
    finished: boolean;
    is_current: boolean;
    is_next: boolean;
    average_entry_score: number;
  }[];
  teams: { id: number; code: number; name: string; short_name: string }[];
  elements: {
    id: number;
    web_name: string;
    first_name: string;
    second_name: string;
    team: number;
    element_type: number;
    now_cost: number;
    form: string;
    ep_next: string | null;
    total_points: number;
    event_points: number;
    selected_by_percent: string;
    status: string;
    news: string;
    photo: string;
  }[];
}

export interface Bootstrap {
  gameweeks: GameweekInfo[];
  teams: Team[];
  players: Player[];
}

export async function getBootstrap(): Promise<Bootstrap> {
  "use cache";
  cacheLife("minutes");
  const raw = await get<RawBootstrap>("/bootstrap-static/");
  const teams = raw.teams.map((t) => ({ id: t.id, name: t.name, short: t.short_name }));
  const teamShort = new Map(teams.map((t) => [t.id, t.short]));
  const teamCode = new Map(raw.teams.map((t) => [t.id, t.code]));
  return {
    teams,
    gameweeks: raw.events.map((e) => ({
      id: e.id,
      deadline: e.deadline_time,
      finished: e.finished,
      isCurrent: e.is_current,
      isNext: e.is_next,
      average: e.average_entry_score,
    })),
    players: raw.elements.map((p) => ({
      id: p.id,
      name: p.web_name,
      fullName: `${p.first_name} ${p.second_name}`,
      teamId: p.team,
      team: teamShort.get(p.team) ?? "",
      teamCode: teamCode.get(p.team) ?? 0,
      pos: POSITIONS[p.element_type - 1] ?? "MID",
      price: p.now_cost / 10,
      form: Number(p.form) || 0,
      xp: Number(p.ep_next) || 0,
      totalPoints: p.total_points,
      lastGwPoints: p.event_points,
      selectedBy: Number(p.selected_by_percent) || 0,
      status: p.status,
      news: p.news,
      photo: p.photo.replace(".jpg", ""),
    })),
  };
}

/** Points per player for one gameweek, plus whether they played. */
export async function getLivePoints(gw: number, finished: boolean) {
  "use cache";
  // A finished gameweek never changes, so it can be cached for a long time.
  if (finished) cacheLife("max");
  else cacheLife("minutes");
  const raw = await get<{ elements: { id: number; stats: { total_points: number; minutes: number } }[] }>(
    `/event/${gw}/live/`,
  );
  const points: Record<number, number> = {};
  const minutes: Record<number, number> = {};
  for (const el of raw.elements) {
    points[el.id] = el.stats.total_points;
    minutes[el.id] = el.stats.minutes;
  }
  return { points, minutes };
}

export async function getFixtures(gw: number): Promise<Fixture[]> {
  "use cache";
  cacheLife("hours");
  const raw = await get<
    {
      event: number;
      team_h: number;
      team_a: number;
      team_h_difficulty: number;
      team_a_difficulty: number;
      kickoff_time: string | null;
    }[]
  >(`/fixtures/?event=${gw}`);
  return raw.map((f) => ({
    event: f.event,
    home: f.team_h,
    away: f.team_a,
    homeDifficulty: f.team_h_difficulty,
    awayDifficulty: f.team_a_difficulty,
    kickoff: f.kickoff_time,
  }));
}

export interface RawEntry {
  id: number;
  name: string;
  player_first_name: string;
  player_last_name: string;
  summary_overall_rank: number | null;
  summary_overall_points: number;
  current_event: number | null;
}

export interface RawHistory {
  current: {
    event: number;
    points: number;
    overall_rank: number;
    bank: number;
    value: number;
    event_transfers: number;
    event_transfers_cost: number;
    points_on_bench: number;
  }[];
  chips: { name: string; event: number }[];
}

export interface RawPicks {
  active_chip: string | null;
  picks: { element: number; position: number; multiplier: number; is_captain: boolean; is_vice_captain: boolean }[];
}

export interface RawTransfer {
  element_in: number;
  element_out: number;
  event: number;
}

export async function getEntry(id: number) {
  "use cache";
  cacheLife("minutes");
  return get<RawEntry>(`/entry/${id}/`);
}

export async function getHistory(id: number) {
  "use cache";
  cacheLife("minutes");
  return get<RawHistory>(`/entry/${id}/history/`);
}

export async function getTransfers(id: number) {
  "use cache";
  cacheLife("minutes");
  return get<RawTransfer[]>(`/entry/${id}/transfers/`);
}

export async function getPicks(id: number, gw: number) {
  "use cache";
  cacheLife("hours");
  return get<RawPicks>(`/entry/${id}/event/${gw}/picks/`);
}
