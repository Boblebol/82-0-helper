import { describe, expect, it, vi } from "vitest";
import type { CandidateRecommendation, SkipAdvice } from "../../src/scoring/projections";
import type { GameState, Player } from "../../src/domain/types";
import { renderSidebar } from "../../src/content/sidebar";

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

const recommendation: CandidateRecommendation = {
  player: kobe,
  position: "SG",
  currentWins: 50,
  withPickWins: 62,
  expectedWins: 78,
  ceilingWins: 82,
  deltaExpectedWins: 28,
  deltaCeilingWins: 32,
  expectedRoster: { SG: kobe },
  ceilingRoster: { SG: kobe }
};

const state: GameState = {
  mode: "classic",
  round: 3,
  team: "LAL",
  decade: "2000s",
  visiblePlayers: [kobe],
  roster: {},
  confidence: "high",
  manual: {}
};

const skipAdvice: SkipAdvice = { kind: "keep", reason: "The current roll is strong relative to reroll options." };

describe("sidebar", () => {
  it("renders recommendation, projections, skip advice, and roster edit controls", () => {
    const root = document.createElement("div");

    renderSidebar(root, {
      state,
      recommendations: [recommendation],
      gaps: ["AST", "STL", "BLK"],
      skipAdvice,
      error: null,
      onEdit: vi.fn(),
      onRetry: vi.fn(),
      onResetManualState: vi.fn()
    });

    expect(root.textContent).toContain("LAL 2000s");
    expect(root.textContent).toContain("Kobe Bryant");
    expect(root.textContent).toContain("Expected +28");
    expect(root.textContent).toContain("Ceiling +32");
    expect(root.textContent).toContain("Skip advice");
    expect(root.textContent).toContain("keep");
    expect(root.textContent).toContain("The current roll is strong relative to reroll options.");
    expect(root.textContent).toContain("AST");
    expect(root.querySelector("button[data-action='edit']")).not.toBeNull();
  });

  it("renders a retry state when player data is unavailable", () => {
    const root = document.createElement("div");

    renderSidebar(root, {
      state,
      recommendations: [],
      gaps: [],
      skipAdvice,
      error: "players data unavailable",
      onEdit: vi.fn(),
      onRetry: vi.fn(),
      onResetManualState: vi.fn()
    });

    expect(root.textContent).toContain("players data unavailable");
    expect(root.querySelector("button[data-action='retry']")).not.toBeNull();
  });

  it("invokes edit, retry, reset, and toggle callbacks", () => {
    const root = document.createElement("div");
    const onEdit = vi.fn();
    const onRetry = vi.fn();
    const onResetManualState = vi.fn();

    renderSidebar(root, {
      state,
      recommendations: [recommendation],
      gaps: [],
      skipAdvice,
      error: "players data unavailable",
      onEdit,
      onRetry,
      onResetManualState
    });

    root.querySelector<HTMLButtonElement>("button[data-action='edit']")?.click();
    root.querySelector<HTMLButtonElement>("button[data-action='retry']")?.click();
    root.querySelector<HTMLButtonElement>("button[data-action='reset-manual']")?.click();
    root.querySelector<HTMLButtonElement>("button[data-action='toggle']")?.click();

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onResetManualState).toHaveBeenCalledTimes(1);
    expect(root.querySelector(".assistant-shell")?.classList.contains("is-open")).toBe(true);
  });
});
