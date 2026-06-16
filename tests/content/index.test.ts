import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startAssistant } from "../../src/content/index";
import type { PlayerIndex } from "../../src/data/players";
import type { Player } from "../../src/domain/types";

const kobe: Player = {
  id: "kobe",
  baseSlug: "kobe",
  name: "Kobe Bryant",
  team: "LAL",
  decade: "2000s",
  primaryPosition: "SG",
  positions: ["SG"],
  ppg: 30,
  rpg: 6.9,
  apg: 5.9,
  spg: 2.2,
  bpg: 0.8
};

const bird: Player = {
  id: "bird",
  baseSlug: "bird",
  name: "Larry Bird",
  team: "BOS",
  decade: "1990s",
  primaryPosition: "SF",
  positions: ["SF"],
  ppg: 24,
  rpg: 10,
  apg: 6,
  spg: 1.7,
  bpg: 0.8
};

const weakWing: Player = {
  id: "weak-wing",
  baseSlug: "weak-wing",
  name: "Weak Wing",
  team: "MIN",
  decade: "1990s",
  primaryPosition: "SF",
  positions: ["SF"],
  ppg: 2,
  rpg: 1,
  apg: 1,
  spg: 0,
  bpg: 0
};

const eliteWing: Player = {
  id: "elite-wing",
  baseSlug: "elite-wing",
  name: "Elite Wing",
  team: "LAL",
  decade: "1990s",
  primaryPosition: "SF",
  positions: ["SF"],
  ppg: 35,
  rpg: 10,
  apg: 8,
  spg: 2,
  bpg: 1
};

beforeEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("content entrypoint", () => {
  it("renders a loading state while player data is still fetching", async () => {
    let resolveFetch!: (value: PlayerIndex) => void;
    const fetchPlayers = vi.fn(
      async () =>
        new Promise<PlayerIndex>((resolve) => {
          resolveFetch = resolve;
        })
    );

    const start = startAssistant({
      fetchPlayers,
      observeMutations: false
    });

    const host = document.getElementById("assistant-82-0-host");
    expect(fetchPlayers).toHaveBeenCalledTimes(1);
    expect(host?.shadowRoot?.textContent).toContain("Loading player data");

    resolveFetch({
      players: [kobe],
      byRoll: new Map([["LAL::2000s", [kobe]]]),
      byName: new Map()
    });
    await start;
  });

  it("mounts the assistant host and renders after player data loads", async () => {
    document.body.innerHTML = `
      <main>
        <p>Classic</p>
        <p>Round 1</p>
        <h2>LAL 2000s</h2>
        <button>Kobe Bryant 30.0 PPG</button>
      </main>
    `;

    await startAssistant({
      fetchPlayers: async () => ({
        players: [kobe],
        byRoll: new Map([
          ["LAL::2000s", [kobe]]
        ]),
        byName: new Map()
      }),
      observeMutations: false
    });

    const host = document.getElementById("assistant-82-0-host");
    expect(host?.shadowRoot?.textContent).toContain("Kobe Bryant");
  });

  it("renders retry state when data loading fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    await startAssistant({
      fetchPlayers: async () => {
        throw new Error("network down");
      },
      observeMutations: false
    });

    const host = document.getElementById("assistant-82-0-host");
    expect(host?.shadowRoot?.textContent).toContain("players data unavailable");
  });

  it("keeps the latest overlapping start render and ignores stale observer callbacks", async () => {
    document.body.innerHTML = `
      <main>
        <p>Classic</p>
        <p>Round 1</p>
        <button>Kobe Bryant 30.0 PPG</button>
        <button>Larry Bird 24.0 PPG</button>
      </main>
    `;

    let firstResolve!: (value: PlayerIndex) => void;
    const firstIndex: PlayerIndex = {
      players: [kobe],
      byRoll: new Map([["LAL::2000s", [kobe]]]),
      byName: new Map()
    };
    const firstFetch = new Promise<PlayerIndex>((resolve) => {
      firstResolve = resolve;
    });

    const firstStart = startAssistant({
      fetchPlayers: async () => firstFetch,
      observeMutations: false
    });

    await startAssistant({
      fetchPlayers: async () => ({
        players: [bird],
        byRoll: new Map([["LAL::2000s", [bird]], ["BOS::1990s", [bird]]]),
        byName: new Map()
      }),
      observeMutations: false
    });

    expect(document.getElementById("assistant-82-0-host")?.shadowRoot?.textContent).toContain("Larry Bird");

    firstResolve(firstIndex);
    await firstStart;

    expect(document.getElementById("assistant-82-0-host")?.shadowRoot?.textContent).toContain("Larry Bird");
  });

  it("rerenders from detected state after manual reset without refetching players", async () => {
    const memory = new Map<string, unknown>();
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: vi.fn(async (key: string) => ({ [key]: memory.get(key) })),
          set: vi.fn(async (value: Record<string, unknown>) => {
            for (const [key, stored] of Object.entries(value)) memory.set(key, stored);
          }),
          remove: vi.fn(async (key: string) => {
            memory.delete(key);
          })
        }
      }
    });

    const fetchPlayers = vi.fn(async () => ({
      players: [kobe, bird],
      byRoll: new Map([
        ["LAL::2000s", [kobe]],
        ["BOS::1990s", [bird]]
      ]),
      byName: new Map()
    }));

    await chrome.storage.local.set({
      "82-0-assistant-manual-state": {
        team: "BOS",
        decade: "1990s"
      }
    });

    document.body.innerHTML = `
      <main>
        <p>Classic</p>
        <p>Round 1</p>
        <h2>LAL 2000s</h2>
        <button>Kobe Bryant 30.0 PPG</button>
      </main>
    `;

    await startAssistant({
      fetchPlayers,
      observeMutations: false
    });

    const host = document.getElementById("assistant-82-0-host");
    expect(host?.shadowRoot?.textContent).toContain("Larry Bird");
    expect(fetchPlayers).toHaveBeenCalledTimes(1);

    host?.shadowRoot?.querySelector<HTMLButtonElement>("button[data-action='reset-manual']")?.click();
    for (let index = 0; index < 5; index++) {
      await Promise.resolve();
    }

    expect(fetchPlayers).toHaveBeenCalledTimes(1);
    expect(host?.shadowRoot?.textContent).toContain("Kobe Bryant");
  });

  it("scans the current page, clears manual corrections, and rerenders without refetching players", async () => {
    const memory = new Map<string, unknown>();
    const remove = vi.fn(async (key: string) => {
      memory.delete(key);
    });
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: vi.fn(async (key: string) => ({ [key]: memory.get(key) })),
          set: vi.fn(async (value: Record<string, unknown>) => {
            for (const [key, stored] of Object.entries(value)) memory.set(key, stored);
          }),
          remove
        }
      }
    });

    const fetchPlayers = vi.fn(async () => ({
      players: [kobe, bird],
      byRoll: new Map([
        ["LAL::2000s", [kobe]],
        ["BOS::1990s", [bird]]
      ]),
      byName: new Map()
    }));

    await chrome.storage.local.set({
      "82-0-assistant-manual-state": {
        team: "BOS",
        decade: "1990s"
      }
    });

    document.body.innerHTML = `
      <main>
        <p>Classic</p>
        <p>Round 1</p>
        <h2>LAL 2000s</h2>
        <button>Kobe Bryant 30.0 PPG</button>
      </main>
    `;

    await startAssistant({
      fetchPlayers,
      observeMutations: false
    });

    const host = document.getElementById("assistant-82-0-host");
    expect(host?.shadowRoot?.textContent).toContain("BOS 1990s");
    expect(host?.shadowRoot?.textContent).toContain("Larry Bird");

    host?.shadowRoot?.querySelector<HTMLButtonElement>("button[data-action='scan-page']")?.click();
    for (let index = 0; index < 5; index++) {
      await Promise.resolve();
    }

    expect(remove).toHaveBeenCalledWith("82-0-assistant-manual-state");
    expect(fetchPlayers).toHaveBeenCalledTimes(1);
    expect(host?.shadowRoot?.textContent).toContain("LAL 2000s");
    expect(host?.shadowRoot?.textContent).toContain("Kobe Bryant");
  });

  it("renders skip-team advice when team reroll distribution is materially stronger", async () => {
    document.body.innerHTML = `
      <main>
        <p>Classic</p>
        <p>Round 1/5</p>
        <h2>MIN 1990s</h2>
        <button>Weak Wing 2.0 PPG 1.0 RPG 1.0 APG</button>
      </main>
    `;

    await startAssistant({
      fetchPlayers: async () => ({
        players: [weakWing, eliteWing],
        byRoll: new Map([
          ["MIN::1990s", [weakWing]],
          ["LAL::1990s", [eliteWing]]
        ]),
        byName: new Map()
      }),
      observeMutations: false
    });

    const host = document.getElementById("assistant-82-0-host");
    expect(host?.shadowRoot?.textContent).toContain("skip team");
  });

  it("does not render skip-team advice when the team reroll is already consumed", async () => {
    document.body.innerHTML = `
      <main>
        <p>Classic</p>
        <p>Round 1/5</p>
        <h2>MIN 1990s</h2>
        <button disabled>Team</button>
        <button>Era</button>
        <button>Weak Wing 2.0 PPG 1.0 RPG 1.0 APG</button>
      </main>
    `;

    await startAssistant({
      fetchPlayers: async () => ({
        players: [weakWing, eliteWing],
        byRoll: new Map([
          ["MIN::1990s", [weakWing]],
          ["LAL::1990s", [eliteWing]]
        ]),
        byName: new Map()
      }),
      observeMutations: false
    });

    const host = document.getElementById("assistant-82-0-host");
    expect(host?.shadowRoot?.textContent).not.toContain("skip team");
    expect(host?.shadowRoot?.textContent).toContain("keep");
  });

  it("renders better-pick reroll odds for available rerolls only", async () => {
    document.body.innerHTML = `
      <main>
        <p>Classic</p>
        <p>Round 1/5</p>
        <h2>MIN 1990s</h2>
        <button>Team</button>
        <button disabled>Era</button>
        <button>Weak Wing 2.0 PPG 1.0 RPG 1.0 APG</button>
      </main>
    `;

    await startAssistant({
      fetchPlayers: async () => ({
        players: [weakWing, eliteWing],
        byRoll: new Map([
          ["MIN::1990s", [weakWing]],
          ["LAL::1990s", [eliteWing]]
        ]),
        byName: new Map()
      }),
      observeMutations: false
    });

    const host = document.getElementById("assistant-82-0-host");
    expect(host?.shadowRoot?.textContent).toContain("Team reroll");
    expect(host?.shadowRoot?.textContent).toContain("100% better than Weak Wing");
    expect(host?.shadowRoot?.textContent).toContain("1/1 rolls");
    expect(host?.shadowRoot?.textContent).toContain("Era reroll");
    expect(host?.shadowRoot?.textContent).toContain("used");
  });

  it("saves partial manual corrections without clearing detected state", async () => {
    const memory = new Map<string, unknown>();
    const set = vi.fn(async (value: Record<string, unknown>) => {
      for (const [key, stored] of Object.entries(value)) memory.set(key, stored);
    });
    const get = vi.fn(async (key: string) => ({ [key]: memory.get(key) }));
    const remove = vi.fn(async (key: string) => {
      memory.delete(key);
    });

    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get,
          set,
          remove
        }
      }
    });

    const fetchPlayers = vi.fn(async () => ({
      players: [kobe],
      byRoll: new Map([
        ["LAL::2000s", [kobe]]
      ]),
      byName: new Map()
    }));

    document.body.innerHTML = `
      <main>
        <p>Classic</p>
        <p>Round 1</p>
        <h2>LAL 2000s</h2>
        <button>Kobe Bryant 30.0 PPG</button>
      </main>
    `;

    await startAssistant({
      fetchPlayers,
      observeMutations: false
    });

    const host = document.getElementById("assistant-82-0-host");
    const shadow = host?.shadowRoot;

    shadow?.querySelector<HTMLButtonElement>("button[data-action='edit']")?.click();

    const team = shadow?.querySelector<HTMLInputElement>("input[name='team']");
    const decade = shadow?.querySelector<HTMLSelectElement>("select[name='decade']");
    const round = shadow?.querySelector<HTMLInputElement>("input[name='round']");

    if (!team || !decade || !round) {
      throw new Error("manual controls missing");
    }

    round.value = "4";

    shadow?.querySelector<HTMLButtonElement>("button[data-action='save-manual']")?.click();

    for (let index = 0; index < 5; index++) {
      await Promise.resolve();
    }

    expect(set).toHaveBeenCalled();
    expect(memory.get("82-0-assistant-manual-state")).toEqual({
      team: "LAL",
      decade: "2000s",
      round: 4
    });
    expect(fetchPlayers).toHaveBeenCalledTimes(1);
    expect(host?.shadowRoot?.textContent).toContain("Round 4");
  });

  it("cancels a stale debounced mutation rerender when a newer start begins", async () => {
    vi.useFakeTimers();

    const observers: Array<{ trigger: () => void; disconnect: () => void }> = [];
    class FakeMutationObserver {
      constructor(private readonly callback: () => void) {
        observers.push({ trigger: callback, disconnect: vi.fn() });
      }

      observe(): void {}

      disconnect(): void {}
    }

    vi.stubGlobal("MutationObserver", FakeMutationObserver);

    document.body.innerHTML = `
      <main>
        <p>Classic</p>
        <p>Round 1</p>
        <button>Kobe Bryant 30.0 PPG</button>
        <button>Larry Bird 24.0 PPG</button>
      </main>
    `;

    await startAssistant({
      fetchPlayers: async () => ({
        players: [kobe],
        byRoll: new Map([["LAL::2000s", [kobe]]]),
        byName: new Map()
      }),
      observeMutations: true
    });

    expect(document.getElementById("assistant-82-0-host")?.shadowRoot?.textContent).toContain("Kobe Bryant");

    observers[0]?.trigger();
    await Promise.resolve();

    await startAssistant({
      fetchPlayers: async () => ({
        players: [bird],
        byRoll: new Map([["LAL::2000s", [bird]], ["BOS::1990s", [bird]]]),
        byName: new Map()
      }),
      observeMutations: false
    });

    await vi.advanceTimersByTimeAsync(200);

    expect(document.getElementById("assistant-82-0-host")?.shadowRoot?.textContent).toContain("Larry Bird");
  });
});
