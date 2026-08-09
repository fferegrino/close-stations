import { MAX_ROUTES } from './constants'
import { tflGet } from './client'
import type { LatLon, Station, TflRequestOptions, WalkingRoute } from './types'

interface TflJourneyLeg {
  duration?: number
  distance?: number
  path?: { lineString?: string }
}

interface TflJourney {
  duration?: number
  legs?: TflJourneyLeg[]
}

interface TflJourneyResponse {
  journeys?: TflJourney[]
}

export function parseLineString(raw: unknown): [number, number][] {
  if (raw == null) return []
  let points: unknown = raw
  if (typeof raw === 'string') {
    try {
      points = JSON.parse(raw)
    } catch {
      return []
    }
  }
  if (!Array.isArray(points)) return []

  const out: [number, number][] = []
  for (const pt of points) {
    if (Array.isArray(pt) && pt.length >= 2) {
      const a = Number(pt[0])
      const b = Number(pt[1])
      if (Number.isFinite(a) && Number.isFinite(b)) out.push([a, b])
    }
  }
  return out
}

/**
 * Walking route from origin to a station via the TfL Journey Planner.
 * Returns null when no walking journey is available.
 */
export async function getWalkingRoute(
  origin: LatLon,
  station: Station,
  options: TflRequestOptions = {},
): Promise<WalkingRoute | null> {
  const from = `${origin.lat},${origin.lon}`
  const to = `${station.lat},${station.lon}`
  const path = `/Journey/JourneyResults/${encodeURIComponent(from)}/to/${encodeURIComponent(to)}`

  let data: TflJourneyResponse
  try {
    data = await tflGet<TflJourneyResponse>(
      path,
      { mode: 'walking' },
      options.auth,
    )
  } catch {
    return null
  }

  const journeys = data.journeys
  if (!Array.isArray(journeys) || journeys.length === 0) return null

  const journey = journeys.reduce((best, candidate) => {
    const bestDuration = best.duration ?? Number.POSITIVE_INFINITY
    const candidateDuration = candidate.duration ?? Number.POSITIVE_INFINITY
    return candidateDuration < bestDuration ? candidate : best
  })

  let walkingDistance = 0
  const routePath: [number, number][] = []
  for (const leg of journey.legs ?? []) {
    if (leg.distance != null) {
      const d = Number(leg.distance)
      if (Number.isFinite(d)) walkingDistance += d
    }
    routePath.push(...parseLineString(leg.path?.lineString))
  }

  if (journey.duration == null && routePath.length === 0 && !walkingDistance) {
    return null
  }

  return {
    stationId: station.id,
    durationMinutes: Math.round(Number(journey.duration ?? 0)),
    distanceMetres: walkingDistance ? Math.round(walkingDistance) : null,
    path: routePath,
  }
}

/**
 * Fetch walking routes to the nearest stations in parallel, tolerating
 * individual failures. Returns a map keyed by station id.
 */
export async function getWalkingRoutes(
  origin: LatLon,
  stations: Station[],
  options: TflRequestOptions = {},
): Promise<Map<string, WalkingRoute>> {
  const maxRoutes = options.maxRoutes ?? MAX_ROUTES
  const targets = stations.slice(0, maxRoutes)
  const results = await Promise.allSettled(
    targets.map((station) => getWalkingRoute(origin, station, options)),
  )

  const routes = new Map<string, WalkingRoute>()
  results.forEach((result, i) => {
    if (result.status === 'fulfilled' && result.value) {
      routes.set(targets[i].id, result.value)
    }
  })
  return routes
}
