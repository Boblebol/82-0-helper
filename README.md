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

After each rebuild, click the extension `Reload` button in `chrome://extensions` before refreshing `82-0.com`.

The extension only injects advice. It never clicks, selects, submits, or changes gameplay.
