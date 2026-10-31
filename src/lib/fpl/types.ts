export type Position = "GKP" | "DEF" | "MID" | "FWD";

export interface Player {
  id: number;
  name: string;
  fullName: string;
  teamId: number;
  team: string;
  /** FPL's club code, used for the official shirt image. */
  teamCode: number;
  pos: Position;
  price: number;
  form: number;
  /** FPL's expected points for the next gameweek. */
  xp: number;
  totalPoints: number;
  lastGwPoints: number;
  selectedBy: number;
  status: string;
  news: string;
  photo: string;
}

export interface Team {
  id: number;
  name: string;
  short: string;
}

export interface GameweekInfo {
  id: number;
  deadline: string;
  finished: boolean;
  isCurrent: boolean;
  isNext: boolean;
  average: number;
}

export interface Fixture {
  event: number;
  home: number;
  away: number;
  homeDifficulty: number;
  awayDifficulty: number;
  kickoff: string | null;
}

/** A gameweek as the manager played it. */
export interface PlayedGameweek {
  gw: number;
  points: number;
  average: number;
  overallRank: number;
  hitCost: number;
  transfers: number;
  benchPoints: number;
  chip: string | null;
  captain: { id: number; points: number; multiplier: number } | null;
  bestCaptain: { id: number; points: number } | null;
  /** Extra points a better captain choice in the XI would have earned. */
  captainMissed: number;
}

export interface TransferWindow {
  gw: number;
  ins: number[];
  outs: number[];
  hitCost: number;
  /** Points of players in minus players out, over the window horizon. */
  gain: number;
  horizon: number;
  chasedHaul: boolean;
}

export type LessonTone = "warning" | "strength" | "info";

export interface Lesson {
  id: string;
  tone: LessonTone;
  topic: "captaincy" | "hits" | "chasing" | "bench" | "transfers" | "chips";
  title: string;
  detail: string;
  evidence: string;
}

export interface ManagerProfile {
  id: number;
  managerName: string;
  teamName: string;
  overallRank: number | null;
  totalPoints: number;
  currentGw: number;
  nextGw: { id: number; deadline: string } | null;
  gameweeks: PlayedGameweek[];
  transfers: TransferWindow[];
  stats: {
    captainAvg: number;
    captainBestRate: number;
    captainMissed: number;
    benchPoints: number;
    hits: number;
    hitCost: number;
    hitsPaidOff: number;
    hitLoss: number;
    transferSuccess: number;
    transferWindows: number;
    pointsLost: number;
  };
  lessons: Lesson[];
  players: Record<number, Pick<Player, "id" | "name" | "team" | "pos">>;
}

/** An expert's record, built from their real FPL team. */
export interface ExpertProfile {
  teamId: number;
  teamName: string;
  managerName: string;
  overallRank: number | null;
  totalPoints: number;
  stats: ManagerProfile["stats"];
  captains: { gw: number; id: number; name: string; points: number; missed: number }[];
}

type PlayerRef = { id: number; name: string; team: string; pos: Position };

/** The full analysis behind an expert's dashboard. */
export interface ExpertDetail {
  teamId: number;
  teamName: string;
  managerName: string;
  overallRank: number | null;
  totalPoints: number;
  stats: ManagerProfile["stats"];
  gameweeks: {
    gw: number;
    points: number;
    average: number;
    overallRank: number;
    hitCost: number;
    transfers: number;
    benchPoints: number;
    chip: string | null;
    value: number;
    captain: (PlayerRef & { points: number; multiplier: number }) | null;
    best: (PlayerRef & { points: number }) | null;
  }[];
  transfers: {
    gw: number;
    hitCost: number;
    gain: number;
    horizon: number;
    chasedHaul: boolean;
    ins: (PlayerRef & { points: number })[];
    outs: (PlayerRef & { points: number })[];
  }[];
  squad: (Pick<Player, "id" | "name" | "team" | "pos" | "price" | "selectedBy" | "form" | "totalPoints" | "status"> & {
    isCaptain: boolean;
    benched: boolean;
    heldGws: number;
  })[];
  trusted: (PlayerRef & { gws: number })[];
  chips: { name: string; gw: number }[];
  style: {
    xiOwnership: number;
    differentials: number;
    transfersPerWeek: number;
    captainOwnership: number;
    benchPerWeek: number;
  };
}

export interface SquadPlayer extends Player {
  isCaptain: boolean;
  isVice: boolean;
  benched: boolean;
  fixture: { opponent: string; home: boolean; difficulty: number } | null;
}

export interface DeadlineData {
  gw: GameweekInfo;
  squad: SquadPlayer[];
  bank: number;
  estimatedFreeTransfers: number;
  players: (Player & { fixture: SquadPlayer["fixture"] })[];
}

/** Where an expert comes from: today's leaderboard, a long track record, or a following. */
export type ExpertGroup = "top" | "proven" | "creator";

/** A manager in one of the expert groups, before anyone follows them. */
export interface GroupManager {
  teamId: number;
  teamName: string;
  managerName: string;
  rank: number | null;
  points: number;
  /** Proven managers: their last five finished seasons. */
  seasons?: { season: string; rank: number }[];
  topFinishes?: number;
}
