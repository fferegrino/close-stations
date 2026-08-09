/**
 * TfL Unified API — nearby stations + optional walking routes.
 * Port of house_move/tfl.py for the extension service worker.
 */

const TFL_BASE = "https://api.tfl.gov.uk";
const DEFAULT_RADIUS_M = 2000;
const DEFAULT_STOP_TYPES =
  "NaptanMetroStation,NaptanRailStation,NaptanFerryPort,TransportInterchange";
const MAX_WALKING_ROUTES = 6;

async function authParams() {
  const { tflAppKey, tflAppId } = await chrome.storage.sync.get([
    "tflAppKey",
    "tflAppId",
  ]);
  const params = {};
  if (tflAppKey) params.app_key = tflAppKey;
  if (tflAppId) params.app_id = tflAppId;
  return params;
}

async function tflGet(path, params = {}) {
  const auth = await authParams();
  const query = new URLSearchParams({ ...params, ...auth });
  const url = `${TFL_BASE}${path}?${query}`;
  const resp = await fetch(url);
  if (!resp.ok) {
    const body = (await resp.text()).slice(0, 300);
    throw new Error(`TfL HTTP ${resp.status}: ${body}`);
  }
  return resp.json();
}

function stationLines(stop) {
  const rawLines = stop.lines || [];
  const idToName = {};
  for (const line of rawLines) {
    if (line && typeof line === "object" && line.id && line.name) {
      idToName[String(line.id)] = String(line.name);
    }
  }

  const names = [];
  const groups = stop.lineModeGroups || [];
  if (groups.length) {
    for (const group of groups) {
      if (!group || group.modeName === "bus") continue;
      for (const lid of group.lineIdentifier || []) {
        const name =
          idToName[String(lid)] ||
          String(lid).replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
        if (name && !names.includes(name)) names.push(name);
      }
    }
    return names;
  }

  for (const line of rawLines) {
    if (!line || typeof line !== "object") continue;
    const name = line.name;
    if (!name || /^\d+$/.test(String(name))) continue;
    if (!names.includes(String(name))) names.push(String(name));
  }
  return names;
}

async function findNearbyStations(latitude, longitude, radiusM = DEFAULT_RADIUS_M) {
  const data = await tflGet("/StopPoint", {
    lat: String(latitude),
    lon: String(longitude),
    radius: String(radiusM),
    stopTypes: DEFAULT_STOP_TYPES,
    useStopPointHierarchy: "false",
    returnLines: "true",
  });

  const stops = Array.isArray(data?.stopPoints)
    ? data.stopPoints
    : Array.isArray(data)
      ? data
      : [];

  const unique = new Map();
  for (const stop of stops) {
    if (!stop || typeof stop !== "object") continue;
    const name = (stop.commonName || "").trim();
    if (!name || stop.lat == null || stop.lon == null) continue;

    const modes = Array.isArray(stop.modes) ? stop.modes : [];
    if (modes.length && modes.every((m) => m === "bus")) continue;

    const key = name.toLowerCase();
    const candidate = {
      id: String(stop.id || stop.naptanId || key),
      name,
      modes: modes.filter((m) => m && m !== "bus").map(String),
      lines: stationLines(stop),
      latitude: Number(stop.lat),
      longitude: Number(stop.lon),
      distance_metres:
        stop.distance != null ? Number(stop.distance) : null,
      stop_type: stop.stopType || null,
    };

    const existing = unique.get(key);
    if (!existing) {
      unique.set(key, candidate);
      continue;
    }
    const oldD = existing.distance_metres;
    const newD = candidate.distance_metres;
    const closer = newD != null && (oldD == null || newD < oldD);
    const richer =
      (!existing.modes.length && candidate.modes.length) ||
      (!existing.lines.length && candidate.lines.length);
    if (closer || (newD === oldD && richer)) unique.set(key, candidate);
  }

  return [...unique.values()].sort((a, b) => {
    const ad = a.distance_metres;
    const bd = b.distance_metres;
    if (ad == null && bd == null) return 0;
    if (ad == null) return 1;
    if (bd == null) return -1;
    return ad - bd;
  });
}

