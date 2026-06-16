# 82-0 Classic Assistant Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Chromium Manifest V3 extension that injects a right-side Classic-mode draft assistant on `82-0.com`.

**Architecture:** A vanilla TypeScript content script loads the public player dataset, detects the visible game state, merges manual corrections, computes recommendations locally, and renders an isolated sidebar. The extension has no backend, no analytics, and never clicks or automates gameplay.

**Tech Stack:** TypeScript, Vite, Vitest, jsdom, Manifest V3, Chrome `storage` API.

---

## File Map

- Create `package.json`: npm scripts and dev dependencies.
- Create `tsconfig.json`: strict TypeScript settings for browser and test code.
- Create `vite.config.ts`: extension bundle build and manifest copy.
- Create `vitest.config.ts`: jsdom/unit test configuration.
- Create `src/vite-env.d.ts`: CSS inline import typing.
- Create `src/manifest.json`: Manifest V3 extension definition.
- Create `src/domain/types.ts`: shared player, roster, detection, and recommendation types.
- Create `src/data/players.ts`: fetch, cache, normalize, and query player data.
- Create `src/scoring/formula.ts`: Classic scoring formula and position helpers.
- Create `src/scoring/projections.ts`: candidate ranking, expected/ceiling projections, gaps, and skip advice.
- Create `src/storage/manual-state.ts`: `chrome.storage.local` wrapper and state merge.
- Create `src/content/detectors.ts`: DOM detectors for roll, mode, round, visible players, and roster.
- Create `src/content/sidebar.ts`: DOM rendering, edit events, drawer behavior, and style injection.
- Create `src/content/index.ts`: content script lifecycle, observers, data loading, and recalculation.
- Create `src/styles/sidebar.css`: isolated sidebar and drawer styles.
- Create `tests/fixtures/classic-draft.html`: representative Classic draft DOM.
- Create `tests/fixtures/incomplete-state.html`: DOM with missing roll and roster.
- Create test files under `tests/**/*.test.ts`.

## Task 1: Project Scaffold And Build Harness

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `src/vite-env.d.ts`
- Create: `src/manifest.json`
- Create: `src/content/index.ts`
- Create: `src/styles/sidebar.css`
- Test: `tests/project/scaffold.test.ts`

- [ ] **Step 1: Create the scaffold test**

Create `tests/project/scaffold.test.ts`:

```ts
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
```

- [ ] **Step 2: Create npm and TypeScript config**

Create `package.json`:

```json
{
  "name": "82-0-classic-assistant",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@types/chrome": "^0.0.277",
    "@types/node": "^22.10.2",
    "jsdom": "^25.0.1",
    "typescript": "^5.7.2",
    "vite": "^6.0.3",
    "vitest": "^2.1.8"
  }
}
```

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "types": ["chrome", "vitest/globals"]
  },
  "include": ["src", "tests", "vite.config.ts", "vitest.config.ts"]
}
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.ts"],
    restoreMocks: true
  }
});
```

Create `src/vite-env.d.ts`:

```ts
declare module "*.css?inline" {
  const css: string;
  export default css;
}
```

- [ ] **Step 3: Create Vite extension build config**

Create `vite.config.ts`:

```ts
import { copyFileSync, mkdirSync } from "node:fs";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: "src/content/index.ts",
      output: {
        entryFileNames: "content.js",
        format: "iife"
      }
    }
  },
  plugins: [
    {
      name: "copy-extension-manifest",
      closeBundle() {
        mkdirSync("dist", { recursive: true });
        copyFileSync("src/manifest.json", "dist/manifest.json");
      }
    }
  ]
});
```

- [ ] **Step 4: Create Manifest V3 and empty entry files**

Create `src/manifest.json`:

```json
{
  "manifest_version": 3,
  "name": "82-0 Classic Assistant",
  "version": "0.1.0",
  "description": "Classic-mode draft advice for 82-0.com.",
  "permissions": ["storage"],
  "host_permissions": ["https://www.82-0.com/*"],
  "content_scripts": [
    {
      "matches": ["https://www.82-0.com/*"],
      "js": ["content.js"],
      "run_at": "document_idle"
    }
  ]
}
```

Create `src/content/index.ts`:

```ts
export {};
```

Create `src/styles/sidebar.css`:

```css
:host {
  all: initial;
}
```

- [ ] **Step 5: Install dependencies**

Run:

```bash
npm install
```

Expected: `package-lock.json` is created and npm exits with code `0`.

- [ ] **Step 6: Run scaffold test, typecheck, and build**

Run:

```bash
npm test -- tests/project/scaffold.test.ts
npm run typecheck
npm run build
```

Expected:

- Vitest reports `2 passed`.
- TypeScript exits with no errors.
- `dist/manifest.json` and `dist/content.js` exist.

- [ ] **Step 7: Commit scaffold**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts vitest.config.ts src tests
git commit -m "chore: scaffold chromium extension"
```

## Task 2: Shared Types And Player Data Module

**Files:**
- Create: `src/domain/types.ts`
- Create: `src/data/players.ts`
- Test: `tests/data/players.test.ts`

- [ ] **Step 1: Write player data tests**

Create `tests/data/players.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { ACTIVE_DECADES, POSITIONS } from "../../src/domain/types";
import {
  getPlayersForRoll,
  loadPlayers,
  normalizePlayers,
  type PlayerIndex
} from "../../src/data/players";

const rawPlayers = [
  {
    team: "LAL",
    player: "Kobe Bryant",
    pos: "SG",
    positions: ["SG", "SF"],
    ppg: 30,
    rpg: 6.9,
    apg: 5.9,
    spg: 2.2,
    bpg: 0.8,
    id: "kobe_bryant_lal_2000s",
    baseSlug: "kobe_bryant",
    era: "2000s"
  },
  {
    team: "LAL",
    player: "George Mikan",
    pos: "C",
    positions: ["C"],
    ppg: 27,
    rpg: 14,
    apg: 2.8,
    spg: null,
    bpg: null,
    id: "george_mikan_lal_1950s",
    baseSlug: "george_mikan",
    era: "1950s"
  },
  {
    team: "BOS",
    player: "Larry Bird",
    pos: "SF",
    positions: ["SF", "PF"],
    ppg: 28.1,
    rpg: 9.2,
    apg: 7.6,
    spg: 1.8,
    bpg: 0.9,
    id: "larry_bird_bos_1980s",
    baseSlug: "larry_bird",
    era: "1980s"
  }
];

describe("player data", () => {
  it("exports the active decades and positions used by the live game", () => {
    expect(ACTIVE_DECADES).toEqual(["1960s", "1970s", "1980s", "1990s", "2000s", "2010s", "2020s"]);
    expect(POSITIONS).toEqual(["PG", "SG", "SF", "PF", "C"]);
  });

  it("normalizes valid active-era players and excludes 1950s records", () => {
    const index = normalizePlayers(rawPlayers);

    expect(index.players.map((player) => player.name)).toEqual(["Kobe Bryant", "Larry Bird"]);
    expect(getPlayersForRoll(index, "LAL", "2000s").map((player) => player.id)).toEqual([
      "kobe_bryant_lal_2000s"
    ]);
  });

  it("loads players from the site endpoint through fetch", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => rawPlayers
      }))
    );

    const index: PlayerIndex = await loadPlayers();

    expect(fetch).toHaveBeenCalledWith("https://www.82-0.com/players_flat.json");
    expect(index.players).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- tests/data/players.test.ts
```

