import { MAX_ROUTES, metresToMiles } from '../api/tfl'
import type { Station, WalkingRoute } from '../types'

interface StationListProps {
  stations: Station[]
  routes: Map<string, WalkingRoute>
  loadingRoutes: boolean
  selectedStationId: string | null
  onSelect: (stationId: string | null) => void
}

export default function StationList({
  stations,
  routes,
  loadingRoutes,
  selectedStationId,
  onSelect,
}: StationListProps) {
  if (stations.length === 0) return null

  return (
    <div className="station-list">
      <h2>
        {stations.length} station{stations.length === 1 ? '' : 's'} within 1.5 miles
      </h2>
      {loadingRoutes ? (
        <p className="loading-routes">Fetching walking routes…</p>
      ) : (
        stations.length > MAX_ROUTES && (
          <p className="routes-note">
            Walking routes shown for the {MAX_ROUTES} nearest stations.
          </p>
        )
      )}
      <ul>
        {stations.map((station) => {
          const route = routes.get(station.id)
          const selected = station.id === selectedStationId
          return (
            <li key={station.id}>
              <button
                type="button"
                className={`station-item${selected ? ' selected' : ''}`}
                onClick={() => onSelect(selected ? null : station.id)}
              >
                <div className="station-name">{station.name}</div>
                <div className="station-meta">
                  <span className="station-distance">
                    {metresToMiles(station.distanceMetres).toFixed(2)} mi
                  </span>
                  {route && (
                    <span className="station-walk-time">
                      {route.durationMinutes} min walk
                    </span>
                  )}
                  {station.modes.map((mode) => (
                    <span key={mode} className={`mode-badge mode-${mode}`}>
                      {mode}
                    </span>
                  ))}
                </div>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
