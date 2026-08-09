import {
  DEFAULT_STOP_TYPES,
  SEARCH_RADIUS_METRES,
} from './constants'
import { tflGet } from './client'
import type { LatLon, Station, StationLine, TflRequestOptions } from './types'

interface TflLineRef {
  id?: string
  name?: string
}

interface TflLineModeGroup {
  modeName?: string
  lineIdentifier?: string[]
}

interface TflStopPoint {
  id?: string
  naptanId?: string
  commonName?: string
  distance?: number
  lat?: number
  lon?: number
  modes?: string[]
  lines?: TflLineRef[]
  lineModeGroups?: TflLineModeGroup[]
  stopType?: string
}

interface TflStopPointResponse {
  stopPoints?: TflStopPoint[]
}

function titleCaseId(id: string): string {
  return id.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/** Prefer non-bus lineModeGroups; fall back to the raw lines list. */
export function stationLines(stop: TflStopPoint): StationLine[] {
  const rawLines = stop.lines ?? []
  const idToName = new Map<string, string>()
  for (const line of rawLines) {
    if (line?.id && line?.name) {
      idToName.set(String(line.id), String(line.name))
    }
  }

  const result: StationLine[] = []
  const seen = new Set<string>()
  const groups = stop.lineModeGroups ?? []

  if (groups.length) {
    for (const group of groups) {
      if (!group || group.modeName === 'bus') continue
      for (const lid of group.lineIdentifier ?? []) {
        const id = String(lid)
        if (seen.has(id)) continue
        seen.add(id)
        result.push({
          id,
          name: idToName.get(id) ?? titleCaseId(id),
        })
      }
    }
    return result
  }

  for (const line of rawLines) {
    if (!line?.id || !line?.name) continue
    if (/^\d+$/.test(String(line.name))) continue
    const id = String(line.id)
    if (seen.has(id)) continue
    seen.add(id)
    result.push({ id, name: String(line.name) })
  }
  return result
}

/**
 * Find Tube, rail (and related) stations within the search radius,
 * sorted by straight-line distance (nearest first). Dedupes by name.
 */
export async function findNearbyStations(
  origin: LatLon,
  options: TflRequestOptions = {},
): Promise<Station[]> {
  const radius = options.radiusMetres ?? SEARCH_RADIUS_METRES
  const stopTypes = options.stopTypes ?? DEFAULT_STOP_TYPES

  const data = await tflGet<TflStopPointResponse | TflStopPoint[]>(
    '/StopPoint',
    {
      lat: String(origin.lat),
      lon: String(origin.lon),
      radius: String(radius),
      stopTypes,
      useStopPointHierarchy: 'false',
      returnLines: 'true',
    },
    options.auth,
  )

  const stops = Array.isArray(data)
    ? data
    : Array.isArray(data.stopPoints)
      ? data.stopPoints
      : []

  const unique = new Map<string, Station>()

  for (const stop of stops) {
    if (!stop || typeof stop !== 'object') continue
    const name = (stop.commonName ?? '').trim()
    if (!name || stop.lat == null || stop.lon == null) continue

    const modes = (stop.modes ?? [])
      .filter((m): m is string => Boolean(m) && m !== 'bus')
      .map(String)
    if ((stop.modes ?? []).length && modes.length === 0) continue

    if (stop.distance == null || !Number.isFinite(Number(stop.distance))) {
      continue
    }

    const candidate: Station = {
      id: String(stop.naptanId || stop.id || name.toLowerCase()),
      name,
      distanceMetres: Number(stop.distance),
      lat: Number(stop.lat),
      lon: Number(stop.lon),
      modes,
      lines: stationLines(stop),
      stopType: stop.stopType ?? null,
    }

    const key = name.toLowerCase()
    const existing = unique.get(key)
    if (!existing) {
      unique.set(key, candidate)
      continue
    }

    const closer = candidate.distanceMetres < existing.distanceMetres
    const richer =
      (!existing.modes.length && candidate.modes.length) ||
      (!existing.lines.length && candidate.lines.length)
    if (closer || (candidate.distanceMetres === existing.distanceMetres && richer)) {
      unique.set(key, candidate)
    }
  }

  return [...unique.values()].sort(
    (a, b) => a.distanceMetres - b.distanceMetres,
  )
}

export function metresToMiles(metres: number): number {
  return metres / 1609.344
}
