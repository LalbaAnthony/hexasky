export class HexaskyError extends Error {
  readonly exitCode: number;

  constructor(message: string, exitCode: number) {
    super(message);
    this.name = 'HexaskyError';
    this.exitCode = exitCode;
  }
}

export class UsageError extends HexaskyError {
  constructor(message: string) {
    super(message, 2);
    this.name = 'UsageError';
  }
}

export class GeocodingError extends HexaskyError {
  readonly status: number | null;

  constructor(message: string, status: number | null = null) {
    super(message, 1);
    this.name = 'GeocodingError';
    this.status = status;
  }
}

export class WeatherError extends HexaskyError {
  readonly status: number | null;

  constructor(message: string, status: number | null = null) {
    super(message, 1);
    this.name = 'WeatherError';
    this.status = status;
  }
}
