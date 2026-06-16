import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { normalizePlayers } from "../../src/data/players";
import { detectGameState } from "../../src/content/detectors";

const index = normalizePlayers([
  { team: "LAL", player: "Kobe Bryant", pos: "SG", positions: ["SG", "SF"], ppg: 30, rpg: 6.9, apg: 5.9, spg: 2.2, bpg: 0.8, id: "kobe", baseSlug: "kobe", era: "2000s" },
  { team: "LAL", player: "Shaquille O'Neal", pos: "C", positions: ["C"], ppg: 29.7, rpg: 13.6, apg: 3.8, spg: 0.5, bpg: 3, id: "shaq", baseSlug: "shaq", era: "2000s" },
  { team: "LAL", player: "Magic Johnson", pos: "PG", positions: ["PG"], ppg: 23.9, rpg: 6.3, apg: 12.2, spg: 1.7, bpg: 0.4, id: "magic", baseSlug: "magic", era: "1980s" },
  { team: "SAS", player: "Tim Duncan", pos: "PF", positions: ["PF", "C"], ppg: 25.5, rpg: 12.7, apg: 3.7, spg: 0.7, bpg: 2.5, id: "duncan", baseSlug: "duncan", era: "2000s" }
]);

describe("DOM detectors", () => {
  it("detects Classic roll, visible players, round, and roster", () => {
    document.body.innerHTML = readFileSync("tests/fixtures/classic-draft.html", "utf8");

    const state = detectGameState(document, index);

    expect(state.mode).toBe("classic");
    expect(state.round).toBe(3);
    expect(state.team).toBe("LAL");
    expect(state.decade).toBe("2000s");
    expect(state.visiblePlayers.map((player) => player.name)).toEqual(["Kobe Bryant", "Shaquille O'Neal"]);
    expect(state.roster.PG?.name).toBe("Magic Johnson");
    expect(state.roster.PF?.name).toBe("Tim Duncan");
    expect(state.confidence).toBe("high");
  });

  it("returns low confidence when the current roll is missing", () => {
    document.body.innerHTML = readFileSync("tests/fixtures/incomplete-state.html", "utf8");

    const state = detectGameState(document, index);

    expect(state.team).toBeNull();
    expect(state.decade).toBeNull();
    expect(state.confidence).toBe("low");
  });
});
