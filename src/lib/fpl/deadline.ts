import "server-only";
import { getBootstrap, getFixtures, getHistory, getPicks, type RawHistory } from "./api";
import type { DeadlineData, Fixture, FixtureRef, SquadPlayer } from "./types";

const RUN_LENGTH = 3;

const MAX_FREE_TRANSFERS = 5;

export async function buildDeadline(id: number): Promise<DeadlineData | null> {
  const [boot, history] = await Promise.all([getBootstrap(), getHistory(id)]);
  const next = boot.gameweeks.find((g) => g.isNext);
  const latest = history.current.at(-1);
  if (!next || !latest) return null;

  const runGws = Array.from({ length: RUN_LENGTH }, (_, i) => next.id + i).filter((gw) => gw <= 38);
  const [picks, ...runFixtures] = await Promise.all([getPicks(id, latest.event), ...runGws.map((gw) => getFixtures(gw))]);
  const fixtures = runFixtures[0];
  const teamShort = new Map(boot.teams.map((t) => [t.id, t.short]));
  const fixtureFor = (teamId: number) => describeFixture(fixtures, teamId, teamShort);
  const runFor = (teamId: number) => runFixtures.map((fx) => describeAll(fx, teamId, teamShort));
  const byId = new Map(boot.players.map((p) => [p.id, p]));

  const squad: SquadPlayer[] = picks.picks
    .map((pick) => {
      const p = byId.get(pick.element);
      if (!p) return null;
      return {
        ...p,
        isCaptain: pick.is_captain,
        isVice: pick.is_vice_captain,
        benched: pick.position > 11,
        fixture: fixtureFor(p.teamId),
        run: runFor(p.teamId),
      };
    })
    .filter((p): p is SquadPlayer => p !== null);

  return {
    gw: next,
    squad,
    bank: latest.bank / 10,
    estimatedFreeTransfers: estimateFreeTransfers(history),
    players: boot.players.map((p) => ({ ...p, fixture: fixtureFor(p.teamId), run: runFor(p.teamId) })),
  };
}

function describeAll(fixtures: Fixture[], teamId: number, teamShort: Map<number, string>): FixtureRef[] {
  return fixtures
    .filter((f) => f.home === teamId || f.away === teamId)
    .map((f) => {
      const home = f.home === teamId;
      return { opponent: teamShort.get(home ? f.away : f.home) ?? "", home, difficulty: home ? f.homeDifficulty : f.awayDifficulty };
    });
}

function describeFixture(fixtures: Fixture[], teamId: number, teamShort: Map<number, string>) {
  const f = fixtures.find((x) => x.home === teamId || x.away === teamId);
  if (!f) return null;
  const home = f.home === teamId;
  return {
    opponent: teamShort.get(home ? f.away : f.home) ?? "",
    home,
    difficulty: home ? f.homeDifficulty : f.awayDifficulty,
  };
}

/**
 * The public API doesn't expose free transfers, so we replay the season:
 * one is banked per gameweek (max 5), and wildcard / free hit weeks don't use any.
 * The user can correct it in the UI.
 */
function estimateFreeTransfers(history: RawHistory): number {
  const chipByGw = new Map(history.chips.map((c) => [c.event, c.name]));
  let ft = 0;
  history.current.forEach((h, i) => {
    if (i === 0) {
      ft = 1;
      return;
    }
    const chip = chipByGw.get(h.event);
    if (chip !== "wildcard" && chip !== "freehit") ft = Math.max(0, ft - h.event_transfers);
    ft = Math.min(MAX_FREE_TRANSFERS, ft + 1);
  });
  return Math.max(1, ft);
}
