import { describe, expect, it } from "vitest";
import type { Player, Roster } from "../../src/domain/types";
import {
  evaluateRoll,
  estimateRerollDeltas,
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
const starterWing = player("Starter Wing", "starter", "NYK", "1990s", ["SF"], 5, 2, 1, 0, 0);
const flexibleBig = player("Flexible Big", "flex", "NYK", "1990s", ["PG", "C"], 30, 10, 8, 1, 1);
const solidGuard = player("Solid Guard", "solid-guard", "NYK", "1990s", ["PG"], 20, 5, 8, 1, 0.3);
const replacementCenter = player("Replacement Center", "replacement-center", "NYK", "1990s", ["C"], 1, 1, 0, 0, 0);

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

  it("does not recommend current candidates already selected by base slug", () => {
    const duplicateKobe: Player = { ...kobe, id: "kobe-duplicate", name: "Duplicate Kobe" };
    const result = evaluateRoll({
      roster: { SG: kobe },
      currentCandidates: [duplicateKobe, shaq],
      allPlayers: [duplicateKobe, shaq, guard, forward]
    });

    expect(result.recommendations.map((recommendation) => recommendation.player.baseSlug)).not.toContain("kobe");
    expect(result.recommendations[0].player.id).toBe("shaq");
  });

  it("searches ceiling assignments instead of greedily consuming flexible players", () => {
    const result = evaluateRoll({
      roster: {},
      currentCandidates: [starterWing],
      allPlayers: [starterWing, flexibleBig, solidGuard, replacementCenter]
    });

    expect(result.recommendations[0].ceilingRoster.PG?.id).toBe("solid-guard");
    expect(result.recommendations[0].ceilingRoster.C?.id).toBe("flex");
  });

  it("deduplicates ceiling candidates by base slug before applying the position cap", () => {
    const duplicateFlexibleBigs = Array.from({ length: 13 }, (_, index) => ({
      ...player(`Duplicate Flexible ${index}`, `cap-duplicate-${String(12 - index).padStart(2, "0")}`, "NYK", "1990s", ["PG", "C"], 28, 9, 7, 1, 1),
      baseSlug: "cap-duplicate"
    }));
    const capGuard = player("Cap Guard", "cap-guard", "NYK", "1990s", ["PG"], 20, 4, 8, 1, 0.2);
    const capCenter = player("Cap Center", "cap-center", "NYK", "1990s", ["C"], 1, 1, 0, 0, 0);
    const result = evaluateRoll({
      roster: {},
      currentCandidates: [starterWing],
      allPlayers: [starterWing, ...duplicateFlexibleBigs, capGuard, capCenter]
    });

    expect(result.recommendations[0].ceilingRoster.PG?.id).toBe("cap-guard");
    expect(result.recommendations[0].ceilingRoster.C?.id).toBe("cap-duplicate-00");
  });

  it("preserves ceiling assignments when later position candidates are already used", () => {
    const loneFlexible = player("Lone Flexible", "lone-flex", "NYK", "1990s", ["PG", "C"], 26, 9, 7, 1, 1);
    const result = evaluateRoll({
      roster: {},
      currentCandidates: [starterWing],
      allPlayers: [starterWing, loneFlexible]
    });

    expect([result.recommendations[0].ceilingRoster.PG?.id, result.recommendations[0].ceilingRoster.C?.id]).toContain("lone-flex");
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

  it("returns skip-team advice when team reroll has the best material advantage", () => {
    const advice = recommendSkip({
      bestDeltaExpectedWins: 4,
      bestDeltaCeilingWins: 2,
      teamRerollMedianDelta: 6,
      decadeRerollMedianDelta: 5,
      ceilingWins: 82
    });

    expect(advice.kind).toBe("skip-team");
  });

  it("returns skip-decade advice when decade reroll has a material advantage", () => {
    const advice = recommendSkip({
      bestDeltaExpectedWins: 4,
      bestDeltaCeilingWins: 2,
      teamRerollMedianDelta: 5,
      decadeRerollMedianDelta: 6,
      ceilingWins: 82
    });

    expect(advice.kind).toBe("skip-decade");
  });

  it("returns chase-only skip advice when expected value is fine but ceiling is capped", () => {
    const advice = recommendSkip({
      bestDeltaExpectedWins: 3,
      bestDeltaCeilingWins: 0,
      teamRerollMedianDelta: 3,
      decadeRerollMedianDelta: 3,
      ceilingWins: 80
    });

    expect(advice.kind).toBe("skip-only-if-chasing-82-0");
  });

  it("estimates stronger same-decade team reroll distributions", () => {
    const weakRoll = player("Weak Wing", "weak-wing", "MIN", "1990s", ["SF"], 2, 1, 1, 0, 0);
    const strongRoll = player("Elite Wing", "elite-wing", "LAL", "1990s", ["SF"], 35, 10, 8, 2, 1);

    const deltas = estimateRerollDeltas({
      roster: {},
      allPlayers: [weakRoll, strongRoll],
      currentTeam: "MIN",
      currentDecade: "1990s"
    });

    expect(deltas.teamRerollMedianDelta).toBeGreaterThan(1.5);
    expect(deltas.decadeRerollMedianDelta).toBe(0);
  });
});
