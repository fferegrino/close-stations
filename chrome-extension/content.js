/**
 * Extract listing coordinates from Rightmove / Zoopla / OnTheMarket pages.
 * Mirrors the portal parsers in the house_move Python project.
 */

function asCoords(lat, lon) {
  const latitude = Number(lat);
  const longitude = Number(lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  if (latitude === 0 && longitude === 0) return null;
  return { latitude, longitude };
}

function coordsFromMapping(obj) {
  if (!obj || typeof obj !== "object") return null;
  return asCoords(
    obj.latitude ?? obj.lat,
    obj.longitude ?? obj.lon ?? obj.lng
  );
}

function firstJsonObject(text, start = 0) {
  const brace = text.indexOf("{", start);
  if (brace < 0) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = brace; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escape) escape = false;
      else if (ch === "\\") escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(brace, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function walkForCoords(obj, path = []) {
  const found = [];
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    const coords = coordsFromMapping(obj);
    if (coords) {
      const joined = path.join("/").toLowerCase();
      let score = 0;
      if (joined.includes("location")) score += 3;
      if (/(property|listing|pageprops|propertydata)/.test(joined)) score += 2;
      if (/(agent|branch|customer)/.test(joined)) score -= 2;
      found.push({ score, coords });
    }
    for (const [key, value] of Object.entries(obj)) {
      found.push(...walkForCoords(value, [...path, String(key)]));
    }
  } else if (Array.isArray(obj)) {
    for (const item of obj) found.push(...walkForCoords(item, path));
  }
  return found;
}

function bestCoords(candidates) {
  if (!candidates.length) return null;
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0].coords;
}

function decodeEncodedPageModel(encoded) {
  let nodes;
  try {
    nodes = JSON.parse(encoded.data);
  } catch {
    return null;
  }
  if (!Array.isArray(nodes) || !nodes.length) return null;

  function decode(idx) {
    if (typeof idx !== "number" || idx < 0 || idx >= nodes.length) return idx;
    const node = nodes[idx];
    if (node && typeof node === "object" && !Array.isArray(node)) {
      const out = {};
      for (const [k, v] of Object.entries(node)) out[k] = decode(v);
      return out;
    }
    if (Array.isArray(node)) return node.map(decode);
    return node;
  }

  const root = decode(0);
  if (root && typeof root === "object" && root.propertyData) return root.propertyData;
  if (root && typeof root === "object") return root.propertyData || root;
  return null;
}

function extractRightmove(html) {
  const marker = html.search(/PAGE_MODEL\s*=\s*/);
  if (marker < 0) return null;
  const eq = html.indexOf("=", marker);
  const model = firstJsonObject(html, eq + 1);
  if (!model || typeof model !== "object") return null;

  let data = model;
  if (model.encoding === "on") data = decodeEncodedPageModel(model);
  else if (model.propertyData) data = model.propertyData;
  if (!data || typeof data !== "object") return null;

  const coords = coordsFromMapping(data.location);
  if (!coords) return null;

  let address = null;
  if (data.address && typeof data.address === "object") {
    address = data.address.displayAddress || null;
  } else if (typeof data.address === "string") {
    address = data.address;
  }
  return { ...coords, address, source: "rightmove" };
}

