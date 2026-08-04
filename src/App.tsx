import { useState } from 'react'
import AddressSearch from './components/AddressSearch'
import MapView from './components/MapView'
import { geocodeAddress } from './api/geocode'
import type { GeocodedAddress } from './types'
import './App.css'

function App() {
  const [origin, setOrigin] = useState<GeocodedAddress | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSearch(address: string) {
    setLoading(true)
    setError(null)
    try {
      const result = await geocodeAddress(address)
      if (!result) {
        setError('Address not found in London. Try being more specific.')
        setOrigin(null)
        return
      }
      setOrigin(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      setOrigin(null)
    } finally {
      setLoading(false)
    }
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
          {origin && <p className="origin-name">{origin.displayName}</p>}
        </header>
      </aside>
      <main className="map-area">
        <MapView origin={origin} />
      </main>
    </div>
  )
}

export default App
