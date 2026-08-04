import { MapContainer, TileLayer } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

// Central London
const LONDON_CENTER: [number, number] = [51.5074, -0.1278]

export default function MapView() {
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
    </MapContainer>
  )
}
