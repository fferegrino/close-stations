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

/** Permanent TfL network geometry for one line (Tube, Overground, etc.). */
export interface NetworkLine {
  id: string
  name: string
  mode: string
  /** One or more route segments as [lat, lon] polylines */
  paths: [number, number][][]
}

/** A station on the permanent network map (independent of search results). */
export interface NetworkStation extends LatLon {
  id: string
  name: string
}

/**
 * Catchment geometry around a station.
 * Start with circles; polygons enable future isochrones / custom shapes.
 */
export type CatchmentGeometry =
  | { kind: 'circle'; center: LatLon; radiusMetres: number }
  | { kind: 'polygon'; rings: [number, number][][] }

export interface StationCatchment {
  stationId: string
  geometry: CatchmentGeometry
}
