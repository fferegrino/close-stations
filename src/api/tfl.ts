import type { LatLon, Station } from '../types'

const TFL_BASE = 'https://api.tfl.gov.uk'

/** 1.5 miles in metres */
export const SEARCH_RADIUS_METRES = 2414

interface TflStopPoint {
  naptanId: string
  commonName: string
  distance: number
  lat: number
  lon: number
  modes: string[]
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
    }))
    .sort((a, b) => a.distanceMetres - b.distanceMetres)
}

export function metresToMiles(metres: number): number {
  return metres / 1609.344
}
