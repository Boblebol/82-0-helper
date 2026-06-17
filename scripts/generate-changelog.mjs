#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from "node:fs";

const releaseDataPath = "releases.json";
const changelogPath = "CHANGELOG.md";

const sectionTitles = {
  added: "Added",
  changed: "Changed",
  fixed: "Fixed",
  removed: "Removed",
  security: "Security"
};

function readReleaseData() {
  return JSON.parse(readFileSync(releaseDataPath, "utf8"));
}

function renderChangeSections(changes) {
  return Object.entries(sectionTitles)
    .flatMap(([key, title]) => {
      const items = changes[key] ?? [];
      if (!items.length) {
        return [];
      }

      return [`### ${title}`, "", ...items.map((item) => `- ${item}`), ""];
    })
    .join("\n");
}

function renderLinks(releases) {
  return releases
    .map((release) => `[${release.version}]: ${release.releaseUrl}`)
    .join("\n");
}

export function buildChangelog(data) {
  const releases = data.releases ?? [];
  const body = releases
    .map((release) =>
      [
        `## [${release.version}] - ${release.date}`,
        "",
        `### ${release.title}`,
        "",
        release.summary,
        "",
        renderChangeSections(release.changes ?? {}).trim()
      ]
        .join("\n")
    )
    .join("\n\n");

  return [
    "# Changelog",
    "",
    "<!-- Generated from releases.json. Do not edit manually. -->",
    "",
    "All notable changes to this project are documented here.",
    "",
    body,
    "",
    renderLinks(releases),
    ""
  ].join("\n");
}

const data = readReleaseData();
const generated = buildChangelog(data);

if (process.argv.includes("--check")) {
  const current = existsSync(changelogPath) ? readFileSync(changelogPath, "utf8") : "";
  if (current !== generated) {
    process.stderr.write("CHANGELOG.md is out of sync with releases.json\n");
    process.exit(1);
  }
  process.exit(0);
}

writeFileSync(changelogPath, generated);
