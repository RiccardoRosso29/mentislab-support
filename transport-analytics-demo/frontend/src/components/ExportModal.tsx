import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { EMPTY_FILTERS, buildQuery, getJSON, hasActiveFilters, type Filters, type Livello, type Meta } from '../api'
import { DOW, ETA, FASCE, MOTIVI, NAZIONALITA, TIPOLOGIE, fmt, fmtPct } from '../labels'
import { IconDownload } from './icons'

const SOGLIA_K = 100

type Campo =
  | 'origine'
  | 'destinazione'
  | 'giorno'
  | 'giorno_settimana'
  | 'fascia_oraria'
  | 'genere'
  | 'eta'
  | 'nazionalita'
  | 'tipologia'
  | 'motivo_origine'
  | 'motivo_destinazione'

const CAMPI: { id: Campo; label: string; gruppo: string; tipo: 'testo' | 'data' }[] = [
  { id: 'origine', label: 'Zona di origine', gruppo: 'Territorio', tipo: 'testo' },
  { id: 'destinazione', label: 'Zona di destinazione', gruppo: 'Territorio', tipo: 'testo' },
  { id: 'giorno', label: 'Data', gruppo: 'Tempo', tipo: 'data' },
  { id: 'giorno_settimana', label: 'Giorno della settimana', gruppo: 'Tempo', tipo: 'testo' },
  { id: 'fascia_oraria', label: 'Fascia oraria', gruppo: 'Tempo', tipo: 'testo' },
  { id: 'genere', label: 'Genere', gruppo: 'Profilo', tipo: 'testo' },
  { id: 'eta', label: 'Fascia d’età', gruppo: 'Profilo', tipo: 'testo' },
  { id: 'nazionalita', label: 'Nazionalità', gruppo: 'Profilo', tipo: 'testo' },
  { id: 'tipologia', label: 'Tipologia', gruppo: 'Spostamento', tipo: 'testo' },
  { id: 'motivo_origine', label: 'Motivo in origine', gruppo: 'Spostamento', tipo: 'testo' },
  { id: 'motivo_destinazione', label: 'Motivo in destinazione', gruppo: 'Spostamento', tipo: 'testo' },
]
const ORDER = CAMPI.map((c) => c.id)
const GRUPPI = ['Territorio', 'Tempo', 'Profilo', 'Spostamento']
const label = (c: Campo) => CAMPI.find((x) => x.id === c)!.label

// icone a tratto 24×24 per i dataset tematici
const ICONS: Record<string, ReactNode> = {
  od: <path d="M5 17a2 2 0 1 0 0-.01M19 7a2 2 0 1 0 0-.01M6.5 15.5C9 9 13 7.5 17 7.2" />,
  fascia: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  generati: <path d="M12 21s-6-5.6-6-10a6 6 0 1 1 12 0c0 4.4-6 10-6 10zM12 8v5M9.8 10.8 12 13l2.2-2.2" />,
  profilo: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19c.6-3 2.8-5 5.5-5s4.9 2 5.5 5M16 5.5a3 3 0 0 1 0 5.6M17.5 14.3c1.7.7 2.7 2.4 3 4.7" />
    </>
  ),
  motivi: <path d="M4 20V10l4-3 4 3v10M4 20h16M14 20v-6h6v6M8 13v2" />,
  nazionalita: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.4 2.4 3.4 5.4 3.4 8.5s-1 6.1-3.4 8.5c-2.4-2.4-3.4-5.4-3.4-8.5s1-6.1 3.4-8.5z" />
    </>
  ),
}

const PRESETS: { id: string; titolo: string; descr: string; campi: Campo[] }[] = [
  { id: 'od', titolo: 'Matrice origine–destinazione', descr: 'Spostamenti tra ogni coppia di zone', campi: ['origine', 'destinazione'] },
  { id: 'fascia', titolo: 'Flussi per fascia oraria', descr: 'La matrice OD nelle cinque fasce della giornata', campi: ['origine', 'destinazione', 'fascia_oraria'] },
  { id: 'generati', titolo: 'Spostamenti generati per zona', descr: 'Partenze da ogni zona, interne o verso fuori regione', campi: ['origine', 'tipologia'] },
  { id: 'profilo', titolo: 'Profilo di chi arriva', descr: 'Arrivi in ogni zona per genere e fascia d’età', campi: ['destinazione', 'genere', 'eta'] },
  { id: 'motivi', titolo: 'Motivi di spostamento', descr: 'Casa, lavoro e altro, all’origine e all’arrivo', campi: ['destinazione', 'motivo_origine', 'motivo_destinazione'] },
  { id: 'nazionalita', titolo: 'Presenze per nazionalità', descr: 'Arrivi di italiani e stranieri in ogni zona', campi: ['destinazione', 'nazionalita'] },
]

