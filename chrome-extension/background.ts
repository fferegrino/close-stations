/**
 * Extension service worker: pin lookup via shared TfL client + Nominatim reverse geocode.
 * Prefetches from the content script and caches results in chrome.storage.session.
 */

/// <reference types="chrome" />

import {
  MAX_ROUTES,
  findNearbyStations,
  getWalkingRoutes,
  type Station,
  type TflAuth,
  type WalkingRoute,
} from '../shared/tfl'

interface EnrichedStation extends Station {
  walkingDurationMinutes: number | null
  walkingDistanceMetres: number | null
  walkingPath: [number, number][]
}

interface AddressMeta {
  pinAddress: string | null
  pinAddressFull: string | null
  pinAddressSource: string | null
}

interface LookupResult extends AddressMeta {
  latitude: number
  longitude: number
  stations: EnrichedStation[]
}

/** In-flight lookups keyed by rounded lat/lon so popup and prefetch share work. */
const inflight = new Map<string, Promise<LookupResult>>()

function coordsKey(latitude: number, longitude: number): string {
  return `${Number(latitude).toFixed(5)},${Number(longitude).toFixed(5)}`
}

function sessionKey(key: string): string {
  return `lookup:${key}`
}

async function readSessionCache(key: string): Promise<LookupResult | null> {
  const stored = await chrome.storage.session.get(sessionKey(key))
  const entry = stored[sessionKey(key)]
  if (!entry || typeof entry !== 'object') return null
  const result = entry as LookupResult
  if (!Array.isArray(result.stations)) return null
  if (!Number.isFinite(result.latitude) || !Number.isFinite(result.longitude)) {
    return null
  }
  return result
}

async function writeSessionCache(key: string, result: LookupResult): Promise<void> {
  await chrome.storage.session.set({ [sessionKey(key)]: result })
}

async function loadTflAuth(): Promise<TflAuth> {
  const { tflAppKey, tflAppId } = await chrome.storage.sync.get([
    'tflAppKey',
    'tflAppId',
  ])
  return {
    appKey: typeof tflAppKey === 'string' ? tflAppKey : undefined,
    appId: typeof tflAppId === 'string' ? tflAppId : undefined,
  }
}

async function enrichWithNearbyStations(
  latitude: number,
  longitude: number,
): Promise<EnrichedStation[]> {
  const origin = { lat: latitude, lon: longitude }
  const auth = await loadTflAuth()
  const stations = (await findNearbyStations(origin, { auth })).filter(
    (s) => s.modes.length > 0,
  )

  const routes = await getWalkingRoutes(origin, stations, { auth })
  const enriched: EnrichedStation[] = []

  for (const station of stations.slice(0, MAX_ROUTES)) {
    const route: WalkingRoute | undefined = routes.get(station.id)
    if (!route) continue
    if (route.durationMinutes == null && route.distanceMetres == null) continue
    enriched.push({
      ...station,
      walkingDurationMinutes: route.durationMinutes,
      walkingDistanceMetres: route.distanceMetres,
      walkingPath: route.path,
    })
  }

  // If walking enrichment failed entirely, fall back to crow-flies list.
  if (!enriched.length) {
    return stations.slice(0, MAX_ROUTES).map((s) => ({
      ...s,
      walkingDurationMinutes: null,
      walkingDistanceMetres: null,
      walkingPath: [],
    }))
  }
  return enriched
}

function formatPinAddress(
  addr: Record<string, string> | undefined,
): string | null {
  if (!addr || typeof addr !== 'object') return null
  const parts: string[] = []
  if (addr.house_number && addr.road) {
    parts.push(`${addr.house_number} ${addr.road}`)
  } else if (addr.road) {
    parts.push(addr.road)
  } else if (addr.pedestrian) {
    parts.push(addr.pedestrian)
  } else if (addr.building) {
    parts.push(addr.building)
  }

  const locality = addr.suburb || addr.neighbourhood || addr.city_district
  if (locality) parts.push(locality)

  const town = addr.city || addr.town || addr.village || addr.municipality
  if (town && town !== locality) parts.push(town)

  if (addr.postcode) parts.push(addr.postcode)
  return parts.length ? parts.join(', ') : null
}

/**
 * Reverse-geocode the map pin (not the portal street label).
 * Stations and walks are always computed from lat/long; this only labels the pin.
 */
