/**
 * Extension service worker: pin lookup via shared TfL client + Nominatim reverse geocode.
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

async function lookupFromCoords(latitude: number, longitude: number) {
  const [stations, geocode] = await Promise.all([
    enrichWithNearbyStations(latitude, longitude),
    reverseGeocode(latitude, longitude).catch(() => ({
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

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'LOOKUP_FROM_COORDS') return

  const latitude = Number(message.latitude)
  const longitude = Number(message.longitude)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    sendResponse({ ok: false, error: 'Missing coordinates.' })
    return
  }

  lookupFromCoords(latitude, longitude)
    .then((result) => sendResponse({ ok: true, ...result }))
    .catch((err: unknown) =>
      sendResponse({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      }),
    )

  return true // keep channel open for async response
})
