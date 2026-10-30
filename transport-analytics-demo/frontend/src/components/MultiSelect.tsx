import { useCallback, useMemo, useRef, useState } from 'react'
import { useClickOutside } from '../hooks'
import { t } from '../settings'

export interface Option {
  value: string
  label: string
  group?: string
  hint?: string
}

interface Props {
  label: string
  options: Option[]
  value: string[]
  onChange: (v: string[]) => void
  searchable?: boolean
  width?: number
}

const MAX_VISIBLE = 250

export default function MultiSelect({ label, options, value, onChange, searchable, width = 260 }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setOpen(false), [])
  useClickOutside(ref, close, open)

  const selected = useMemo(() => new Set(value), [value])
  const byValue = useMemo(() => new Map(options.map((o) => [o.value, o])), [options])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options
    return list.slice(0, MAX_VISIBLE)
  }, [options, query])

  const summary =
    value.length === 0
      ? t('Tutti', 'All')
      : value.length <= 2
        ? value.map((v) => byValue.get(v)?.label ?? v).join(', ')
        : t(`${value.length} selezionati`, `${value.length} selected`)

  const toggle = (v: string) => onChange(selected.has(v) ? value.filter((x) => x !== v) : [...value, v])

  let lastGroup: string | undefined
  return (
    <div className={`ms ${open ? 'open' : ''} ${value.length ? 'active' : ''}`} ref={ref}>
      <button className="ms-btn" onClick={() => setOpen((o) => !o)} title={summary}>
        <span className="ms-label">{label}</span>
        <span className="ms-value">{summary}</span>
        <span className="ms-caret">▾</span>
      </button>
      {open && (
        <div className="ms-panel" style={{ width }}>
          {searchable && (
            <input
              autoFocus
              className="ms-search"
              placeholder={t('Cerca…', 'Search…')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          )}
          <div className="ms-list">
            {filtered.map((o) => {
              const header = o.group && o.group !== lastGroup ? o.group : null
              lastGroup = o.group
              return (
                <div key={o.value}>
                  {header && <div className="ms-group">{header}</div>}
                  <label className="ms-opt">
                    <input type="checkbox" checked={selected.has(o.value)} onChange={() => toggle(o.value)} />
                    <span>{o.label}</span>
                    {o.hint && <span className="ms-hint">{o.hint}</span>}
                  </label>
                </div>
              )
            })}
            {filtered.length === 0 && <div className="ms-empty">{t('Nessun risultato', 'No results')}</div>}
          </div>
          <div className="ms-foot">
            <button onClick={() => onChange([])} disabled={!value.length}>
              {t('Deseleziona', 'Clear')}
            </button>
            <button className="primary" onClick={close}>
              {t('Chiudi', 'Close')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
