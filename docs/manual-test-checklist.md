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
