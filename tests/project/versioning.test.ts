import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type ReleaseEntry = {
  version: string;
  tag: string;
  date: string;
  title: string;
  summary: string;
  releaseUrl: string;
  downloadUrl?: string;
  changes: Record<string, string[]>;
};

describe("release versioning", () => {
  it("keeps release metadata in a single source file", () => {
    expect(existsSync("releases.json")).toBe(true);

    const data = JSON.parse(readFileSync("releases.json", "utf8")) as { releases: ReleaseEntry[] };
    const versions = data.releases.map((release) => release.version);

    expect(versions).toEqual(["0.2.0", "0.1.1", "0.1.0"]);
    expect(data.releases[0]).toMatchObject({
      version: "0.2.0",
      tag: "v0.2.0",
      date: "2026-06-17",
      title: "Landing page et versioning"
    });
    expect(data.releases[0].downloadUrl).toBe(
      "https://github.com/Boblebol/82-0-helper/releases/download/v0.2.0/82-0-helper-v0.2.0.zip"
    );
    expect(data.releases[0].changes.added).toContain(
      "Landing page Netlify avec téléchargement direct et guide d'installation."
    );
  });

  it("generates CHANGELOG.md from releases.json", () => {
    expect(existsSync("scripts/generate-changelog.mjs")).toBe(true);

    execFileSync(process.execPath, ["scripts/generate-changelog.mjs", "--check"], {
      stdio: "pipe"
    });

    const changelog = readFileSync("CHANGELOG.md", "utf8");
    expect(changelog).toContain("<!-- Generated from releases.json. Do not edit manually. -->");
    expect(changelog).toContain("## [0.2.0] - 2026-06-17");
    expect(changelog).toContain("### Added");
    expect(changelog).toContain("- Landing page Netlify avec téléchargement direct et guide d'installation.");
    expect(changelog).toContain("[0.2.0]: https://github.com/Boblebol/82-0-helper/releases/tag/v0.2.0");
  });
});
