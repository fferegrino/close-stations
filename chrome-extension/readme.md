# Close Stations (Chrome extension)

Popup extension for Rightmove, Zoopla, and OnTheMarket listing pages.
**Map lat/long is the source of truth** (not the marketed street name): stations
and walks are computed from the pin, and the address shown is reverse-geocoded
from those coordinates.

## Load unpacked

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → select this `chrome-extension` folder
4. Open a listing page and click the extension icon
5. After updates, click **Reload** on the extension card

## Optional TfL key

Anonymous TfL calls work for light personal use. For higher rate limits, get a
key from https://api-portal.tfl.gov.uk/ and paste it under **TfL API key** in
the popup.

## How it works

1. **Content script** extracts **coordinates** from the page (Rightmove
   `PAGE_MODEL`, Zoopla `__next_f`, OnTheMarket `__NEXT_DATA__` / `__OTM_DATA__`,
   plus map URL / JSON-LD fallbacks). Portal street labels are ignored for
   distance.
2. **Service worker** reverse-geocodes the pin via Nominatim, and calls TfL
   `StopPoint` (2 km) plus walking routes for the nearest stations.
3. **Popup** shows lat/long first, then `Pin ≈ …` address, then stations.
