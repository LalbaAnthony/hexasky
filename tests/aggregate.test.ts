import { describe, expect, it } from 'vitest';
import {
  aggregateHourlyBlock,
  meansByDate,
  roundedMeansForDates,
} from '../src/aggregate.js';

const dates = ['2026-08-17', '2026-08-18', '2026-08-19'];

const timestamps = [
  '2026-08-17T00:00',
  '2026-08-17T06:00',
  '2026-08-17T12:00',
  '2026-08-17T18:00',
  '2026-08-18T00:00',
  '2026-08-18T12:00',
];

describe('meansByDate', () => {
  it('groups samples by the date prefix of the local timestamp', () => {
    const means = meansByDate(timestamps, [60, 70, 50, 40, 81, 79]);

    expect(means.get('2026-08-17')).toBe(55);
    expect(means.get('2026-08-18')).toBe(80);
    expect(means.has('2026-08-19')).toBe(false);
  });

  it('ignores null and non-finite samples', () => {
    const means = meansByDate(timestamps, [
      60,
      null,
      Number.NaN,
      40,
      Number.POSITIVE_INFINITY,
      80,
    ]);

    expect(means.get('2026-08-17')).toBe(50);
    expect(means.get('2026-08-18')).toBe(80);
  });

  it('skips samples whose value slot does not exist', () => {
    const means = meansByDate(timestamps, [60, 70]);

    expect(means.get('2026-08-17')).toBe(65);
    expect(means.has('2026-08-18')).toBe(false);
  });
});

describe('roundedMeansForDates', () => {
  it('rounds humidity to the nearest integer percent', () => {
    const humidity = roundedMeansForDates(
      dates,
      timestamps,
      [58, 59, 61, 62, 71, 72],
    );

    expect(humidity).toEqual([60, 72, null]);
  });

  it('rounds pressure to the nearest integer hectopascal', () => {
    const pressure = roundedMeansForDates(
      dates,
      timestamps,
      [1014.4, 1014.6, 1015.1, 1015.9, 1009.2, 1009.4],
    );

    expect(pressure).toEqual([1015, 1009, null]);
  });

  it('yields null for a day with no matching hourly samples', () => {
    const means = roundedMeansForDates(dates, timestamps, [60, 60, 60, 60, 80, 80]);

    expect(means[2]).toBeNull();
  });

  it('yields null for every day when the hourly block is empty', () => {
    expect(roundedMeansForDates(dates, [], [])).toEqual([null, null, null]);
  });
});

describe('aggregateHourlyBlock', () => {
  it('produces aligned humidity and pressure series', () => {
    const aggregates = aggregateHourlyBlock(dates, {
      time: timestamps,
      relative_humidity_2m: [58, 59, 61, 62, 71, 72],
      surface_pressure: [1014.4, 1014.6, 1015.1, 1015.9, 1009.2, 1009.4],
    });

    expect(aggregates.humidity).toEqual([60, 72, null]);
    expect(aggregates.pressure).toEqual([1015, 1009, null]);
  });

  it('keeps one entry per requested date', () => {
    const aggregates = aggregateHourlyBlock(dates, {
      time: [],
      relative_humidity_2m: [],
      surface_pressure: [],
    });

    expect(aggregates.humidity).toHaveLength(dates.length);
    expect(aggregates.pressure).toHaveLength(dates.length);
  });
});
