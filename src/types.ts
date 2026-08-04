export interface LatLon {
  lat: number
  lon: number
}

export interface GeocodedAddress extends LatLon {
  /** Full display name returned by the geocoder */
  displayName: string
}

export interface StationLine {
  /** TfL line id, e.g. "circle", "windrush", "southeastern" */
  id: string
  name: string
}

export interface Station extends LatLon {
  id: string
  name: string
  /** Straight-line distance from the search origin, in metres */
  distanceMetres: number
  /** Transport modes served, e.g. ["tube", "dlr"] */
  modes: string[]
  /** Lines serving this station */
  lines: StationLine[]
}

export interface WalkingRoute {
  stationId: string
  /** Walking time in minutes */
  durationMinutes: number
  /** Route polyline as [lat, lon] pairs */
  path: [number, number][]
}
