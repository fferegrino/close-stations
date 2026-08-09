export interface LatLon {
  lat: number
  lon: number
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
  /** TfL stop type when available */
  stopType?: string | null
}

export interface WalkingRoute {
  stationId: string
  /** Walking time in minutes */
  durationMinutes: number
  /** Sum of leg distances when TfL provides them */
  distanceMetres: number | null
  /** Route polyline as [lat, lon] pairs */
  path: [number, number][]
}

/** Optional TfL API credentials (higher rate limits). */
export interface TflAuth {
  appKey?: string
  appId?: string
}

export interface TflRequestOptions {
  auth?: TflAuth
  /** Override search radius in metres */
  radiusMetres?: number
  /** Override StopPoint stopTypes query value */
  stopTypes?: string
  /** Max stations to request walking routes for */
  maxRoutes?: number
}
