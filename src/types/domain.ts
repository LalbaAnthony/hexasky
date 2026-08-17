export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface Location extends Coordinates {
  label: string;
  city: string | null;
  postcode: string | null;
  context: string | null;
}

export type WeatherCategory =
  | 'clear'
  | 'cloud'
  | 'fog'
  | 'rain'
  | 'snow'
  | 'storm';

export interface WeatherDescriptor {
  label: string;
  category: WeatherCategory;
}

export interface CurrentConditions {
  temperature: number | null;
  apparentTemperature: number | null;
  humidity: number | null;
  precipitation: number | null;
  weather: WeatherDescriptor;
  pressure: number | null;
  windSpeed: number | null;
  windDirection: number | null;
}

export interface DailyForecast {
  date: string;
  weather: WeatherDescriptor;
  temperatureMin: number | null;
  temperatureMax: number | null;
  humidity: number | null;
  precipitation: number | null;
  precipitationProbability: number | null;
  windSpeed: number | null;
  windDirection: number | null;
  pressure: number | null;
}

export interface Forecast {
  location: Location;
  timezone: string;
  current: CurrentConditions;
  days: readonly DailyForecast[];
}
