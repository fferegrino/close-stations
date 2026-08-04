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
import type { GeocodedAddress, Station, WalkingRoute } from '../types'

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
  selectedStationId: string | null
  activeLineIds: Set<string>
  onSelectStation: (stationId: string | null) => void
}

const DIMMED_COLOR = '#9ca3af'

export default function MapView({
  origin,
  stations,
  routes,
  selectedStationId,
  activeLineIds,
  onSelectStation,
}: MapViewProps) {
  const stationsById = new Map(stations.map((s) => [s.id, s]))

  /**
   * Marker/route colour for a station given the active line highlights:
   * red when selected, the first matching line's colour when highlighted,
   * grey when filtered out, TfL blue otherwise.
   */
  function stationColor(station: Station, selected: boolean): string {
    if (selected) return '#d4351c'
    if (activeLineIds.size === 0) return '#1d70b8'
    const match = station.lines.find((line) => activeLineIds.has(line.id))
    return match ? lineColor(match.id) : DIMMED_COLOR
  }

  function isDimmed(station: Station): boolean {
    return (
      activeLineIds.size > 0 &&
      !station.lines.some((line) => activeLineIds.has(line.id))
    )
  }
  return (
    <MapContainer
      center={LONDON_CENTER}
      zoom={13}
      className="map-container"
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {origin && (
        <Marker position={[origin.lat, origin.lon]}>
          <Popup>{origin.displayName}</Popup>
        </Marker>
      )}
      {[...routes.values()].map((route) => {
        const selected = route.stationId === selectedStationId
        const station = stationsById.get(route.stationId)
        const dimmed = station ? isDimmed(station) : false
        const color = station ? stationColor(station, selected) : '#1d70b8'
        return (
          <Polyline
            key={route.stationId}
            positions={route.path}
            pathOptions={{
              color,
              weight: selected ? 5 : 3,
              opacity: selected ? 0.95 : dimmed ? 0.2 : 0.6,
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
              fillOpacity: isDimmed(station) ? 0.35 : 0.8,
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
