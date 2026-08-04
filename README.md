# London Station Walk Finder

A web app that, given an address in London, shows on a map the walking routes to the
closest Tube and rail stations within 1.5 miles.

## How it works

- **Geocoding** — the address is resolved to coordinates using the
  [Nominatim](https://nominatim.org/release-docs/latest/api/Search/) (OpenStreetMap) search API,
  restricted to a Greater London bounding box.
- **Nearby stations** — stations within 1.5 miles (2414 m) are found via the
  [TfL Unified API](https://api.tfl.gov.uk/) `StopPoint` radius search.
- **Walking routes** — the actual walking paths and durations come from the TfL Journey Planner
  (`mode=walking`), and are drawn on the map.
- **Map** — [Leaflet](https://leafletjs.com/) with OpenStreetMap tiles.

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

## Stack

- [Vite](https://vite.dev/) + [React](https://react.dev/) + TypeScript
- [Leaflet](https://leafletjs.com/) / [react-leaflet](https://react-leaflet.js.org/)
