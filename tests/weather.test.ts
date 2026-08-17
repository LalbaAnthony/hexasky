import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { fetchForecast } from '../src/weather.js';
import { WeatherError } from '../src/errors.js';
import type { Location } from '../src/types/domain.js';

interface FetchRecorder {
  urls: URL[];
}

const toulouse: Location = {
  latitude: 43.604462,
  longitude: 1.44305,
  label: 'Toulouse',
  city: 'Toulouse',
  postcode: '31000',
  context: '31, Haute-Garonne, Occitanie',
};

const forecastFixture: unknown = JSON.parse(
  readFileSync(
    new URL('./fixtures/forecast-toulouse.json', import.meta.url),
    'utf8',
  ),
);

function singleUrl(recorder: FetchRecorder): URL {
  const [url] = recorder.urls;
  if (url === undefined) {
    throw new Error('fetch was never called');
  }
  return url;
}

function stubFetch(payload: unknown, status = 200): FetchRecorder {
  const recorder: FetchRecorder = { urls: [] };
  vi.stubGlobal('fetch', (input: string | URL): Promise<Response> => {
    recorder.urls.push(input instanceof URL ? input : new URL(input));
    return Promise.resolve(
      new Response(JSON.stringify(payload), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
    );
  });
  return recorder;
}

describe('fetchForecast request', () => {
  it('issues exactly one call to Open-Meteo', async () => {
    const recorder = stubFetch(forecastFixture);

    await fetchForecast(toulouse);

    expect(recorder.urls).toHaveLength(1);
    const url = singleUrl(recorder);
    expect(url.origin).toBe('https://api.open-meteo.com');
    expect(url.pathname).toBe('/v1/forecast');
  });

  it('sends every required parameter with the exact expected value', async () => {
    const recorder = stubFetch(forecastFixture);

    await fetchForecast(toulouse);

    const parameters = singleUrl(recorder).searchParams;
    const expected: Record<string, string> = {
      latitude: '43.604462',
      longitude: '1.44305',
      current:
        'temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,surface_pressure,wind_speed_10m,wind_direction_10m',
      daily:
        'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_direction_10m_dominant',
      hourly: 'relative_humidity_2m,surface_pressure',
      forecast_days: '7',
      timezone: 'auto',
      temperature_unit: 'celsius',
      wind_speed_unit: 'kmh',
      precipitation_unit: 'mm',
    };

    for (const [name, value] of Object.entries(expected)) {
      expect(parameters.get(name)).toBe(value);
    }
    expect([...parameters.keys()].sort()).toEqual(Object.keys(expected).sort());
  });
});

describe('fetchForecast parsing', () => {
  it('maps the payload onto the domain forecast', async () => {
    stubFetch(forecastFixture);

    const forecast = await fetchForecast(toulouse);

    expect(forecast.timezone).toBe('Europe/Paris');
    expect(forecast.location).toEqual(toulouse);
    expect(forecast.days).toHaveLength(7);
    expect(forecast.current.temperature).toBe(18.3);
    expect(forecast.current.apparentTemperature).toBe(17.9);
    expect(forecast.current.humidity).toBe(62);
    expect(forecast.current.weather.label).toBe('Partly cloudy');
    expect(forecast.current.windDirection).toBe(268);
  });

  it('exposes the aggregated humidity and pressure on every day', async () => {
    stubFetch(forecastFixture);

    const forecast = await fetchForecast(toulouse);

    expect(forecast.days.map((day) => day.humidity)).toEqual([
      58, 71, 66, 54, 49, 63, 77,
    ]);
    expect(forecast.days.map((day) => day.pressure)).toEqual([
      1015, 1009, 1011, 1016, 1018, 1012, 1006,
    ]);
  });

  it('resolves the daily weather descriptors', async () => {
    stubFetch(forecastFixture);

    const forecast = await fetchForecast(toulouse);

    expect(forecast.days.map((day) => day.weather.label)).toEqual([
      'Partly cloudy',
      'Light rain',
      'Overcast',
      'Clear sky',
      'Mainly clear',
      'Light showers',
      'Thunderstorm',
    ]);
  });

  it('reports the rate limit with a dedicated message', async () => {
    stubFetch({}, 429);

    await expect(fetchForecast(toulouse)).rejects.toThrow(
      'rate limit reached, retry in a few seconds',
    );
  });

  it('carries the status code of a non-2xx response', async () => {
    stubFetch({}, 500);

    await expect(fetchForecast(toulouse)).rejects.toMatchObject({
      status: 500,
      exitCode: 1,
      message: 'forecast request failed with status 500',
    });
  });

  it('rejects a payload with mismatched series lengths', async () => {
    stubFetch({
      timezone: 'Europe/Paris',
      current: {},
      daily: {
        time: ['2026-08-17', '2026-08-18'],
        weather_code: [2],
        temperature_2m_max: [27],
        temperature_2m_min: [14],
        precipitation_sum: [0],
        precipitation_probability_max: [10],
        wind_speed_10m_max: [17],
        wind_direction_10m_dominant: [268],
      },
      hourly: { time: [], relative_humidity_2m: [], surface_pressure: [] },
    });

    await expect(fetchForecast(toulouse)).rejects.toThrow(WeatherError);
    await expect(fetchForecast(toulouse)).rejects.toThrow(
      'forecast response had an unexpected shape',
    );
  });

  it('wraps a transport failure into a WeatherError', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new Error('socket hang up')));

    await expect(fetchForecast(toulouse)).rejects.toThrow(WeatherError);
    await expect(fetchForecast(toulouse)).rejects.toThrow(
      'forecast request failed: socket hang up',
    );
  });
});
