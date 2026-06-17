import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("landing page", () => {
  it("declares a separate Netlify build for the landing app", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8"));

    expect(packageJson.scripts["dev:landing"]).toBe(
      "vite --config landing/vite.config.ts --host 127.0.0.1"
    );
    expect(packageJson.scripts["build:landing"]).toBe("vite build --config landing/vite.config.ts");
    expect(existsSync("landing/vite.config.ts")).toBe(true);

    const netlifyConfigExists = existsSync("netlify.toml");
    expect(netlifyConfigExists).toBe(true);

    const netlifyConfig = readFileSync("netlify.toml", "utf8");
    expect(netlifyConfig).toContain('command = "npm run build:landing"');
    expect(netlifyConfig).toContain('publish = "landing/dist"');
  });

  it("ships a product-first French landing page with 82-0 styling", () => {
    expect(existsSync("landing/index.html")).toBe(true);
    expect(existsSync("landing/src/styles.css")).toBe(true);

    const html = readFileSync("landing/index.html", "utf8");
    const css = readFileSync("landing/src/styles.css", "utf8");

    expect(html).toContain("82-0 Helper");
    expect(html).toContain("Télécharger l'extension");
    expect(html).toContain("Chrome, Edge et Brave");
    expect(html).toContain("Guide d'installation");
    expect(html).toContain("chrome://extensions");
    expect(html).toContain("Mode développeur");
    expect(html).toContain("Meilleur pick");
    expect(html).toContain("https://github.com/Boblebol/82-0-helper/releases/download/v0.1.1/82-0-classic-assistant-v0.1.1.zip");
    expect(html).toContain("https://github.com/Boblebol/82-0-helper/releases/latest");
    expect(css).toContain("--page: #f7f8fa");
    expect(css).toContain("--accent: #ff5a00");
    expect(css).toContain(".assistant-preview");
    expect(css).toContain("overflow-x: hidden");
    expect(css).toContain("minmax(0, 1fr)");
  });
});
