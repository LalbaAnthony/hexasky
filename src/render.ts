import { createTheme } from './theme.js';
import { toCompassDirection } from './weather-codes.js';
import type { RenderOptions, Theme } from './types/cli.js';
import type { DailyForecast, Forecast, Location } from './types/domain.js';

const missingValue = '-';
const columnGap = '  ';
const truncationMark = '.';
const coordinateDecimals = 4;
const precipitationDecimals = 1;

const dayWidth = 3;
const dateWidth = 6;
const conditionWidth = 20;
const temperatureWidth = 3;
const humidityWidth = 3;
const precipitationWidth = 4;
const probabilityWidth = 4;
const windDirectionWidth = 3;
const windSpeedWidth = 4;
const windWidth = 9;
const pressureWidth = 5;

const weekdayNames = [
  'Sun',
  'Mon',
  'Tue',
  'Wed',
  'Thu',
  'Fri',
  'Sat',
] as const;

const monthNames = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

const numericContextSegment = /^\d+[A-Za-z]?$/;

interface CalendarDate {
  year: number;
  month: number;
  day: number;
  weekday: number;
}

function parseIsoDate(date: string): CalendarDate | null {
  const [rawYear, rawMonth, rawDay] = date.split('-');
  if (rawYear === undefined || rawMonth === undefined || rawDay === undefined) {
    return null;
  }
  const year = Number(rawYear);
  const month = Number(rawMonth);
  const day = Number(rawDay.slice(0, 2));
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return { year, month, day, weekday };
}

function formatWeekday(date: string): string {
  const parsed = parseIsoDate(date);
  return parsed === null ? missingValue : (weekdayNames[parsed.weekday] ?? missingValue);
}

function formatDayAndMonth(date: string): string {
  const parsed = parseIsoDate(date);
  if (parsed === null) {
    return missingValue;
  }
  const month = monthNames[parsed.month - 1];
  if (month === undefined) {
    return missingValue;
  }
  return `${parsed.day.toString().padStart(2, '0')} ${month}`;
}

function roundHalfUp(value: number, decimals: number): number {
  const shifted = Number(`${value.toString()}e${decimals.toString()}`);
  if (!Number.isFinite(shifted)) {
    return value;
  }
  const rounded = Number(`${Math.round(shifted).toString()}e-${decimals.toString()}`);
  return Number.isFinite(rounded) ? rounded : value;
}

function formatInteger(value: number | null): string {
  return value === null ? missingValue : roundHalfUp(value, 0).toString();
}

function formatDecimal(value: number | null): string {
  return value === null
    ? missingValue
    : roundHalfUp(value, precipitationDecimals).toFixed(precipitationDecimals);
}

function withUnit(text: string, unit: string): string {
  return text === missingValue ? missingValue : `${text}${unit}`;
}

function truncate(text: string, width: number): string {
  if (text.length <= width) {
    return text;
  }
  return `${text.slice(0, width - truncationMark.length).trimEnd()}${truncationMark}`;
}

function formatContext(context: string | null): string | null {
  if (context === null) {
    return null;
  }
  const segments = context
    .split(',')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
  const [first, ...rest] = segments;
  if (first !== undefined && numericContextSegment.test(first) && rest.length > 0) {
    return rest.join(', ');
  }
  return segments.length > 0 ? segments.join(', ') : null;
}

function formatCoordinates(location: Location): string {
  const latitude = roundHalfUp(location.latitude, coordinateDecimals).toFixed(
    coordinateDecimals,
  );
  const longitude = roundHalfUp(location.longitude, coordinateDecimals).toFixed(
    coordinateDecimals,
  );
  return `${latitude}, ${longitude}`;
}

function formatWindCell(direction: number | null, speed: number | null): string {
  const compass = toCompassDirection(direction) ?? missingValue;
  return `${compass.padEnd(windDirectionWidth)}${formatInteger(speed).padStart(windSpeedWidth)}`;
}

function renderLocationLine(location: Location, theme: Theme): string {
  const postcode =
    location.postcode !== null && !location.label.includes(location.postcode)
      ? location.postcode
      : null;
  const parts = [location.label, postcode].filter(
    (part): part is string => part !== null && part.length > 0,
  );
  return theme.location(parts.join(', '));
}

