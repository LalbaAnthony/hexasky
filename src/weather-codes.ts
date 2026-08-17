import type { WeatherDescriptor } from './types/domain.js';

const unknownWeather: WeatherDescriptor = { label: 'Unknown', category: 'cloud' };

const weatherCodeDescriptors = new Map<number, WeatherDescriptor>([
  [0, { label: 'Clear sky', category: 'clear' }],
  [1, { label: 'Mainly clear', category: 'clear' }],
  [2, { label: 'Partly cloudy', category: 'cloud' }],
  [3, { label: 'Overcast', category: 'cloud' }],
  [45, { label: 'Fog', category: 'fog' }],
  [48, { label: 'Rime fog', category: 'fog' }],
  [51, { label: 'Light drizzle', category: 'rain' }],
  [53, { label: 'Drizzle', category: 'rain' }],
  [55, { label: 'Dense drizzle', category: 'rain' }],
  [56, { label: 'Light freezing drizzle', category: 'snow' }],
  [57, { label: 'Freezing drizzle', category: 'snow' }],
  [61, { label: 'Light rain', category: 'rain' }],
  [63, { label: 'Rain', category: 'rain' }],
  [65, { label: 'Heavy rain', category: 'rain' }],
  [66, { label: 'Light freezing rain', category: 'snow' }],
  [67, { label: 'Freezing rain', category: 'snow' }],
  [71, { label: 'Light snow', category: 'snow' }],
  [73, { label: 'Snow', category: 'snow' }],
  [75, { label: 'Heavy snow', category: 'snow' }],
  [77, { label: 'Snow grains', category: 'snow' }],
  [80, { label: 'Light showers', category: 'rain' }],
  [81, { label: 'Showers', category: 'rain' }],
  [82, { label: 'Violent showers', category: 'rain' }],
  [85, { label: 'Light snow showers', category: 'snow' }],
  [86, { label: 'Snow showers', category: 'snow' }],
  [95, { label: 'Thunderstorm', category: 'storm' }],
  [96, { label: 'Thunderstorm, light hail', category: 'storm' }],
  [99, { label: 'Thunderstorm, heavy hail', category: 'storm' }],
]);

const compassPoints = [
  'N',
  'NNE',
  'NE',
  'ENE',
  'E',
  'ESE',
  'SE',
  'SSE',
  'S',
  'SSW',
  'SW',
  'WSW',
  'W',
  'WNW',
  'NW',
  'NNW',
] as const;

const degreesPerCompassPoint = 360 / compassPoints.length;

export function describeWeatherCode(code: number | null): WeatherDescriptor {
  if (code === null) {
    return unknownWeather;
  }
  return weatherCodeDescriptors.get(code) ?? unknownWeather;
}

export function toCompassDirection(degrees: number | null): string | null {
  if (degrees === null || !Number.isFinite(degrees)) {
    return null;
  }
  const normalizedDegrees = ((degrees % 360) + 360) % 360;
  const index =
    Math.round(normalizedDegrees / degreesPerCompassPoint) %
    compassPoints.length;
  return compassPoints[index] ?? null;
}
