import { useEffect } from 'react'
import {
  MapContainer,
  TileLayer,
  Marker,
  CircleMarker,
  Polyline,
  Popup,
  useMap,
} from 'react-leaflet'
import L from 'leaflet'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import 'leaflet/dist/leaflet.css'
import { metresToMiles } from '../api/tfl'
import { lineColor, lineTextColor } from '../lineColors'
import CatchmentLayer from './CatchmentLayer'
import type {
  GeocodedAddress,
  NetworkLine,
  Station,
  StationCatchment,
  WalkingRoute,
} from '../types'

// Vite bundling breaks Leaflet's default icon URL resolution
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
})

// Central London
const LONDON_CENTER: [number, number] = [51.5074, -0.1278]

function FitToResults({
  origin,
  stations,
}: {
  origin: GeocodedAddress | null
  stations: Station[]
}) {
  const map = useMap()

  useEffect(() => {
    if (!origin) return
    if (stations.length === 0) {
      map.flyTo([origin.lat, origin.lon], 15, { duration: 0.8 })
      return
    }
    const bounds = L.latLngBounds([
      [origin.lat, origin.lon],
      ...stations.map((s): [number, number] => [s.lat, s.lon]),
    ])
    map.flyToBounds(bounds, { padding: [40, 40], duration: 0.8 })
  }, [origin, stations, map])

  return null
}

interface MapViewProps {
  origin: GeocodedAddress | null
  stations: Station[]
  routes: Map<string, WalkingRoute>
  networkLines: NetworkLine[]
  catchments: StationCatchment[]
  showCatchments: boolean
  selectedStationId: string | null
  enabledLineIds: Set<string>
  onSelectStation: (stationId: string | null) => void
}

const FALLBACK_COLOR = '#1d70b8'
const WALK_COLOR = '#1d70b8'

export default function MapView({
  origin,
  stations,
  routes,
  networkLines,
  catchments,
  showCatchments,
  selectedStationId,
  enabledLineIds,
  onSelectStation,
}: MapViewProps) {
  function stationColor(station: Station, selected: boolean): string {
    if (selected) return '#d4351c'
    // Search markers stay fully visible and use serving-line colour regardless
    // of which network paths are toggled on the overlay.
    const firstLine = station.lines[0]
    return firstLine ? lineColor(firstLine.id) : FALLBACK_COLOR
  }

  return (
    <MapContainer
      center={LONDON_CENTER}
      zoom={12}
      className="map-container"
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* Station catchments — independent of search and line toggles */}
      <CatchmentLayer catchments={catchments} visible={showCatchments} />

      {/* Permanent TfL network paths — how stations are connected */}
      {networkLines.map((line) => {
        if (!enabledLineIds.has(line.id)) return null
        const color = lineColor(line.id)
        return line.paths.map((path, i) => (
          <Polyline
            key={`${line.id}-${i}`}
            positions={path}
            pathOptions={{
              color,
              weight: 4,
              opacity: 0.85,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
        ))
      })}

      {origin && (
        <Marker position={[origin.lat, origin.lon]}>
          <Popup>{origin.displayName}</Popup>
        </Marker>
      )}

      {/* Walking routes from the searched address */}
      {[...routes.values()].map((route) => {
        const selected = route.stationId === selectedStationId
        return (
          <Polyline
            key={`walk-${route.stationId}`}
            positions={route.path}
            pathOptions={{
              color: selected ? '#d4351c' : WALK_COLOR,
              weight: selected ? 5 : 3,
              opacity: selected ? 0.95 : 0.7,
              dashArray: selected ? undefined : '6 8',
            }}
            eventHandlers={{
              click: () => onSelectStation(route.stationId),
            }}
          />
        )
      })}

      {stations.map((station) => {
        const route = routes.get(station.id)
        const selected = station.id === selectedStationId
        const color = stationColor(station, selected)
        return (
          <CircleMarker
            key={station.id}
            center={[station.lat, station.lon]}
            radius={selected ? 10 : 8}
            pathOptions={{
              color,
              fillColor: color,
              fillOpacity: 0.85,
              weight: 2,
            }}
            eventHandlers={{
              click: () => onSelectStation(selected ? null : station.id),
            }}
          >
            <Popup>
              <strong>{station.name}</strong>
              <br />
              {metresToMiles(station.distanceMetres).toFixed(2)} mi away
              {route && (
                <>
                  <br />
                  {route.durationMinutes} min walk
                </>
              )}
              <span className="popup-lines">
                {station.lines.map((line) => (
                  <span
                    key={line.id}
                    className="line-badge"
                    style={{
                      background: lineColor(line.id),
                      color: lineTextColor(line.id),
                    }}
                  >
                    {line.name}
                  </span>
                ))}
              </span>
            </Popup>
          </CircleMarker>
        )
      })}
      <FitToResults origin={origin} stations={stations} />
    </MapContainer>
  )
}
