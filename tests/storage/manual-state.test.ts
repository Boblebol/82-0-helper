import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DetectedGameState, ManualState } from "../../src/domain/types";
import {
  clearManualState,
  loadManualState,
  mergeManualState,
  saveManualState
} from "../../src/storage/manual-state";

const memory = new Map<string, unknown>();

beforeEach(() => {
  memory.clear();
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
});

describe("manual state", () => {
  it("saves and loads manual corrections", async () => {
    const state: ManualState = { team: "LAL", decade: "2000s", round: 3 };

    await saveManualState(state);

    expect(await loadManualState()).toEqual(state);
  });

  it("clears manual corrections", async () => {
    await saveManualState({ team: "BOS" });
    await clearManualState();

    expect(await loadManualState()).toEqual({});
  });

  it("merges manual values over detected state", () => {
    const detected: DetectedGameState = {
      mode: "classic",
      round: 2,
      team: "LAL",
      decade: "2000s",
      visiblePlayers: [],
      roster: {},
      confidence: "high"
    };

    expect(mergeManualState(detected, { team: "BOS", round: 4 })).toMatchObject({
      team: "BOS",
      round: 4,
      decade: "2000s",
      confidence: "high"
    });
  });

  it("lets explicit null manual values clear detected values", () => {
    const detected: DetectedGameState = {
      mode: "classic",
      round: 2,
      team: "LAL",
      decade: "2000s",
      visiblePlayers: [],
      roster: {},
      confidence: "high"
    };

    expect(mergeManualState(detected, { team: null, decade: null, round: null })).toMatchObject({
      team: null,
      decade: null,
      round: null
    });
  });
});
