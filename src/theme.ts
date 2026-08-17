import pc from 'picocolors';
import type { Styler, Theme } from './types/cli.js';
import type { WeatherCategory } from './types/domain.js';

type Palette = ReturnType<typeof pc.createColors>;

const hotTemperature = 30;
const warmTemperature = 20;
const mildTemperature = 10;
const freezingTemperature = 0;
const highProbabilityPercent = 60;
const strongWindKmh = 60;
const briskWindKmh = 40;

const identity: Styler = (text) => text;

function categoryStyler(palette: Palette, category: WeatherCategory): Styler {
  const stylers: Record<WeatherCategory, Styler> = {
    clear: palette.yellow,
    cloud: identity,
    fog: palette.dim,
    rain: palette.blue,
    snow: palette.cyan,
    storm: palette.magenta,
  };
  return stylers[category];
}

function temperatureStyler(palette: Palette, celsius: number): Styler {
  if (celsius >= hotTemperature) {
    return palette.red;
  }
  if (celsius >= warmTemperature) {
    return palette.yellow;
  }
  if (celsius >= mildTemperature) {
    return palette.green;
  }
  if (celsius >= freezingTemperature) {
    return palette.cyan;
  }
  return palette.blue;
}

function windStyler(palette: Palette, kilometersPerHour: number): Styler {
  if (kilometersPerHour >= strongWindKmh) {
    return palette.red;
  }
  if (kilometersPerHour >= briskWindKmh) {
    return palette.yellow;
  }
  return identity;
}

export function isColorSupported(): boolean {
  return pc.isColorSupported;
}

export function createTheme(colorEnabled: boolean): Theme {
  const palette = pc.createColors(colorEnabled);

  return {
    location: palette.bold,
    context: palette.dim,
    tableHeader: palette.dim,
    today: palette.bold,
    failure: palette.red,
    condition: (category, text) => categoryStyler(palette, category)(text),
    temperature: (celsius, text) =>
      celsius === null ? text : temperatureStyler(palette, celsius)(text),
    precipitation: (millimeters, text) =>
      millimeters !== null && millimeters > 0
        ? palette.blue(text)
        : palette.dim(text),
    probability: (percent, text) =>
      percent !== null && percent >= highProbabilityPercent
        ? palette.yellow(text)
        : palette.dim(text),
    wind: (kilometersPerHour, text) =>
      kilometersPerHour === null
        ? text
        : windStyler(palette, kilometersPerHour)(text),
  };
}