const LIVELLI: { id: Livello; label: string }[] = [
  { id: 'ace', label: 'ACE ISTAT' },
  { id: 'comune', label: 'Comuni' },
  { id: 'provincia', label: 'Province' },
]

type Granularita = 'media' | 'giornaliera'

interface Summary {
  gruppi_totali: number
  gruppi_esportati: number
  spostamenti_totali: number
  spostamenti_esportati: number
  perdita: number
}
interface Rows extends Summary {
  header: string[]
  rows: (string | number)[][]
}

/** Livello di perdita informativa: quota di spostamenti che cade in gruppi rimossi dalla soglia. */
function severity(p: number) {
  if (p <= 0.05) return { cls: 'low', label: 'Bassa' }
  if (p <= 0.2) return { cls: 'mid', label: 'Moderata' }
  return { cls: 'high', label: 'Elevata' }
}

/** Indicatore compatto a quattro tacche per la lista dei dataset tematici. */
function LossTicks({ s }: { s: Summary | string | null | undefined }) {
  if (typeof s === 'string')
    return (
      <span className="xp-ticks na" title={s}>
        troppo dettagliato
      </span>
    )
  if (s === undefined || s === null) return <span className="xp-ticks pending">···</span>
  const sv = severity(s.perdita)
  const lit = s.perdita <= 0.01 ? 1 : s.perdita <= 0.05 ? 2 : s.perdita <= 0.2 ? 3 : 4
  return (
    <span className={`xp-ticks ${sv.cls}`} title={`Perdita informativa ${sv.label.toLowerCase()}: ${fmtPct(s.perdita)} degli spostamenti`}>
      <span className="xp-ticks-bars" aria-hidden>
        {[1, 2, 3, 4].map((i) => (
          <i key={i} className={i <= lit ? 'on' : ''} />
        ))}
      </span>
      {fmtPct(s.perdita)}
    </span>
  )
}

/** Righe di esempio con valori plausibili ma non reali, per mostrare la struttura del file. */
function exampleRows(campi: Campo[], meta: Meta, livello: Livello) {
  const zone =
    livello === 'provincia'
      ? meta.province.filter((p) => p.piemonte).map((p) => p.nome)
      : livello === 'ace'
        ? ['Torino · ACE 17', 'Novara · ACE 3', 'Moncalieri · ACE 2', 'Alba', 'Asti · ACE 1']
        : ['Torino', 'Moncalieri', 'Novara', 'Cuneo', 'Alessandria']
  const pick = <T,>(arr: T[], i: number) => arr[i % arr.length]
  const val: Record<Campo, (i: number) => string> = {
    origine: (i) => pick(zone, i),
    destinazione: (i) => pick(zone, i + 2),
    giorno: (i) => `2026-06-${String(15 + i).padStart(2, '0')}`,
    giorno_settimana: (i) => pick(DOW, i).short,
    fascia_oraria: (i) => pick(Object.keys(FASCE), i + 1),
    genere: (i) => pick(['f', 'm'], i),
    eta: (i) => pick(ETA.slice(0, 6), i + 2),
    nazionalita: (i) => pick(Object.keys(NAZIONALITA), i === 3 ? 1 : 0),
    tipologia: (i) => pick(Object.keys(TIPOLOGIE), i === 2 ? 1 : 0),
    motivo_origine: (i) => pick(Object.keys(MOTIVI), i),
    motivo_destinazione: (i) => pick(Object.keys(MOTIVI), i + 1),
  }
  const media = !campi.includes('giorno')
  return [0, 1, 2, 3].map((i) => {
    const tot = Math.round(48210 / (i + 1.4))
    return [...campi.map((c) => val[c](i)), fmt(tot), ...(media ? [fmt(tot / 14)] : [])]
  })
}

