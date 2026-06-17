import { describe, expect, it, vi } from "vitest";
import type { GameState } from "../../src/domain/types";
import { renderSidebar } from "../../src/content/sidebar";

const state: GameState = {
  mode: "unknown",
  round: null,
  team: null,
  decade: null,
  visiblePlayers: [],
  roster: {},
  skipsUsed: { team: false, decade: false },
  confidence: "low",
  manual: {}
};

const seededState: GameState = {
  mode: "classic",
  round: 2,
  team: "LAL",
  decade: "2000s",
  visiblePlayers: [],
  roster: {},
  skipsUsed: { team: false, decade: false },
  confidence: "high",
  manual: {}
};

describe("manual edit UI", () => {
  it("initializes manual controls from the current state", () => {
    const root = document.createElement("div");

    renderSidebar(root, {
      state: seededState,
      recommendations: [],
      gaps: [],
      skipAdvice: { kind: "keep", reason: "Waiting for a detected team and decade." },
      error: null,
      onEdit: vi.fn(),
      onRetry: vi.fn(),
      onScanPage: vi.fn(),
      onResetManualState: vi.fn(),
      onManualSave: vi.fn()
    });

    root.querySelector<HTMLButtonElement>("[data-action='edit']")?.click();

    expect(root.textContent).toContain("Correction manuelle");
    expect(root.querySelector<HTMLInputElement>("input[name='team']")?.value).toBe("LAL");
    expect(root.querySelector<HTMLSelectElement>("select[name='decade']")?.value).toBe("2000s");
    expect(root.querySelector<HTMLInputElement>("input[name='round']")?.value).toBe("2");
    expect(root.querySelector<HTMLButtonElement>("[data-action='save-manual']")?.textContent).toContain("Enregistrer");
  });

  it("toggles manual controls when edit is clicked", () => {
    const root = document.createElement("div");
    const onEdit = vi.fn();

    renderSidebar(root, {
      state,
      recommendations: [],
      gaps: [],
      skipAdvice: { kind: "keep", reason: "Waiting for a detected team and decade." },
      error: null,
      onEdit,
      onRetry: vi.fn(),
      onScanPage: vi.fn(),
      onResetManualState: vi.fn(),
      onManualSave: vi.fn()
    });

    const editButton = root.querySelector<HTMLButtonElement>("[data-action='edit']");
    const shell = root.querySelector<HTMLElement>(".assistant-shell");
    const panel = root.querySelector<HTMLElement>("[data-assistant-edit-panel]");

    editButton?.click();

    expect(onEdit).toHaveBeenCalledOnce();
    expect(shell?.classList.contains("is-editing")).toBe(true);
    expect(panel?.hidden).toBe(false);
    expect(root.querySelector<HTMLInputElement>("input[name='team']")).not.toBeNull();

    editButton?.click();

    expect(shell?.classList.contains("is-editing")).toBe(false);
    expect(panel?.hidden).toBe(true);
  });

  it("saves normalized manual corrections", () => {
    const root = document.createElement("div");
    const onManualSave = vi.fn();

    renderSidebar(root, {
      state,
      recommendations: [],
      gaps: [],
      skipAdvice: { kind: "keep", reason: "Waiting for a detected team and decade." },
      error: null,
      onEdit: vi.fn(),
      onRetry: vi.fn(),
      onScanPage: vi.fn(),
      onResetManualState: vi.fn(),
      onManualSave
    });

    root.querySelector<HTMLButtonElement>("[data-action='edit']")?.click();

    const team = root.querySelector<HTMLInputElement>("input[name='team']");
    const decade = root.querySelector<HTMLSelectElement>("select[name='decade']");
    const round = root.querySelector<HTMLInputElement>("input[name='round']");

    if (!team || !decade || !round) {
      throw new Error("manual controls missing");
    }

    team.value = " lal ";
    decade.value = "2000s";
    round.value = "3";

    root.querySelector<HTMLButtonElement>("[data-action='save-manual']")?.click();

    expect(onManualSave).toHaveBeenCalledOnce();
    expect(onManualSave).toHaveBeenCalledWith({
      team: "LAL",
      decade: "2000s",
      round: 3
    });
  });

  it("blocks invalid manual rounds", () => {
    const root = document.createElement("div");
    const onManualSave = vi.fn();

    renderSidebar(root, {
      state: seededState,
      recommendations: [],
      gaps: [],
      skipAdvice: { kind: "keep", reason: "Waiting for a detected team and decade." },
      error: null,
      onEdit: vi.fn(),
      onRetry: vi.fn(),
      onScanPage: vi.fn(),
      onResetManualState: vi.fn(),
      onManualSave
    });

    root.querySelector<HTMLButtonElement>("[data-action='edit']")?.click();

    const round = root.querySelector<HTMLInputElement>("input[name='round']");
    if (!round) {
      throw new Error("round control missing");
    }

    round.value = "6";
    root.querySelector<HTMLButtonElement>("[data-action='save-manual']")?.click();

    expect(onManualSave).not.toHaveBeenCalled();
    expect(round.getAttribute("aria-invalid")).toBe("true");
  });

  it("blocks invalid manual decades", () => {
    const root = document.createElement("div");
    const onManualSave = vi.fn();

    renderSidebar(root, {
      state: seededState,
      recommendations: [],
      gaps: [],
      skipAdvice: { kind: "keep", reason: "Waiting for a detected team and decade." },
      error: null,
      onEdit: vi.fn(),
      onRetry: vi.fn(),
      onScanPage: vi.fn(),
      onResetManualState: vi.fn(),
      onManualSave
    });

    root.querySelector<HTMLButtonElement>("[data-action='edit']")?.click();

    const decade = root.querySelector<HTMLSelectElement>("select[name='decade']");
    if (!decade) {
      throw new Error("decade control missing");
    }

    const invalidOption = document.createElement("option");
    invalidOption.value = "1950s";
    invalidOption.textContent = "1950s";
    decade.appendChild(invalidOption);
    decade.value = "1950s";
    root.querySelector<HTMLButtonElement>("[data-action='save-manual']")?.click();

    expect(onManualSave).not.toHaveBeenCalled();
    expect(decade.getAttribute("aria-invalid")).toBe("true");
  });
});
