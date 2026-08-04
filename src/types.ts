export interface LatLon {
  lat: number
  lon: number
}

export interface GeocodedAddress extends LatLon {
  /** Full display name returned by the geocoder */
  displayName: string
}

export interface Station extends LatLon {
  id: string
  name: string
  /** Straight-line distance from the search origin, in metres */
  distanceMetres: number
  /** Transport modes served, e.g. ["tube", "dlr"] */
  modes: string[]
}
