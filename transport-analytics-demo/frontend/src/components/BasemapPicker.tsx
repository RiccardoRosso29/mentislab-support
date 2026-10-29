import { useCallback, useRef, useState } from 'react'
import { useClickOutside } from '../hooks'
import { BASEMAPS, type Basemap } from './FlowMap'

// anteprime generate dagli stessi stili della mappa (area di Torino), servite con l'app
const THUMBS: Record<Basemap, string> = {
  chiara: 'mappe/chiara.jpg',
  strade: 'mappe/strade.jpg',
  satellite: 'mappe/satellite.jpg',
}

/** Selettore del tipo di mappa: un riquadro con l'anteprima che si apre sulle alternative. */
export default function BasemapPicker({ value, onChange }: { value: Basemap; onChange: (b: Basemap) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setOpen(false), [])
  useClickOutside(ref, close, open)
  const current = BASEMAPS.find((b) => b.id === value)!

  return (
    <div className={`bm ${open ? 'open' : ''}`} ref={ref}>
      <button className="bm-tile bm-main" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={`Tipo di mappa: ${current.label}`}>
        <img src={THUMBS[value]} alt="" />
        <span>
          <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden>
            <path d="m12 3 9 5-9 5-9-5 9-5zM3 13l9 5 9-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          </svg>
          Mappa
        </span>
      </button>
      {open && (
        <div className="bm-panel" role="radiogroup" aria-label="Tipo di mappa">
          {BASEMAPS.map((b) => (
            <button
              key={b.id}
              role="radio"
              aria-checked={b.id === value}
              className={`bm-tile ${b.id === value ? 'on' : ''}`}
              onClick={() => {
                onChange(b.id)
                close()
              }}
            >
              <img src={THUMBS[b.id]} alt="" />
              <span>{b.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
