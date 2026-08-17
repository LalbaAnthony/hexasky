import { GeocodingError } from './errors.js';
import { userAgent } from './version.js';
import type { Location } from './types/domain.js';
import type {
  GeocodingFeature,
  GeocodingResponse,
} from './types/geocoding.js';

const geocodingEndpoint = 'https://data.geopf.fr/geocodage/search';
const requestTimeoutMs = 10_000;
const requestTimeoutSeconds = requestTimeoutMs / 1000;
const rateLimitStatus = 429;
const longitudeIndex = 0;
const latitudeIndex = 1;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toArray(value: unknown): readonly unknown[] | null {
  return Array.isArray(value) ? (value as readonly unknown[]) : null;
}

function toFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function toOptionalString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function narrowFeature(value: unknown): GeocodingFeature | null {
  if (!isRecord(value)) {
    return null;
  }
  const geometry = value.geometry;
  if (!isRecord(geometry)) {
    return null;
  }
  const coordinates = toArray(geometry.coordinates);
  if (coordinates === null) {
    return null;
  }
  const longitude = toFiniteNumber(coordinates[longitudeIndex]);
  const latitude = toFiniteNumber(coordinates[latitudeIndex]);
  if (longitude === null || latitude === null) {
    return null;
  }
  const properties = isRecord(value.properties) ? value.properties : {};
  return {
    geometry: { longitude, latitude },
    properties: {
      label: toOptionalString(properties.label),
      city: toOptionalString(properties.city),
      postcode: toOptionalString(properties.postcode),
      context: toOptionalString(properties.context),
    },
  };
}

export function narrowGeocodingResponse(
  payload: unknown,
): GeocodingResponse | null {
  if (!isRecord(payload)) {
    return null;
  }
  const rawFeatures = toArray(payload.features);
  if (rawFeatures === null) {
    return null;
  }
  const features: GeocodingFeature[] = [];
  for (const rawFeature of rawFeatures) {
    const feature = narrowFeature(rawFeature);
    if (feature === null) {
      return null;
    }
    features.push(feature);
  }
  return { features };
}

function describeTransportFailure(cause: unknown): string {
  if (cause instanceof Error && cause.name === 'TimeoutError') {
    return `geocoding request timed out after ${String(requestTimeoutSeconds)}s`;
  }
  const detail = cause instanceof Error ? cause.message : 'unknown transport error';
  return `geocoding request failed: ${detail}`;
}

async function requestGeocodingPayload(url: URL): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { 'User-Agent': userAgent },
      signal: AbortSignal.timeout(requestTimeoutMs),
    });
  } catch (cause) {
    throw new GeocodingError(describeTransportFailure(cause));
  }

  if (response.status === rateLimitStatus) {
    throw new GeocodingError(
      'rate limit reached, retry in a few seconds',
      rateLimitStatus,
    );
  }
  if (!response.ok) {
    throw new GeocodingError(
      `geocoding request failed with status ${String(response.status)}`,
      response.status,
    );
  }

  try {
    return await response.json();
  } catch {
    throw new GeocodingError('geocoding response was not valid JSON');
  }
}

export function buildGeocodingUrl(query: string): URL {
  const url = new URL(geocodingEndpoint);
  url.search = new URLSearchParams({
    q: query,
    limit: '1',
    index: 'address',
  }).toString();
  return url;
}

export async function geocode(query: string): Promise<Location> {
  const payload = await requestGeocodingPayload(buildGeocodingUrl(query));
  const parsed = narrowGeocodingResponse(payload);
  if (parsed === null) {
    throw new GeocodingError('geocoding response had an unexpected shape');
  }

  const [feature] = parsed.features;
  if (feature === undefined) {
    throw new GeocodingError(`no location found for "${query}"`);
  }

  return {
    latitude: feature.geometry.latitude,
    longitude: feature.geometry.longitude,
    label: feature.properties.label ?? feature.properties.city ?? query,
    city: feature.properties.city,
    postcode: feature.properties.postcode,
    context: feature.properties.context,
  };
}
