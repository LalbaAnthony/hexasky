export interface GeocodingProperties {
  label: string | null;
  city: string | null;
  postcode: string | null;
  context: string | null;
}

export interface GeocodingGeometry {
  longitude: number;
  latitude: number;
}

export interface GeocodingFeature {
  geometry: GeocodingGeometry;
  properties: GeocodingProperties;
}

export interface GeocodingResponse {
  features: readonly GeocodingFeature[];
}
