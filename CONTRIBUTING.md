# Contributing

Thanks for considering a contribution to 82-0 Helper.

## Development Setup

```bash
npm install
npm test
npm run typecheck
npm run build
```

Use `npm test -- --watch` or `npm run test:watch` while working locally.

## Pull Request Guidelines

- Keep changes focused on one issue or feature.
- Add or update tests for scoring, detection, storage, and UI behavior changes.
- Run `npm test`, `npm run typecheck`, and `npm run build` before opening a PR.
- Do not commit generated build output from `dist/` or release archives from `release/`.
- Do not add private data, authentication tokens, or proprietary site assets.

## Code Style

- Use TypeScript for extension logic.
- Prefer small pure functions for scoring and parsing logic.
- Keep DOM selectors defensive because 82-0.com can change without notice.
- Keep user-facing sidebar text in French.

## Player Data Changes

When changing player data or recommendation formulas:

- Include the reasoning in the PR description.
- Add tests for important edge cases.
- Avoid subjective ranking changes unless they are backed by the scoring model.

## Release Changes

Release artifacts are built from `dist/` and attached to GitHub Releases. They are not committed to the repository.
