import { describe, expect, it } from "vitest";
import type { Player, Roster } from "../../src/domain/types";
import {
  adjustedDefensiveStats,
  calculateTeamResult,
  canPlayerPlayPosition,
  openPositions,
  projectedWins
} from "../../src/scoring/formula";

const kobe: Player = {
  id: "kobe",
  baseSlug: "kobe",
  name: "Kobe Bryant",
  team: "LAL",
  decade: "2000s",
  primaryPosition: "SG",
  positions: ["SG", "SF"],
  ppg: 30,
  rpg: 6.9,
  apg: 5.9,
  spg: 2.2,
  bpg: 0.8
};

const shaq: Player = {
  id: "shaq",
  baseSlug: "shaq",
  name: "Shaquille O'Neal",
  team: "LAL",
  decade: "2000s",
  primaryPosition: "C",
  positions: ["C"],
  ppg: 29.7,
  rpg: 13.6,
  apg: 3.8,
  spg: 0.5,
  bpg: 3
};

describe("classic scoring formula", () => {
  it("checks legal player positions", () => {
    expect(canPlayerPlayPosition(kobe, "SG")).toBe(true);
    expect(canPlayerPlayPosition(kobe, "PG")).toBe(false);
  });

  it("returns open positions from the roster", () => {
    const roster: Roster = { SG: kobe };
    expect(openPositions(roster)).toEqual(["PG", "SF", "PF", "C"]);
  });

  it("adjusts defensive stats to five-player roster scale", () => {
    expect(adjustedDefensiveStats([kobe, shaq])).toEqual({ adjustedSpg: 6.75, adjustedBpg: 9.5 });
  });

  it("projects wins with the nonlinear curve", () => {
    expect(projectedWins(0)).toBe(0);
    expect(projectedWins(110)).toBe(82);
  });

  it("calculates a deterministic record for a roster", () => {
    const result = calculateTeamResult({ SG: kobe, C: shaq });

    expect(result.teamRating).toBeGreaterThan(30);
    expect(result.wins).toBeGreaterThan(20);
    expect(result.losses).toBe(82 - result.wins);
  });
});
