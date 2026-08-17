import { aggregateHourlyBlock } from './aggregate.js';
import { WeatherError } from './errors.js';
import { userAgent } from './version.js';
import { describeWeatherCode } from './weather-codes.js';
import type {
  DailyForecast,
  Forecast,
  Location,
} from './types/domain.js';
import type {
  NumericSeries,
  RawCurrentBlock,
  RawDailyBlock,
  RawForecastResponse,
  RawHourlyBlock,
} from './types/weather.js';

const forecastEndpoint = 'https://api.open-meteo.com/v1/forecast';
const requestTimeoutMs = 10_000;
const requestTimeoutSeconds = requestTimeoutMs / 1000;
const rateLimitStatus = 429;
const forecastDays = 7;

const currentFields = [
  'temperature_2m',
  'apparent_temperature',
  'relative_humidity_2m',
  'precipitation',
  'weather_code',
  'surface_pressure',
  'wind_speed_10m',
  'wind_direction_10m',
] as const;

const dailyFields = [
  'weather_code',
  'temperature_2m_max',
  'temperature_2m_min',
  'precipitation_sum',
  'precipitation_probability_max',
  'wind_speed_10m_max',
  'wind_direction_10m_dominant',
] as const;

const hourlyFields = ['relative_humidity_2m', 'surface_pressure'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toArray(value: unknown): readonly unknown[] | null {
  return Array.isArray(value) ? (value as readonly unknown[]) : null;
}

function toFiniteNumberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function toNumericSeries(value: unknown, length: number): NumericSeries | null {
  const items = toArray(value);
  if (items?.length !== length) {
    return null;
  }
  return items.map(toFiniteNumberOrNull);
}

function toStringSeries(value: unknown): readonly string[] | null {
  const items = toArray(value);
  if (items === null) {
    return null;
  }
  const timestamps: string[] = [];
  for (const item of items) {
    if (typeof item !== 'string') {
      return null;
    }
    timestamps.push(item);
  }
  return timestamps;
}

function narrowCurrentBlock(value: unknown): RawCurrentBlock | null {
  if (!isRecord(value)) {
    return null;
  }
  return {
    temperature_2m: toFiniteNumberOrNull(value.temperature_2m),
    apparent_temperature: toFiniteNumberOrNull(value.apparent_temperature),
    relative_humidity_2m: toFiniteNumberOrNull(value.relative_humidity_2m),
    precipitation: toFiniteNumberOrNull(value.precipitation),
    weather_code: toFiniteNumberOrNull(value.weather_code),
    surface_pressure: toFiniteNumberOrNull(value.surface_pressure),
    wind_speed_10m: toFiniteNumberOrNull(value.wind_speed_10m),
    wind_direction_10m: toFiniteNumberOrNull(value.wind_direction_10m),
  };
}

function narrowDailyBlock(value: unknown): RawDailyBlock | null {
  if (!isRecord(value)) {
    return null;
  }
  const time = toStringSeries(value.time);
  if (time === null || time.length === 0) {
    return null;
  }
  const series = new Map<string, NumericSeries>();
  for (const field of dailyFields) {
    const parsed = toNumericSeries(value[field], time.length);
    if (parsed === null) {
      return null;
    }
    series.set(field, parsed);
  }
  const weatherCode = series.get('weather_code');
  const temperatureMax = series.get('temperature_2m_max');
  const temperatureMin = series.get('temperature_2m_min');
  const precipitationSum = series.get('precipitation_sum');
  const precipitationProbability = series.get('precipitation_probability_max');
  const windSpeedMax = series.get('wind_speed_10m_max');
  const windDirection = series.get('wind_direction_10m_dominant');
  if (
    weatherCode === undefined ||
    temperatureMax === undefined ||
    temperatureMin === undefined ||
    precipitationSum === undefined ||
    precipitationProbability === undefined ||
    windSpeedMax === undefined ||
    windDirection === undefined
  ) {
    return null;
  }
  return {
    time,
    weather_code: weatherCode,
    temperature_2m_max: temperatureMax,
    temperature_2m_min: temperatureMin,
    precipitation_sum: precipitationSum,
    precipitation_probability_max: precipitationProbability,
    wind_speed_10m_max: windSpeedMax,
    wind_direction_10m_dominant: windDirection,
  };
}

function narrowHourlyBlock(value: unknown): RawHourlyBlock | null {
  if (!isRecord(value)) {
    return null;
  }
  const time = toStringSeries(value.time);
  if (time === null) {
    return null;
  }
  const humidity = toNumericSeries(value[hourlyFields[0]], time.length);
  const pressure = toNumericSeries(value[hourlyFields[1]], time.length);
  if (humidity === null || pressure === null) {
    return null;
  }
  return {
    time,
    relative_humidity_2m: humidity,
    surface_pressure: pressure,
  };
}

export function narrowForecastResponse(
  payload: unknown,
): RawForecastResponse | null {
  if (!isRecord(payload)) {
    return null;
  }
  const timezone = payload.timezone;
  if (typeof timezone !== 'string') {
    return null;
  }
  const current = narrowCurrentBlock(payload.current);
  const daily = narrowDailyBlock(payload.daily);
  const hourly = narrowHourlyBlock(payload.hourly);
  if (current === null || daily === null || hourly === null) {
    return null;
  }
  return { timezone, current, daily, hourly };
}

function describeTransportFailure(cause: unknown): string {
  if (cause instanceof Error && cause.name === 'TimeoutError') {
    return `forecast request timed out after ${String(requestTimeoutSeconds)}s`;
  }
  const detail = cause instanceof Error ? cause.message : 'unknown transport error';
  return `forecast request failed: ${detail}`;
}

async function requestForecastPayload(url: URL): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { 'User-Agent': userAgent },
      signal: AbortSignal.timeout(requestTimeoutMs),
    });
  } catch (cause) {
    throw new WeatherError(describeTransportFailure(cause));
  }

  if (response.status === rateLimitStatus) {
    throw new WeatherError(
      'rate limit reached, retry in a few seconds',
      rateLimitStatus,
    );
  }
  if (!response.ok) {
    throw new WeatherError(
      `forecast request failed with status ${String(response.status)}`,
      response.status,
    );
  }

  try {
    return await response.json();
  } catch {
    throw new WeatherError('forecast response was not valid JSON');
  }
}

