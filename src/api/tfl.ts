import type { LatLon, Station, WalkingRoute } from '../types'

const TFL_BASE = 'https://api.tfl.gov.uk'

/** 1.5 miles in metres */
export const SEARCH_RADIUS_METRES = 2414

/** Max stations to request walking routes for (TfL anonymous rate limits) */
export const MAX_ROUTES = 8

interface TflStopPoint {
  naptanId: string
  commonName: string
  distance: number
  lat: number
  lon: number
  modes: string[]
  lines: Array<{ id: string; name: string }>
}

/**
 * Find Tube and rail stations within the search radius of the origin,
 * sorted by straight-line distance (nearest first).
 */
export async function findNearbyStations(origin: LatLon): Promise<Station[]> {
  const params = new URLSearchParams({
    lat: String(origin.lat),
    lon: String(origin.lon),
    stopTypes: 'NaptanMetroStation,NaptanRailStation',
    radius: String(SEARCH_RADIUS_METRES),
  })

  const response = await fetch(`${TFL_BASE}/StopPoint?${params}`)
  if (!response.ok) {
    throw new Error(`TfL station search failed (HTTP ${response.status})`)
  }

  const data: { stopPoints: TflStopPoint[] } = await response.json()

  return data.stopPoints
    .map((sp) => ({
      id: sp.naptanId,
      name: sp.commonName,
      distanceMetres: sp.distance,
      lat: sp.lat,
      lon: sp.lon,
      modes: sp.modes,
      lines: (sp.lines ?? []).map(({ id, name }) => ({ id, name })),
    }))
    .sort((a, b) => a.distanceMetres - b.distanceMetres)
}

export function metresToMiles(metres: number): number {
  return metres / 1609.344
}

interface TflJourneyLeg {
  duration: number
  path?: { lineString?: string }
}

interface TflJourney {
  duration: number
  legs: TflJourneyLeg[]
}

/**
 * Get the walking route from the origin to a station via the TfL Journey
 * Planner. Returns null when no walking journey is available.
 */
export async function getWalkingRoute(
  origin: LatLon,
  station: Station,
): Promise<WalkingRoute | null> {
  const from = `${origin.lat},${origin.lon}`
  const to = `${station.lat},${station.lon}`
  const params = new URLSearchParams({ mode: 'walking' })

  const response = await fetch(
    `${TFL_BASE}/Journey/JourneyResults/${from}/to/${to}?${params}`,
  )
  if (!response.ok) return null

  const data: { journeys?: TflJourney[] } = await response.json()
  const journey = data.journeys?.[0]
  if (!journey) return null

  // Each leg's path.lineString is a JSON-encoded array of [lat, lon] pairs
  const path: [number, number][] = []
  for (const leg of journey.legs) {
    if (!leg.path?.lineString) continue
    try {
      const points: [number, number][] = JSON.parse(leg.path.lineString)
      path.push(...points)
    } catch {
      // skip malformed leg paths
    }
  }
  if (path.length === 0) return null

  return {
    stationId: station.id,
    durationMinutes: journey.duration,
    path,
  }
}

/**
 * Fetch walking routes to the nearest stations in parallel, tolerating
 * individual failures. Returns a map keyed by station id.
 */
export async function getWalkingRoutes(
  origin: LatLon,
  stations: Station[],
): Promise<Map<string, WalkingRoute>> {
  const targets = stations.slice(0, MAX_ROUTES)
  const results = await Promise.allSettled(
    targets.map((station) => getWalkingRoute(origin, station)),
  )

  const routes = new Map<string, WalkingRoute>()
  results.forEach((result, i) => {
    if (result.status === 'fulfilled' && result.value) {
      routes.set(targets[i].id, result.value)
    }
  })
  return routes
}
