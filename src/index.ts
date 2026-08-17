import { parseArgs } from 'node:util';
import { UsageError } from './errors.js';
import type { CliArguments } from './types/cli.js';

export { geocode } from './geocoding.js';
export { fetchForecast } from './weather.js';
export { renderForecast, currentDateInTimeZone } from './render.js';
export { aggregateHourlyBlock, meansByDate, roundedMeansForDates } from './aggregate.js';
export { describeWeatherCode, toCompassDirection } from './weather-codes.js';
export { createTheme, isColorSupported } from './theme.js';
export {
  HexaskyError,
  UsageError,
  GeocodingError,
  WeatherError,
} from './errors.js';
export { packageVersion } from './version.js';
export type * from './types/index.js';

const cliOptions = {
  help: { type: 'boolean', short: 'h', default: false },
  version: { type: 'boolean', short: 'v', default: false },
  'no-color': { type: 'boolean', default: false },
} as const;

const sentenceSeparator = '. ';

function firstSentence(text: string): string {
  const line = text.split('\n')[0] ?? text;
  const separatorIndex = line.indexOf(sentenceSeparator);
  return separatorIndex === -1
    ? line
    : line.slice(0, separatorIndex + sentenceSeparator.length - 1);
}

export function parseCliArguments(argv: readonly string[]): CliArguments {
  let values: Record<string, boolean | undefined>;
  let positionals: readonly string[];

  try {
    const parsed = parseArgs({
      args: [...argv],
      options: cliOptions,
      allowPositionals: true,
      strict: true,
    });
    values = parsed.values;
    positionals = parsed.positionals;
  } catch (cause) {
    throw new UsageError(
      cause instanceof Error
        ? firstSentence(cause.message)
        : 'invalid arguments',
    );
  }

  const help = values.help === true;
  const version = values.version === true;
  const query = positionals.join(' ').trim();

  if (!help && !version && query.length === 0) {
    throw new UsageError('missing address argument');
  }

  return {
    help,
    version,
    colorDisabled: values['no-color'] === true,
    query,
  };
}
