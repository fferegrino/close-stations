import { useState } from 'react'
import AddressSearch from './components/AddressSearch'
import LineFilter, { uniqueLines } from './components/LineFilter'
import StationList from './components/StationList'
import MapView from './components/MapView'
import { geocodeAddress } from './api/geocode'
import { findNearbyStations, getWalkingRoutes } from './api/tfl'
import type { GeocodedAddress, Station, WalkingRoute } from './types'
import './App.css'

function allLineIds(stations: Station[]): Set<string> {
  return new Set(uniqueLines(stations).map((line) => line.id))
}

function App() {
  const [origin, setOrigin] = useState<GeocodedAddress | null>(null)
  const [stations, setStations] = useState<Station[]>([])
  const [routes, setRoutes] = useState<Map<string, WalkingRoute>>(new Map())
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null)
  const [enabledLineIds, setEnabledLineIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [loadingRoutes, setLoadingRoutes] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSearch(address: string) {
    setLoading(true)
    setError(null)
    setOrigin(null)
    setStations([])
    setRoutes(new Map())
    setSelectedStationId(null)
    setEnabledLineIds(new Set())
    try {
      const result = await geocodeAddress(address)
      if (!result) {
        setError('Address not found in London. Try being more specific.')
        return
      }
      setOrigin(result)

      const nearby = await findNearbyStations(result)
      setStations(nearby)
      // Lines are on by default — permanent colour view until toggled off
      setEnabledLineIds(allLineIds(nearby))
      if (nearby.length === 0) {
        setError('No stations found within 1.5 miles of that address.')
        return
      }

      setLoadingRoutes(true)
      try {
        setRoutes(await getWalkingRoutes(result, nearby))
      } finally {
        setLoadingRoutes(false)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  function toggleLine(lineId: string) {
    setEnabledLineIds((prev) => {
      const next = new Set(prev)
      if (next.has(lineId)) {
        next.delete(lineId)
      } else {
        next.add(lineId)
      }
      return next
    })
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <header className="sidebar-header">
          <h1>London Station Walk Finder</h1>
          <p className="tagline">
            Find walking routes to Tube and rail stations within 1.5 miles of any
            London address.
          </p>
          <AddressSearch onSearch={handleSearch} loading={loading} />
          {error && <p className="error">{error}</p>}
          {loading && !error && (
            <p className="status">
              {origin ? 'Finding nearby stations…' : 'Looking up address…'}
            </p>
          )}
          {origin && <p className="origin-name">{origin.displayName}</p>}
        </header>
        {!origin && !loading && !error && (
          <div className="empty-state">
            <p>
              Search for a London address above to see nearby Tube and rail
              stations and the walking route to each one.
            </p>
          </div>
        )}
        <LineFilter
          stations={stations}
          enabledLineIds={enabledLineIds}
          onToggle={toggleLine}
          onShowAll={() => setEnabledLineIds(allLineIds(stations))}
        />
        <StationList
          stations={stations}
          routes={routes}
          loadingRoutes={loadingRoutes}
          selectedStationId={selectedStationId}
          enabledLineIds={enabledLineIds}
          onSelect={setSelectedStationId}
        />
      </aside>
      <main className="map-area">
        <MapView
          origin={origin}
          stations={stations}
          routes={routes}
          selectedStationId={selectedStationId}
          enabledLineIds={enabledLineIds}
          onSelectStation={setSelectedStationId}
        />
      </main>
    </div>
  )
}

export default App
