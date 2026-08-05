import { lineColor, lineTextColor } from '../lineColors'
import type { NetworkLine } from '../types'

interface LineFilterProps {
  lines: NetworkLine[]
  enabledLineIds: Set<string>
  loading: boolean
  onToggle: (lineId: string) => void
  onShowAll: () => void
}

export default function LineFilter({
  lines,
  enabledLineIds,
  loading,
  onToggle,
  onShowAll,
}: LineFilterProps) {
  if (loading && lines.length === 0) {
    return (
      <div className="line-filter">
        <h2>Lines</h2>
        <p className="line-filter-hint">Loading network map…</p>
      </div>
    )
  }

  if (lines.length === 0) return null

  const allOn = lines.every((line) => enabledLineIds.has(line.id))

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
        Tube, Overground, DLR, Elizabeth and Tram routes. Toggle a line off to
        hide it.
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
