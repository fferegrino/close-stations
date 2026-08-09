//#region shared/tfl/constants.ts
var TFL_BASE = "https://api.tfl.gov.uk";
//#endregion
//#region shared/tfl/client.ts
function authQuery(auth) {
	const params = {};
	if (auth?.appKey) params.app_key = auth.appKey;
	if (auth?.appId) params.app_id = auth.appId;
	return params;
}
/**
* GET a TfL Unified API path with query params.
* Throws on non-OK responses (callers that want soft-fail should catch).
*/
async function tflGet(path, params = {}, auth) {
	const url = `${TFL_BASE}${path}?${new URLSearchParams({
		...params,
		...authQuery(auth)
	})}`;
	const response = await fetch(url);
	if (!response.ok) {
		const body = (await response.text()).slice(0, 300);
		throw new Error(`TfL HTTP ${response.status}: ${body}`);
	}
	return response.json();
}
//#endregion
//#region shared/tfl/stations.ts
function titleCaseId(id) {
	return id.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
/** Prefer non-bus lineModeGroups; fall back to the raw lines list. */
function stationLines(stop) {
	const rawLines = stop.lines ?? [];
	const idToName = /* @__PURE__ */ new Map();
	for (const line of rawLines) if (line?.id && line?.name) idToName.set(String(line.id), String(line.name));
	const result = [];
	const seen = /* @__PURE__ */ new Set();
	const groups = stop.lineModeGroups ?? [];
	if (groups.length) {
		for (const group of groups) {
			if (!group || group.modeName === "bus") continue;
			for (const lid of group.lineIdentifier ?? []) {
				const id = String(lid);
				if (seen.has(id)) continue;
				seen.add(id);
				result.push({
					id,
					name: idToName.get(id) ?? titleCaseId(id)
				});
			}
		}
		return result;
	}
	for (const line of rawLines) {
		if (!line?.id || !line?.name) continue;
		if (/^\d+$/.test(String(line.name))) continue;
		const id = String(line.id);
		if (seen.has(id)) continue;
		seen.add(id);
		result.push({
			id,
			name: String(line.name)
		});
	}
	return result;
}
/**
* Find Tube, rail (and related) stations within the search radius,
* sorted by straight-line distance (nearest first). Dedupes by name.
*/
async function findNearbyStations(origin, options = {}) {
	const radius = options.radiusMetres ?? 2414;
	const stopTypes = options.stopTypes ?? "NaptanMetroStation,NaptanRailStation,NaptanFerryPort,TransportInterchange";
	const data = await tflGet("/StopPoint", {
		lat: String(origin.lat),
		lon: String(origin.lon),
		radius: String(radius),
		stopTypes,
		useStopPointHierarchy: "false",
		returnLines: "true"
	}, options.auth);
	const stops = Array.isArray(data) ? data : Array.isArray(data.stopPoints) ? data.stopPoints : [];
	const unique = /* @__PURE__ */ new Map();
	for (const stop of stops) {
		if (!stop || typeof stop !== "object") continue;
		const name = (stop.commonName ?? "").trim();
		if (!name || stop.lat == null || stop.lon == null) continue;
		const modes = (stop.modes ?? []).filter((m) => Boolean(m) && m !== "bus").map(String);
		if ((stop.modes ?? []).length && modes.length === 0) continue;
		if (stop.distance == null || !Number.isFinite(Number(stop.distance))) continue;
		const candidate = {
			id: String(stop.naptanId || stop.id || name.toLowerCase()),
			name,
			distanceMetres: Number(stop.distance),
			lat: Number(stop.lat),
			lon: Number(stop.lon),
			modes,
			lines: stationLines(stop),
			stopType: stop.stopType ?? null
		};
		const key = name.toLowerCase();
		const existing = unique.get(key);
		if (!existing) {
			unique.set(key, candidate);
			continue;
		}
		const closer = candidate.distanceMetres < existing.distanceMetres;
		const richer = !existing.modes.length && candidate.modes.length || !existing.lines.length && candidate.lines.length;
		if (closer || candidate.distanceMetres === existing.distanceMetres && richer) unique.set(key, candidate);
	}
	return [...unique.values()].sort((a, b) => a.distanceMetres - b.distanceMetres);
}
//#endregion
//#region shared/tfl/walking.ts
function parseLineString(raw) {
	if (raw == null) return [];
	let points = raw;
	if (typeof raw === "string") try {
		points = JSON.parse(raw);
	} catch {
		return [];
	}
	if (!Array.isArray(points)) return [];
	const out = [];
	for (const pt of points) if (Array.isArray(pt) && pt.length >= 2) {
		const a = Number(pt[0]);
		const b = Number(pt[1]);
		if (Number.isFinite(a) && Number.isFinite(b)) out.push([a, b]);
	}
	return out;
}
/**
* Walking route from origin to a station via the TfL Journey Planner.
* Returns null when no walking journey is available.
*/
async function getWalkingRoute(origin, station, options = {}) {
	const from = `${origin.lat},${origin.lon}`;
	const to = `${station.lat},${station.lon}`;
	const path = `/Journey/JourneyResults/${encodeURIComponent(from)}/to/${encodeURIComponent(to)}`;
	let data;
	try {
		data = await tflGet(path, { mode: "walking" }, options.auth);
	} catch {
		return null;
	}
	const journeys = data.journeys;
	if (!Array.isArray(journeys) || journeys.length === 0) return null;
	const journey = journeys.reduce((best, candidate) => {
		const bestDuration = best.duration ?? Number.POSITIVE_INFINITY;
		return (candidate.duration ?? Number.POSITIVE_INFINITY) < bestDuration ? candidate : best;
	});
	let walkingDistance = 0;
	const routePath = [];
	for (const leg of journey.legs ?? []) {
		if (leg.distance != null) {
			const d = Number(leg.distance);
			if (Number.isFinite(d)) walkingDistance += d;
		}
		routePath.push(...parseLineString(leg.path?.lineString));
	}
	if (journey.duration == null && routePath.length === 0 && !walkingDistance) return null;
	return {
		stationId: station.id,
		durationMinutes: Math.round(Number(journey.duration ?? 0)),
		distanceMetres: walkingDistance ? Math.round(walkingDistance) : null,
		path: routePath
	};
}
/**
* Fetch walking routes to the nearest stations in parallel, tolerating
* individual failures. Returns a map keyed by station id.
*/
async function getWalkingRoutes(origin, stations, options = {}) {
	const maxRoutes = options.maxRoutes ?? 8;
	const targets = stations.slice(0, maxRoutes);
	const results = await Promise.allSettled(targets.map((station) => getWalkingRoute(origin, station, options)));
	const routes = /* @__PURE__ */ new Map();
	results.forEach((result, i) => {
		if (result.status === "fulfilled" && result.value) routes.set(targets[i].id, result.value);
	});
	return routes;
}
//#endregion
//#region chrome-extension/background.ts
/**
* Extension service worker: pin lookup via shared TfL client + Nominatim reverse geocode.
*/
async function loadTflAuth() {
	const { tflAppKey, tflAppId } = await chrome.storage.sync.get(["tflAppKey", "tflAppId"]);
	return {
		appKey: typeof tflAppKey === "string" ? tflAppKey : void 0,
		appId: typeof tflAppId === "string" ? tflAppId : void 0
	};
}
async function enrichWithNearbyStations(latitude, longitude) {
	const origin = {
		lat: latitude,
		lon: longitude
	};
	const auth = await loadTflAuth();
	const stations = (await findNearbyStations(origin, { auth })).filter((s) => s.modes.length > 0);
	const routes = await getWalkingRoutes(origin, stations, { auth });
	const enriched = [];
	for (const station of stations.slice(0, 8)) {
		const route = routes.get(station.id);
		if (!route) continue;
		if (route.durationMinutes == null && route.distanceMetres == null) continue;
		enriched.push({
			...station,
			walkingDurationMinutes: route.durationMinutes,
			walkingDistanceMetres: route.distanceMetres,
			walkingPath: route.path
		});
	}
	if (!enriched.length) return stations.slice(0, 8).map((s) => ({
		...s,
		walkingDurationMinutes: null,
		walkingDistanceMetres: null,
		walkingPath: []
	}));
	return enriched;
}
function formatPinAddress(addr) {
	if (!addr || typeof addr !== "object") return null;
	const parts = [];
	if (addr.house_number && addr.road) parts.push(`${addr.house_number} ${addr.road}`);
	else if (addr.road) parts.push(addr.road);
	else if (addr.pedestrian) parts.push(addr.pedestrian);
	else if (addr.building) parts.push(addr.building);
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
	const url = `https://nominatim.openstreetmap.org/reverse?${new URLSearchParams({
		format: "jsonv2",
		lat: String(latitude),
		lon: String(longitude),
		zoom: "18",
		addressdetails: "1"
	})}`;
	const resp = await fetch(url, { headers: {
		Accept: "application/json",
		"Accept-Language": "en-GB,en;q=0.9"
	} });
	if (!resp.ok) throw new Error(`Nominatim HTTP ${resp.status}`);
	const data = await resp.json();
	const pinAddress = formatPinAddress(data.address) || data.display_name || null;
	return {
		pinAddress,
		pinAddressFull: data.display_name || pinAddress,
		pinAddressSource: "nominatim"
	};
}
async function lookupFromCoords(latitude, longitude, addressMeta) {
	const [stations, geocode] = await Promise.all([enrichWithNearbyStations(latitude, longitude), addressMeta ? Promise.resolve(addressMeta) : reverseGeocode(latitude, longitude).catch(() => ({
		pinAddress: null,
		pinAddressFull: null,
		pinAddressSource: null
	}))]);
	return {
		latitude,
		longitude,
		stations,
		...geocode
	};
}
/**
* Forward-geocode an address (Greater London) then run the usual station lookup.
*/
async function geocodeAddress(address) {
	const query = address.trim();
	if (!query) throw new Error("Enter an address.");
	const url = `https://nominatim.openstreetmap.org/search?${new URLSearchParams({
		q: query,
		format: "jsonv2",
		limit: "1",
		viewbox: "-0.5103,51.6919,0.3340,51.2868",
		bounded: "1",
		countrycodes: "gb"
	})}`;
	const resp = await fetch(url, { headers: {
		Accept: "application/json",
		"Accept-Language": "en-GB,en;q=0.9"
	} });
	if (!resp.ok) throw new Error(`Nominatim HTTP ${resp.status}`);
	const results = await resp.json();
	if (!results.length) throw new Error("Address not found in London. Try being more specific.");
	const first = results[0];
	return {
		latitude: Number(first.lat),
		longitude: Number(first.lon),
		pinAddress: first.display_name,
		pinAddressFull: first.display_name,
		pinAddressSource: "nominatim-search"
	};
}
async function lookupFromAddress(address) {
	const geocoded = await geocodeAddress(address);
	return lookupFromCoords(geocoded.latitude, geocoded.longitude, {
		pinAddress: geocoded.pinAddress,
		pinAddressFull: geocoded.pinAddressFull,
		pinAddressSource: geocoded.pinAddressSource
	});
}
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
	if (message?.type === "LOOKUP_FROM_COORDS") {
		const latitude = Number(message.latitude);
		const longitude = Number(message.longitude);
		if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
			sendResponse({
				ok: false,
				error: "Missing coordinates."
			});
			return;
		}
		lookupFromCoords(latitude, longitude).then((result) => sendResponse({
			ok: true,
			...result
		})).catch((err) => sendResponse({
			ok: false,
			error: err instanceof Error ? err.message : String(err)
		}));
		return true;
	}
	if (message?.type === "LOOKUP_FROM_ADDRESS") {
		lookupFromAddress(String(message.address ?? "")).then((result) => sendResponse({
			ok: true,
			...result,
			overridden: true
		})).catch((err) => sendResponse({
			ok: false,
			error: err instanceof Error ? err.message : String(err)
		}));
		return true;
	}
});
//#endregion

//# sourceMappingURL=background.js.map