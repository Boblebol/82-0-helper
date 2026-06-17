import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("sidebar theme", () => {
  it("uses a light 82-0-like theme with orange accents", () => {
    const css = readFileSync("src/styles/sidebar.css", "utf8");

    expect(css).toContain("--assistant-page: #f7f8fa");
    expect(css).toContain("--assistant-panel: #ffffff");
    expect(css).toContain("--assistant-accent: #ff5a00");
    expect(css).toContain("background: var(--assistant-panel)");
    expect(css).toContain("color: var(--assistant-text)");
  });

  it("keeps help hover content inside the card flow", () => {
    const css = readFileSync("src/styles/sidebar.css", "utf8");

    expect(css).not.toContain(".assistant-help::after");
    expect(css).toContain(".assistant-help-tooltip");
    expect(css).toContain("grid-column: 1 / -1");
    expect(css).toContain("max-width: 100%");
  });
});
