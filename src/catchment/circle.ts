import type { NetworkStation, StationCatchment } from '../types'

/** ~10-minute walk at a typical urban pace. Easy to retune later. */
export const DEFAULT_CATCHMENT_RADIUS_METRES = 800

/**
 * Build circular catchments around every station.
 * Swap this for an isochrone (or other) builder later without changing the map layer.
 */
export function buildCircleCatchments(
  stations: NetworkStation[],
  radiusMetres: number = DEFAULT_CATCHMENT_RADIUS_METRES,
): StationCatchment[] {
  return stations.map((station) => ({
    stationId: station.id,
    geometry: {
      kind: 'circle' as const,
      center: { lat: station.lat, lon: station.lon },
      radiusMetres,
    },
  }))
}
