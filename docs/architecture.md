# Architecture

## Purpose

`hexasky` resolves a French address to coordinates, fetches a 7-day forecast for
those coordinates, and prints a compact colorized table. One run performs exactly
two HTTP requests and then exits.

## Module graph

```
cli.ts  (bin entry, shebang, single error boundary)
 |
 +-- index.ts        parseCliArguments + public library surface
 +-- geocoding.ts    geocode()        -> errors.ts, version.ts, types/
 +-- weather.ts      fetchForecast()  -> aggregate.ts, weather-codes.ts, errors.ts, version.ts, types/
 +-- render.ts       renderForecast() -> theme.ts, weather-codes.ts, types/
 +-- theme.ts        createTheme()    -> picocolors
 +-- version.ts      packageVersion, userAgent
 +-- errors.ts       HexaskyError, UsageError, GeocodingError, WeatherError
```

Nothing under `src/` imports `cli.ts`. Dependencies flow in one direction:
`cli.ts` -> feature modules -> `errors.ts` / `types/`. There are no cycles.

## Data flow

1. `cli.ts` hands `process.argv.slice(2)` to `parseCliArguments`, which joins
   every positional with a single space to form the query string.
2. `geocode(query)` calls the Geoplateforme geocoder and returns a `Location`
   (latitude, longitude, label, city, postcode, context).
3. `fetchForecast(location)` calls Open-Meteo once, validates the payload, and
   maps it to a `Forecast`: `location`, `timezone`, `current`, and seven
   `DailyForecast` entries.
4. `currentDateInTimeZone(forecast.timezone, new Date())` produces the
   `YYYY-MM-DD` string used to decide which row is today.
5. `renderForecast(forecast, { colorEnabled, today })` returns the whole block as
   a single string. `cli.ts` writes it to stdout.

## Why humidity and pressure are aggregated client-side

Open-Meteo exposes no daily aggregate for relative humidity or surface pressure.
Only `hourly` series exist for those two variables, so both are requested hourly
and averaged in `aggregate.ts`.

Because the request uses `timezone=auto`, every `hourly.time[i]` entry is already
a local timestamp of the form `YYYY-MM-DDTHH:mm`. Grouping is therefore a plain
string slice of the first ten characters -- no timezone arithmetic, no date
parsing, no dependency on the machine's own timezone.

`meansByDate` builds the unrounded mean per date. `roundedMeansForDates` aligns
those means against `daily.time` and rounds to the nearest integer (percent for
humidity, hectopascal for pressure). A date with no matching hourly samples
produces `null`, which the renderer prints as `-`.

## Why types are centralized

Every interface that crosses a module boundary lives under `src/types/` and is
imported with `import type`. Three consequences:

- The wire shapes (`src/types/geocoding.ts`, `src/types/weather.ts`) are visible
  in one place and can be diffed against the vendor documentation without
  reading any logic.
- The domain shapes (`src/types/domain.ts`) are what the renderer and the public
  API consume, so a vendor field rename never leaks past `geocoding.ts` or
  `weather.ts`.
- `src/index.ts` re-exports the whole `types/` barrel with `export type *`, so
  library consumers get the same declarations the CLI uses.

`src/types/cli.ts` additionally holds the presentation contracts (`Theme`,
`Styler`, `RenderOptions`, `CliArguments`) because they cross the
`theme.ts` -> `render.ts` -> `cli.ts` boundary.

## Validation boundary

Both endpoints are validated by a hand-written narrowing function
(`narrowGeocodingResponse`, `narrowForecastResponse`) that takes `unknown` and
returns either a fully typed object or `null`. The only `as` casts in the code
base sit inside those functions, where `Array.isArray` on an `unknown` value
narrows to `any[]` and has to be pinned back to `readonly unknown[]`.

A malformed payload therefore raises `GeocodingError` or `WeatherError`; a
`TypeError` from property access can never reach the user.

Numeric series are rejected unless their length matches `daily.time`. Misaligned
arrays would otherwise silently shift a whole column by one day.

## Decisions taken where the brief was silent

**`parseCliArguments` lives in `src/index.ts`, not `src/cli.ts`.** `cli.ts` is
required to hold exactly one `try`/`catch`, and converting the `TypeError` that
`parseArgs` throws for an unknown flag into a `UsageError` needs its own. Putting
the parser in `index.ts` keeps `cli.ts` a pure shell with a single error
boundary, and lets `tests/cli-args.test.ts` import the parser without executing
the bin. The parser is pure and is part of the published API surface.

**`fetchForecast` takes the full `Location`.** It echoes it into
`Forecast.location`, so `renderForecast` receives everything it needs in one
object instead of two positional arguments.

**`RenderOptions.today` is an explicit date string.** The renderer stays pure:
it never reads the clock. `cli.ts` derives the value from the forecast timezone
with `Intl.DateTimeFormat('en-CA')`, whose output format is already
`YYYY-MM-DD`. An unusable timezone falls back to UTC rather than throwing.

**The theme is built on `pc.createColors(colorEnabled)`.** picocolors' own
environment detection is read exactly once, in `cli.ts`, through
`isColorSupported()`. Everything downstream is driven by the explicit boolean, so
`renderForecast` produces byte-identical output regardless of TTY state and the
tests can assert on ANSI sequences deterministically.

**Column widths are fixed constants.** `DAY` 3, `DATE` 6, `CONDITION` 20, `MIN`
3, `MAX` 3, `HUM` 3, `PREC` 4, `PROB` 4, `WIND` 9, `PRESS` 5, joined by a
two-space gap: 78 columns total. Cells are padded before they are colorized, so
ANSI sequences never affect alignment.

**Rounding is half-up on the decimal value, not on the binary double.**
`(1.44305).toFixed(4)` yields `1.4430` because the stored double is slightly
below the decimal literal. `roundHalfUp` shifts through exponential notation so
the rendered coordinate is `1.4431`, matching the documented sample output.

**The context line drops a leading department number.** The geocoder returns
`31, Haute-Garonne, Occitanie`; the first segment is redundant next to the
postcode already shown on the line above.

**The postcode is omitted from the first line when the label already contains
it.** Street-level results return labels such as
`8 Rue du Taur 31000 Toulouse`, which would otherwise print the postcode twice.

**HTTP helpers are duplicated across `geocoding.ts` and `weather.ts`.** The
repository layout has no shared HTTP module, and the brief asks for one
hand-written narrowing function per endpoint. Each module owns its timeout,
User-Agent header, status handling and error class; the duplication is a handful
of lines and keeps each endpoint independently readable.

**Tests are linted without type-aware rules.** `tsconfig.json` includes only
`src`, so type-aware ESLint rules have no program for `tests/`. Those files get
the non-type-checked config plus the no-comment rule; their correctness is
enforced by execution under Vitest.

**The executable bit is left to npm.** `dist/cli.js` carries the shebang and
`bin` points at it; npm sets the mode when the package is installed. No `chmod`
step is needed in `prepack`, which keeps the build working identically on
Windows.

**`version.ts` falls back to `0.0.0-development`** when `package.json` cannot be
read or carries no string `version`, so `--version` never throws.