async function reverseGeocode(latitude: number, longitude: number) {
  const query = new URLSearchParams({
    format: 'jsonv2',
    lat: String(latitude),
    lon: String(longitude),
    zoom: '18',
    addressdetails: '1',
  })
  const url = `https://nominatim.openstreetmap.org/reverse?${query}`
  const resp = await fetch(url, {
    headers: {
      Accept: 'application/json',
      // Nominatim asks apps to identify themselves (User-Agent is forbidden in
      // extension fetch, so we use this + the default Chrome UA).
      'Accept-Language': 'en-GB,en;q=0.9',
    },
  })
  if (!resp.ok) {
    throw new Error(`Nominatim HTTP ${resp.status}`)
  }
  const data = (await resp.json()) as {
    address?: Record<string, string>
    display_name?: string
  }
  const pinAddress =
    formatPinAddress(data.address) || data.display_name || null
  return {
    pinAddress,
    pinAddressFull: data.display_name || pinAddress,
    pinAddressSource: 'nominatim' as const,
  }
}

async function lookupFromCoords(
  latitude: number,
  longitude: number,
  addressMeta?: AddressMeta,
): Promise<LookupResult> {
  const [stations, geocode] = await Promise.all([
    enrichWithNearbyStations(latitude, longitude),
    addressMeta
      ? Promise.resolve(addressMeta)
      : reverseGeocode(latitude, longitude).catch(() => ({
          pinAddress: null,
          pinAddressFull: null,
          pinAddressSource: null,
        })),
  ])
  return {
    latitude,
    longitude,
    stations,
    ...geocode,
  }
}

/**
 * Return a cached lookup, join an in-flight one, or start a fresh TfL/Nominatim run.
 */
function ensureLookup(
  latitude: number,
  longitude: number,
  addressMeta?: AddressMeta,
): Promise<LookupResult> {
  const key = coordsKey(latitude, longitude)
  const existing = inflight.get(key)
  if (existing) return existing

  const promise = (async () => {
    const cached = await readSessionCache(key)
    if (cached) return cached

    const result = await lookupFromCoords(latitude, longitude, addressMeta)
    await writeSessionCache(key, result)
    return result
  })().finally(() => {
    inflight.delete(key)
  })

  inflight.set(key, promise)
  return promise
}

/**
 * Forward-geocode an address (Greater London) then run the usual station lookup.
 */
async function geocodeAddress(address: string) {
  const query = address.trim()
  if (!query) throw new Error('Enter an address.')

  // Greater London: minLon, maxLat, maxLon, minLat
  const params = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    limit: '1',
    viewbox: '-0.5103,51.6919,0.3340,51.2868',
    bounded: '1',
    countrycodes: 'gb',
  })
  const url = `https://nominatim.openstreetmap.org/search?${params}`
  const resp = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'en-GB,en;q=0.9',
    },
  })
  if (!resp.ok) {
    throw new Error(`Nominatim HTTP ${resp.status}`)
  }
  const results = (await resp.json()) as Array<{
    lat: string
    lon: string
    display_name: string
  }>
  if (!results.length) {
    throw new Error('Address not found in London. Try being more specific.')
  }
  const first = results[0]
  return {
    latitude: Number(first.lat),
    longitude: Number(first.lon),
    pinAddress: first.display_name,
    pinAddressFull: first.display_name,
    pinAddressSource: 'nominatim-search' as const,
  }
}

async function lookupFromAddress(address: string) {
  const geocoded = await geocodeAddress(address)
  // Bypass pin cache: override coords may differ from the listing pin.
  return lookupFromCoords(geocoded.latitude, geocoded.longitude, {
    pinAddress: geocoded.pinAddress,
    pinAddressFull: geocoded.pinAddressFull,
    pinAddressSource: geocoded.pinAddressSource,
  })
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'PREFETCH_LOOKUP') {
    const latitude = Number(message.latitude)
    const longitude = Number(message.longitude)
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      sendResponse({ ok: false, error: 'Missing coordinates.' })
      return
    }

    ensureLookup(latitude, longitude)
      .then(() => sendResponse({ ok: true, started: true }))
      .catch((err: unknown) =>
        sendResponse({
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        }),
      )

    return true
  }

  if (message?.type === 'LOOKUP_FROM_COORDS') {
    const latitude = Number(message.latitude)
    const longitude = Number(message.longitude)
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      sendResponse({ ok: false, error: 'Missing coordinates.' })
      return
    }

    ensureLookup(latitude, longitude)
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch((err: unknown) =>
        sendResponse({
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        }),
      )

    return true
  }

  if (message?.type === 'LOOKUP_FROM_ADDRESS') {
    const address = String(message.address ?? '')
    lookupFromAddress(address)
      .then((result) => sendResponse({ ok: true, ...result, overridden: true }))
      .catch((err: unknown) =>
        sendResponse({
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        }),
      )

    return true
  }
})
