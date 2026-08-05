import { lineColor, lineTextColor } from '../lineColors'
import type { NetworkLine } from '../types'

interface LineFilterProps {
  lines: NetworkLine[]
  enabledLineIds: Set<string>
  loading: boolean
  onToggle: (lineId: string) => void
  onToggleAll: (on: boolean) => void
}

export default function LineFilter({
  lines,
  enabledLineIds,
  loading,
  onToggle,
  onToggleAll,
}: LineFilterProps) {
  if (loading && lines.length === 0) {
    return <p className="line-filter-hint">Loading network map…</p>
  }

  if (lines.length === 0) return null

  const allOn = lines.every((line) => enabledLineIds.has(line.id))
  const anyOn = lines.some((line) => enabledLineIds.has(line.id))
  const masterOn = allOn

  return (
    <div className="line-filter">
      <button
        type="button"
        className={`line-switch line-switch-master${masterOn ? ' on' : ''}${anyOn && !allOn ? ' partial' : ''}`}
        role="switch"
        aria-checked={masterOn}
        aria-label="Show all network lines"
        onClick={() => onToggleAll(!masterOn)}
      >
        <span className="line-switch-track">
          <span className="line-switch-thumb" />
        </span>
        Show network lines
      </button>
      <p className="line-filter-hint">
        Tube, Overground, DLR, Elizabeth and Tram. Toggle individual lines, or
        use the switch above for all at once.
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
