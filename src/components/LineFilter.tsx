import { useMemo } from 'react'
import { lineColor, lineTextColor } from '../lineColors'
import type { Station, StationLine } from '../types'

interface LineFilterProps {
  stations: Station[]
  activeLineIds: Set<string>
  onToggle: (lineId: string) => void
  onClear: () => void
}

export default function LineFilter({
  stations,
  activeLineIds,
  onToggle,
  onClear,
}: LineFilterProps) {
  const lines = useMemo(() => {
    const byId = new Map<string, StationLine>()
    for (const station of stations) {
      for (const line of station.lines) {
        byId.set(line.id, line)
      }
    }
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [stations])

  if (lines.length === 0) return null

  return (
    <div className="line-filter">
      <div className="line-filter-header">
        <h2>Highlight lines</h2>
        {activeLineIds.size > 0 && (
          <button type="button" className="line-filter-clear" onClick={onClear}>
            Clear
          </button>
        )}
      </div>
      <div className="line-filter-chips">
        {lines.map((line) => {
          const active = activeLineIds.has(line.id)
          const color = lineColor(line.id)
          return (
            <button
              key={line.id}
              type="button"
              className={`line-chip${active ? ' active' : ''}`}
              style={
                active
                  ? { background: color, borderColor: color, color: lineTextColor(line.id) }
                  : { borderColor: color, color: 'var(--text-h)' }
              }
              aria-pressed={active}
              onClick={() => onToggle(line.id)}
            >
              <span className="line-chip-swatch" style={{ background: color }} />
              {line.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}
