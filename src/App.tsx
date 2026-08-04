import MapView from './components/MapView'
import './App.css'

function App() {
  return (
    <div className="app">
      <aside className="sidebar">
        <header className="sidebar-header">
          <h1>London Station Walk Finder</h1>
          <p className="tagline">
            Find walking routes to Tube and rail stations within 1.5 miles of any
            London address.
          </p>
        </header>
      </aside>
      <main className="map-area">
        <MapView />
      </main>
    </div>
  )
}

export default App