function listingBitsFromNextFlight(html) {
  const chunks = [];
  const pushRe = /__next_f\.push\(\[([\s\S]*?)\]\)\s*;?/g;
  let m;
  while ((m = pushRe.exec(html))) chunks.push(m[1]);
  const scopes = chunks.length ? chunks : [html];

  const addressPatterns = [
    /"address"\s*:\s*\{\s*"address"\s*:\s*"((?:\\.|[^"\\])*)"\s*,\s*"latitude"\s*:\s*(-?\d+(?:\.\d+)?)\s*,\s*"longitude"\s*:\s*(-?\d+(?:\.\d+)?)/,
    /\\"address\\"\s*:\s*\{\s*\\"address\\"\s*:\s*\\"((?:\\.|[^"\\])*)\\"\s*,\s*\\"latitude\\"\s*:\s*(-?\d+(?:\.\d+)?)\s*,\s*\\"longitude\\"\s*:\s*(-?\d+(?:\.\d+)?)/,
  ];
  const coordPatterns = [
    /"latitude"\s*:\s*(-?\d+(?:\.\d+)?)\s*,\s*"longitude"\s*:\s*(-?\d+(?:\.\d+)?)/,
    /\\"latitude\\"\s*:\s*(-?\d+(?:\.\d+)?)\s*,\s*\\"longitude\\"\s*:\s*(-?\d+(?:\.\d+)?)/,
  ];

  for (const scope of scopes) {
    for (const pattern of addressPatterns) {
      const match = pattern.exec(scope);
      if (!match) continue;
      const coords = asCoords(match[2], match[3]);
      if (!coords) continue;
      let address = match[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\");
      try {
        address = JSON.parse(`"${match[1]}"`);
      } catch {
        /* keep unescape above */
      }
      return { ...coords, address, source: "zoopla-flight" };
    }
  }

  for (const scope of scopes) {
    for (const pattern of coordPatterns) {
      const match = pattern.exec(scope);
      if (!match) continue;
      const coords = asCoords(match[1], match[2]);
      if (coords) return { ...coords, address: null, source: "zoopla-flight" };
    }
  }
  return null;
}

function scriptJson(html, ...markers) {
  for (const markerRe of markers) {
    const match = html.match(markerRe);
    if (!match) continue;
    const data = firstJsonObject(html, match.index + match[0].length);
    if (data != null) return data;
  }
  return null;
}

function coordsFromMapUrls(html) {
  const patterns = [
    /[?&]center=(-?\d+\.\d+),(-?\d+\.\d+)/i,
    /\/static\/(-?\d+\.\d+),(-?\d+\.\d+)\//i,
    /[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/i,
    /@(-?\d+\.\d+),(-?\d+\.\d+)(?:,|\/)/,
    /markers=[^"'\s]*?(-?\d+\.\d+),(-?\d+\.\d+)/i,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (!match) continue;
    const coords = asCoords(match[1], match[2]);
    if (coords) return { ...coords, address: null, source: "map-url" };
  }
  return null;
}

function coordsFromJsonLd() {
  const tags = document.querySelectorAll('script[type="application/ld+json"]');
  for (const tag of tags) {
    const raw = tag.textContent || "";
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      continue;
    }
    const best = bestCoords(walkForCoords(data));
    if (best) return { ...best, address: null, source: "json-ld" };
    if (data && typeof data === "object") {
      const geo = coordsFromMapping(data.geo);
      if (geo) return { ...geo, address: null, source: "json-ld" };
    }
  }
  return null;
}

function extractEmbeddedNext(html) {
  const data = scriptJson(
    html,
    /id="__NEXT_DATA__"[^>]*>/,
    /__NEXT_DATA__\s*=\s*/,
    /window\.__OTM_DATA__\s*=\s*/,
    /__OTM_DATA__\s*=\s*/
  );
  if (data == null) return null;
  const best = bestCoords(walkForCoords(data));
  if (!best) return null;
  return { ...best, address: null, source: "next-data" };
}

function extractCoords() {
  const html = document.documentElement.outerHTML;
  const host = location.hostname;

  if (host.includes("rightmove")) {
    return (
      extractRightmove(html) ||
      coordsFromMapUrls(html) ||
      coordsFromJsonLd()
    );
  }

  if (host.includes("zoopla")) {
    return (
      listingBitsFromNextFlight(html) ||
      extractEmbeddedNext(html) ||
      coordsFromMapUrls(html) ||
      coordsFromJsonLd()
    );
  }

  if (host.includes("onthemarket")) {
    return (
      extractEmbeddedNext(html) ||
      coordsFromMapUrls(html) ||
      coordsFromJsonLd()
    );
  }

  return (
    extractRightmove(html) ||
    listingBitsFromNextFlight(html) ||
    extractEmbeddedNext(html) ||
    coordsFromMapUrls(html) ||
    coordsFromJsonLd()
  );
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "EXTRACT_COORDS") return;
  try {
    const result = extractCoords();
    if (!result) {
      sendResponse({ ok: false, error: "No coordinates found on this page." });
      return;
    }
    sendResponse({ ok: true, ...result, url: location.href });
  } catch (err) {
    sendResponse({ ok: false, error: err?.message || String(err) });
  }
});
