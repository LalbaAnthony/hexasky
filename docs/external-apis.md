# External APIs

A single CLI run performs exactly two requests: one geocoding call, then one
forecast call. No retries, no caching, no throttling.

Both requests share the same transport rules:

- `AbortSignal.timeout(10_000)`.
- Header `User-Agent: hexasky/<version>`, built in `src/version.ts`.
- HTTP 429 raises the message `rate limit reached, retry in a few seconds`.
- Any other non-2xx status raises a domain error carrying `status`.
- The JSON body is validated by a hand-written narrowing function before any
  property is read.

## 1. Geocoding -- Geoplateforme (IGN)

```
GET https://data.geopf.fr/geocodage/search
```

### Legacy host

`api-adresse.data.gouv.fr` was decommissioned in January 2026. It must not be
used. The Geoplateforme endpoint is the replacement and serves the same Base
Adresse Nationale data with the same GeoJSON response shape.

### Parameters

| Parameter | Value              | Notes                                   |
| --------- | ------------------ | --------------------------------------- |
| `q`       | the joined address | URL-encoded by `URLSearchParams`        |
| `limit`   | `1`                | only the best match is used             |
| `index`   | `address`          | address index rather than parcel or POI |

### Rate limit

50 requests per second per IP. A CLI run makes one call, so no client-side
throttling is implemented.

### Sample response

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [1.44305, 43.604462] },
      "properties": {
        "label": "Toulouse",
        "score": 0.87,
        "city": "Toulouse",
        "postcode": "31000",
        "context": "31, Haute-Garonne, Occitanie",
        "type": "municipality"
      }
    }
  ]
}
```

### The coordinate-order trap

`geometry.coordinates` is `[longitude, latitude]`, in GeoJSON order. It is not
`[latitude, longitude]`. Swapping the pair sends Toulouse (43.60 N, 1.44 E) to
a point off the coast of Somalia, and the forecast call still succeeds, so the
mistake is silent.

`src/geocoding.ts` reads index `0` as longitude and index `1` as latitude, and
`tests/geocoding.test.ts` carries a dedicated regression test for it.

### Consumed properties

Only `label`, `city`, `postcode` and `context` are read, and all four are
treated as optional: a missing or non-string value becomes `null`. When `label`
is absent, `city` is used; when both are absent, the original query is shown.

### Empty results

`features` may legitimately be an empty array for a query that matches nothing.
That is not an error response -- the status is still 200. It raises
`GeocodingError` with the message `no location found for "<query>"` and exit
code 1.

## 2. Forecast -- Open-Meteo

```
GET https://api.open-meteo.com/v1/forecast
```

### Parameters

| Parameter            | Value                                                                                                                                               |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `latitude`           | from geocoding                                                                                                                                      |
| `longitude`          | from geocoding                                                                                                                                      |
| `current`            | `temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,surface_pressure,wind_speed_10m,wind_direction_10m`            |
| `daily`              | `weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_direction_10m_dominant` |
| `hourly`             | `relative_humidity_2m,surface_pressure`                                                                                                             |
| `forecast_days`      | `7`                                                                                                                                                 |
| `timezone`           | `auto`                                                                                                                                              |
| `temperature_unit`   | `celsius`                                                                                                                                           |
| `wind_speed_unit`    | `kmh`                                                                                                                                               |
| `precipitation_unit` | `mm`                                                                                                                                                |

The query string is built with `URLSearchParams`; URLs are never concatenated by
hand. `tests/weather.test.ts` asserts the exact value of every parameter and
that no extra parameter is sent.

### Why `hourly` is requested

Open-Meteo has no `daily` aggregate for relative humidity or surface pressure.
Both are requested as hourly series and averaged client-side in
`src/aggregate.ts`, grouped by the `YYYY-MM-DD` prefix of each `hourly.time[i]`
entry.

`timezone=auto` makes those timestamps local to the resolved coordinates, so
grouping is a string slice rather than timezone arithmetic. Humidity is rounded
to the nearest integer percent, pressure to the nearest integer hectopascal, and
a day with no matching hourly samples yields `null`, rendered as `-`.

### Sample response

Trimmed to one hour and two days; the real payload carries 168 hourly entries and
7 daily entries.

```json
{
  "latitude": 43.6,
  "longitude": 1.4375,
  "utc_offset_seconds": 7200,
  "timezone": "Europe/Paris",
  "timezone_abbreviation": "GMT+2",
  "current": {
    "time": "2026-08-17T14:00",
    "temperature_2m": 18.3,
    "apparent_temperature": 17.9,
    "relative_humidity_2m": 62,
    "precipitation": 0,
    "weather_code": 2,
    "surface_pressure": 1013.6,
    "wind_speed_10m": 13.7,
    "wind_direction_10m": 268
  },
  "hourly": {
    "time": ["2026-08-17T00:00"],
    "relative_humidity_2m": [58],
    "surface_pressure": [1015.0]
  },
  "daily": {
    "time": ["2026-08-17", "2026-08-18"],
    "weather_code": [2, 61],
    "temperature_2m_max": [27.4, 24.1],
    "temperature_2m_min": [14.2, 16.3],
    "precipitation_sum": [0.0, 4.2],
    "precipitation_probability_max": [10, 80],
    "wind_speed_10m_max": [17.6, 25.9],
    "wind_direction_10m_dominant": [268, 214]
  }
}
```

The full fixture used by the test suite is
`tests/fixtures/forecast-toulouse.json`.

### Validation rules

- `timezone` must be a string.
- `current` must be an object; each field is coerced to `number | null`.
- `daily.time` must be a non-empty array of strings.
- Every `daily` series must have exactly the same length as `daily.time`; a
  mismatch rejects the payload rather than shifting a column by one day.
- `hourly.time` and both hourly series must have matching lengths.

Any failure raises `WeatherError` with the message
`forecast response had an unexpected shape`.

### Rate limit

Open-Meteo's free tier allows non-commercial use without an API key, with daily
and hourly call ceilings well above what one CLI invocation consumes. Exceeding
them returns HTTP 429, which is surfaced as
`rate limit reached, retry in a few seconds`.

### WMO weather codes

`daily.weather_code` and `current.weather_code` are WMO 4677 codes. The mapping
to English labels and severity categories lives in `src/weather-codes.ts`. Codes
outside the documented set render as `Unknown` in the `cloud` category rather
than failing.