Expected: FAIL because `src/domain/types.ts` and `src/data/players.ts` do not exist.

- [ ] **Step 3: Implement shared types**

Create `src/domain/types.ts`:

```ts
export const ACTIVE_DECADES = ["1960s", "1970s", "1980s", "1990s", "2000s", "2010s", "2020s"] as const;
export type Decade = (typeof ACTIVE_DECADES)[number];

export const POSITIONS = ["PG", "SG", "SF", "PF", "C"] as const;
export type Position = (typeof POSITIONS)[number];

export type TeamAbbreviation = string;

export interface RawPlayer {
  team: string;
  player: string;
  pos: string;
  positions?: Array<string | null>;
  ppg: number | null;
  rpg: number | null;
  apg: number | null;
  spg: number | null;
  bpg: number | null;
  id: string;
  baseSlug: string;
  era: string;
}

export interface Player {
  id: string;
  baseSlug: string;
  name: string;
  team: TeamAbbreviation;
  decade: Decade;
  primaryPosition: Position;
  positions: Position[];
  ppg: number;
  rpg: number;
  apg: number;
  spg: number | null;
  bpg: number | null;
}

export type Roster = Partial<Record<Position, Player>>;

export interface DetectedGameState {
  mode: "classic" | "hoopiq" | "unknown";
  round: number | null;
  team: TeamAbbreviation | null;
  decade: Decade | null;
  visiblePlayers: Player[];
  roster: Roster;
  confidence: "high" | "low";
}

export interface ManualState {
  mode?: "classic" | "hoopiq" | "unknown";
  round?: number | null;
  team?: TeamAbbreviation | null;
  decade?: Decade | null;
  roster?: Roster;
}

export interface GameState extends DetectedGameState {
  manual: ManualState;
}
```

- [ ] **Step 4: Implement player loading and normalization**

Create `src/data/players.ts`:

```ts
import { ACTIVE_DECADES, POSITIONS, type Decade, type Player, type Position, type RawPlayer } from "../domain/types";

export interface PlayerIndex {
  players: Player[];
  byRoll: Map<string, Player[]>;
  byName: Map<string, Player>;
}

const PLAYERS_URL = "https://www.82-0.com/players_flat.json";

export async function loadPlayers(fetchImpl: typeof fetch = fetch): Promise<PlayerIndex> {
  const response = await fetchImpl(PLAYERS_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch players: ${response.status}`);
  }
  const raw = (await response.json()) as RawPlayer[];
  return normalizePlayers(raw);
}

export function normalizePlayers(rawPlayers: unknown[]): PlayerIndex {
  const players = rawPlayers.flatMap((raw) => normalizePlayer(raw));
  const byRoll = new Map<string, Player[]>();
  const byName = new Map<string, Player>();

  for (const player of players) {
    const rollKey = toRollKey(player.team, player.decade);
    byRoll.set(rollKey, [...(byRoll.get(rollKey) ?? []), player]);
    byName.set(normalizeName(player.name), player);
  }

  for (const [key, rollPlayers] of byRoll.entries()) {
    byRoll.set(
      key,
      [...rollPlayers].sort((left, right) => right.ppg + right.rpg + right.apg - (left.ppg + left.rpg + left.apg))
    );
  }

  return { players, byRoll, byName };
}

export function getPlayersForRoll(index: PlayerIndex, team: string, decade: Decade): Player[] {
  return index.byRoll.get(toRollKey(team, decade)) ?? [];
}

export function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizePlayer(raw: unknown): Player[] {
  if (!isRawPlayer(raw)) {
    return [];
  }

  if (!isDecade(raw.era) || !Number.isFinite(raw.ppg) || !Number.isFinite(raw.rpg) || !Number.isFinite(raw.apg)) {
    return [];
  }

  const positions = normalizePositions(raw.positions, raw.pos);
  if (positions.length === 0) {
    return [];
  }

  return [
    {
      id: raw.id,
      baseSlug: raw.baseSlug,
      name: raw.player,
      team: raw.team,
      decade: raw.era,
      primaryPosition: positions[0],
      positions,
      ppg: raw.ppg,
      rpg: raw.rpg,
      apg: raw.apg,
      spg: Number.isFinite(raw.spg) ? raw.spg : null,
      bpg: Number.isFinite(raw.bpg) ? raw.bpg : null
    }
  ];
}

function normalizePositions(rawPositions: Array<string | null> | undefined, fallback: string): Position[] {
  const values = rawPositions?.length ? rawPositions : [fallback];
  const positions = values.filter((value): value is Position => POSITIONS.includes(value as Position));
  return [...new Set(positions)];
}

function isDecade(value: string): value is Decade {
  return ACTIVE_DECADES.includes(value as Decade);
}

function isRawPlayer(value: unknown): value is RawPlayer {
  if (!value || typeof value !== "object") {
    return false;
  }
  const player = value as RawPlayer;
  return (
    typeof player.team === "string" &&
    typeof player.player === "string" &&
    typeof player.pos === "string" &&
    typeof player.id === "string" &&
    typeof player.baseSlug === "string" &&
    typeof player.era === "string"
  );
}

function toRollKey(team: string, decade: Decade): string {
  return `${team.toUpperCase()}::${decade}`;
}
```

- [ ] **Step 5: Run data tests**

Run:

```bash
npm test -- tests/data/players.test.ts
npm run typecheck
```

Expected: all player data tests pass and TypeScript exits cleanly.

- [ ] **Step 6: Commit data module**

```bash
git add src/domain/types.ts src/data/players.ts tests/data/players.test.ts
git commit -m "feat: load and normalize player data"
```

## Task 3: Classic Scoring Formula

**Files:**
- Create: `src/scoring/formula.ts`
- Test: `tests/scoring/formula.test.ts`

- [ ] **Step 1: Write formula tests**

Create `tests/scoring/formula.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Player, Roster } from "../../src/domain/types";
import {
  adjustedDefensiveStats,
  calculateTeamResult,
  canPlayerPlayPosition,
  openPositions,
  projectedWins
} from "../../src/scoring/formula";

const kobe: Player = {
  id: "kobe",
  baseSlug: "kobe",
  name: "Kobe Bryant",
  team: "LAL",
  decade: "2000s",
  primaryPosition: "SG",
  positions: ["SG", "SF"],
  ppg: 30,
  rpg: 6.9,
  apg: 5.9,
  spg: 2.2,
  bpg: 0.8
};

const shaq: Player = {
  id: "shaq",
  baseSlug: "shaq",
  name: "Shaquille O'Neal",
  team: "LAL",
  decade: "2000s",
  primaryPosition: "C",
  positions: ["C"],
  ppg: 29.7,
  rpg: 13.6,
  apg: 3.8,
  spg: 0.5,
  bpg: 3
};

