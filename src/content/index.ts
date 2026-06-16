import { getPlayersForRoll, loadPlayers, type PlayerIndex } from "../data/players";
import type { Decade, GameState } from "../domain/types";
import { detectGameState } from "./detectors";
import { ensureSidebarHost, renderSidebar } from "./sidebar";
import { clearManualState, loadManualState, mergeManualState, saveManualState } from "../storage/manual-state";
import { estimateRerollDeltas, evaluateRoll, recommendSkip, type CandidateRecommendation, type RerollDeltas, type SkipAdvice } from "../scoring/projections";

export interface StartOptions {
  fetchPlayers?: () => Promise<PlayerIndex>;
  observeMutations?: boolean;
}

interface DebouncedCallback {
  trigger: () => void;
  cancel: () => void;
}

let activeObserver: MutationObserver | null = null;
let activeDebouncedCallback: DebouncedCallback | null = null;
let activeRunId = 0;

export async function startAssistant(options: StartOptions = {}): Promise<void> {
  const root = ensureSidebarHost();
  const runId = ++activeRunId;
  disposeActiveObserver();
  renderLoadingState(root);

  const fetchPlayers = options.fetchPlayers ?? loadPlayers;
  try {
    const index = await fetchPlayers();
    if (isStale(runId)) {
      return;
    }

    await renderWithState(ensureSidebarHost(), index, options, runId);
    if (isStale(runId)) {
      return;
    }

    if (options.observeMutations !== false && typeof MutationObserver !== "undefined") {
      const rerender = debounce(() => {
        if (!isStale(runId)) {
          void renderWithState(ensureSidebarHost(), index, options, runId);
        }
      }, 150);
      activeDebouncedCallback = rerender;
      activeObserver = new MutationObserver(rerender.trigger);
      activeObserver.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
      });
    }
  } catch (error) {
    if (isStale(runId)) {
      return;
    }
    console.error("[82 Assist] Failed to load players", error);
    await renderWithState(ensureSidebarHost(), emptyPlayerIndex(), options, runId, "players data unavailable");
  }
}

async function renderWithState(
  root: ShadowRoot,
  index: PlayerIndex,
  options: StartOptions,
  runId: number,
  error: string | null = null
): Promise<void> {
  const detected = detectGameState(document, index);
  const manual = await loadManualState();
  if (isStale(runId)) {
    return;
  }
  const state = mergeManualState(detected, manual);
  const effectiveState: GameState = error ? { ...state, confidence: "low" } : state;
  const currentCandidates =
    effectiveState.team && effectiveState.decade
      ? getPlayersForRoll(index, effectiveState.team, effectiveState.decade as Decade)
      : effectiveState.visiblePlayers;
  const evaluation = evaluateRoll({
    roster: effectiveState.roster,
    currentCandidates,
    allPlayers: index.players
  });
  const rerollDeltas = estimateRerollDeltas({
    roster: effectiveState.roster,
    allPlayers: index.players,
    currentTeam: effectiveState.confidence === "high" ? effectiveState.team : null,
    currentDecade: effectiveState.confidence === "high" ? effectiveState.decade : null
  });
  const skipAdvice = error
    ? fallbackSkipAdvice(error)
    : bestSkipAdvice(evaluation.recommendations[0], rerollDeltas, effectiveState);

  renderSidebar(root, {
    state: effectiveState,
    recommendations: error ? [] : evaluation.recommendations,
    gaps: error ? [] : evaluation.gaps,
    skipAdvice,
    error,
    onEdit: () => undefined,
    onRetry: () => {
      void startAssistant(options);
    },
    onScanPage: async () => {
      await clearManualState();
      if (!isStale(runId)) {
        await renderWithState(root, index, options, runId, error);
      }
    },
    onResetManualState: async () => {
      await clearManualState();
      if (!isStale(runId)) {
        await renderWithState(root, index, options, runId, error);
      }
    },
    onManualSave: async (manualPatch) => {
      if (isStale(runId)) {
        return;
      }

      await saveManualState({
        ...state.manual,
        team: manualPatch.team,
        decade: manualPatch.decade,
        round: manualPatch.round
      });

      if (!isStale(runId)) {
        await renderWithState(root, index, options, runId, error);
      }
    }
  });
}

function bestSkipAdvice(recommendation: CandidateRecommendation | undefined, rerollDeltas: RerollDeltas, state: GameState): SkipAdvice {
  if (!recommendation) {
    return {
      kind: "keep",
      reason: "Wait for more player data before deciding whether to skip."
    };
  }

  return recommendSkip({
    bestDeltaExpectedWins: recommendation.withPickWins - recommendation.currentWins,
    bestDeltaCeilingWins: recommendation.deltaCeilingWins,
    teamRerollMedianDelta: rerollDeltas.teamRerollMedianDelta,
    decadeRerollMedianDelta: rerollDeltas.decadeRerollMedianDelta,
    ceilingWins: recommendation.ceilingWins,
    canSkipTeam: !state.skipsUsed.team,
    canSkipDecade: !state.skipsUsed.decade
  });
}

function fallbackSkipAdvice(error: string): SkipAdvice {
  return {
    kind: "keep",
    reason: error
  };
}

function renderLoadingState(root: ShadowRoot): void {
  const detected = detectGameState(document, emptyPlayerIndex());
  const state: GameState = { ...detected, manual: {} };

  renderSidebar(root, {
    state,
    recommendations: [],
    gaps: [],
    skipAdvice: {
      kind: "keep",
      reason: "Waiting for player data before evaluating this roll."
    },
    loading: "Loading player data...",
    error: null,
    onEdit: () => undefined,
    onRetry: () => undefined,
    onScanPage: () => undefined,
    onResetManualState: () => undefined,
    onManualSave: () => undefined
  });
}

function emptyPlayerIndex(): PlayerIndex {
  return {
    players: [],
    byRoll: new Map(),
    byName: new Map()
  };
}

function disposeActiveObserver(): void {
  activeObserver?.disconnect();
  activeObserver = null;
  activeDebouncedCallback?.cancel();
  activeDebouncedCallback = null;
}

function debounce(callback: () => void, delayMs: number): DebouncedCallback {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return {
    trigger: () => {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }

      timeoutId = setTimeout(() => {
        timeoutId = null;
        callback();
      }, delayMs);
    },
    cancel: () => {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    }
  };
}

function isStale(runId: number): boolean {
  return runId !== activeRunId;
}

if (typeof document !== "undefined" && (import.meta as ImportMeta & { env?: { MODE?: string } }).env?.MODE !== "test") {
  void startAssistant();
}
