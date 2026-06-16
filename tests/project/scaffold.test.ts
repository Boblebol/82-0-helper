import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";

describe("extension scaffold", () => {
  it("declares a Manifest V3 content script for 82-0", () => {
    const manifest = JSON.parse(readFileSync("src/manifest.json", "utf8"));

    expect(manifest.manifest_version).toBe(3);
    expect(manifest.permissions).toEqual(["storage"]);
    expect(manifest.host_permissions).toEqual(["https://www.82-0.com/*"]);
    expect(manifest.content_scripts[0].matches).toEqual(["https://www.82-0.com/*"]);
    expect(manifest.content_scripts[0].js).toEqual(["content.js"]);
  });

  it("has the content script and sidebar stylesheet entry files", () => {
    expect(existsSync("src/content/index.ts")).toBe(true);
    expect(existsSync("src/styles/sidebar.css")).toBe(true);
  });
});
