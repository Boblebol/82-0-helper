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
  confidence: "low",
  manual: {}
};

describe("manual edit UI", () => {
  it("opens manual controls when edit is clicked", () => {
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
      onResetManualState: vi.fn(),
      onManualSave: vi.fn()
    });

    root.querySelector<HTMLButtonElement>("[data-action='edit']")?.click();

    expect(onEdit).toHaveBeenCalledOnce();
    expect(root.querySelector(".assistant-shell")?.classList.contains("is-editing")).toBe(true);
    expect(root.querySelector<HTMLInputElement>("input[name='team']")).not.toBeNull();
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
});
