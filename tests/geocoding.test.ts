import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { geocode } from '../src/geocoding.js';
import { GeocodingError } from '../src/errors.js';

interface FetchRecorder {
  urls: URL[];
}

const toulouseFixture: unknown = JSON.parse(
  readFileSync(
    new URL('./fixtures/geocoding-toulouse.json', import.meta.url),
    'utf8',
  ),
);

function singleUrl(recorder: FetchRecorder): URL {
  const [url] = recorder.urls;
  if (url === undefined) {
    throw new Error('fetch was never called');
  }
  return url;
}

function stubFetch(payload: unknown, status = 200): FetchRecorder {
  const recorder: FetchRecorder = { urls: [] };
  vi.stubGlobal('fetch', (input: string | URL): Promise<Response> => {
    recorder.urls.push(input instanceof URL ? input : new URL(input));
    return Promise.resolve(
      new Response(JSON.stringify(payload), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
    );
  });
  return recorder;
}

describe('geocode', () => {
  it('reads latitude and longitude in GeoJSON order', async () => {
    stubFetch(toulouseFixture);

    const location = await geocode('Toulouse');

    expect(location.latitude).toBe(43.604462);
    expect(location.longitude).toBe(1.44305);
  });

  it('does not swap the coordinate pair', async () => {
    stubFetch({
      features: [
        {
          geometry: { type: 'Point', coordinates: [2.3488, 48.8534] },
          properties: { label: 'Paris', postcode: '75000' },
        },
      ],
    });

    const location = await geocode('Paris');

    expect(location.longitude).toBeLessThan(location.latitude);
    expect(location.latitude).toBe(48.8534);
    expect(location.longitude).toBe(2.3488);
  });

  it('exposes the consumed properties and defaults them to null', async () => {
    stubFetch(toulouseFixture);

    const location = await geocode('Toulouse');

    expect(location.label).toBe('Toulouse');
    expect(location.city).toBe('Toulouse');
    expect(location.postcode).toBe('31000');
    expect(location.context).toBe('31, Haute-Garonne, Occitanie');
  });

  it('falls back to the query when the label is absent', async () => {
    stubFetch({
      features: [
        {
          geometry: { coordinates: [1.44305, 43.604462] },
          properties: {},
        },
      ],
    });

    const location = await geocode('somewhere');

    expect(location.label).toBe('somewhere');
    expect(location.city).toBeNull();
    expect(location.postcode).toBeNull();
    expect(location.context).toBeNull();
  });

  it('sends the documented query parameters to the Geoplateforme host', async () => {
    const recorder = stubFetch(toulouseFixture);

    await geocode('8 rue du Taur, Toulouse');

    expect(recorder.urls).toHaveLength(1);
    const url = singleUrl(recorder);
    expect(url.origin).toBe('https://data.geopf.fr');
    expect(url.pathname).toBe('/geocodage/search');
    expect(url.searchParams.get('q')).toBe('8 rue du Taur, Toulouse');
    expect(url.searchParams.get('limit')).toBe('1');
    expect(url.searchParams.get('index')).toBe('address');
  });

  it('throws a GeocodingError when features is empty', async () => {
    stubFetch({ type: 'FeatureCollection', features: [] });

    await expect(geocode('zzzzzzzz')).rejects.toThrow(GeocodingError);
    await expect(geocode('zzzzzzzz')).rejects.toThrow(
      'no location found for "zzzzzzzz"',
    );
  });

  it('reports the rate limit with a dedicated message', async () => {
    stubFetch({}, 429);

    await expect(geocode('Toulouse')).rejects.toThrow(
      'rate limit reached, retry in a few seconds',
    );
  });

  it('carries the status code of a non-2xx response', async () => {
    stubFetch({}, 503);

    await expect(geocode('Toulouse')).rejects.toMatchObject({
      status: 503,
      exitCode: 1,
      message: 'geocoding request failed with status 503',
    });
  });

  it('rejects a malformed payload without leaking a TypeError', async () => {
    stubFetch({ features: 'not-an-array' });

    await expect(geocode('Toulouse')).rejects.toThrow(GeocodingError);
    await expect(geocode('Toulouse')).rejects.not.toThrow(TypeError);
  });

  it('rejects a feature whose coordinates are not numbers', async () => {
    stubFetch({
      features: [{ geometry: { coordinates: ['1.44', '43.60'] }, properties: {} }],
    });

    await expect(geocode('Toulouse')).rejects.toThrow(
      'geocoding response had an unexpected shape',
    );
  });

  it('wraps a transport failure into a GeocodingError', async () => {
    vi.stubGlobal('fetch', () =>
      Promise.reject(new Error('getaddrinfo ENOTFOUND data.geopf.fr')),
    );

    await expect(geocode('Toulouse')).rejects.toThrow(GeocodingError);
    await expect(geocode('Toulouse')).rejects.toThrow(
      'geocoding request failed: getaddrinfo ENOTFOUND data.geopf.fr',
    );
  });
});
