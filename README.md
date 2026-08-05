# London Station Walk Finder

A web app that, given an address in London, shows on a map the walking routes to the
closest Tube and rail stations within 1.5 miles.

## How it works

- **Network map** — Tube, Overground, DLR, Elizabeth line and Tram routes are loaded
  once from the TfL Line Route Sequence API and drawn permanently so you can see how
  stations connect. Toggle individual lines via the Lines control on the map.
- **Coverage areas** — a transparent circle (800 m, ~10‑minute walk) is drawn around
  every network station, including London National Rail stations (kept inside a
  Greater London bounding box). Overlaps highlight better‑connected areas. The shape
  is abstracted so circles can later be replaced with isochrones or other polygons.
  Toggle with the Coverage control on the map (independent of search and lines).
- **Geocoding** — the address is resolved to coordinates using the
  [Nominatim](https://nominatim.org/release-docs/latest/api/Search/) (OpenStreetMap) search API,
  restricted to a Greater London bounding box.
- **Nearby stations** — stations within 1.5 miles (2414 m) are found via the
  [TfL Unified API](https://api.tfl.gov.uk/) `StopPoint` radius search.
- **Walking routes** — the actual walking paths and durations come from the TfL Journey Planner
  (`mode=walking`), and are drawn on the map.
- **Map** — [Leaflet](https://leafletjs.com/) with OpenStreetMap tiles.

National Rail stations are included in coverage, but National Rail route *paths* are
not drawn on the Lines overlay — TfL only publishes geometry for modes it operates.

No API keys or backend required; everything runs in the browser.

## Development

```bash
npm install
npm run dev
```

Then open the printed URL (defaults to http://localhost:5173) and search for a London
address, e.g. "10 Downing Street".

## Build

```bash
npm run build
npm run preview
```

## Deploy (GitHub Pages)

The app is a static Vite build and deploys automatically via GitHub Actions on pushes to `main`.

1. In the repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. After the first successful workflow run, the site is at:
   https://fferegrino.github.io/close-stations/

## Stack

- [Vite](https://vite.dev/) + [React](https://react.dev/) + TypeScript
- [Leaflet](https://leafletjs.com/) / [react-leaflet](https://react-leaflet.js.org/)
