import { useMemo } from 'react'
import { lineColor, lineTextColor } from '../lineColors'
import type { Station, StationLine } from '../types'

interface LineFilterProps {
  stations: Station[]
  enabledLineIds: Set<string>
  onToggle: (lineId: string) => void
  onShowAll: () => void
}

export function uniqueLines(stations: Station[]): StationLine[] {
  const byId = new Map<string, StationLine>()
  for (const station of stations) {
    for (const line of station.lines) {
      byId.set(line.id, line)
    }
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name))
}

export default function LineFilter({
  stations,
  enabledLineIds,
  onToggle,
  onShowAll,
}: LineFilterProps) {
  const lines = useMemo(() => uniqueLines(stations), [stations])
  const allOn = lines.length > 0 && lines.every((line) => enabledLineIds.has(line.id))

  if (lines.length === 0) return null

  return (
    <div className="line-filter">
      <div className="line-filter-header">
        <h2>Lines</h2>
        {!allOn && (
          <button type="button" className="line-filter-clear" onClick={onShowAll}>
            Show all
          </button>
        )}
      </div>
      <p className="line-filter-hint">
        Lines are shown in their colours. Toggle a line off to hide it.
      </p>
      <div className="line-filter-chips">
        {lines.map((line) => {
          const on = enabledLineIds.has(line.id)
          const color = lineColor(line.id)
          return (
            <button
              key={line.id}
              type="button"
              className={`line-switch${on ? ' on' : ''}`}
              style={
                on
                  ? {
                      background: color,
                      borderColor: color,
                      color: lineTextColor(line.id),
                    }
                  : { borderColor: color, color: 'var(--text)' }
              }
              role="switch"
              aria-checked={on}
              onClick={() => onToggle(line.id)}
            >
              <span
                className="line-switch-track"
                style={{ background: on ? 'rgba(255,255,255,0.35)' : color }}
              >
                <span className="line-switch-thumb" />
              </span>
              {line.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}