function parseLineString(raw) {
  if (raw == null) return [];
  let points = raw;
  if (typeof raw === "string") {
    try {
      points = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(points)) return [];
  const out = [];
  for (const pt of points) {
    if (Array.isArray(pt) && pt.length >= 2) {
      const a = Number(pt[0]);
      const b = Number(pt[1]);
      if (Number.isFinite(a) && Number.isFinite(b)) out.push([a, b]);
    }
  }
  return out;
}

async function walkingRoute(fromLat, fromLon, toLat, toLon) {
  const fromPlace = `${fromLat},${fromLon}`;
  const toPlace = `${toLat},${toLon}`;
  const path = `/Journey/JourneyResults/${encodeURIComponent(fromPlace)}/to/${encodeURIComponent(toPlace)}`;
  let data;
  try {
    data = await tflGet(path, { mode: "walking" });
  } catch {
    return null;
  }

  const journeys = data?.journeys;
  if (!Array.isArray(journeys) || !journeys.length) return null;

  const best = journeys.reduce((a, b) => {
    const ad = a.duration ?? 1e9;
    const bd = b.duration ?? 1e9;
    return ad <= bd ? a : b;
  });

  let walkingDistance = 0;
  const pathPoints = [];
  for (const leg of best.legs || []) {
    if (!leg || typeof leg !== "object") continue;
    if (leg.distance != null) {
      const d = Number(leg.distance);
      if (Number.isFinite(d)) walkingDistance += d;
    }
    pathPoints.push(...parseLineString(leg.path?.lineString));
  }

  return {
    walking_duration_minutes:
      best.duration != null ? Math.round(Number(best.duration)) : null,
    walking_distance_metres: walkingDistance
      ? Math.round(walkingDistance)
      : null,
    walking_path: pathPoints,
  };
}

async function enrichWithNearbyStations(latitude, longitude) {
  const stations = (await findNearbyStations(latitude, longitude)).filter(
    (s) => s.modes?.length
  );

  const enriched = [];
  const targets = stations.slice(0, MAX_WALKING_ROUTES);
  const routes = await Promise.all(
    targets.map((station) =>
      walkingRoute(
        latitude,
        longitude,
        station.latitude,
        station.longitude
      ).then((route) => ({ station, route }))
    )
  );

  for (const { station, route } of routes) {
    if (
      !route ||
      (route.walking_duration_minutes == null &&
        route.walking_distance_metres == null)
    ) {
      continue;
    }
    enriched.push({ ...station, ...route });
  }

  // If walking enrichment failed entirely, fall back to crow-flies list.
  if (!enriched.length) {
    return stations.slice(0, MAX_WALKING_ROUTES).map((s) => ({ ...s }));
  }
  return enriched;
}

function formatPinAddress(addr) {
  if (!addr || typeof addr !== "object") return null;
  const parts = [];
  if (addr.house_number && addr.road) {
    parts.push(`${addr.house_number} ${addr.road}`);
  } else if (addr.road) {
    parts.push(addr.road);
  } else if (addr.pedestrian) {
    parts.push(addr.pedestrian);
  } else if (addr.building) {
    parts.push(addr.building);
  }

  const locality = addr.suburb || addr.neighbourhood || addr.city_district;
  if (locality) parts.push(locality);

  const town = addr.city || addr.town || addr.village || addr.municipality;
  if (town && town !== locality) parts.push(town);

  if (addr.postcode) parts.push(addr.postcode);
  return parts.length ? parts.join(", ") : null;
}

/**
 * Reverse-geocode the map pin (not the portal street label).
 * Stations and walks are always computed from lat/long; this only labels the pin.
 */
async function reverseGeocode(latitude, longitude) {
  const query = new URLSearchParams({
    format: "jsonv2",
    lat: String(latitude),
    lon: String(longitude),
    zoom: "18",
    addressdetails: "1",
  });
  const url = `https://nominatim.openstreetmap.org/reverse?${query}`;
  const resp = await fetch(url, {
    headers: {
      Accept: "application/json",
      // Nominatim asks apps to identify themselves (User-Agent is forbidden in
      // extension fetch, so we use this + the default Chrome UA).
      "Accept-Language": "en-GB,en;q=0.9",
    },
  });
  if (!resp.ok) {
    throw new Error(`Nominatim HTTP ${resp.status}`);
  }
  const data = await resp.json();
  const pinAddress =
    formatPinAddress(data.address) || data.display_name || null;
  return {
    pin_address: pinAddress,
    pin_address_full: data.display_name || pinAddress,
    pin_address_source: "nominatim",
  };
}

async function lookupFromCoords(latitude, longitude) {
  const [stations, geocode] = await Promise.all([
    enrichWithNearbyStations(latitude, longitude),
    reverseGeocode(latitude, longitude).catch(() => ({
      pin_address: null,
      pin_address_full: null,
      pin_address_source: null,
    })),
  ]);
  return {
    latitude,
    longitude,
    stations,
    ...geocode,
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "LOOKUP_FROM_COORDS") return;

  const latitude = Number(message.latitude);
  const longitude = Number(message.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    sendResponse({ ok: false, error: "Missing coordinates." });
    return;
  }

  lookupFromCoords(latitude, longitude)
    .then((result) => sendResponse({ ok: true, ...result }))
    .catch((err) =>
      sendResponse({ ok: false, error: err?.message || String(err) })
    );

  return true; // keep channel open for async response
});
