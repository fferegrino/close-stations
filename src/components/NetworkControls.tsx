import { useEffect, useRef, useState } from 'react'
import LineFilter from './LineFilter'
import type { NetworkLine } from '../types'

interface NetworkControlsProps {
  lines: NetworkLine[]
  enabledLineIds: Set<string>
  loading: boolean
  showCatchments: boolean
  onToggle: (lineId: string) => void
  onToggleAll: (on: boolean) => void
  onToggleCatchments: () => void
}

export default function NetworkControls({
  lines,
  enabledLineIds,
  loading,
  showCatchments,
  onToggle,
  onToggleAll,
  onToggleCatchments,
}: NetworkControlsProps) {
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    function handlePointerDown(event: MouseEvent) {
      if (!panelRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  const enabledCount = lines.filter((line) => enabledLineIds.has(line.id)).length

  return (
    <div className="network-controls" ref={panelRef}>
      <div className="network-controls-toolbar">
        <button
          type="button"
          className={`network-controls-toggle${showCatchments ? ' active' : ''}`}
          role="switch"
          aria-checked={showCatchments}
          aria-label="Show station coverage areas"
          onClick={onToggleCatchments}
        >
          Coverage
        </button>
        <button
          type="button"
          className={`network-controls-toggle${open ? ' open' : ''}`}
          aria-expanded={open}
          aria-controls="network-lines-panel"
          onClick={() => setOpen((prev) => !prev)}
        >
          <span className="network-controls-icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M4 7h16M4 12h10M4 17h14"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </span>
          Lines
          {!loading && lines.length > 0 && (
            <span className="network-controls-count">
              {enabledCount}/{lines.length}
            </span>
          )}
        </button>
      </div>

      {open && (
        <div
          id="network-lines-panel"
          className="network-controls-panel"
          role="dialog"
          aria-label="Network line settings"
        >
          <LineFilter
            lines={lines}
            enabledLineIds={enabledLineIds}
            loading={loading}
            onToggle={onToggle}
            onToggleAll={onToggleAll}
          />
        </div>
      )}
    </div>
  )
}
