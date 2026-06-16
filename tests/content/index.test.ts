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

beforeEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("content entrypoint", () => {
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
