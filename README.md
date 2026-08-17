# hexasky

[![npm](https://img.shields.io/npm/v/@lalba-anthony/hexasky.svg)](https://www.npmjs.com/package/@lalba-anthony/hexasky)

Print the French weather forecast from your terminal.

## Usage

```sh
npx @lalba-anthony/hexasky Toulouse
npx @lalba-anthony/hexasky "8 rue du Taur, Toulouse"
npx @lalba-anthony/hexasky 8 rue du Taur Toulouse
```

```
Toulouse, 31000
Haute-Garonne, Occitanie - 43.6045, 1.4431 - Europe/Paris

Now  18°C (feels 18°C)  Partly cloudy  62%  0.0mm  W 14 km/h  1014 hPa

DAY  DATE    CONDITION             MIN  MAX  HUM  PREC  PROB  WIND       PRESS
                                    °C   °C    %    mm     %       km/h    hPa
Mon  17 Aug  Partly cloudy          14   27   58   0.0    10  W    18     1015
Tue  18 Aug  Light rain             16   24   71   4.2    80  SW   26     1009
Wed  19 Aug  Overcast               15   26   66   0.6    35  WNW  19     1011
Thu  20 Aug  Clear sky              18   31   54   0.0     0  SSE  12     1016
Fri  21 Aug  Mainly clear           20   33   49   0.0     5  NNE  16     1018
Sat  22 Aug  Light showers          16   27   63   3.1    65  NW   41     1012
Sun  23 Aug  Thunderstorm           13   21   77  12.4    90  WSW  63     1006
```

Flags: `-h, --help`, `-v, --version`, `--no-color`.

## France only

Addresses are resolved against the French national address base, so coverage is
limited to metropolitan and overseas France.

## Documentation

- [Usage](docs/usage.md) -- flags, exit codes, environment variables, library API
- [Architecture](docs/architecture.md) -- module graph and design decisions
- [External APIs](docs/external-apis.md) -- Geoplateforme and Open-Meteo contracts
- [Contributing](docs/contributing.md) -- branching, commits, project rules
- [Git](docs/git.md) -- how to use Git with this project
- [Release](docs/release.md) -- how publication is automated

## License

MIT
