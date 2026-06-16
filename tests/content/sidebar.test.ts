import { describe, expect, it, vi } from "vitest";
import type { CandidateRecommendation, SkipAdvice } from "../../src/scoring/projections";
import type { GameState, Player } from "../../src/domain/types";
import { ensureSidebarHost, renderSidebar } from "../../src/content/sidebar";

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
  skipsUsed: { team: false, decade: false },
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
      onScanPage: vi.fn(),
      onResetManualState: vi.fn(),
      onManualSave: vi.fn()
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
      onScanPage: vi.fn(),
      onResetManualState: vi.fn(),
      onManualSave: vi.fn()
    });

    expect(root.textContent).toContain("players data unavailable");
    expect(root.querySelector("button[data-action='retry']")).not.toBeNull();
  });

  it("invokes edit, retry, scan, reset, and toggle callbacks", () => {
    const root = document.createElement("div");
    const onEdit = vi.fn();
    const onRetry = vi.fn();
    const onScanPage = vi.fn();
    const onResetManualState = vi.fn();

    renderSidebar(root, {
      state,
      recommendations: [recommendation],
      gaps: [],
      skipAdvice,
      error: "players data unavailable",
      onEdit,
      onRetry,
      onScanPage,
      onResetManualState,
      onManualSave: vi.fn()
    });

    root.querySelector<HTMLButtonElement>("button[data-action='edit']")?.click();
    root.querySelector<HTMLButtonElement>("button[data-action='retry']")?.click();
    root.querySelector<HTMLButtonElement>("button[data-action='scan-page']")?.click();
    root.querySelector<HTMLButtonElement>("button[data-action='reset-manual']")?.click();
    root.querySelector<HTMLButtonElement>("button[data-action='toggle']")?.click();

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onScanPage).toHaveBeenCalledTimes(1);
    expect(onResetManualState).toHaveBeenCalledTimes(1);
    expect(root.querySelector(".assistant-shell")?.classList.contains("is-open")).toBe(true);
  });

  it("tracks mobile toggle aria state", () => {
    const root = document.createElement("div");

    renderSidebar(root, {
      state,
      recommendations: [recommendation],
      gaps: [],
      skipAdvice,
      error: null,
      onEdit: vi.fn(),
      onRetry: vi.fn(),
      onScanPage: vi.fn(),
      onResetManualState: vi.fn(),
      onManualSave: vi.fn()
    });

    const toggle = root.querySelector<HTMLButtonElement>("button[data-action='toggle']");

    expect(toggle?.getAttribute("aria-expanded")).toBe("false");

    toggle?.click();

    expect(toggle?.getAttribute("aria-expanded")).toBe("true");
    expect(root.querySelector(".assistant-shell")?.classList.contains("is-open")).toBe(true);
  });

  it("preserves the open mobile drawer across rerenders", () => {
    const root = document.createElement("div");

    renderSidebar(root, {
      state,
      recommendations: [recommendation],
      gaps: [],
      skipAdvice,
      error: null,
      onEdit: vi.fn(),
      onRetry: vi.fn(),
      onScanPage: vi.fn(),
      onResetManualState: vi.fn(),
      onManualSave: vi.fn()
    });

    root.querySelector<HTMLButtonElement>("button[data-action='toggle']")?.click();

    renderSidebar(root, {
      state,
      recommendations: [recommendation],
      gaps: [],
      skipAdvice,
      error: null,
      onEdit: vi.fn(),
      onRetry: vi.fn(),
      onScanPage: vi.fn(),
      onResetManualState: vi.fn(),
      onManualSave: vi.fn()
    });

    expect(root.querySelector(".assistant-shell")?.classList.contains("is-open")).toBe(true);
    expect(root.querySelector<HTMLButtonElement>("button[data-action='toggle']")?.getAttribute("aria-expanded")).toBe("true");
  });

  it("escapes player and error text before rendering", () => {
    const root = document.createElement("div");
    const dangerousPlayer: Player = {
      ...kobe,
      name: '<img src=x onerror=alert(1)>'
    };

    renderSidebar(root, {
      state: { ...state, visiblePlayers: [dangerousPlayer] },
      recommendations: [{
        ...recommendation,
        player: dangerousPlayer
      }],
      gaps: [],
      skipAdvice,
      error: '<img src=x onerror=alert(1)>',
      onEdit: vi.fn(),
      onRetry: vi.fn(),
      onScanPage: vi.fn(),
      onResetManualState: vi.fn(),
      onManualSave: vi.fn()
    });

    expect(root.querySelector("img")).toBeNull();
    expect(root.textContent).toContain("<img src=x onerror=alert(1)>");
  });

  it("reuses the sidebar host and injects styles once", () => {
    const first = ensureSidebarHost();
    const second = ensureSidebarHost();

    expect(first).toBe(second);
    expect(document.querySelectorAll("#assistant-82-0-host")).toHaveLength(1);
    expect(first.querySelectorAll("style#assistant-82-0-sidebar-style")).toHaveLength(1);
  });
});