function renderContextLine(
  location: Location,
  timezone: string,
  theme: Theme,
): string {
  const parts = [
    formatContext(location.context),
    formatCoordinates(location),
    timezone,
  ].filter((part): part is string => part !== null && part.length > 0);
  return theme.context(parts.join(' - '));
}

function renderCurrentLine(forecast: Forecast, theme: Theme): string {
  const current = forecast.current;
  const temperature = withUnit(formatInteger(current.temperature), '°C');
  const apparent = withUnit(
    formatInteger(current.apparentTemperature),
    '°C',
  );
  const compass = toCompassDirection(current.windDirection) ?? missingValue;

  return [
    'Now',
    theme.temperature(
      current.temperature,
      `${temperature} (feels ${apparent})`,
    ),
    theme.condition(current.weather.category, current.weather.label),
    withUnit(formatInteger(current.humidity), '%'),
    theme.precipitation(
      current.precipitation,
      withUnit(formatDecimal(current.precipitation), 'mm'),
    ),
    theme.wind(
      current.windSpeed,
      `${compass} ${withUnit(formatInteger(current.windSpeed), ' km/h')}`,
    ),
    withUnit(formatInteger(current.pressure), ' hPa'),
  ].join(columnGap);
}

function renderTableHeader(theme: Theme): readonly string[] {
  const titles = [
    'DAY'.padEnd(dayWidth),
    'DATE'.padEnd(dateWidth),
    'CONDITION'.padEnd(conditionWidth),
    'MIN'.padStart(temperatureWidth),
    'MAX'.padStart(temperatureWidth),
    'HUM'.padStart(humidityWidth),
    'PREC'.padStart(precipitationWidth),
    'PROB'.padStart(probabilityWidth),
    'WIND'.padEnd(windWidth),
    'PRESS'.padStart(pressureWidth),
  ].join(columnGap);

  const units = [
    ''.padEnd(dayWidth),
    ''.padEnd(dateWidth),
    ''.padEnd(conditionWidth),
    '°C'.padStart(temperatureWidth),
    '°C'.padStart(temperatureWidth),
    '%'.padStart(humidityWidth),
    'mm'.padStart(precipitationWidth),
    '%'.padStart(probabilityWidth),
    'km/h'.padStart(windWidth),
    'hPa'.padStart(pressureWidth),
  ].join(columnGap);

  return [theme.tableHeader(titles), theme.tableHeader(units)];
}

function renderDayRow(day: DailyForecast, isToday: boolean, theme: Theme): string {
  const row = [
    formatWeekday(day.date).padEnd(dayWidth),
    formatDayAndMonth(day.date).padEnd(dateWidth),
    theme.condition(
      day.weather.category,
      truncate(day.weather.label, conditionWidth).padEnd(conditionWidth),
    ),
    theme.temperature(
      day.temperatureMin,
      formatInteger(day.temperatureMin).padStart(temperatureWidth),
    ),
    theme.temperature(
      day.temperatureMax,
      formatInteger(day.temperatureMax).padStart(temperatureWidth),
    ),
    formatInteger(day.humidity).padStart(humidityWidth),
    theme.precipitation(
      day.precipitation,
      formatDecimal(day.precipitation).padStart(precipitationWidth),
    ),
    theme.probability(
      day.precipitationProbability,
      formatInteger(day.precipitationProbability).padStart(probabilityWidth),
    ),
    theme.wind(
      day.windSpeed,
      formatWindCell(day.windDirection, day.windSpeed).padEnd(windWidth),
    ),
    formatInteger(day.pressure).padStart(pressureWidth),
  ].join(columnGap);

  return isToday ? theme.today(row) : row;
}

export function currentDateInTimeZone(timeZone: string, instant: Date): string {
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  };
  try {
    return new Intl.DateTimeFormat('en-CA', { ...options, timeZone }).format(
      instant,
    );
  } catch {
    return new Intl.DateTimeFormat('en-CA', { ...options, timeZone: 'UTC' }).format(
      instant,
    );
  }
}

export function renderForecast(
  forecast: Forecast,
  options: RenderOptions,
): string {
  const theme = createTheme(options.colorEnabled);

  return [
    renderLocationLine(forecast.location, theme),
    renderContextLine(forecast.location, forecast.timezone, theme),
    '',
    renderCurrentLine(forecast, theme),
    '',
    ...renderTableHeader(theme),
    ...forecast.days.map((day) =>
      renderDayRow(day, day.date === options.today, theme),
    ),
  ].join('\n');
}
