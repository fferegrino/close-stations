export interface LatLon {
  lat: number
  lon: number
}

export interface GeocodedAddress extends LatLon {
  /** Full display name returned by the geocoder */
  displayName: string
}
