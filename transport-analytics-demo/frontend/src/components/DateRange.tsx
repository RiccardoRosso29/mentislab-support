import { useCallback, useMemo, useRef, useState } from 'react'
import { useClickOutside } from '../hooks'
import { fmtDate, getLocale } from '../labels'
import { IconCalendar, IconChevron } from './icons'
import { t } from '../settings'

interface Props {
  min: string // primo giorno disponibile (ISO)
  max: string // ultimo giorno disponibile (ISO)
  value: string[] // [] = tutto il periodo, altrimenti [da, a]
  onChange: (v: string[]) => void
}

const iso = (d: Date) => d.toISOString().slice(0, 10)
const parse = (s: string) => new Date(s + 'T00:00:00Z')
const addDays = (s: string, n: number) => iso(new Date(parse(s).getTime() + n * 86400000))

/** Selettore di intervallo di date: primo clic = inizio, secondo clic = fine. */
export default function DateRange({ min, max, value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState<string | null>(null)
  const [hover, setHover] = useState<string | null>(null)
  const [month, setMonth] = useState(() => (value[0] ?? min).slice(0, 7))
  const ref = useRef<HTMLDivElement>(null)
  const close = useCallback(() => {
    setOpen(false)
    setPending(null)
  }, [])
  useClickOutside(ref, close, open)

  const [da, a] = value.length === 2 ? value : [min, max]
  const full = value.length === 0
  const label = full
    ? t('Tutto il periodo', 'Whole period')
    : da === a
      ? fmtDate(da)
      : `${fmtDate(da)} – ${fmtDate(a)}`

  const cells = useMemo(() => {
    const first = parse(month + '-01')
    const offset = (first.getUTCDay() + 6) % 7
    const days = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate()
    return [...Array(offset).fill(null), ...Array.from({ length: days }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)]
  }, [month])

  const shiftMonth = (n: number) => {
    const d = parse(month + '-01')
    d.setUTCMonth(d.getUTCMonth() + n)
    setMonth(iso(d).slice(0, 7))
  }
  const canPrev = month > min.slice(0, 7)
  const canNext = month < max.slice(0, 7)

  const pick = (day: string) => {
    if (!pending) {
      setPending(day)
      return
    }
    const [s, e] = pending <= day ? [pending, day] : [day, pending]
    setPending(null)
    onChange(s === min && e === max ? [] : [s, e])
  }

  // anteprima dell'intervallo mentre si sceglie la data di fine
  const [rs, re] = pending ? [pending, hover ?? pending].sort() : [da, a]

  const presets = [
    { label: t('Tutto il periodo', 'Whole period'), v: [] as string[] },
    { label: t('Prima settimana', 'First week'), v: [min, addDays(min, 6)] },
    { label: t('Seconda settimana', 'Second week'), v: [addDays(min, 7), max] },
  ]

  return (
    <div className={`ms dr ${open ? 'open' : ''} ${full ? '' : 'active'}`} ref={ref}>
      <button className="ms-btn" onClick={() => setOpen((o) => !o)} title={label}>
        <IconCalendar className="ms-icon" />
        <span className="ms-label">{t('Date', 'Dates')}</span>
        <span className="ms-value">{label}</span>
        <span className="ms-caret">▾</span>
      </button>
      {open && (
        <div className="ms-panel dr-panel">
          <div className="dr-presets">
            {presets.map((p) => (
              <button
                key={p.label}
                className={JSON.stringify(p.v) === JSON.stringify(value) ? 'on' : ''}
                onClick={() => {
                  setPending(null)
                  onChange(p.v)
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="dr-head">
            <button onClick={() => shiftMonth(-1)} disabled={!canPrev} aria-label={t('Mese precedente', 'Previous month')}>
              <IconChevron dir="left" />
            </button>
            <span>{parse(month + '-01').toLocaleDateString(getLocale(), { month: 'long', year: 'numeric', timeZone: 'UTC' })}</span>
            <button onClick={() => shiftMonth(1)} disabled={!canNext} aria-label={t('Mese successivo', 'Next month')}>
              <IconChevron dir="right" />
            </button>
          </div>
          <div className="dr-grid" onMouseLeave={() => setHover(null)}>
            {t('LMMGVSD', 'MTWTFSS').split('').map((w, i) => (
              <span key={i} className="dr-wd">
                {w}
              </span>
            ))}
            {cells.map((day, i) => {
              if (!day) return <span key={i} />
              const disabled = day < min || day > max
              const inRange = !disabled && day >= rs && day <= re
              const edge = day === rs || day === re
              const dow = (parse(day).getUTCDay() + 6) % 7
              return (
                <button
                  key={day}
                  disabled={disabled}
                  className={`dr-day ${inRange ? 'in' : ''} ${inRange && edge ? 'edge' : ''} ${dow >= 5 ? 'we' : ''}`}
                  onClick={() => pick(day)}
                  onMouseEnter={() => setHover(day)}
                >
                  {Number(day.slice(8))}
                </button>
              )
            })}
          </div>
          <p className="dr-hint">
            {pending
              ? t('Scegli la data di fine', 'Pick the end date')
              : t(`Dati disponibili dal ${fmtDate(min)} al ${fmtDate(max)}`, `Data available from ${fmtDate(min)} to ${fmtDate(max)}`)}
          </p>
        </div>
      )}
    </div>
  )
}
