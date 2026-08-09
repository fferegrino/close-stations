const coordsEl = document.getElementById("coords");
const pinAddressEl = document.getElementById("pin-address");
const statusEl = document.getElementById("status");
const stationsEl = document.getElementById("stations");
const keyInput = document.getElementById("tfl-key");
const idInput = document.getElementById("tfl-id");
const saveBtn = document.getElementById("save-key");
const keySaved = document.getElementById("key-saved");

const MODE_LABELS = {
  tube: "Tube",
  metro: "Metro",
  "national-rail": "Rail",
  overground: "Overground",
  dlr: "DLR",
  "elizabeth-line": "Elizabeth",
  tram: "Tram",
  "river-bus": "River",
  "river-tour": "River",
  ferry: "Ferry",
  "cable-car": "Cable",
};

function setStatus(text, kind = "loading") {
  statusEl.hidden = false;
  stationsEl.hidden = true;
  statusEl.className = `status ${kind}`;
  statusEl.textContent = text;
}

function showCoords(latitude, longitude) {
  coordsEl.textContent = `${Number(latitude).toFixed(5)}, ${Number(longitude).toFixed(5)}`;
}

function showPinAddress(address) {
  if (!address) {
    pinAddressEl.hidden = true;
    pinAddressEl.textContent = "";
    return;
  }
  pinAddressEl.hidden = false;
  pinAddressEl.textContent = `Pin ≈ ${address}`;
}

function shortName(name) {
  return (name || "")
    .replace(/\s+Underground Station$/i, "")
    .replace(/\s+Rail Station$/i, "")
    .replace(/\s+DLR Station$/i, "")
    .replace(/\s+Station$/i, "")
    .trim();
}

function formatMetres(m) {
  if (m == null || !Number.isFinite(m)) return null;
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

function modeClass(mode) {
  return `mode ${String(mode).toLowerCase().replace(/\s+/g, "-")}`;
}

function renderStations(stations) {
  statusEl.hidden = true;
  stationsEl.hidden = false;
  stationsEl.replaceChildren();

  if (!stations.length) {
    setStatus("No rail/tube stations found within 1.5 miles.", "warn");
    return;
  }

  for (const station of stations) {
    const li = document.createElement("li");

    const top = document.createElement("div");
    top.className = "station-top";

    const name = document.createElement("div");
    name.className = "station-name";
    name.textContent = shortName(station.name);

    const walk = document.createElement("div");
    walk.className = "walk";
    if (station.walkingDurationMinutes != null) {
      walk.textContent = `${station.walkingDurationMinutes} min walk`;
    } else if (station.distanceMetres != null) {
      walk.textContent = formatMetres(station.distanceMetres);
    } else {
      walk.textContent = "";
    }

    top.append(name, walk);
    li.append(top);

    if (station.modes?.length) {
      const modes = document.createElement("div");
      modes.className = "modes";
      for (const mode of station.modes) {
        const chip = document.createElement("span");
        chip.className = modeClass(mode);
        chip.textContent = MODE_LABELS[mode] || mode;
        modes.append(chip);
      }
      li.append(modes);
    }

    if (station.lines?.length) {
      const lines = document.createElement("p");
      lines.className = "lines";
      const lineNames = station.lines
        .map((line) => (typeof line === "string" ? line : line.name))
        .filter(Boolean)
        .slice(0, 6);
      lines.textContent = lineNames.join(" · ");
      li.append(lines);
    }

    const crow = formatMetres(station.distanceMetres);
    const walkDist = formatMetres(station.walkingDistanceMetres);
    if (crow || walkDist) {
      const metaLine = document.createElement("p");
      metaLine.className = "meta";
      const bits = [];
      if (crow) bits.push(`${crow} crow-flies`);
      if (walkDist) bits.push(`${walkDist} walk`);
      metaLine.textContent = bits.join(" · ");
      li.append(metaLine);
    }

    stationsEl.append(li);
  }
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function supportedUrl(url) {
  if (!url) return false;
  try {
    const host = new URL(url).hostname;
    return (
      host.includes("rightmove.co.uk") ||
      host.includes("zoopla.co.uk") ||
      host.includes("onthemarket.com")
    );
  } catch {
    return false;
  }
}

async function ensureContentScript(tabId) {
  try {
    return await chrome.tabs.sendMessage(tabId, { type: "EXTRACT_COORDS" });
  } catch {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"],
    });
    return chrome.tabs.sendMessage(tabId, { type: "EXTRACT_COORDS" });
  }
}

async function loadKeys() {
  const { tflAppKey, tflAppId } = await chrome.storage.sync.get([
    "tflAppKey",
    "tflAppId",
  ]);
  if (tflAppKey) keyInput.value = tflAppKey;
  if (tflAppId) idInput.value = tflAppId;
}

saveBtn.addEventListener("click", async () => {
  await chrome.storage.sync.set({
    tflAppKey: keyInput.value.trim(),
    tflAppId: idInput.value.trim(),
  });
  keySaved.hidden = false;
  setTimeout(() => {
    keySaved.hidden = true;
  }, 1500);
});

async function main() {
  await loadKeys();
  setStatus("Reading map coordinates…");

  const tab = await getActiveTab();
  if (!tab?.id || !supportedUrl(tab.url)) {
    setStatus(
      "Open a Rightmove, Zoopla, or OnTheMarket listing page, then click the extension again.",
      "warn"
    );
    return;
  }

  let coords;
  try {
    coords = await ensureContentScript(tab.id);
  } catch (err) {
    setStatus(err?.message || "Could not read this page.", "error");
    return;
  }

  if (!coords?.ok) {
    setStatus(coords?.error || "No coordinates found on this page.", "error");
    return;
  }

  // Lat/long from the map pin drives everything — not the marketed street name.
  showCoords(coords.latitude, coords.longitude);
  setStatus("Looking up pin address & TfL stations…");

  let result;
  try {
    result = await chrome.runtime.sendMessage({
      type: "LOOKUP_FROM_COORDS",
      latitude: coords.latitude,
      longitude: coords.longitude,
    });
  } catch (err) {
    setStatus(err?.message || "Lookup failed.", "error");
    return;
  }

  if (!result?.ok) {
    setStatus(result?.error || "Lookup failed.", "error");
    return;
  }

  showPinAddress(result.pinAddress || result.pinAddressFull);
  renderStations(result.stations || []);
}

main();
