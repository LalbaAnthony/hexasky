import type {
  DailyAggregates,
  NumericSeries,
  RawHourlyBlock,
} from './types/weather.js';

const isoDateLength = 10;

interface RunningMean {
  sum: number;
  count: number;
}

export function meansByDate(
  timestamps: readonly string[],
  values: NumericSeries,
): Map<string, number> {
  const running = new Map<string, RunningMean>();

  for (const [index, timestamp] of timestamps.entries()) {
    const value = values[index];
    if (value === undefined || value === null || !Number.isFinite(value)) {
      continue;
    }
    const date = timestamp.slice(0, isoDateLength);
    const bucket = running.get(date);
    if (bucket === undefined) {
      running.set(date, { sum: value, count: 1 });
    } else {
      bucket.sum += value;
      bucket.count += 1;
    }
  }

  const means = new Map<string, number>();
  for (const [date, bucket] of running) {
    means.set(date, bucket.sum / bucket.count);
  }
  return means;
}

export function roundedMeansForDates(
  dates: readonly string[],
  timestamps: readonly string[],
  values: NumericSeries,
): NumericSeries {
  const means = meansByDate(timestamps, values);
  return dates.map((date) => {
    const mean = means.get(date);
    return mean === undefined ? null : Math.round(mean);
  });
}

export function aggregateHourlyBlock(
  dates: readonly string[],
  hourly: RawHourlyBlock,
): DailyAggregates {
  return {
    humidity: roundedMeansForDates(
      dates,
      hourly.time,
      hourly.relative_humidity_2m,
    ),
    pressure: roundedMeansForDates(dates, hourly.time, hourly.surface_pressure),
  };
}
