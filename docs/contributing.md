# Contributing

## Local setup

```sh
git clone https://github.com/lalba-anthony/hexasky.git
cd hexasky
git checkout develop
npm ci
```

Node 22 or newer is required (`engines.node` is `>=22`). The package is ESM only.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run lint` | ESLint over the whole repository |
| `npm run lint:fix` | ESLint with `--fix` |
| `npm run typecheck` | `tsc --noEmit` over `src` |
| `npm test` | Vitest, single run |
| `npm run test:watch` | Vitest in watch mode |
| `npm run build` | `tsc` into `dist/` |
| `npm run dev` | `tsc --watch` |

Run this before every commit:

```sh
npm run lint && npm run typecheck && npm test
```

## Branching model

| Branch | Role |
| --- | --- |
| `develop` | Default branch. All work lands here. CI runs lint, typecheck, test, build. Nothing is published. |
| `main` | Production. A merge into `main` triggers semantic-release. |

Feature work branches off `develop` and is merged back into `develop`. When a
release is wanted, `develop` is merged into `main`.

## Conventional Commits

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org).
semantic-release derives the next version from them:

| Prefix | Release |
| --- | --- |
| `fix:` | patch |
| `feat:` | minor |
| `BREAKING CHANGE:` in the footer | major |
| `chore:`, `docs:`, `test:`, `refactor:`, `ci:`, `build:`, `style:`, `perf:` | none |

```
feat(render): add a compass column to the daily table

fix(weather): reject misaligned daily series

refactor(theme): build the palette from createColors

BREAKING CHANGE: renderForecast now requires an explicit today option
```

## The no-comment rule

There are zero comments under `src/` and `tests/`. No `//`, no `/* */`, no
JSDoc. All explanation lives in `docs/`.

The rule is machine-enforced: `eslint.config.js` registers a local
`hexasky/no-comments` rule that reports every comment token in those two
directories (the `dist/cli.js` hashbang is exempt). `npm run lint` fails if a
comment is added, so this is not merely a convention.

Code must therefore carry its meaning in its names. If a construct needs a
comment to be understood, either rename it or write the explanation in the
relevant file under `docs/`.

A quick manual check:

```sh
grep -rE '(^|\s)//|/\*' src/
```

The pattern anchors on a line start or whitespace so that the two endpoint URL
literals in `src/geocoding.ts` and `src/weather.ts` are not reported. `npm run
lint` remains the authoritative check.

## The no-emoji rule

No emoji anywhere: not in source, not in CLI output, not in documentation, not
in commit messages, not in the README. Weather conditions are rendered as text
labels only. All user-facing output and all documentation is in English.

## Code standards

- TypeScript strict, no `any`, no `@ts-expect-error`.
- `as` casts only inside the JSON narrowing functions in `src/geocoding.ts` and
  `src/weather.ts`.
- Every interface crossing a module boundary is declared under `src/types/` and
  imported with `import type`.
- `picocolors` is the only runtime dependency. Everything else is a
  devDependency. Argument parsing uses `node:util`'s `parseArgs`; HTTP uses the
  global `fetch`.
- Errors are never swallowed: they are converted into `UsageError`,
  `GeocodingError` or `WeatherError` and handled by the single boundary in
  `src/cli.ts`.

## Tests

Vitest, Node environment, no live network calls. The global `fetch` is stubbed
with `vi.stubGlobal` and the fixtures under `tests/fixtures/`.

A change to any of these needs a test alongside it:

- the GeoJSON coordinate order,
- the forecast request parameters,
- the hourly aggregation,
- the rendered column layout,
- the positional argument joining,
- the WMO code mapping.
