import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import 'leaflet/dist/leaflet.css'
import type { GeocodedAddress } from '../types'

// Vite bundling breaks Leaflet's default icon URL resolution
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
})

// Central London
const LONDON_CENTER: [number, number] = [51.5074, -0.1278]

function FlyToOrigin({ origin }: { origin: GeocodedAddress | null }) {
  const map = useMap()

  useEffect(() => {
    if (origin) {
      map.flyTo([origin.lat, origin.lon], 15, { duration: 0.8 })
    }
  }, [origin, map])

  return null
}

interface MapViewProps {
  origin: GeocodedAddress | null
}

export default function MapView({ origin }: MapViewProps) {
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
      <FlyToOrigin origin={origin} />
    </MapContainer>
  )
}
