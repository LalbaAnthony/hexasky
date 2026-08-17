import type { WeatherCategory } from './domain.js';

export interface CliArguments {
  help: boolean;
  version: boolean;
  colorDisabled: boolean;
  query: string;
}

export type Styler = (text: string) => string;

export interface Theme {
  location: Styler;
  context: Styler;
  tableHeader: Styler;
  today: Styler;
  failure: Styler;
  condition: (category: WeatherCategory, text: string) => string;
  temperature: (celsius: number | null, text: string) => string;
  precipitation: (millimeters: number | null, text: string) => string;
  probability: (percent: number | null, text: string) => string;
  wind: (kilometersPerHour: number | null, text: string) => string;
}

export interface RenderOptions {
  colorEnabled: boolean;
  today: string;
}
