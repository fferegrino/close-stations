import type { GeocodedAddress } from '../types'

// Greater London bounding box: minLon, maxLat, maxLon, minLat
const LONDON_VIEWBOX = '-0.5103,51.6919,0.3340,51.2868'

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'

/**
 * Geocode an address using Nominatim, restricted to the Greater London
 * bounding box. Returns null when the address cannot be found.
 */
export async function geocodeAddress(
  address: string,
): Promise<GeocodedAddress | null> {
  const params = new URLSearchParams({
    q: address,
    format: 'jsonv2',
    limit: '1',
    viewbox: LONDON_VIEWBOX,
    bounded: '1',
    countrycodes: 'gb',
  })

  const response = await fetch(`${NOMINATIM_URL}?${params}`, {
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) {
    throw new Error(`Geocoding failed (HTTP ${response.status})`)
  }

  const results: Array<{
    lat: string
    lon: string
    display_name: string
  }> = await response.json()

  if (results.length === 0) return null

  const [first] = results
  return {
    lat: Number(first.lat),
    lon: Number(first.lon),
    displayName: first.display_name,
  }
}
