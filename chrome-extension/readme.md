# Close Stations (Chrome extension)

Popup extension for Rightmove, Zoopla, and OnTheMarket listing pages.
**Map lat/long is the source of truth** (not the marketed street name): stations
and walks are computed from the pin, and the address shown is reverse-geocoded
from those coordinates.

## Chrome Web Store zip

From the repo root:

```bash
npm run pack:extension
```

That writes `close-stations-extension-<version>.zip` with **`manifest.json` at the
zip root**. Upload that file in the
[Chrome Developer Dashboard](https://chrome.google.com/webstore/devconsole).

Or run the **Package Chrome Extension** GitHub Action, then download the artifact
and upload **that** zip as-is. Do not re-zip the folder, and do not upload an
inner nested zip — the store needs `manifest.json` in the top level of the
archive.

## Load unpacked

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → select this `chrome-extension` folder
4. Open a listing page and click the extension icon
5. After updates, rebuild if needed, then click **Reload** on the extension card

## Optional TfL key

Anonymous TfL calls work for light personal use. For higher rate limits, get a
key from https://api-portal.tfl.gov.uk/ and paste it under **TfL API key** in
the popup.

## How it works

1. **Content script** extracts **coordinates** from the page (Rightmove
   `PAGE_MODEL`, Zoopla `__next_f`, OnTheMarket `__NEXT_DATA__` / `__OTM_DATA__`,
   plus map URL / JSON-LD fallbacks). Portal street labels are ignored for
   distance. On load it also asks the service worker to **prefetch** the lookup.
2. **Service worker** reverse-geocodes the pin via Nominatim, and uses the
   shared TfL client (`shared/tfl`) for nearby stops (~1.5 mi) plus walking
   routes for the nearest stations. Completed lookups are stored in
   `chrome.storage.session` (keyed by lat/lon) so the popup can reuse them.
3. **Popup** shows lat/long first, then an editable address (from the pin), then
   stations. You can override the address and re-run the lookup, or reset to the
   map pin.
