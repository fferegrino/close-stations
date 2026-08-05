import type { NetworkLine, NetworkStation } from '../types'

const TFL_BASE = 'https://api.tfl.gov.uk'

/** Modes that expose route geometry via the TfL Line API. */
const NETWORK_MODES = 'tube,elizabeth-line,dlr,overground,tram'

interface TflLine {
  id: string
  name: string
  modeName: string
}

interface TflRouteStation {
  id: string
  name: string
  lat: number
  lon: number
}

interface TflRouteSequence {
  lineId: string
  lineName: string
  mode: string
  lineStrings: string[]
  stations?: TflRouteStation[]
}

export interface NetworkData {
  lines: NetworkLine[]
  stations: NetworkStation[]
}

/**
 * Parse TfL lineStrings into Leaflet [lat, lon] polylines.
 * TfL encodes each string as JSON: [[[lon, lat], ...], ...]
 */
function parseLineStrings(lineStrings: string[]): [number, number][][] {
  const paths: [number, number][][] = []
  for (const raw of lineStrings) {
    try {
      const segments: [number, number][][] = JSON.parse(raw)
      for (const segment of segments) {
        if (segment.length < 2) continue
        paths.push(segment.map(([lon, lat]) => [lat, lon]))
      }
    } catch {
      // skip malformed segments
    }
  }
  return paths
}

/**
 * Load Tube / Overground / DLR / Elizabeth / Tram route geometry and unique
 * station points once. Uses inbound sequences only (outbound mirrors paths).
 */
export async function fetchNetworkData(): Promise<NetworkData> {
  const listResponse = await fetch(
    `${TFL_BASE}/Line/Mode/${NETWORK_MODES}`,
  )
  if (!listResponse.ok) {
    throw new Error(`TfL line list failed (HTTP ${listResponse.status})`)
  }

  const lines: TflLine[] = await listResponse.json()
  const stationsById = new Map<string, NetworkStation>()

  const results = await Promise.allSettled(
    lines.map(async (line) => {
      const response = await fetch(
        `${TFL_BASE}/Line/${line.id}/Route/Sequence/inbound`,
      )
      if (!response.ok) {
        throw new Error(`Route sequence failed for ${line.id}`)
      }
      const sequence: TflRouteSequence = await response.json()
      const paths = parseLineStrings(sequence.lineStrings ?? [])
      if (paths.length === 0) {
        throw new Error(`No geometry for ${line.id}`)
      }

      for (const station of sequence.stations ?? []) {
        if (!station.id || stationsById.has(station.id)) continue
        stationsById.set(station.id, {
          id: station.id,
          name: station.name,
          lat: station.lat,
          lon: station.lon,
        })
      }

      return {
        id: line.id,
        name: line.name,
        mode: line.modeName,
        paths,
      } satisfies NetworkLine
    }),
  )

  const network: NetworkLine[] = []
  for (const result of results) {
    if (result.status === 'fulfilled') network.push(result.value)
  }

  return {
    lines: network.sort((a, b) => a.name.localeCompare(b.name)),
    stations: [...stationsById.values()],
  }
}
