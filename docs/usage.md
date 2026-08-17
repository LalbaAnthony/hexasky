# Usage

## Command

```
hexasky <address>
```

Every positional argument is joined with a single space, so all three forms are
equivalent:

```sh
npx @lalba-anthony/hexasky Toulouse
npx @lalba-anthony/hexasky "8 rue du Taur, Toulouse"
npx @lalba-anthony/hexasky 8 rue du Taur Toulouse
```

Coverage is limited to metropolitan and overseas France. Addresses are resolved
against the French national address base (Base Adresse Nationale) served by the
Geoplateforme, which holds no data outside French territory.

## Flags

| Flag              | Effect                                               |
| ----------------- | ---------------------------------------------------- |
| `-h`, `--help`    | Print usage to stdout and exit 0                     |
| `-v`, `--version` | Print the package version to stdout and exit 0       |
| `--no-color`      | Disable ANSI output regardless of terminal detection |

Flags may appear anywhere in the argument list; the remaining positionals are
still joined in order. To pass an address that begins with `-`, place it after
`--`:

```sh
hexasky -- "--odd-place-name"
```

## Exit codes

| Code | Condition                                                                           |
| ---- | ----------------------------------------------------------------------------------- |
| 0    | Success, or `--help` / `--version`                                                  |
| 1    | Network error, timeout, non-2xx response, malformed payload, or no geocoding result |
| 2    | Usage error: no positional argument, or an unknown flag                             |

Errors are written to stderr as a single line, `hexasky: <message>`, in red when
color is enabled. A usage error additionally prints the help block to stderr.
No stack trace is shown unless `HEXASKY_DEBUG=1` is set.

## Environment variables

| Variable        | Effect                                                                |
| --------------- | --------------------------------------------------------------------- |
| `NO_COLOR`      | Any non-empty value disables ANSI output (honored by picocolors)      |
| `FORCE_COLOR`   | Any non-empty value enables ANSI output even when stdout is not a TTY |
| `HEXASKY_DEBUG` | Set to `1` to print the error stack after the error line              |

`--no-color` overrides `FORCE_COLOR`: the flag forces plain output
unconditionally.

## Output

```
Toulouse, 31000
Haute-Garonne, Occitanie - 43.6045, 1.4431 - Europe/Paris

Now  18°C (feels 18°C)  Partly cloudy  62%  0.0mm  W 14 km/h  1014 hPa

DAY  DATE    CONDITION             MIN  MAX  HUM  PREC  PROB  WIND       PRESS
                                    °C   °C    %    mm     %       km/h    hPa
Mon  17 Aug  Partly cloudy          14   27   58   0.0    10  W    18     1015
Tue  18 Aug  Light rain             16   24   71   4.2    80  SW   26     1009
```

- `HUM` is the mean of the day's hourly relative humidity samples.
- `PRESS` is the mean of the day's hourly surface pressure samples.
- `PREC` is the daily precipitation total; `PROB` is the daily maximum
  precipitation probability.
- `WIND` shows the dominant direction as a 16-point compass abbreviation and the
  maximum wind speed.
- Today's row is bold. Missing values render as `-`.

The table is 78 columns wide.

## Programmatic usage

The package also ships as a library. `dist/index.js` is the ESM entry point and
`dist/index.d.ts` carries the declarations.

```ts
import {
  currentDateInTimeZone,
  fetchForecast,
  geocode,
  renderForecast,
} from '@lalba-anthony/hexasky';

const location = await geocode('Toulouse');
const forecast = await fetchForecast(location);
const today = currentDateInTimeZone(forecast.timezone, new Date());

console.log(renderForecast(forecast, { colorEnabled: false, today }));

for (const day of forecast.days) {
  console.log(day.date, day.temperatureMax, day.weather.label);
}
```

Errors are instances of `HexaskyError` and carry an `exitCode`:

```ts
import { GeocodingError, geocode } from '@lalba-anthony/hexasky';

try {
  await geocode('zzzzzzzz');
} catch (error) {
  if (error instanceof GeocodingError) {
    console.error(error.message, error.status, error.exitCode);
  }
}
```

Other exported members: `parseCliArguments`, `describeWeatherCode`,
`toCompassDirection`, `createTheme`, `isColorSupported`, `aggregateHourlyBlock`,
`meansByDate`, `roundedMeansForDates`, `packageVersion`, and every type under
`src/types/`.
