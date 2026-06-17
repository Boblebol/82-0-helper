# 82-0 Helper

82-0 Helper is a Chromium extension for `https://www.82-0.com/`. It adds a right-side advisor panel for Classic mode drafts, in French, without automating gameplay.

The extension reads the visible game state, compares the current roll against its bundled player data, and suggests the best available pick. It does not click buttons, select players, submit drafts, or change the site state.

## Features

- Classic mode recommendations for the current team and decade roll.
- Estimated game-score impact for each recommended pick.
- Reroll advice with better-pick probabilities.
- One team reroll and one era reroll tracked per game.
- Manual roster editing when the page state is incomplete.
- French UI with contextual help tooltips.
- Manifest V3 content script for Chrome, Edge, and Brave.

## Install From A Release

1. Download the latest zip from the [GitHub releases page](https://github.com/Boblebol/82-0-helper/releases).
2. Unzip it locally.
3. Open `chrome://extensions` in Chrome, Edge, or Brave.
4. Enable Developer mode.
5. Click Load unpacked.
6. Select the unzipped extension folder.
7. Open `https://www.82-0.com/` and start a Classic mode game.

After upgrading, click Reload for the extension in `chrome://extensions`, then refresh `82-0.com`.

## Develop Locally

Requirements:

- Node.js 18.18 or newer.
- npm.

Install dependencies:

```bash
npm install
```

Run the checks:

```bash
npm test
npm run typecheck
npm run build
```

Load the local build:

1. Run `npm run build`.
2. Open `chrome://extensions`.
3. Enable Developer mode.
4. Click Load unpacked.
5. Select `dist/`.

## Project Structure

```text
src/content/      DOM detection and sidebar rendering
src/data/         Bundled player data
src/domain/       Shared domain types
src/scoring/      Recommendation and projection logic
src/storage/      Manual state persisted with chrome.storage
src/styles/       Sidebar CSS
tests/            Unit and DOM fixture tests
```

## Release Build

```bash
npm run build
cd dist
zip -r ../release/82-0-helper-vX.Y.Z.zip .
```

The zip should contain `manifest.json`, `content.js`, and `content.js.map` at the archive root.

## Privacy And Permissions

82-0 Helper requests only:

- `storage`, to remember manual roster and reroll state locally.
- `https://www.82-0.com/*`, to inject the assistant on the game site.

The extension has no background worker, no external API calls, and no telemetry.

## Contributing

Issues and pull requests are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a PR.

## Disclaimer

This project is not affiliated with, endorsed by, or sponsored by 82-0.com. It is an independent helper extension for personal gameplay analysis.

## License

MIT. See [LICENSE](LICENSE).
