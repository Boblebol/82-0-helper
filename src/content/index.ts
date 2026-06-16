import { getPlayersForRoll, loadPlayers, type PlayerIndex } from "../data/players";
import type { Decade, GameState } from "../domain/types";
import { detectGameState } from "./detectors";
import { ensureSidebarHost, renderSidebar } from "./sidebar";
import { clearManualState, loadManualState, mergeManualState } from "../storage/manual-state";
import { evaluateRoll, recommendSkip, type CandidateRecommendation, type SkipAdvice } from "../scoring/projections";

export interface StartOptions {
  fetchPlayers?: () => Promise<PlayerIndex>;
  observeMutations?: boolean;
}

let activeObserver: MutationObserver | null = null;

export async function startAssistant(options: StartOptions = {}): Promise<void> {
  ensureSidebarHost();
  disposeActiveObserver();

  const fetchPlayers = options.fetchPlayers ?? loadPlayers;
  try {
    const index = await fetchPlayers();
    await renderWithState(ensureSidebarHost(), index, options);

    if (options.observeMutations !== false && typeof MutationObserver !== "undefined") {
      const rerender = debounce(() => {
        void renderWithState(ensureSidebarHost(), index, options);
      }, 150);
      activeObserver = new MutationObserver(rerender);
      activeObserver.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
      });
    }
  } catch (error) {
    console.error("[82 Assist] Failed to load players", error);
    await renderWithState(ensureSidebarHost(), emptyPlayerIndex(), options, "players data unavailable");
  }
}

async function renderWithState(
  root: ShadowRoot,
  index: PlayerIndex,
  options: StartOptions,
  error: string | null = null
): Promise<void> {
  const detected = detectGameState(document, index);
  const manual = await loadManualState();
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
  const skipAdvice = error
    ? fallbackSkipAdvice(error)
    : bestSkipAdvice(evaluation.recommendations[0]);

  renderSidebar(root, {
    state: effectiveState,
    recommendations: error ? [] : evaluation.recommendations,
    gaps: error ? [] : evaluation.gaps,
    skipAdvice,
    error,
    onEdit: () => window.alert("Manual edit controls will open in this sidebar."),
    onRetry: () => {
      void startAssistant(options);
    },
    onResetManualState: () => {
      void clearManualState();
    }
  });
}

function bestSkipAdvice(recommendation: CandidateRecommendation | undefined): SkipAdvice {
  if (!recommendation) {
    return {
      kind: "keep",
      reason: "Wait for more player data before deciding whether to skip."
    };
  }

  return recommendSkip({
    bestDeltaExpectedWins: recommendation.deltaExpectedWins,
    bestDeltaCeilingWins: recommendation.deltaCeilingWins,
    teamRerollMedianDelta: recommendation.deltaExpectedWins,
    decadeRerollMedianDelta: recommendation.deltaExpectedWins,
    ceilingWins: recommendation.ceilingWins
  });
}

function fallbackSkipAdvice(error: string): SkipAdvice {
  return {
    kind: "keep",
    reason: error
  };
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
}

function debounce(callback: () => void, delayMs: number): () => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      timeoutId = null;
      callback();
    }, delayMs);
  };
}

if (typeof document !== "undefined" && (import.meta as ImportMeta & { env?: { MODE?: string } }).env?.MODE !== "test") {
  void startAssistant();
}