describe("classic scoring formula", () => {
  it("checks legal player positions", () => {
    expect(canPlayerPlayPosition(kobe, "SG")).toBe(true);
    expect(canPlayerPlayPosition(kobe, "PG")).toBe(false);
  });

  it("returns open positions from the roster", () => {
    const roster: Roster = { SG: kobe };
    expect(openPositions(roster)).toEqual(["PG", "SF", "PF", "C"]);
  });

  it("adjusts defensive stats to five-player roster scale", () => {
    expect(adjustedDefensiveStats([kobe, shaq])).toEqual({ adjustedSpg: 6.75, adjustedBpg: 9.5 });
  });

  it("projects wins with the nonlinear curve", () => {
    expect(projectedWins(0)).toBe(0);
    expect(projectedWins(110)).toBe(82);
  });

  it("calculates a deterministic record for a roster", () => {
    const result = calculateTeamResult({ SG: kobe, C: shaq });

    expect(result.teamRating).toBeGreaterThan(30);
    expect(result.wins).toBeGreaterThan(20);
    expect(result.losses).toBe(82 - result.wins);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- tests/scoring/formula.test.ts
```

Expected: FAIL because `src/scoring/formula.ts` does not exist.

- [ ] **Step 3: Implement formula module**

Create `src/scoring/formula.ts`:

```ts
import { POSITIONS, type Player, type Position, type Roster } from "../domain/types";

const WEIGHTS = {
  ppg: 0.46,
  rpg: 0.25,
  apg: 0.18,
  spg: 0.07,
  bpg: 0.04
} as const;

const BASELINES = {
  ppg: 133.4,
  rpg: 39.7,
  apg: 29.3,
  spg: 6.1,
  bpg: 3.2
} as const;

export interface TeamResult {
  teamRating: number;
  wins: number;
  losses: number;
}

export function canPlayerPlayPosition(player: Player, position: Position): boolean {
  return player.positions.includes(position);
}

export function openPositions(roster: Roster): Position[] {
  return POSITIONS.filter((position) => !roster[position]);
}

export function rosterPlayers(roster: Roster): Player[] {
  return POSITIONS.flatMap((position) => {
    const player = roster[position];
    return player ? [player] : [];
  });
}

export function placePlayer(roster: Roster, position: Position, player: Player): Roster {
  return { ...roster, [position]: player };
}

export function adjustedDefensiveStats(players: Player[]): { adjustedSpg: number; adjustedBpg: number } {
  const steals = players.map((player) => player.spg).filter((value): value is number => typeof value === "number" && value > 0);
  const blocks = players.map((player) => player.bpg).filter((value): value is number => typeof value === "number" && value > 0);

  return {
    adjustedSpg: sum(steals) * (steals.length > 0 ? 5 / steals.length : 1),
    adjustedBpg: sum(blocks) * (blocks.length > 0 ? 5 / blocks.length : 1)
  };
}

export function calculateTeamResult(roster: Roster): TeamResult {
  const players = rosterPlayers(roster);
  if (players.length === 0) {
    return { teamRating: 0, wins: 0, losses: 82 };
  }

  const totals = {
    ppg: sum(players.map((player) => player.ppg)),
    rpg: sum(players.map((player) => player.rpg)),
    apg: sum(players.map((player) => player.apg)),
    ...adjustedDefensiveStats(players)
  };

  const teamRating = roundToTenth(
    100 *
      (totals.ppg / BASELINES.ppg * WEIGHTS.ppg +
        totals.rpg / BASELINES.rpg * WEIGHTS.rpg +
        totals.apg / BASELINES.apg * WEIGHTS.apg +
        totals.adjustedSpg / BASELINES.spg * WEIGHTS.spg +
        totals.adjustedBpg / BASELINES.bpg * WEIGHTS.bpg)
  );

  const wins = projectedWins(teamRating);
  return { teamRating, wins, losses: 82 - wins };
}

export function projectedWins(teamRating: number): number {
  return Math.round(82 * Math.pow(Math.min(Math.max(teamRating, 0) / 110, 1), 1.15));
}

export function roundToTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
```

- [ ] **Step 4: Run formula tests**

Run:

```bash
npm test -- tests/scoring/formula.test.ts
npm run typecheck
```

Expected: all formula tests pass and TypeScript exits cleanly.

- [ ] **Step 5: Commit scoring formula**

```bash
git add src/scoring/formula.ts tests/scoring/formula.test.ts
git commit -m "feat: implement classic scoring formula"
```

## Task 4: Projections, Candidate Ranking, Gaps, And Skip Advice

**Files:**
- Create: `src/scoring/projections.ts`
- Test: `tests/scoring/projections.test.ts`

- [ ] **Step 1: Write projection tests**

Create `tests/scoring/projections.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Player, Roster } from "../../src/domain/types";
import {
  evaluateRoll,
  recommendSkip,
  rosterGaps
} from "../../src/scoring/projections";

function player(name: string, id: string, team: string, decade: Player["decade"], positions: Player["positions"], ppg: number, rpg: number, apg: number, spg: number | null, bpg: number | null): Player {
  return {
    id,
    baseSlug: id,
    name,
    team,
    decade,
    primaryPosition: positions[0],
    positions,
    ppg,
    rpg,
    apg,
    spg,
    bpg
  };
}

const kobe = player("Kobe Bryant", "kobe", "LAL", "2000s", ["SG", "SF"], 30, 6.9, 5.9, 2.2, 0.8);
const shaq = player("Shaquille O'Neal", "shaq", "LAL", "2000s", ["C"], 29.7, 13.6, 3.8, 0.5, 3);
const rolePlayer = player("Role Player", "role", "LAL", "2000s", ["SF"], 11, 4, 2, 0.6, 0.2);
const guard = player("Elite Guard", "guard", "BOS", "1980s", ["PG"], 25, 5, 11, 2.1, 0.3);
const forward = player("Elite Forward", "forward", "BOS", "1980s", ["PF"], 24, 12, 4, 1.2, 1.8);

describe("projections", () => {
  it("ranks candidates by best final outcome and legal position", () => {
    const result = evaluateRoll({
      roster: {},
      currentCandidates: [rolePlayer, shaq, kobe],
      allPlayers: [rolePlayer, shaq, kobe, guard, forward]
    });

    expect(result.recommendations[0].player.name).toBe("Shaquille O'Neal");
    expect(result.recommendations[0].position).toBe("C");
    expect(result.recommendations).toHaveLength(3);
    expect(result.recommendations[0].deltaExpectedWins).toBeGreaterThanOrEqual(result.recommendations[2].deltaExpectedWins);
  });

  it("excludes already selected players from completion projections", () => {
    const roster: Roster = { SG: kobe };
    const result = evaluateRoll({
      roster,
      currentCandidates: [shaq],
      allPlayers: [kobe, shaq, guard, forward]
    });

    expect(result.recommendations[0].expectedRoster.SG?.id).toBe("kobe");
    expect(Object.values(result.recommendations[0].expectedRoster).filter((drafted) => drafted?.id === "kobe")).toHaveLength(1);
  });

  it("identifies roster gaps by weakest category share", () => {
    expect(rosterGaps({ C: shaq })).toEqual(["AST", "STL", "PPG"]);
  });

  it("returns keep advice when the current roll is strong", () => {
    const advice = recommendSkip({
      bestDeltaExpectedWins: 10,
      bestDeltaCeilingWins: 3,
      teamRerollMedianDelta: 8,
      decadeRerollMedianDelta: 7,
      ceilingWins: 82
    });

    expect(advice.kind).toBe("keep");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- tests/scoring/projections.test.ts
```

Expected: FAIL because `src/scoring/projections.ts` does not exist.

- [ ] **Step 3: Implement projections**

Create `src/scoring/projections.ts`:

```ts
import type { Player, Position, Roster } from "../domain/types";
import { calculateTeamResult, canPlayerPlayPosition, openPositions, placePlayer, rosterPlayers } from "./formula";

export interface RollEvaluationInput {
  roster: Roster;
  currentCandidates: Player[];
  allPlayers: Player[];
}

export interface CandidateRecommendation {
  player: Player;
  position: Position;
  currentWins: number;
  withPickWins: number;
  expectedWins: number;
  ceilingWins: number;
  deltaExpectedWins: number;
  deltaCeilingWins: number;
  expectedRoster: Roster;
  ceilingRoster: Roster;
}

export interface RollEvaluation {
  recommendations: CandidateRecommendation[];
  gaps: string[];
}

export interface SkipAdviceInput {
  bestDeltaExpectedWins: number;
  bestDeltaCeilingWins: number;
  teamRerollMedianDelta: number;
  decadeRerollMedianDelta: number;
  ceilingWins: number;
}

export interface SkipAdvice {
  kind: "keep" | "skip-team" | "skip-decade" | "skip-only-if-chasing-82-0";
  reason: string;
}

export function evaluateRoll(input: RollEvaluationInput): RollEvaluation {
  const currentWins = calculateTeamResult(input.roster).wins;
  const recommendations = input.currentCandidates
    .flatMap((player) => bestPlacementForPlayer(input.roster, player, input.allPlayers, currentWins))
    .sort((left, right) => {
      if (right.deltaExpectedWins !== left.deltaExpectedWins) {
        return right.deltaExpectedWins - left.deltaExpectedWins;
      }
      return right.deltaCeilingWins - left.deltaCeilingWins;
    })
    .slice(0, 5);

  return {
    recommendations,
    gaps: rosterGaps(input.roster)
  };
}

export function rosterGaps(roster: Roster): string[] {
  const players = rosterPlayers(roster);
  const totals = {
    PPG: players.reduce((sum, player) => sum + player.ppg, 0) / 133.4,
    REB: players.reduce((sum, player) => sum + player.rpg, 0) / 39.7,
    AST: players.reduce((sum, player) => sum + player.apg, 0) / 29.3,
    STL: players.reduce((sum, player) => sum + (player.spg ?? 0), 0) / 6.1,
    BLK: players.reduce((sum, player) => sum + (player.bpg ?? 0), 0) / 3.2
  };

  return Object.entries(totals)
    .sort((left, right) => left[1] - right[1])
    .map(([category]) => category)
    .slice(0, 3);
}

export function recommendSkip(input: SkipAdviceInput): SkipAdvice {
  const teamAdvantage = input.teamRerollMedianDelta - input.bestDeltaExpectedWins;
  const decadeAdvantage = input.decadeRerollMedianDelta - input.bestDeltaExpectedWins;

  if (teamAdvantage >= 1.5 && teamAdvantage >= decadeAdvantage) {
    return { kind: "skip-team", reason: "Rerolling the team has a better expected candidate distribution." };
  }

  if (decadeAdvantage >= 1.5) {
    return { kind: "skip-decade", reason: "Rerolling the decade better matches the current roster gaps." };
  }

  if (input.ceilingWins < 82 && input.bestDeltaExpectedWins > 0 && input.bestDeltaCeilingWins < 1) {
    return { kind: "skip-only-if-chasing-82-0", reason: "This is fine for expected wins but lowers the 82-0 ceiling path." };
  }

  return { kind: "keep", reason: "The current roll is strong relative to reroll options." };
}

function bestPlacementForPlayer(roster: Roster, player: Player, allPlayers: Player[], currentWins: number): CandidateRecommendation[] {
  return openPositions(roster)
    .filter((position) => canPlayerPlayPosition(player, position))
    .map((position) => {
      const withPickRoster = placePlayer(roster, position, player);
      const withPickWins = calculateTeamResult(withPickRoster).wins;
      const expectedRoster = completeRoster(withPickRoster, allPlayers, "expected");
      const ceilingRoster = completeRoster(withPickRoster, allPlayers, "ceiling");
      const expectedWins = calculateTeamResult(expectedRoster).wins;
      const ceilingWins = calculateTeamResult(ceilingRoster).wins;

      return {
        player,
        position,
        currentWins,
        withPickWins,
        expectedWins,
        ceilingWins,
        deltaExpectedWins: expectedWins - currentWins,
        deltaCeilingWins: ceilingWins - currentWins,
        expectedRoster,
        ceilingRoster
      };
    })
    .sort((left, right) => right.expectedWins - left.expectedWins)
    .slice(0, 1);
}

function completeRoster(roster: Roster, allPlayers: Player[], mode: "expected" | "ceiling"): Roster {
  let completed = { ...roster };
  const usedBaseSlugs = new Set(rosterPlayers(completed).map((player) => player.baseSlug));

  for (const position of openPositions(completed)) {
    const candidates = allPlayers
      .filter((player) => !usedBaseSlugs.has(player.baseSlug))
      .filter((player) => canPlayerPlayPosition(player, position))
      .map((player) => ({ player, wins: calculateTeamResult(placePlayer(completed, position, player)).wins }))
      .sort((left, right) => right.wins - left.wins);

    const chosen = mode === "ceiling" ? candidates[0] : medianTopQuintile(candidates);
    if (chosen) {
      completed = placePlayer(completed, position, chosen.player);
      usedBaseSlugs.add(chosen.player.baseSlug);
    }
  }

  return completed;
}

function medianTopQuintile(candidates: Array<{ player: Player; wins: number }>): { player: Player; wins: number } | undefined {
  if (candidates.length === 0) {
    return undefined;
  }
  const topCount = Math.max(1, Math.ceil(candidates.length * 0.2));
  const top = candidates.slice(0, topCount);
  return top[Math.floor((top.length - 1) / 2)];
}
```

- [ ] **Step 4: Run projection tests**

Run:

```bash
npm test -- tests/scoring/projections.test.ts
npm run typecheck
```

Expected: all projection tests pass and TypeScript exits cleanly.

- [ ] **Step 5: Commit projections**

```bash
git add src/scoring/projections.ts tests/scoring/projections.test.ts
git commit -m "feat: rank draft recommendations"
```

## Task 5: Manual State Storage And Merge

**Files:**
- Create: `src/storage/manual-state.ts`
- Test: `tests/storage/manual-state.test.ts`

- [ ] **Step 1: Write manual storage tests**

Create `tests/storage/manual-state.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DetectedGameState, ManualState } from "../../src/domain/types";
import {
  clearManualState,
  loadManualState,
  mergeManualState,
  saveManualState
} from "../../src/storage/manual-state";

const memory = new Map<string, unknown>();

beforeEach(() => {
  memory.clear();
  vi.stubGlobal("chrome", {
    storage: {
      local: {
        get: vi.fn(async (key: string) => ({ [key]: memory.get(key) })),
        set: vi.fn(async (value: Record<string, unknown>) => {
          for (const [key, stored] of Object.entries(value)) memory.set(key, stored);
        }),
        remove: vi.fn(async (key: string) => {
          memory.delete(key);
        })
      }
    }
  });
});

describe("manual state", () => {
  it("saves and loads manual corrections", async () => {
    const state: ManualState = { team: "LAL", decade: "2000s", round: 3 };

    await saveManualState(state);

    expect(await loadManualState()).toEqual(state);
  });

  it("clears manual corrections", async () => {
    await saveManualState({ team: "BOS" });
    await clearManualState();

    expect(await loadManualState()).toEqual({});
  });

  it("merges manual values over detected state", () => {
    const detected: DetectedGameState = {
      mode: "classic",
      round: 2,
      team: "LAL",
      decade: "2000s",
      visiblePlayers: [],
      roster: {},
      confidence: "high"
    };

    expect(mergeManualState(detected, { team: "BOS", round: 4 })).toMatchObject({
      team: "BOS",
      round: 4,
      decade: "2000s",
      confidence: "high"
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- tests/storage/manual-state.test.ts
```

Expected: FAIL because `src/storage/manual-state.ts` does not exist.

- [ ] **Step 3: Implement manual state storage**

Create `src/storage/manual-state.ts`:

```ts
import type { DetectedGameState, GameState, ManualState } from "../domain/types";

const STORAGE_KEY = "82-0-assistant-manual-state";

export async function loadManualState(): Promise<ManualState> {
  if (!globalThis.chrome?.storage?.local) {
    return {};
  }
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return isManualState(result[STORAGE_KEY]) ? result[STORAGE_KEY] : {};
}

export async function saveManualState(state: ManualState): Promise<void> {
  if (!globalThis.chrome?.storage?.local) {
    return;
  }
  await chrome.storage.local.set({ [STORAGE_KEY]: state });
}

export async function clearManualState(): Promise<void> {
  if (!globalThis.chrome?.storage?.local) {
    return;
  }
  await chrome.storage.local.remove(STORAGE_KEY);
}

export function mergeManualState(detected: DetectedGameState, manual: ManualState): GameState {
  return {
    ...detected,
    mode: manual.mode ?? detected.mode,
    round: manual.round ?? detected.round,
    team: manual.team ?? detected.team,
    decade: manual.decade ?? detected.decade,
    roster: { ...detected.roster, ...(manual.roster ?? {}) },
    manual
  };
}

function isManualState(value: unknown): value is ManualState {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
```

- [ ] **Step 4: Run storage tests**

Run:

```bash
npm test -- tests/storage/manual-state.test.ts
npm run typecheck
```

Expected: all manual storage tests pass and TypeScript exits cleanly.

- [ ] **Step 5: Commit manual state module**

```bash
git add src/storage/manual-state.ts tests/storage/manual-state.test.ts
git commit -m "feat: persist manual corrections"
```

## Task 6: DOM Detection

**Files:**
- Create: `src/content/detectors.ts`
- Create: `tests/fixtures/classic-draft.html`
- Create: `tests/fixtures/incomplete-state.html`
- Test: `tests/content/detectors.test.ts`

- [ ] **Step 1: Create DOM fixtures**

Create `tests/fixtures/classic-draft.html`:

```html
<main>
  <section aria-label="draft status">
    <p>Classic</p>
    <p>Round 3</p>
    <h2>LAL 2000s</h2>
  </section>
  <section aria-label="players">
    <button>Kobe Bryant 30.0 PPG 6.9 RPG 5.9 APG</button>
    <button>Shaquille O'Neal 29.7 PPG 13.6 RPG 3.8 APG</button>
  </section>
  <section aria-label="roster">
    <div>PG Magic Johnson</div>
    <div>SG Empty</div>
    <div>SF Empty</div>
    <div>PF Tim Duncan</div>
    <div>C Empty</div>
  </section>
</main>
```

Create `tests/fixtures/incomplete-state.html`:

```html
<main>
  <p>Loading player data...</p>
  <section aria-label="roster">
    <div>PG Empty</div>
  </section>
</main>
```

- [ ] **Step 2: Write detector tests**

Create `tests/content/detectors.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { normalizePlayers } from "../../src/data/players";
import { detectGameState } from "../../src/content/detectors";

const index = normalizePlayers([
  { team: "LAL", player: "Kobe Bryant", pos: "SG", positions: ["SG", "SF"], ppg: 30, rpg: 6.9, apg: 5.9, spg: 2.2, bpg: 0.8, id: "kobe", baseSlug: "kobe", era: "2000s" },
  { team: "LAL", player: "Shaquille O'Neal", pos: "C", positions: ["C"], ppg: 29.7, rpg: 13.6, apg: 3.8, spg: 0.5, bpg: 3, id: "shaq", baseSlug: "shaq", era: "2000s" },
  { team: "LAL", player: "Magic Johnson", pos: "PG", positions: ["PG"], ppg: 23.9, rpg: 6.3, apg: 12.2, spg: 1.7, bpg: 0.4, id: "magic", baseSlug: "magic", era: "1980s" },
  { team: "SAS", player: "Tim Duncan", pos: "PF", positions: ["PF", "C"], ppg: 25.5, rpg: 12.7, apg: 3.7, spg: 0.7, bpg: 2.5, id: "duncan", baseSlug: "duncan", era: "2000s" }
]);

describe("DOM detectors", () => {
  it("detects Classic roll, visible players, round, and roster", () => {
    document.body.innerHTML = readFileSync("tests/fixtures/classic-draft.html", "utf8");

    const state = detectGameState(document, index);

    expect(state.mode).toBe("classic");
    expect(state.round).toBe(3);
    expect(state.team).toBe("LAL");
    expect(state.decade).toBe("2000s");
    expect(state.visiblePlayers.map((player) => player.name)).toEqual(["Kobe Bryant", "Shaquille O'Neal"]);
    expect(state.roster.PG?.name).toBe("Magic Johnson");
    expect(state.roster.PF?.name).toBe("Tim Duncan");
    expect(state.confidence).toBe("high");
  });

  it("returns low confidence when the current roll is missing", () => {
    document.body.innerHTML = readFileSync("tests/fixtures/incomplete-state.html", "utf8");

    const state = detectGameState(document, index);

    expect(state.team).toBeNull();
    expect(state.decade).toBeNull();
    expect(state.confidence).toBe("low");
  });
});
```

- [ ] **Step 3: Run detector tests to verify failure**

Run:

```bash
npm test -- tests/content/detectors.test.ts
```

Expected: FAIL because `src/content/detectors.ts` does not exist.

- [ ] **Step 4: Implement detectors**

Create `src/content/detectors.ts`:

```ts
import { ACTIVE_DECADES, POSITIONS, type Decade, type DetectedGameState, type Player, type Position, type Roster } from "../domain/types";
import { normalizeName, type PlayerIndex } from "../data/players";

const TEAM_PATTERN = /\b(ATL|BOS|BKN|CHA|CHI|CLE|DAL|DEN|DET|GSW|HOU|IND|LAC|LAL|MEM|MIA|MIL|MIN|NOP|NYK|OKC|ORL|PHI|PHX|POR|SAC|SAS|TOR|UTA|WAS)\b/;
const ROUND_PATTERN = /\bRound\s+([1-5])\b/i;

export function detectGameState(doc: Document, index: PlayerIndex): DetectedGameState {
  const text = doc.body.textContent ?? "";
  const mode = detectMode(text);
  const round = detectRound(text);
  const team = detectTeam(text);
  const decade = detectDecade(text);
  const visiblePlayers = detectVisiblePlayers(doc, index, team, decade);
  const roster = detectRoster(text, index);
  const confidence = team && decade ? "high" : "low";

  return { mode, round, team, decade, visiblePlayers, roster, confidence };
}

function detectMode(text: string): DetectedGameState["mode"] {
  if (/\bHoopIQ\b/i.test(text)) return "hoopiq";
  if (/\bClassic\b/i.test(text)) return "classic";
  return "unknown";
}

function detectRound(text: string): number | null {
  const match = text.match(ROUND_PATTERN);
  return match ? Number(match[1]) : null;
}

function detectTeam(text: string): string | null {
  return text.match(TEAM_PATTERN)?.[1] ?? null;
}

function detectDecade(text: string): Decade | null {
  return ACTIVE_DECADES.find((decade) => text.includes(decade)) ?? null;
}

function detectVisiblePlayers(doc: Document, index: PlayerIndex, team: string | null, decade: Decade | null): Player[] {
  const elements = [...doc.querySelectorAll("button, [role='button'], li, article, div")];
  const visibleText = elements.map((element) => element.textContent ?? "").join("\n").toLowerCase();
  const scopedPlayers = team && decade ? index.byRoll.get(`${team}::${decade}`) ?? [] : index.players;

  return scopedPlayers.filter((player) => visibleText.includes(normalizeName(player.name)));
}

function detectRoster(text: string, index: PlayerIndex): Roster {
  const roster: Roster = {};
  for (const position of POSITIONS) {
    const player = findRosterPlayerForPosition(text, position, index.players);
    if (player) {
      roster[position] = player;
    }
  }
  return roster;
}

function findRosterPlayerForPosition(text: string, position: Position, players: Player[]): Player | undefined {
  const positionIndex = text.indexOf(position);
  if (positionIndex < 0) {
    return undefined;
  }

  const nextPositionIndexes = POSITIONS.filter((candidate) => candidate !== position)
    .map((candidate) => text.indexOf(candidate, positionIndex + position.length))
    .filter((index) => index > positionIndex);
  const end = nextPositionIndexes.length > 0 ? Math.min(...nextPositionIndexes) : text.length;
  const segment = text.slice(positionIndex, end).toLowerCase();

  return players.find((player) => segment.includes(normalizeName(player.name)));
}
```

- [ ] **Step 5: Run detector tests**

Run:

```bash
npm test -- tests/content/detectors.test.ts
npm run typecheck
```

Expected: detector tests pass and TypeScript exits cleanly.

- [ ] **Step 6: Commit detectors**

```bash
git add src/content/detectors.ts tests/content/detectors.test.ts tests/fixtures
git commit -m "feat: detect 82-0 draft state"
```

## Task 7: Sidebar Rendering And Manual Edit Events

**Files:**
- Create: `src/content/sidebar.ts`
- Modify: `src/styles/sidebar.css`
- Test: `tests/content/sidebar.test.ts`

- [ ] **Step 1: Write sidebar tests**

Create `tests/content/sidebar.test.ts`:

```ts
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
});
```

- [ ] **Step 2: Run sidebar tests to verify failure**

Run:

```bash
npm test -- tests/content/sidebar.test.ts
```

Expected: FAIL because `src/content/sidebar.ts` does not exist.

- [ ] **Step 3: Implement sidebar renderer**

Create `src/content/sidebar.ts`:

```ts
import css from "../styles/sidebar.css?inline";
import type { GameState, Position } from "../domain/types";
import type { CandidateRecommendation, SkipAdvice } from "../scoring/projections";

export interface SidebarViewModel {
  state: GameState;
  recommendations: CandidateRecommendation[];
  gaps: string[];
  skipAdvice: SkipAdvice;
  error: string | null;
  onEdit: () => void;
  onRetry: () => void;
  onResetManualState: () => void;
}

export function ensureSidebarHost(): ShadowRoot {
  let host = document.getElementById("assistant-82-0-host");
  if (!host) {
    host = document.createElement("aside");
    host.id = "assistant-82-0-host";
    document.documentElement.append(host);
  }

  const shadow = host.shadowRoot ?? host.attachShadow({ mode: "open" });
  if (!shadow.querySelector("style")) {
    const style = document.createElement("style");
    style.textContent = css;
    shadow.append(style);
  }
  return shadow;
}

export function renderSidebar(root: Element | ShadowRoot, viewModel: SidebarViewModel): void {
  const container = getContainer(root);
  const best = viewModel.recommendations[0];
  container.innerHTML = `
    <section class="assistant-shell" aria-label="82-0 Classic Assistant">
      <button class="assistant-toggle" type="button" data-action="toggle">82 Assist</button>
      <div class="assistant-panel">
        <header class="assistant-header">
          <div>
            <p class="assistant-kicker">${viewModel.state.mode === "classic" ? "Classic" : "Mode unknown"}${viewModel.state.confidence === "low" ? " · low confidence" : ""}</p>
            <h2>${viewModel.state.team ?? "Team ?"} ${viewModel.state.decade ?? "Decade ?"}</h2>
          </div>
          <p class="assistant-round">Round ${viewModel.state.round ?? "?"}</p>
        </header>
        ${viewModel.error ? renderError(viewModel.error) : renderRecommendation(best)}
        ${renderAlternatives(viewModel.recommendations)}
        ${renderSkip(viewModel.skipAdvice)}
        ${renderRoster(viewModel.state.roster)}
        ${renderGaps(viewModel.gaps)}
        <footer class="assistant-actions">
          <button type="button" data-action="edit">Edit</button>
          <button type="button" data-action="reset">Reset manual</button>
        </footer>
      </div>
    </section>
  `;

  container.querySelector("[data-action='edit']")?.addEventListener("click", viewModel.onEdit);
  container.querySelector("[data-action='retry']")?.addEventListener("click", viewModel.onRetry);
  container.querySelector("[data-action='reset']")?.addEventListener("click", viewModel.onResetManualState);
  container.querySelector("[data-action='toggle']")?.addEventListener("click", () => {
    container.querySelector(".assistant-shell")?.classList.toggle("is-open");
  });
}

function getContainer(root: Element | ShadowRoot): Element {
  let container = root.querySelector(".assistant-root");
  if (!container) {
    container = document.createElement("div");
    container.className = "assistant-root";
    root.append(container);
  }
  return container;
}

function renderError(error: string): string {
  return `
    <section class="assistant-card assistant-error">
      <h3>${escapeHtml(error)}</h3>
      <p>Use retry, or edit the roll manually if the page is still loading.</p>
      <button type="button" data-action="retry">Retry</button>
    </section>
  `;
}

function renderRecommendation(best: CandidateRecommendation | undefined): string {
  if (!best) {
    return `<section class="assistant-card"><h3>No recommendation yet</h3><p>Waiting for a detected roll.</p></section>`;
  }
  return `
    <section class="assistant-card assistant-best">
      <p class="assistant-kicker">Best pick</p>
      <h3>${escapeHtml(best.player.name)} -> ${best.position}</h3>
      <p>Projected ${best.expectedWins}-${82 - best.expectedWins} expected / ${best.ceilingWins}-${82 - best.ceilingWins} ceiling</p>
      <div class="assistant-deltas">
        <span>Expected +${best.deltaExpectedWins}</span>
        <span>Ceiling +${best.deltaCeilingWins}</span>
      </div>
    </section>
  `;
}

function renderAlternatives(recommendations: CandidateRecommendation[]): string {
  const rows = recommendations
    .map(
      (recommendation, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(recommendation.player.name)}</td>
          <td>${recommendation.position}</td>
          <td>+${recommendation.deltaExpectedWins}</td>
          <td>+${recommendation.deltaCeilingWins}</td>
        </tr>
      `
    )
    .join("");
  return `<section class="assistant-card"><h3>Top picks</h3><table><tbody>${rows}</tbody></table></section>`;
}

function renderSkip(skipAdvice: SkipAdvice): string {
  return `<section class="assistant-card"><h3>Skip advice: ${skipAdvice.kind}</h3><p>${escapeHtml(skipAdvice.reason)}</p></section>`;
}

function renderRoster(roster: GameState["roster"]): string {
  const positions: Position[] = ["PG", "SG", "SF", "PF", "C"];
  const rows = positions
    .map((position) => `<li><strong>${position}</strong><span>${escapeHtml(roster[position]?.name ?? "Empty")}</span></li>`)
    .join("");
  return `<section class="assistant-card"><h3>Roster</h3><ul class="assistant-roster">${rows}</ul></section>`;
}

function renderGaps(gaps: string[]): string {
  return `<section class="assistant-card"><h3>Gaps</h3><p>${gaps.map(escapeHtml).join(" · ") || "No roster yet"}</p></section>`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const replacements: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
    return replacements[character];
  });
}
```

- [ ] **Step 4: Implement sidebar CSS**

Replace `src/styles/sidebar.css` with:

```css
:host {
  all: initial;
  color-scheme: dark;
}

.assistant-root,
.assistant-root * {
  box-sizing: border-box;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.assistant-shell {
  position: fixed;
  top: 72px;
  right: 16px;
  z-index: 2147483647;
  width: min(360px, calc(100vw - 32px));
  color: #f8fafc;
}

.assistant-toggle {
  display: none;
}

.assistant-panel {
  max-height: calc(100vh - 96px);
  overflow: auto;
  border: 1px solid rgba(148, 163, 184, 0.36);
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.96);
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.38);
}

.assistant-header,
.assistant-card,
.assistant-actions {
  padding: 12px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.18);
}

.assistant-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.assistant-kicker,
.assistant-round {
  margin: 0;
  color: #93c5fd;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
}

.assistant-header h2,
.assistant-card h3 {
  margin: 4px 0 8px;
  font-size: 16px;
  line-height: 1.25;
}

.assistant-card p {
  margin: 0;
  color: #cbd5e1;
  font-size: 13px;
  line-height: 1.4;
}

.assistant-best {
  border-left: 3px solid #22c55e;
}

.assistant-error {
  border-left: 3px solid #ef4444;
}

.assistant-deltas {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 10px;
}

.assistant-deltas span {
  border-radius: 6px;
  background: rgba(34, 197, 94, 0.16);
  padding: 8px;
  color: #bbf7d0;
  font-size: 12px;
  font-weight: 700;
}

.assistant-card table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.assistant-card td {
  padding: 6px 4px;
  border-top: 1px solid rgba(148, 163, 184, 0.14);
}

.assistant-roster {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.assistant-roster li {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  font-size: 12px;
}

.assistant-actions {
  display: flex;
  gap: 8px;
}

.assistant-actions button,
.assistant-card button {
  border: 1px solid rgba(148, 163, 184, 0.4);
  border-radius: 6px;
  background: rgba(30, 41, 59, 0.9);
  color: #f8fafc;
  cursor: pointer;
  padding: 7px 10px;
  font-size: 12px;
  font-weight: 700;
}

@media (max-width: 760px) {
  .assistant-shell {
    top: auto;
    right: 12px;
    bottom: 76px;
    width: min(340px, calc(100vw - 24px));
  }

  .assistant-toggle {
    display: inline-flex;
    float: right;
    border: 0;
    border-radius: 999px;
    background: #2563eb;
    color: #fff;
    cursor: pointer;
    padding: 10px 14px;
    font-weight: 800;
    box-shadow: 0 10px 30px rgba(37, 99, 235, 0.35);
  }

  .assistant-panel {
    display: none;
    clear: both;
    margin-top: 10px;
    max-height: min(620px, calc(100vh - 140px));
  }

  .assistant-shell.is-open .assistant-panel {
    display: block;
  }
}
```

- [ ] **Step 5: Run sidebar tests**

Run:

```bash
npm test -- tests/content/sidebar.test.ts
npm run typecheck
```

Expected: sidebar tests pass and TypeScript exits cleanly.

- [ ] **Step 6: Commit sidebar**

```bash
git add src/content/sidebar.ts src/styles/sidebar.css tests/content/sidebar.test.ts
git commit -m "feat: render assistant sidebar"
```

## Task 8: Content Script Integration

**Files:**
- Modify: `src/content/index.ts`
- Test: `tests/content/index.test.ts`

- [ ] **Step 1: Write integration tests**

Create `tests/content/index.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { startAssistant } from "../../src/content/index";

describe("content entrypoint", () => {
  it("mounts the assistant host and renders after player data loads", async () => {
    document.body.innerHTML = `
      <main>
        <p>Classic</p>
        <p>Round 1</p>
        <h2>LAL 2000s</h2>
        <button>Kobe Bryant 30.0 PPG</button>
      </main>
    `;

    await startAssistant({
      fetchPlayers: async () => ({
        players: [
          {
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
          }
        ],
        byRoll: new Map([
          [
            "LAL::2000s",
            [
              {
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
              }
            ]
          ]
        ]),
        byName: new Map()
      }),
      observeMutations: false
    });

    const host = document.getElementById("assistant-82-0-host");
    expect(host?.shadowRoot?.textContent).toContain("Kobe Bryant");
  });

  it("renders retry state when data loading fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    await startAssistant({
      fetchPlayers: async () => {
        throw new Error("network down");
      },
      observeMutations: false
    });

    const host = document.getElementById("assistant-82-0-host");
    expect(host?.shadowRoot?.textContent).toContain("players data unavailable");
  });
});
```

- [ ] **Step 2: Run integration tests to verify failure**

Run:

```bash
npm test -- tests/content/index.test.ts
```

Expected: FAIL because `src/content/index.ts` exports nothing useful yet.

- [ ] **Step 3: Implement content lifecycle**

Replace `src/content/index.ts` with:

```ts
import { getPlayersForRoll, loadPlayers, type PlayerIndex } from "../data/players";
import type { Decade, GameState } from "../domain/types";
import { detectGameState } from "./detectors";
import { ensureSidebarHost, renderSidebar } from "./sidebar";
import { clearManualState, loadManualState, mergeManualState } from "../storage/manual-state";
import { evaluateRoll, recommendSkip, type SkipAdvice } from "../scoring/projections";

interface StartOptions {
  fetchPlayers?: () => Promise<PlayerIndex>;
  observeMutations?: boolean;
}

export async function startAssistant(options: StartOptions = {}): Promise<void> {
  const shadow = ensureSidebarHost();
  const fetchPlayers = options.fetchPlayers ?? loadPlayers;
  const observeMutations = options.observeMutations ?? true;

  try {
    const index = await fetchPlayers();
    const render = async () => renderWithState(shadow, index, null);
    await render();

    if (observeMutations) {
      const observer = new MutationObserver(debounce(render, 150));
      observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    }
  } catch (error) {
    console.error("[82 Assist] Failed to load players", error);
    const fallbackState: GameState = {
      mode: "unknown",
      round: null,
      team: null,
      decade: null,
      visiblePlayers: [],
      roster: {},
      confidence: "low",
      manual: {}
    };
    renderSidebar(shadow, {
      state: fallbackState,
      recommendations: [],
      gaps: [],
      skipAdvice: { kind: "keep", reason: "Player data is unavailable, so no skip advice can be calculated." },
      error: "players data unavailable",
      onEdit: () => undefined,
      onRetry: () => void startAssistant(options),
      onResetManualState: () => void clearManualState()
    });
  }
}

async function renderWithState(root: ShadowRoot, index: PlayerIndex, error: string | null): Promise<void> {
  const detected = detectGameState(document, index);
  const manual = await loadManualState();
  const state = mergeManualState(detected, manual);
  const currentCandidates = state.team && state.decade ? getPlayersForRoll(index, state.team, state.decade as Decade) : state.visiblePlayers;
  const evaluation = evaluateRoll({ roster: state.roster, currentCandidates, allPlayers: index.players });
  const best = evaluation.recommendations[0];
  const skipAdvice: SkipAdvice = best
    ? recommendSkip({
        bestDeltaExpectedWins: best.deltaExpectedWins,
        bestDeltaCeilingWins: best.deltaCeilingWins,
        teamRerollMedianDelta: best.deltaExpectedWins,
        decadeRerollMedianDelta: best.deltaExpectedWins,
        ceilingWins: best.ceilingWins
      })
    : { kind: "keep", reason: "Waiting for a detected team and decade." };

  renderSidebar(root, {
    state,
    recommendations: evaluation.recommendations,
    gaps: evaluation.gaps,
    skipAdvice,
    error,
    onEdit: () => window.alert("Manual edit controls will open in this sidebar."),
    onRetry: () => void startAssistant(),
    onResetManualState: () => void clearManualState()
  });
}

function debounce(callback: () => void, delayMs: number): () => void {
  let timeout: number | undefined;
  return () => {
    window.clearTimeout(timeout);
    timeout = window.setTimeout(callback, delayMs);
  };
}

void startAssistant();
```

- [ ] **Step 4: Run integration tests**

Run:

```bash
npm test -- tests/content/index.test.ts
npm run typecheck
npm run build
```

Expected:

- integration tests pass;
- TypeScript exits cleanly;
- `dist/content.js` and `dist/manifest.json` are present.

- [ ] **Step 5: Commit content integration**

```bash
git add src/content/index.ts tests/content/index.test.ts
git commit -m "feat: integrate assistant content script"
```

## Task 9: Manual Correction UI Completion

**Files:**
- Modify: `src/content/sidebar.ts`
- Modify: `src/content/index.ts`
- Modify: `src/storage/manual-state.ts`
- Test: `tests/content/manual-edit.test.ts`

- [ ] **Step 1: Write manual edit behavior tests**

Create `tests/content/manual-edit.test.ts`:

```ts
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
      onResetManualState: vi.fn()
    });

    root.querySelector<HTMLButtonElement>("[data-action='edit']")?.click();

    expect(onEdit).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run manual edit test**

Run:

```bash
npm test -- tests/content/manual-edit.test.ts
```

Expected: PASS with the current callback path, proving the button wiring before expanding the controls.

- [ ] **Step 3: Extend sidebar view model for manual save**

Modify `src/content/sidebar.ts` so `SidebarViewModel` includes:

```ts
onManualSave: (state: { team: string | null; decade: string | null; round: number | null }) => void;
```

Update `renderSidebar` to render an edit panel when `.assistant-shell` has class `is-editing`. The panel must include:

```html
<label>Team <input name="team" maxlength="3" /></label>
<label>Decade <select name="decade">
  <option value="">Unknown</option>
  <option value="1960s">1960s</option>
  <option value="1970s">1970s</option>
  <option value="1980s">1980s</option>
  <option value="1990s">1990s</option>
  <option value="2000s">2000s</option>
  <option value="2010s">2010s</option>
  <option value="2020s">2020s</option>
</select></label>
<label>Round <input name="round" type="number" min="1" max="5" /></label>
<button type="button" data-action="save-manual">Save</button>
```

The existing edit button should toggle `is-editing`, and `save-manual` should call `onManualSave`.

- [ ] **Step 4: Update integration to persist manual roll corrections**

Modify `src/content/index.ts` so the sidebar receives:

```ts
onManualSave: async (manualPatch) => {
  await saveManualState({
    ...state.manual,
    team: manualPatch.team,
    decade: manualPatch.decade as Decade | null,
    round: manualPatch.round
  });
  await renderWithState(root, index, null);
}
```

Import `saveManualState` from `src/storage/manual-state.ts`.

- [ ] **Step 5: Run manual edit, sidebar, and integration tests**

Run:

```bash
npm test -- tests/content/manual-edit.test.ts tests/content/sidebar.test.ts tests/content/index.test.ts
npm run typecheck
```

Expected: all selected tests pass and TypeScript exits cleanly.

- [ ] **Step 6: Commit manual edit UI**

```bash
git add src/content/sidebar.ts src/content/index.ts tests/content/manual-edit.test.ts
git commit -m "feat: add manual roll correction UI"
```

## Task 10: Full Verification And Browser Load Checklist

**Files:**
- Create: `docs/manual-test-checklist.md`
- Modify: `README.md`

- [ ] **Step 1: Create manual test checklist**

Create `docs/manual-test-checklist.md`:

```md
# Manual Test Checklist

1. Run `npm install`.
2. Run `npm test`.
3. Run `npm run typecheck`.
4. Run `npm run build`.
5. Open Chrome, Edge, or Brave.
6. Navigate to `chrome://extensions`.
7. Enable developer mode.
8. Click "Load unpacked".
9. Select the `dist/` directory.
10. Open `https://www.82-0.com/`.
11. Start Classic mode.
12. Confirm the right sidebar appears on desktop.
13. Confirm the sidebar shows the detected team, decade, round, top pick, expected delta, ceiling delta, skip advice, roster, and gaps.
14. Resize the browser below 760px.
15. Confirm the sidebar collapses to the `82 Assist` button and opens as a drawer.
16. Use Edit to set a manual team, decade, and round.
17. Confirm the sidebar updates after saving manual corrections.
18. Use Reset manual.
19. Confirm the sidebar returns to detected state.
20. Disable network, refresh the page, and confirm the retry state is visible without breaking the site.
```

- [ ] **Step 2: Create README**

Create `README.md`:

````md
# 82-0 Classic Assistant

Chromium extension that adds Classic-mode draft advice to `82-0.com`.

## Development

```bash
npm install
npm test
npm run typecheck
npm run build
```

## Load In Browser

1. Build with `npm run build`.
2. Open `chrome://extensions` in Chrome, Edge, or Brave.
3. Enable developer mode.
4. Click "Load unpacked".
5. Select `dist/`.
6. Open `https://www.82-0.com/`.

The extension only injects advice. It never clicks, selects, submits, or changes gameplay.
```
````

- [ ] **Step 3: Run full verification**

Run:

```bash
npm test
npm run typecheck
npm run build
```

Expected:

- all tests pass;
- TypeScript exits cleanly;
- Vite builds `dist/`;
- `dist/manifest.json` contains Manifest V3, `storage`, and `https://www.82-0.com/*`.

- [ ] **Step 4: Inspect final git state**

Run:

```bash
git status --short
```

Expected: only intentional files are modified or untracked.

- [ ] **Step 5: Commit docs and final verification changes**

```bash
git add README.md docs/manual-test-checklist.md
git commit -m "docs: add extension usage checklist"
```

## Self-Review

Spec coverage:

- Manifest V3 Chromium extension: Tasks 1 and 10.
- Classic only, advice only, no automation: Tasks 1, 7, 8, 10.
- Public data loading and local calculations: Tasks 2, 3, 4.
- Right sidebar and mobile drawer: Task 7.
- Automatic detection with manual fallback: Tasks 5, 6, 9.
- Expected and ceiling projections: Task 4.
- Skip advice and roster gaps: Task 4.
- Error fallback and retry state: Tasks 7 and 8.
- Tests and manual validation: all tasks, with final checklist in Task 10.

Red-flag scan:

- No unresolved markers or unspecified implementation steps are intentionally left in this plan.

Type consistency:

- Shared types are introduced in `src/domain/types.ts` before modules import them.
- `PlayerIndex`, `CandidateRecommendation`, `SkipAdvice`, and `GameState` are defined before later tasks depend on them.
- All planned modules use the same `Position`, `Decade`, `Roster`, and `Player` names.
