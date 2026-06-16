# 82-0 Classic Assistant Browser Extension Design

Date: 2026-06-16

## Goal

Build a Chromium browser extension for `https://www.82-0.com/` that helps the user play Classic mode by recommending the best draft choice without clicking or automating gameplay.

The extension should improve decision quality during a live draft by showing:

- the best available player for the current team and decade;
- the best roster position for that player;
- expected and ceiling projections for the final result;
- skip advice;
- roster weaknesses and manual correction controls.

## Scope

In scope for V1:

- Chrome, Edge, and Brave through Manifest V3.
- Classic mode only.
- Advice only. The extension never clicks, selects, submits, or changes the game state.
- Current live 82-0 behavior: five rounds, five roster positions, one team and one decade roll per round.
- Right sidebar on desktop, drawer-style panel on narrow screens.
- Automatic detection with manual correction fallback.
- Local calculations using the site's public player dataset.

Out of scope for V1:

- HoopIQ-specific advice.
- Browser support outside Chromium.
- Account integration.
- Network interception or dependence on private app state.
- Automatic drafting.
- Enforcing a separate "exactly one player per decade" rule. The provided rules text mentions that constraint, but it conflicts with the currently observed live site behavior.

## Site Findings

The site is a Next.js app deployed on Vercel. The live homepage loads player data from:

```text
https://www.82-0.com/players_flat.json
```

The dataset is a flat JSON array. Each player includes:

```text
team, player, pos, positions, ppg, rpg, apg, spg, bpg, id, baseSlug, era
```

The live app also caches the dataset in local storage under `nba_players_local_cache`.

The game logic visible in bundled scripts indicates:

- active draft decades are `1960s` through `2020s`;
- there are five roster positions: `PG`, `SG`, `SF`, `PF`, `C`;
- Classic scoring uses cumulative `PPG`, `RPG`, `APG`, adjusted `SPG`, and adjusted `BPG`;
- projected wins are derived from a nonlinear curve.

## User Experience

The extension injects a right sidebar when the user is on the 82-0 play surface.

Desktop layout:

- Header: detected mode, round, current team, and current decade.
- Recommendation card: best pick, recommended position, expected projection, and ceiling projection.
- Alternatives table: top five available players with recommended position, expected delta, and ceiling delta.
- Skip block: `keep`, `skip team`, `skip decade`, or `skip only if chasing 82-0`, plus a short reason.
- Roster block: five positions with detected or manually corrected player assignments.
- Gaps block: weakest statistical categories for the current roster.
- Edit controls: manual team, decade, round, roster, and mode correction.

Narrow layout:

- The sidebar collapses to a floating `82 Assist` button.
- Tapping the button opens a drawer with the same content.

The extension marks uncertain advice as `low confidence` when detection is incomplete.

## Architecture

Use a vanilla TypeScript extension built with Vite. Avoid React for V1 to keep the injected UI small and reduce interaction risk with the host app.

Modules:

- `src/manifest.json`: Manifest V3 extension declaration.
- `src/content/index.ts`: content script entrypoint, lifecycle, DOM observer, and sidebar mount.
- `src/content/sidebar.ts`: UI rendering and event handling.
- `src/content/detectors.ts`: DOM detection for current roll, visible players, roster, mode, and round.
- `src/data/players.ts`: fetch, cache, normalize, and query `/players_flat.json`.
- `src/scoring/formula.ts`: player, team, rating, wins, and record calculations.
- `src/scoring/projections.ts`: expected and ceiling completion estimates, deltas, and skip advice.
- `src/storage/manual-state.ts`: `chrome.storage.local` persistence for user corrections.
- `src/styles/sidebar.css`: isolated extension styles.

Data flow:

1. The content script starts on matching 82-0 pages.
2. The data module loads player data from the site, then caches normalized data.
3. The detector reads the current visible game state.
4. Manual corrections are merged over detected state.
5. The scoring module computes current, expected, and ceiling outcomes.
6. The sidebar renders recommendations.
7. A `MutationObserver` recalculates advice after visible game state changes.

## Scoring And Projection

The extension mirrors the public formula visible in the site's scripts where practical.

Classic team rating:

- Sum player `PPG`, `RPG`, and `APG`.
- Adjust `SPG` and `BPG` to account for missing historical defensive data.
- Apply category weights matching the site's visible model: points are the largest factor, then rebounds, assists, steals, and blocks.
- Convert team rating into projected wins with the same nonlinear curve shape.

For each candidate pick:

1. Determine every open legal roster position for the player.
2. Evaluate the candidate in each position.
3. Pick the position with the best projected outcome.
4. Compare against the current roster projection.
5. Show `delta expected` and `delta ceiling`.

Expected projection:

- Completes empty roster slots with the median candidate from the top 20% of valid players for each open position across active decades and teams.
- Excludes players already selected in the current roster.
- Uses a deterministic sort by projected team outcome, not random sampling, so tests are stable.
- Intended to answer: "What should I expect if the rest of the draft is normal to good?"

Ceiling projection:

- Completes empty roster slots greedily with the best valid player for each open position across active decades and teams.
- Excludes players already selected in the current roster.
- Uses the same legal-position checks as the visible roster UI.
- Intended to answer: "Can this path still reach or approach 82-0?"

Skip advice:

- Recommend `keep` when the best current pick is strong relative to expected alternatives.
- Recommend `skip team` when keeping the current decade but rerolling teams has a materially better expected candidate distribution.
- Recommend `skip decade` when keeping the current team but rerolling decades has a materially better expected candidate distribution.
- Recommend `skip only if chasing 82-0` when the pick is good for expected performance but materially lowers ceiling.

## Manual Correction

Detection should be automatic but not trusted blindly.

Manual state can override:

- current team;
- current decade;
- current round;
- current mode;
- roster assignments by position.

Manual corrections persist per browser in `chrome.storage.local`. The user can reset all corrections from the sidebar.

## Error Handling

Data load failure:

- Show `players data unavailable`.
- Provide a retry action.
- Keep the sidebar mounted.

Current roll not detected:

- Show manual team and decade inputs.
- Mark recommendation confidence as low until corrected.

Roster not detected:

- Continue with manual roster editing.
- Avoid showing precise deltas unless enough state is known.

Site DOM changed:

- Fail soft into manual mode.
- Do not remove or modify host page elements outside the extension container.

## Privacy And Permissions

Permissions should be minimal:

- host permission for `https://www.82-0.com/*`;
- `storage` for manual corrections and cached metadata.

The extension should not collect analytics, send user data to a third party, or require login.

## Testing

Automated tests:

- scoring formula tests with known player inputs;
- projection tests for expected and ceiling behavior;
- player data normalization tests;
- DOM detector tests using local HTML fixtures for roll, player list, roster, and incomplete states.

Build and manual validation:

- `npm run build` must produce a loadable `dist/` extension.
- Load `dist/` in Chrome, Edge, or Brave developer mode.
- Verify the sidebar appears only on `82-0.com`.
- Verify Classic draft detection, recommendations, manual correction, and retry states.

## Acceptance Criteria

- The extension loads in Chromium browsers through Manifest V3.
- On the 82-0 Classic play surface, it displays a right sidebar on desktop.
- The sidebar recommends the best pick and position for the current roll.
- The sidebar shows expected and ceiling projections with per-pick deltas.
- The sidebar gives skip advice with a short reason.
- Manual correction works for roll and roster state.
- The extension never clicks or automates gameplay.
- If detection or data loading fails, the page remains usable and the sidebar provides a fallback.
