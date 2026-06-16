import { describe, expect, it, vi } from "vitest";
import { ACTIVE_DECADES, POSITIONS } from "../../src/domain/types";
import {
  getPlayersForRoll,
  loadPlayers,
  normalizePlayers,
  type PlayerIndex
} from "../../src/data/players";

const rawPlayers = [
  {
    team: "LAL",
    player: "Kobe Bryant",
    pos: "SG",
    positions: ["SG", "SF"],
    ppg: 30,
    rpg: 6.9,
    apg: 5.9,
    spg: 2.2,
    bpg: 0.8,
    id: "kobe_bryant_lal_2000s",
    baseSlug: "kobe_bryant",
    era: "2000s"
  },
  {
    team: "LAL",
    player: "George Mikan",
    pos: "C",
    positions: ["C"],
    ppg: 27,
    rpg: 14,
    apg: 2.8,
    spg: null,
    bpg: null,
    id: "george_mikan_lal_1950s",
    baseSlug: "george_mikan",
    era: "1950s"
  },
  {
    team: "BOS",
    player: "Larry Bird",
    pos: "SF",
    positions: ["SF", "PF"],
    ppg: 28.1,
    rpg: 9.2,
    apg: 7.6,
    spg: 1.8,
    bpg: 0.9,
    id: "larry_bird_bos_1980s",
    baseSlug: "larry_bird",
    era: "1980s"
  }
];

describe("player data", () => {
  it("exports the active decades and positions used by the live game", () => {
    expect(ACTIVE_DECADES).toEqual(["1960s", "1970s", "1980s", "1990s", "2000s", "2010s", "2020s"]);
    expect(POSITIONS).toEqual(["PG", "SG", "SF", "PF", "C"]);
  });

  it("normalizes valid active-era players and excludes 1950s records", () => {
    const index = normalizePlayers(rawPlayers);

    expect(index.players.map((player) => player.name)).toEqual(["Kobe Bryant", "Larry Bird"]);
    expect(getPlayersForRoll(index, "LAL", "2000s").map((player) => player.id)).toEqual([
      "kobe_bryant_lal_2000s"
    ]);
  });

  it("loads players from the site endpoint through fetch", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => rawPlayers
    })) as unknown as typeof fetch;

    const index: PlayerIndex = await loadPlayers(fetchImpl);

    expect(fetchImpl).toHaveBeenCalledWith("https://www.82-0.com/players_flat.json");
    expect(index.players).toHaveLength(2);
  });

  it("rejects malformed player endpoint payloads", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({ players: rawPlayers })
    })) as unknown as typeof fetch;

    await expect(loadPlayers(fetchImpl)).rejects.toThrow("Invalid players payload");
  });

  it("falls back to pos when positions is malformed", () => {
    const [player] = normalizePlayers([
      {
        team: "LAL",
        player: "Kobe Bryant",
        pos: "SG",
        positions: "SF",
        ppg: 30,
        rpg: 6.9,
        apg: 5.9,
        spg: 2.2,
        bpg: 0.8,
        id: "kobe_bryant_lal_2000s",
        baseSlug: "kobe_bryant",
        era: "2000s"
      }
    ]).players;

    expect(player?.primaryPosition).toBe("SG");
    expect(player?.positions).toEqual(["SG"]);
  });

  it("keeps the strongest duplicate name in the name index", () => {
    const index = normalizePlayers([
      {
        team: "BOS",
        player: "Alex Example",
        pos: "SG",
        positions: ["SG"],
        ppg: 20,
        rpg: 5,
        apg: 6,
        spg: 1,
        bpg: 0,
        id: "alex_example_bos_2000s",
        baseSlug: "alex_example",
        era: "2000s"
      },
      {
        team: "LAL",
        player: "Alex Example",
        pos: "PG",
        positions: ["PG"],
        ppg: 10,
        rpg: 3,
        apg: 4,
        spg: 1,
        bpg: 0,
        id: "alex_example_lal_1990s",
        baseSlug: "alex_example",
        era: "1990s"
      }
    ]);

    expect(index.byName.get("alex example")?.id).toBe("alex_example_bos_2000s");
  });

  it("prefers valid pos before secondary positions", () => {
    const [player] = normalizePlayers([
      {
        team: "LAL",
        player: "Kobe Bryant",
        pos: "SG",
        positions: ["SF", "SG"],
        ppg: 30,
        rpg: 6.9,
        apg: 5.9,
        spg: 2.2,
        bpg: 0.8,
        id: "kobe_bryant_lal_2000s",
        baseSlug: "kobe_bryant",
        era: "2000s"
      }
    ]).players;

    expect(player?.primaryPosition).toBe("SG");
    expect(player?.positions).toEqual(["SG", "SF"]);
  });
});
