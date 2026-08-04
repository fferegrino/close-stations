import { metresToMiles } from '../api/tfl'
import type { Station } from '../types'

interface StationListProps {
  stations: Station[]
}

export default function StationList({ stations }: StationListProps) {
  if (stations.length === 0) return null

  return (
    <div className="station-list">
      <h2>
        {stations.length} station{stations.length === 1 ? '' : 's'} within 1.5 miles
      </h2>
      <ul>
        {stations.map((station) => (
          <li key={station.id} className="station-item">
            <div className="station-name">{station.name}</div>
            <div className="station-meta">
              <span className="station-distance">
                {metresToMiles(station.distanceMetres).toFixed(2)} mi
              </span>
              {station.modes.map((mode) => (
                <span key={mode} className={`mode-badge mode-${mode}`}>
                  {mode}
                </span>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
