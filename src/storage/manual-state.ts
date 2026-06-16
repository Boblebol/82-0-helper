import type { DetectedGameState, GameState, ManualState } from "../domain/types";

const STORAGE_KEY = "82-0-assistant-manual-state";

export async function loadManualState(): Promise<ManualState> {
  if (!globalThis.chrome?.storage?.local) {
    return {};
  }
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return isManualState(result[STORAGE_KEY]) ? result[STORAGE_KEY] : {};
}

export async function saveManualState(state: ManualState): Promise<void> {
  if (!globalThis.chrome?.storage?.local) {
    return;
  }
  await chrome.storage.local.set({ [STORAGE_KEY]: state });
}

export async function clearManualState(): Promise<void> {
  if (!globalThis.chrome?.storage?.local) {
    return;
  }
  await chrome.storage.local.remove(STORAGE_KEY);
}

export function mergeManualState(detected: DetectedGameState, manual: ManualState): GameState {
  return {
    ...detected,
    mode: manual.mode ?? detected.mode,
    round: manual.round !== undefined ? manual.round : detected.round,
    team: manual.team !== undefined ? manual.team : detected.team,
    decade: manual.decade !== undefined ? manual.decade : detected.decade,
    roster: { ...detected.roster, ...(manual.roster ?? {}) },
    manual
  };
}

function isManualState(value: unknown): value is ManualState {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