export function buildForecastUrl(location: Location): URL {
  const url = new URL(forecastEndpoint);
  url.search = new URLSearchParams({
    latitude: location.latitude.toString(),
    longitude: location.longitude.toString(),
    current: currentFields.join(','),
    daily: dailyFields.join(','),
    hourly: hourlyFields.join(','),
    forecast_days: forecastDays.toString(),
    timezone: 'auto',
    temperature_unit: 'celsius',
    wind_speed_unit: 'kmh',
    precipitation_unit: 'mm',
  }).toString();
  return url;
}

function toDailyForecasts(daily: RawDailyBlock, hourly: RawHourlyBlock): DailyForecast[] {
  const aggregates = aggregateHourlyBlock(daily.time, hourly);
  return daily.time.map((date, index) => ({
    date,
    weather: describeWeatherCode(daily.weather_code[index] ?? null),
    temperatureMin: daily.temperature_2m_min[index] ?? null,
    temperatureMax: daily.temperature_2m_max[index] ?? null,
    humidity: aggregates.humidity[index] ?? null,
    precipitation: daily.precipitation_sum[index] ?? null,
    precipitationProbability: daily.precipitation_probability_max[index] ?? null,
    windSpeed: daily.wind_speed_10m_max[index] ?? null,
    windDirection: daily.wind_direction_10m_dominant[index] ?? null,
    pressure: aggregates.pressure[index] ?? null,
  }));
}

export function toForecast(
  location: Location,
  raw: RawForecastResponse,
): Forecast {
  return {
    location,
    timezone: raw.timezone,
    current: {
      temperature: raw.current.temperature_2m,
      apparentTemperature: raw.current.apparent_temperature,
      humidity: raw.current.relative_humidity_2m,
      precipitation: raw.current.precipitation,
      weather: describeWeatherCode(raw.current.weather_code),
      pressure: raw.current.surface_pressure,
      windSpeed: raw.current.wind_speed_10m,
      windDirection: raw.current.wind_direction_10m,
    },
    days: toDailyForecasts(raw.daily, raw.hourly),
  };
}

export async function fetchForecast(location: Location): Promise<Forecast> {
  const payload = await requestForecastPayload(buildForecastUrl(location));
  const raw = narrowForecastResponse(payload);
  if (raw === null) {
    throw new WeatherError('forecast response had an unexpected shape');
  }
  return toForecast(location, raw);
}
