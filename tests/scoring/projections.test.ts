import { describe, expect, it } from "vitest";
import type { Player, Roster } from "../../src/domain/types";
import {
  evaluateRoll,
  recommendSkip,
  rosterGaps
} from "../../src/scoring/projections";

function player(name: string, id: string, team: string, decade: Player["decade"], positions: Player["positions"], ppg: number, rpg: number, apg: number, spg: number | null, bpg: number | null): Player {
  return {
    id,
    baseSlug: id,
    name,
    team,
    decade,
    primaryPosition: positions[0],
    positions,
    ppg,
    rpg,
    apg,
    spg,
    bpg
  };
}

const kobe = player("Kobe Bryant", "kobe", "LAL", "2000s", ["SG", "SF"], 30, 6.9, 5.9, 2.2, 0.8);
const shaq = player("Shaquille O'Neal", "shaq", "LAL", "2000s", ["C"], 29.7, 13.6, 3.8, 0.5, 3);
const rolePlayer = player("Role Player", "role", "LAL", "2000s", ["SF"], 11, 4, 2, 0.6, 0.2);
const guard = player("Elite Guard", "guard", "BOS", "1980s", ["PG"], 25, 5, 11, 2.1, 0.3);
const forward = player("Elite Forward", "forward", "BOS", "1980s", ["PF"], 24, 12, 4, 1.2, 1.8);

describe("projections", () => {
  it("ranks candidates by final outcome and preserves roll order on projection ties", () => {
    const result = evaluateRoll({
      roster: {},
      currentCandidates: [rolePlayer, shaq, kobe],
      allPlayers: [rolePlayer, shaq, kobe, guard, forward]
    });

    expect(result.recommendations[0].player.name).toBe("Role Player");
    expect(result.recommendations[0].position).toBe("SF");
    expect(result.recommendations).toHaveLength(3);
    expect(result.recommendations[0].deltaExpectedWins).toBeGreaterThanOrEqual(result.recommendations[2].deltaExpectedWins);
  });

  it("excludes already selected players from completion projections", () => {
    const roster: Roster = { SG: kobe };
    const result = evaluateRoll({
      roster,
      currentCandidates: [shaq],
      allPlayers: [kobe, shaq, guard, forward]
    });

    expect(result.recommendations[0].expectedRoster.SG?.id).toBe("kobe");
    expect(Object.values(result.recommendations[0].expectedRoster).filter((drafted) => drafted?.id === "kobe")).toHaveLength(1);
  });

  it("identifies roster gaps by weakest category share", () => {
    expect(rosterGaps({ C: shaq })).toEqual(["STL", "AST", "PPG"]);
  });

  it("returns keep advice when the current roll is strong", () => {
    const advice = recommendSkip({
      bestDeltaExpectedWins: 10,
      bestDeltaCeilingWins: 3,
      teamRerollMedianDelta: 8,
      decadeRerollMedianDelta: 7,
      ceilingWins: 82
    });

    expect(advice.kind).toBe("keep");
  });
});
