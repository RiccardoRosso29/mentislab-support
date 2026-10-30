import { useCallback, useRef, useState } from 'react'
import { useClickOutside } from '../hooks'
import { BASEMAPS, type Basemap } from './FlowMap'
import { t } from '../settings'

// anteprime generate dagli stessi stili della mappa (area di Torino), servite con l'app
const THUMBS: Record<Basemap, string> = {
  chiara: 'mappe/chiara.jpg',
  strade: 'mappe/strade.jpg',
  satellite: 'mappe/satellite.jpg',
}

/** Selettore del tipo di mappa: un riquadro con l'anteprima che si apre sulle alternative. */
interface Props {
  value: Basemap
  onChange: (b: Basemap) => void
  /** opacità di flussi e nodi, 0.15–1 */
  opacity: number
  onOpacity: (v: number) => void
}

export default function BasemapPicker({ value, onChange, opacity, onOpacity }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setOpen(false), [])
  useClickOutside(ref, close, open)
  const current = BASEMAPS.find((b) => b.id === value)!

  return (
    <div className={`bm ${open ? 'open' : ''}`} ref={ref}>
      <button className="bm-tile bm-main" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={`${t('Tipo di mappa', 'Map type')}: ${current.label()}`}>
        <img src={THUMBS[value]} alt="" />
        <span>
          <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden>
            <path d="m12 3 9 5-9 5-9-5 9-5zM3 13l9 5 9-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          </svg>
          {t('Mappa', 'Map')}
        </span>
      </button>
      {open && (
        <div className="bm-panel">
          <div className="bm-tiles" role="radiogroup" aria-label={t('Tipo di mappa', 'Map type')}>
          {BASEMAPS.map((b) => (
            <button
              key={b.id}
              role="radio"
              aria-checked={b.id === value}
              className={`bm-tile ${b.id === value ? 'on' : ''}`}
              onClick={() => onChange(b.id)}
            >
              <img src={THUMBS[b.id]} alt="" />
              <span>{b.label()}</span>
            </button>
          ))}
          </div>
          <label className="bm-opacity" htmlFor="bm-opacity">
            <span>
              {t('Opacità flussi e nodi', 'Flow and node opacity')} <b>{Math.round(opacity * 100)}%</b>
            </span>
            <input
              id="bm-opacity"
              className="slider"
              type="range"
              min={15}
              max={100}
              step={5}
              value={Math.round(opacity * 100)}
              style={{ '--fill': `${((opacity * 100 - 15) / 85) * 100}%` } as React.CSSProperties}
              onChange={(e) => onOpacity(Number(e.target.value) / 100)}
            />
          </label>
        </div>
      )}
    </div>
  )
}
