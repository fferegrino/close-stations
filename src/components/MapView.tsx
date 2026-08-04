import { useEffect } from 'react'
import {
  MapContainer,
  TileLayer,
  Marker,
  CircleMarker,
  Popup,
  useMap,
} from 'react-leaflet'
import L from 'leaflet'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import 'leaflet/dist/leaflet.css'
import { metresToMiles } from '../api/tfl'
import type { GeocodedAddress, Station } from '../types'

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
}

export default function MapView({ origin, stations }: MapViewProps) {
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
      {stations.map((station) => (
        <CircleMarker
          key={station.id}
          center={[station.lat, station.lon]}
          radius={8}
          pathOptions={{
            color: '#1d70b8',
            fillColor: '#1d70b8',
            fillOpacity: 0.8,
            weight: 2,
          }}
        >
          <Popup>
            <strong>{station.name}</strong>
            <br />
            {metresToMiles(station.distanceMetres).toFixed(2)} mi away
          </Popup>
        </CircleMarker>
      ))}
      <FitToResults origin={origin} stations={stations} />
    </MapContainer>
  )
}
