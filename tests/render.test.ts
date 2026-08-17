import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { currentDateInTimeZone, renderForecast } from '../src/render.js';
import { describeWeatherCode, toCompassDirection } from '../src/weather-codes.js';
import { fetchForecast } from '../src/weather.js';
import type { Forecast, Location } from '../src/types/domain.js';

const escapeCharacter = '\u001B';
const headerLineCount = 7;
const dataRowCount = 7;

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

async function loadForecast(): Promise<Forecast> {
  vi.stubGlobal('fetch', () =>
    Promise.resolve(
      new Response(JSON.stringify(forecastFixture), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    ),
  );
  return fetchForecast(toulouse);
}

describe('renderForecast', () => {
  let forecast: Forecast;

  beforeEach(async () => {
    forecast = await loadForecast();
  });

  it('produces no ANSI escape sequence when color is disabled', () => {
    const output = renderForecast(forecast, {
      colorEnabled: false,
      today: '2026-08-17',
    });

    expect(output.includes(escapeCharacter)).toBe(false);
  });

  it('produces exactly seven data rows', () => {
    const lines = renderForecast(forecast, {
      colorEnabled: false,
      today: '2026-08-17',
    }).split('\n');

    expect(lines).toHaveLength(headerLineCount + dataRowCount);
    expect(lines.slice(headerLineCount)).toHaveLength(dataRowCount);
  });

  it('lays out the location, context and current lines', () => {
    const lines = renderForecast(forecast, {
      colorEnabled: false,
      today: '2026-08-17',
    }).split('\n');

    expect(lines[0]).toBe('Toulouse, 31000');
    expect(lines[1]).toBe(
      'Haute-Garonne, Occitanie - 43.6045, 1.4431 - Europe/Paris',
    );
    expect(lines[2]).toBe('');
    expect(lines[3]).toBe(
      'Now  18°C (feels 18°C)  Partly cloudy  62%  0.0mm  W 14 km/h  1014 hPa',
    );
    expect(lines[4]).toBe('');
  });

  it('lays out the two table header lines', () => {
    const lines = renderForecast(forecast, {
      colorEnabled: false,
      today: '2026-08-17',
    }).split('\n');

    expect(lines[5]).toBe(
      'DAY  DATE    CONDITION             MIN  MAX  HUM  PREC  PROB  WIND       PRESS',
    );
    expect(lines[6]).toBe(
      '                                    °C   °C    %    mm     %       km/h    hPa',
    );
  });

  it('renders the first data row with aligned columns', () => {
    const lines = renderForecast(forecast, {
      colorEnabled: false,
      today: '2026-08-18',
    }).split('\n');

    expect(lines[headerLineCount]).toBe(
      'Mon  17 Aug  Partly cloudy          14   27   58   0.0    10  W    18     1015',
    );
    expect(lines[headerLineCount + 1]).toBe(
      'Tue  18 Aug  Light rain             16   24   71   4.2    80  SW   26     1009',
    );
  });

  it('keeps every line under 88 columns', () => {
    const lines = renderForecast(forecast, {
      colorEnabled: false,
      today: '2026-08-17',
    }).split('\n');

    for (const line of lines) {
      expect(line.length).toBeLessThan(88);
    }
  });

  it('emits ANSI sequences only for the requested row when color is enabled', () => {
    const lines = renderForecast(forecast, {
      colorEnabled: true,
      today: '2026-08-17',
    }).split('\n');

    const todayRow = lines[headerLineCount] ?? '';
    const otherRow = lines[headerLineCount + 1] ?? '';

    expect(todayRow.startsWith(`${escapeCharacter}[1m`)).toBe(true);
    expect(otherRow.startsWith(`${escapeCharacter}[1m`)).toBe(false);
  });

  it('renders missing values as a dash', () => {
    const sparse: Forecast = {
      ...forecast,
      current: {
        ...forecast.current,
        temperature: null,
        windSpeed: null,
        windDirection: null,
      },
      days: forecast.days.map((day) => ({
        ...day,
        humidity: null,
        pressure: null,
      })),
    };

    const lines = renderForecast(sparse, {
      colorEnabled: false,
      today: '2026-08-17',
    }).split('\n');

    expect(lines[3]).toContain('Now  - (feels 18°C)');
    expect(lines[headerLineCount]).toBe(
      'Mon  17 Aug  Partly cloudy          14   27    -   0.0    10  W    18        -',
    );
  });

  it('truncates a long condition label with a period', () => {
    const stormy: Forecast = {
      ...forecast,
      days: forecast.days.map((day) => ({
        ...day,
        weather: describeWeatherCode(96),
      })),
    };

    const lines = renderForecast(stormy, {
      colorEnabled: false,
      today: '2026-08-17',
    }).split('\n');

    expect(lines[headerLineCount]).toContain('Thunderstorm, light.');
  });
});

describe('currentDateInTimeZone', () => {
  it('formats the instant as an ISO date in the given zone', () => {
    const instant = new Date('2026-08-17T23:30:00Z');

    expect(currentDateInTimeZone('Europe/Paris', instant)).toBe('2026-08-18');
    expect(currentDateInTimeZone('UTC', instant)).toBe('2026-08-17');
  });

  it('falls back to UTC for an unusable zone', () => {
    const instant = new Date('2026-08-17T23:30:00Z');

    expect(currentDateInTimeZone('Not/AZone', instant)).toBe('2026-08-17');
  });
});

describe('describeWeatherCode', () => {
  it('maps every documented code to its label and category', () => {
    expect(describeWeatherCode(0)).toEqual({
      label: 'Clear sky',
      category: 'clear',
    });
    expect(describeWeatherCode(3)).toEqual({
      label: 'Overcast',
      category: 'cloud',
    });
    expect(describeWeatherCode(48)).toEqual({
      label: 'Rime fog',
      category: 'fog',
    });
    expect(describeWeatherCode(65)).toEqual({
      label: 'Heavy rain',
      category: 'rain',
    });
    expect(describeWeatherCode(66)).toEqual({
      label: 'Light freezing rain',
      category: 'snow',
    });
    expect(describeWeatherCode(99)).toEqual({
      label: 'Thunderstorm, heavy hail',
      category: 'storm',
    });
  });

  it('maps an unknown code to Unknown in the cloud category', () => {
    expect(describeWeatherCode(4)).toEqual({
      label: 'Unknown',
      category: 'cloud',
    });
    expect(describeWeatherCode(1000)).toEqual({
      label: 'Unknown',
      category: 'cloud',
    });
    expect(describeWeatherCode(null)).toEqual({
      label: 'Unknown',
      category: 'cloud',
    });
  });
});

describe('toCompassDirection', () => {
  it('converts degrees to a 16-point abbreviation', () => {
    expect(toCompassDirection(0)).toBe('N');
    expect(toCompassDirection(22.5)).toBe('NNE');
    expect(toCompassDirection(90)).toBe('E');
    expect(toCompassDirection(214)).toBe('SW');
    expect(toCompassDirection(268)).toBe('W');
    expect(toCompassDirection(350)).toBe('N');
    expect(toCompassDirection(360)).toBe('N');
  });

  it('normalizes out-of-range and missing values', () => {
    expect(toCompassDirection(-90)).toBe('W');
    expect(toCompassDirection(450)).toBe('E');
    expect(toCompassDirection(null)).toBeNull();
    expect(toCompassDirection(Number.NaN)).toBeNull();
  });
});
