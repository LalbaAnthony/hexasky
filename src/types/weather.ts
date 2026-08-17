export type NumericSeries = readonly (number | null)[];

export interface RawCurrentBlock {
  temperature_2m: number | null;
  apparent_temperature: number | null;
  relative_humidity_2m: number | null;
  precipitation: number | null;
  weather_code: number | null;
  surface_pressure: number | null;
  wind_speed_10m: number | null;
  wind_direction_10m: number | null;
}

export interface RawDailyBlock {
  time: readonly string[];
  weather_code: NumericSeries;
  temperature_2m_max: NumericSeries;
  temperature_2m_min: NumericSeries;
  precipitation_sum: NumericSeries;
  precipitation_probability_max: NumericSeries;
  wind_speed_10m_max: NumericSeries;
  wind_direction_10m_dominant: NumericSeries;
}

export interface RawHourlyBlock {
  time: readonly string[];
  relative_humidity_2m: NumericSeries;
  surface_pressure: NumericSeries;
}

export interface RawForecastResponse {
  timezone: string;
  current: RawCurrentBlock;
  daily: RawDailyBlock;
  hourly: RawHourlyBlock;
}

export interface DailyAggregates {
  humidity: NumericSeries;
  pressure: NumericSeries;
}
