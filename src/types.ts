export type {
  LatLon,
  Station,
  StationLine,
  WalkingRoute,
} from '../shared/tfl'

import type { LatLon } from '../shared/tfl'

export interface GeocodedAddress extends LatLon {
  /** Full display name returned by the geocoder */
  displayName: string
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