function toCsv(header: string[], rows: (string | number)[][]) {
  // separatore ";" e virgola decimale: il file si apre correttamente in Excel con impostazioni italiane
  const cell = (v: string | number) => {
    const s = typeof v === 'number' ? String(v).replace('.', ',') : v
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return '﻿' + [header, ...rows].map((r) => r.map(cell).join(';')).join('\r\n')
}

function Seg<T extends string>({ value, options, onChange, disabled }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; disabled?: boolean }) {
  return (
    <div className={`xp-seg ${disabled ? 'disabled' : ''}`} role="radiogroup">
      {options.map((o) => (
        <button key={o.id} role="radio" aria-checked={value === o.id} className={value === o.id ? 'on' : ''} onClick={() => onChange(o.id)} disabled={disabled}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

interface Props {
  meta: Meta
  filters: Filters
  livello: Livello
  onClose: () => void
}

export default function ExportModal({ meta, filters, livello: livelloIniziale, onClose }: Props) {
  const [tab, setTab] = useState<'temi' | 'custom'>('temi')
  const [preset, setPreset] = useState(PRESETS[0].id)
  const [granularita, setGranularita] = useState<Granularita>('media')
  const [custom, setCustom] = useState<Campo[]>(['origine', 'destinazione'])
  const [livello, setLivello] = useState<Livello>(livelloIniziale)
  const filtriAttivi = hasActiveFilters(filters)
  const [useFilters, setUseFilters] = useState(filtriAttivi)
  const [summaries, setSummaries] = useState<Record<string, Summary | null | string>>({})
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const presetCampi = (cs: Campo[]) => (granularita === 'giornaliera' ? ORDER.filter((c) => c === 'giorno' || cs.includes(c)) : cs)
  const presetSel = PRESETS.find((p) => p.id === preset)!
  const campi = tab === 'temi' ? presetCampi(presetSel.campi) : ORDER.filter((c) => custom.includes(c))
  const base = buildQuery(livello, useFilters ? filters : EMPTY_FILTERS, null)
  const urlFor = (cs: Campo[], righe = false) => `/api/export?${base}&campi=${cs.join(',')}&k=${SOGLIA_K}${righe ? '&righe=1' : ''}`

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // perdita informativa calcolata sui dati reali: prima la configurazione corrente, poi i dataset tematici
  const pending = useMemo(() => {
    const list = [campi, ...PRESETS.map((p) => presetCampi(p.campi))].filter((cs) => cs.length > 0)
    return [...new Map(list.map((cs) => [urlFor(cs), cs])).values()].filter((cs) => !(urlFor(cs) in summaries))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campi.join(','), base, summaries, granularita])

  useEffect(() => {
    if (!pending.length) return
    // le richieste vanno in coda al motore; i risultati restano in cache per configurazione
    const k = urlFor(pending[0])
    setSummaries((s) => ({ ...s, [k]: null }))
    getJSON<Summary>(k)
      .then((r) => setSummaries((s) => ({ ...s, [k]: r })))
      .catch((e: Error) => setSummaries((s) => ({ ...s, [k]: e.message })))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending.map((cs) => urlFor(cs)).join('|')])

  const entry = campi.length ? summaries[urlFor(campi)] : undefined
  const current = entry && typeof entry === 'object' ? entry : null
  const entryError = typeof entry === 'string' ? entry : null
  const sv = current ? severity(current.perdita) : null
  const summaryOf = (cs: Campo[]) => summaries[urlFor(cs)]

  const toggle = (c: Campo) => setCustom((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]))

  const download = async () => {
    setDownloading(true)
    setError(null)
    try {
      const r = await getJSON<Rows>(urlFor(campi, true))
      const blob = new Blob([toCsv(r.header, r.rows)], { type: 'text/csv;charset=utf-8' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      const nome = tab === 'temi' ? `${preset}_${granularita}` : 'personalizzato'
      a.download = `transport-analytics_${nome}_${livello}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(a.href), 5000)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setDownloading(false)
    }
  }

  const media = !campi.includes('giorno')
  const header = [...campi, 'spostamenti_periodo', ...(media ? ['spostamenti_medi_giorno'] : [])]
  const examples = exampleRows(campi, meta, livello)
  const territoriale = campi.includes('origine') || campi.includes('destinazione')
  const titolo = tab === 'temi' ? presetSel.titolo : 'Dataset personalizzato'
  // posizione del marcatore sulla scala 0–40% (oltre è comunque "elevata")
  const marker = current ? Math.min(1, current.perdita / 0.4) * 100 : 0

  return (
    <div className="xp-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="xp" role="dialog" aria-modal="true" aria-labelledby="xp-title">
        <header className="xp-head">
          <div>
            <span className="xp-eyebrow">Esportazione dati</span>
            <h2 id="xp-title">Crea un dataset</h2>
          </div>
          <div className="xp-head-right">
            <span className="xp-shield" title={`Ogni riga del file rappresenta almeno ${SOGLIA_K} spostamenti nel periodo`}>
              <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden>
                <path d="M12 3 5 6v5c0 4.5 3 8.3 7 10 4-1.7 7-5.5 7-10V6l-7-3z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                <path d="m9 12 2 2 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Anonimizzazione k ≥ {SOGLIA_K}
            </span>
            <button className="xp-x" onClick={onClose} aria-label="Chiudi">
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
                <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </header>

        <div className="xp-body">
          <section className="xp-main">
            <div className="xp-step">
              <div className="xp-step-head">
                <span className="xp-num">1</span>
                <h3>Contenuto</h3>
                <div className="xp-tabs" role="tablist">
                  <button role="tab" aria-selected={tab === 'temi'} className={tab === 'temi' ? 'on' : ''} onClick={() => setTab('temi')}>
                    Dataset tematici
                  </button>
                  <button role="tab" aria-selected={tab === 'custom'} className={tab === 'custom' ? 'on' : ''} onClick={() => setTab('custom')}>
                    Personalizzato
                  </button>
                </div>
              </div>

              {tab === 'temi' ? (
                <ul className="xp-presets" role="radiogroup" aria-label="Dataset tematici">
                  {PRESETS.map((p) => {
                    const on = preset === p.id
                    return (
                      <li key={p.id}>
                        <button role="radio" aria-checked={on} className={on ? 'on' : ''} onClick={() => setPreset(p.id)}>
                          <span className="xp-icon">
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                              {ICONS[p.id]}
                            </svg>
                          </span>
                          <span className="xp-p-text">
                            <span className="xp-p-title">{p.titolo}</span>
                            <span className="xp-p-descr">{p.descr}</span>
                            <span className="xp-p-cols">{presetCampi(p.campi).join(' · ')}</span>
                          </span>
                          <LossTicks s={summaryOf(presetCampi(p.campi))} />
                        </button>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <div className="xp-fields">
                  {GRUPPI.map((g) => (
                    <div key={g} className="xp-group">
                      <span className="xp-group-label">{g}</span>
                      <div className="xp-toggles">
                        {CAMPI.filter((c) => c.gruppo === g).map((c) => {
                          const on = custom.includes(c.id)
                          return (
                            <button key={c.id} id={`xp-${c.id}`} className={on ? 'on' : ''} aria-pressed={on} onClick={() => toggle(c.id)}>
                              <span className="xp-check" aria-hidden>
                                {on && (
                                  <svg viewBox="0 0 24 24" width="12" height="12">
                                    <path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                )}
                              </span>
                              {c.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                  {custom.includes('giorno') && custom.includes('giorno_settimana') && (
                    <p className="xp-note">La data contiene già il giorno della settimana: uno dei due campi è ridondante.</p>
                  )}
                </div>
              )}
            </div>

            <div className="xp-step">
              <div className="xp-step-head">
                <span className="xp-num">2</span>
                <h3>Opzioni</h3>
              </div>
              <div className="xp-options">
                {tab === 'temi' && (
                  <div className="xp-opt">
                    <span className="xp-opt-label">Granularità temporale</span>
                    <Seg<Granularita>
                      value={granularita}
                      onChange={setGranularita}
                      options={[
                        { id: 'media', label: 'Media giornaliera' },
                        { id: 'giornaliera', label: 'Per data' },
                      ]}
                    />
                    <span className="xp-opt-hint">
                      {granularita === 'media' ? 'Una riga per combinazione, con totale del periodo e media al giorno' : 'Una riga per ogni data del periodo: più dettaglio, gruppi più piccoli'}
                    </span>
                  </div>
                )}
                <div className="xp-opt">
                  <span className="xp-opt-label">Livello territoriale</span>
                  <Seg<Livello> value={livello} onChange={setLivello} options={LIVELLI} disabled={!territoriale} />
                  {!territoriale && <span className="xp-opt-hint">Il dataset non contiene zone</span>}
                </div>
                <label className={`xp-switch ${filtriAttivi ? '' : 'disabled'}`}>
                  <input id="xp-filtri" type="checkbox" checked={useFilters} disabled={!filtriAttivi} onChange={(e) => setUseFilters(e.target.checked)} />
                  <span className="xp-switch-track" aria-hidden />
                  <span>{filtriAttivi ? 'Applica i filtri attivi della dashboard' : 'Nessun filtro attivo: si esporta tutto il periodo'}</span>
                </label>
              </div>
            </div>
          </section>

          <aside className="xp-side">
            <div className="xp-step-head">
              <span className="xp-num">3</span>
              <h3>Verifica</h3>
            </div>
            <p className="xp-side-title">{titolo}</p>

            <div className={`xp-gauge ${sv?.cls ?? ''}`}>
              <div className="xp-gauge-top">
                <div>
                  <span className="xp-gauge-label">Perdita informativa</span>
                  <span className="xp-gauge-sev">{sv ? sv.label : entryError ? 'Non calcolabile' : campi.length ? 'Calcolo in corso…' : 'Nessun campo'}</span>
                </div>
                <span className="xp-gauge-value">{current ? fmtPct(current.perdita) : '–'}</span>
              </div>
              <div className="xp-scale">
                <span className="z1" />
                <span className="z2" />
                <span className="z3" />
                {current && <i style={{ left: `${marker}%` }} />}
              </div>
              <div className="xp-scale-labels">
                <span>0%</span>
                <span>5%</span>
                <span>20%</span>
                <span>40%+</span>
              </div>
              {entryError && <p className="xp-warn">{entryError}</p>}
              {sv?.cls === 'high' && <p className="xp-warn">Molti gruppi sono sotto la soglia: togli qualche campo o scegli un livello territoriale meno dettagliato.</p>}
            </div>

            <dl className="xp-stats">
              <div>
                <dt>Righe nel file</dt>
                <dd>{current ? fmt(current.gruppi_esportati) : '–'}</dd>
              </div>
              <div>
                <dt>Colonne</dt>
                <dd>{campi.length ? header.length : '–'}</dd>
              </div>
              <div>
                <dt>Gruppi rimossi</dt>
                <dd>{current ? fmt(current.gruppi_totali - current.gruppi_esportati) : '–'}</dd>
              </div>
              <div>
                <dt>Spostamenti conservati</dt>
                <dd>{current ? fmtPct(1 - current.perdita) : '–'}</dd>
              </div>
            </dl>

            <div className="xp-preview">
              <div className="xp-preview-head">
                <span>Struttura del file</span>
                <small>valori di esempio</small>
              </div>
              <div className="xp-sheet">
                <table>
                  <thead>
                    <tr>
                      <th className="rn" />
                      {header.map((h) => {
                        const tipo = h.startsWith('spostamenti') ? '123' : h === 'giorno' ? 'data' : 'Aa'
                        return (
                          <th key={h}>
                            <span className="xp-type">{tipo}</span>
                            {h}
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {campi.length ? (
                      examples.map((r, i) => (
                        <tr key={i}>
                          <td className="rn">{i + 1}</td>
                          {r.map((v, j) => (
                            <td key={j} className={j >= campi.length ? 'num' : ''}>
                              {v}
                            </td>
                          ))}
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={header.length + 1} className="xp-empty">
                          Seleziona almeno un campo
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <footer className="xp-foot">
              <span className="xp-file">
                CSV · UTF-8 · separatore «;»
                {campi.length > 0 && (
                  <>
                    <br />
                    {campi.map(label).join(', ')}
                  </>
                )}
              </span>
              {error && <span className="xp-warn">Esportazione non riuscita: {error}</span>}
              <button className="xp-go" onClick={download} disabled={!campi.length || downloading || !current}>
                <IconDownload />
                {downloading ? 'Preparazione…' : 'Scarica CSV'}
              </button>
            </footer>
          </aside>
        </div>
      </div>
    </div>
  )
}
