# CLAUDE.md

## Project

`@lalba-anthony/hexasky` is an npm CLI that prints a 7-day French weather
forecast for any French address. One run geocodes the address against the
Geoplateforme (IGN), fetches one Open-Meteo forecast, renders a compact
colorized table to stdout, and exits.

## Layout

```
.github/workflows/   ci.flow.yml (develop), release.flow.yml (main),
                     tests.inc.yml (reusable verify job, called by both)
docs/                architecture.md, usage.md, external-apis.md, contributing.md, release.md
src/
  cli.ts             bin entry, shebang, exactly one try/catch
  index.ts           public library surface + parseCliArguments
  geocoding.ts       geocode()
  weather.ts         fetchForecast()
  aggregate.ts       hourly -> daily means
  weather-codes.ts   WMO labels, categories, compass conversion
  render.ts          renderForecast(), pure
  theme.ts           createTheme(colorEnabled)
  errors.ts          HexaskyError, UsageError, GeocodingError, WeatherError
  version.ts         packageVersion, userAgent
  types/             every cross-module type
tests/               vitest, fixtures under tests/fixtures/
```

## Non-negotiable constraints

- TypeScript strict. No `any`. No `@ts-expect-error`. `as` casts only inside the
  JSON narrowing functions in `geocoding.ts` and `weather.ts`.
- ESM only, `"type": "module"`, Node >= 22.
- **Zero comments under `src/` and `tests/`.** No `//`, no `/* */`, no JSDoc.
  This is enforced by the `hexasky/no-comments` ESLint rule and `npm run lint`
  fails on any violation. Code must be self-documenting through naming.
- **Documentation belongs in `docs/`, never in code comments.** If something
  needs explaining, add it to the relevant file under `docs/`.
- **No emoji anywhere** -- not in source, not in CLI output, not in docs, not in
  commit messages, not in the README. Conditions are text labels only.
- All user-facing output and all documentation is in English.
- Every type or interface crossing a module boundary is declared under
  `src/types/` and imported with `import type`.
- Exactly one runtime dependency: `picocolors`. Everything else is a
  devDependency. Argument parsing uses `node:util`'s `parseArgs`; HTTP uses the
  global `fetch`.
- `src/cli.ts` holds exactly one `try`/`catch`, which maps `HexaskyError` to its
  `exitCode` and anything else to exit 1 with `unexpected error`.
- `renderForecast` is pure: it takes an explicit `colorEnabled` boolean and an
  explicit `today` date string, and never reads the clock or the environment.

## Branching

- `develop` -- default branch, all work lands here. CI lints, typechecks, tests
  and builds. Nothing is published.
- `main` -- production. A merge into `main` triggers semantic-release, which
  publishes to npm and writes `CHANGELOG.md`.

Conventional Commits are required: `fix:` yields a patch, `feat:` a minor,
`BREAKING CHANGE:` in the footer a major.

## Before any commit

```sh
npm run lint && npm run typecheck && npm test
```

All three must pass. `npm run build` must also pass before anything is merged
into `main`.

## Gotchas

- `geometry.coordinates` from the geocoder is `[longitude, latitude]`, GeoJSON
  order. A dedicated regression test guards this.
- Open-Meteo has no daily aggregate for humidity or pressure; both are requested
  hourly and averaged in `aggregate.ts`, grouped by the `YYYY-MM-DD` prefix of
  the local timestamps produced by `timezone=auto`.
- `api-adresse.data.gouv.fr` was decommissioned in January 2026. Use
  `data.geopf.fr`.
- Cells are padded before they are colorized; reversing that breaks alignment.
