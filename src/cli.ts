#!/usr/bin/env node
import { HexaskyError, UsageError } from './errors.js';
import { geocode } from './geocoding.js';
import { parseCliArguments } from './index.js';
import { currentDateInTimeZone, renderForecast } from './render.js';
import { createTheme, isColorSupported } from './theme.js';
import { packageVersion } from './version.js';
import { fetchForecast } from './weather.js';

const usage = `Usage:
  hexasky <address>

Options:
  -h, --help      Show this help and exit
  -v, --version   Show the version and exit
      --no-color  Disable colored output

Example:
  hexasky "8 rue du Taur, Toulouse"

Coverage is limited to metropolitan and overseas France: addresses are resolved
against the French national address base.`;

const noColorFlag = '--no-color';
const unexpectedFailureExitCode = 1;

function resolveColorEnabled(colorDisabled: boolean): boolean {
  return !colorDisabled && isColorSupported();
}

function writeLine(stream: NodeJS.WriteStream, text: string): void {
  stream.write(`${text}\n`);
}

async function run(argv: readonly string[]): Promise<void> {
  const args = parseCliArguments(argv);

  if (args.help) {
    writeLine(process.stdout, usage);
    return;
  }

  if (args.version) {
    writeLine(process.stdout, packageVersion);
    return;
  }

  const location = await geocode(args.query);
  const forecast = await fetchForecast(location);
  const today = currentDateInTimeZone(forecast.timezone, new Date());

  writeLine(
    process.stdout,
    renderForecast(forecast, {
      colorEnabled: resolveColorEnabled(args.colorDisabled),
      today,
    }),
  );
}

try {
  await run(process.argv.slice(2));
} catch (error) {
  const theme = createTheme(
    resolveColorEnabled(process.argv.includes(noColorFlag)),
  );
  const isKnownFailure = error instanceof HexaskyError;

  writeLine(
    process.stderr,
    theme.failure(
      `hexasky: ${isKnownFailure ? error.message : 'unexpected error'}`,
    ),
  );

  if (error instanceof UsageError) {
    writeLine(process.stderr, usage);
  }

  if (
    process.env.HEXASKY_DEBUG === '1' &&
    error instanceof Error &&
    error.stack !== undefined
  ) {
    writeLine(process.stderr, error.stack);
  }

  process.exitCode = isKnownFailure
    ? error.exitCode
    : unexpectedFailureExitCode;
}
