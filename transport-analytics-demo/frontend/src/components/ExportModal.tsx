import { useEffect, useMemo, useState } from 'react'
import { EMPTY_FILTERS, buildQuery, getJSON, hasActiveFilters, type Filters, type Livello, type Meta } from '../api'
import { DOW, ETA, FASCE, GENERI, MOTIVI, NAZIONALITA, TIPOLOGIE, fmt, fmtPct } from '../labels'

const SOGLIA_K = 100
const MAX_CAMPI = 4

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

const CAMPI: { id: Campo; label: string; gruppo: string }[] = [
  { id: 'origine', label: 'Zona di origine', gruppo: 'Territorio' },
  { id: 'destinazione', label: 'Zona di destinazione', gruppo: 'Territorio' },
  { id: 'giorno', label: 'Data', gruppo: 'Tempo' },
  { id: 'giorno_settimana', label: 'Giorno della settimana', gruppo: 'Tempo' },
  { id: 'fascia_oraria', label: 'Fascia oraria', gruppo: 'Tempo' },
  { id: 'genere', label: 'Genere', gruppo: 'Profilo' },
  { id: 'eta', label: 'Fascia d’età', gruppo: 'Profilo' },
  { id: 'nazionalita', label: 'Nazionalità', gruppo: 'Profilo' },
  { id: 'tipologia', label: 'Tipologia (interno / scambio)', gruppo: 'Spostamento' },
  { id: 'motivo_origine', label: 'Motivo in origine', gruppo: 'Spostamento' },
  { id: 'motivo_destinazione', label: 'Motivo in destinazione', gruppo: 'Spostamento' },
]
const ORDER = CAMPI.map((c) => c.id)

const PRESETS: { id: string; titolo: string; descr: string; campi: Campo[] }[] = [
  { id: 'od', titolo: 'Matrice origine–destinazione', descr: 'Spostamenti tra coppie di zone nel periodo e medi giornalieri.', campi: ['origine', 'destinazione'] },
  { id: 'od_fascia', titolo: 'Flussi per fascia oraria', descr: 'La matrice OD suddivisa nelle cinque fasce della giornata.', campi: ['origine', 'destinazione', 'fascia_oraria'] },
  { id: 'giornaliero', titolo: 'Andamento giornaliero per origine', descr: 'Spostamenti generati da ogni zona, giorno per giorno.', campi: ['origine', 'giorno'] },
  { id: 'profilo', titolo: 'Profilo dei visitatori per destinazione', descr: 'Chi arriva in ogni zona, per genere e fascia d’età.', campi: ['destinazione', 'genere', 'eta'] },
  { id: 'motivi', titolo: 'Motivi di spostamento per destinazione', descr: 'Casa, lavoro e altri motivi all’origine e all’arrivo.', campi: ['destinazione', 'motivo_origine', 'motivo_destinazione'] },
  { id: 'stranieri', titolo: 'Presenze per nazionalità', descr: 'Arrivi di italiani e stranieri per zona e giorno della settimana.', campi: ['destinazione', 'nazionalita', 'giorno_settimana'] },
]

const LIVELLI: { id: Livello; label: string }[] = [
  { id: 'ace', label: 'ACE ISTAT' },
  { id: 'comune', label: 'Comuni' },
  { id: 'provincia', label: 'Province' },
]

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

/** Livello di perdita informativa: quota di spostamenti che cadono in gruppi rimossi dalla soglia. */
function severity(p: number) {
  if (p <= 0.05) return { cls: 'low', label: 'Bassa' }
  if (p <= 0.2) return { cls: 'mid', label: 'Media' }
  return { cls: 'high', label: 'Alta' }
}

function LossBadge({ s }: { s: Summary | null | undefined }) {
  if (!s) return <span className="ex-loss pending">calcolo…</span>
  const sv = severity(s.perdita)
  return (
    <span className={`ex-loss ${sv.cls}`} title={`${fmtPct(s.perdita)} degli spostamenti in gruppi sotto la soglia`}>
      Perdita {sv.label.toLowerCase()} · {fmtPct(s.perdita)}
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

interface Props {
  meta: Meta
  filters: Filters
  livello: Livello
  onClose: () => void
}

export default function ExportModal({ meta, filters, livello: livelloIniziale, onClose }: Props) {
  const [tab, setTab] = useState<'temi' | 'custom'>('temi')
  const [preset, setPreset] = useState(PRESETS[0].id)
  const [custom, setCustom] = useState<Campo[]>(['origine', 'destinazione'])
  const [livello, setLivello] = useState<Livello>(livelloIniziale)
  const [useFilters, setUseFilters] = useState(hasActiveFilters(filters))
  const [summaries, setSummaries] = useState<Record<string, Summary | null>>({})
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const campi = tab === 'temi' ? PRESETS.find((p) => p.id === preset)!.campi : ORDER.filter((c) => custom.includes(c))
  const base = buildQuery(livello, useFilters ? filters : EMPTY_FILTERS, null)
  const urlFor = (cs: Campo[], righe = false) => `/api/export?${base}&campi=${cs.join(',')}&k=${SOGLIA_K}${righe ? '&righe=1' : ''}`
  const keyFor = (cs: Campo[]) => urlFor(cs)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // perdita informativa: prima la configurazione corrente, poi i dataset tematici
  const pending = useMemo(() => {
    const list = [campi, ...PRESETS.map((p) => p.campi)].filter((cs) => cs.length > 0)
    return [...new Map(list.map((cs) => [keyFor(cs), cs])).values()].filter((cs) => !(keyFor(cs) in summaries))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campi.join(','), base, summaries])

  useEffect(() => {
    if (!pending.length) return
    // una richiesta alla volta: il motore elabora le richieste in coda, i risultati restano in cache
    const cs = pending[0]
    const k = keyFor(cs)
    setSummaries((s) => ({ ...s, [k]: null }))
    getJSON<Summary>(urlFor(cs))
      .then((r) => setSummaries((s) => ({ ...s, [k]: r })))
      .catch((e: Error) => setError(e.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending.map(keyFor).join('|')])

  const current = campi.length ? summaries[keyFor(campi)] : undefined
  const sv = current ? severity(current.perdita) : null

  const toggle = (c: Campo) =>
    setCustom((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : cur.length >= MAX_CAMPI ? cur : [...cur, c]))

  const download = async () => {
    setDownloading(true)
    setError(null)
    try {
      const r = await getJSON<Rows>(urlFor(campi, true))
      const blob = new Blob([toCsv(r.header, r.rows)], { type: 'text/csv;charset=utf-8' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `transport-analytics_${tab === 'temi' ? preset : 'personalizzato'}_${livello}.csv`
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

  const header = [...campi, 'spostamenti_periodo', ...(campi.includes('giorno') ? [] : ['spostamenti_medi_giorno'])]
  const examples = exampleRows(campi, meta, livello)
  const territoriale = campi.includes('origine') || campi.includes('destinazione')

  return (
    <div className="ex-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ex-modal" role="dialog" aria-modal="true" aria-labelledby="ex-title">
        <header className="ex-head">
          <div>
            <h2 id="ex-title">Esporta dati</h2>
            <p>Dataset aggregati e anonimizzati: i gruppi con meno di {SOGLIA_K} spostamenti nel periodo vengono rimossi.</p>
          </div>
          <button className="ex-x" onClick={onClose} aria-label="Chiudi">
            ✕
          </button>
        </header>

        <div className="ex-body">
          <section className="ex-left">
            <div className="ex-tabs" role="tablist">
              <button role="tab" aria-selected={tab === 'temi'} className={tab === 'temi' ? 'on' : ''} onClick={() => setTab('temi')}>
                Dataset tematici
              </button>
              <button role="tab" aria-selected={tab === 'custom'} className={tab === 'custom' ? 'on' : ''} onClick={() => setTab('custom')}>
                Personalizzato
              </button>
            </div>

            {tab === 'temi' ? (
              <ul className="ex-presets">
                {PRESETS.map((p) => (
                  <li key={p.id}>
                    <button className={preset === p.id ? 'on' : ''} onClick={() => setPreset(p.id)}>
                      <span className="ex-p-title">{p.titolo}</span>
                      <span className="ex-p-descr">{p.descr}</span>
                      <span className="ex-p-foot">
                        <span className="ex-chips">
                          {p.campi.map((c) => (
                            <i key={c}>{CAMPI.find((x) => x.id === c)!.label}</i>
                          ))}
                        </span>
                        <LossBadge s={summaries[keyFor(p.campi)]} />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="ex-fields">
                <p className="ex-hint">
                  Scegli fino a {MAX_CAMPI} campi: più campi combini, più i gruppi diventano piccoli e vengono rimossi dalla soglia.
                  <b>
                    {' '}
                    {custom.length}/{MAX_CAMPI} selezionati
                  </b>
                </p>
                {['Territorio', 'Tempo', 'Profilo', 'Spostamento'].map((g) => (
                  <fieldset key={g}>
                    <legend>{g}</legend>
                    {CAMPI.filter((c) => c.gruppo === g).map((c) => {
                      const checked = custom.includes(c.id)
                      const full = !checked && custom.length >= MAX_CAMPI
                      return (
                        <label key={c.id} className={full ? 'disabled' : ''}>
                          <input id={`ex-${c.id}`} type="checkbox" checked={checked} disabled={full} onChange={() => toggle(c.id)} />
                          {c.label}
                        </label>
                      )
                    })}
                  </fieldset>
                ))}
                {custom.includes('giorno') && custom.includes('giorno_settimana') && (
                  <p className="ex-hint">La data contiene già il giorno della settimana: puoi togliere uno dei due campi.</p>
                )}
              </div>
            )}
          </section>

          <section className="ex-right">
            <div className="ex-config">
              <label>
                <span>Livello territoriale</span>
                <select id="ex-livello" value={livello} onChange={(e) => setLivello(e.target.value as Livello)} disabled={!territoriale}>
                  {LIVELLI.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="ex-check">
                <input id="ex-filtri" type="checkbox" checked={useFilters} onChange={(e) => setUseFilters(e.target.checked)} disabled={!hasActiveFilters(filters)} />
                <span>{hasActiveFilters(filters) ? 'Applica i filtri attivi della dashboard' : 'Nessun filtro attivo: si esporta tutto il periodo'}</span>
              </label>
            </div>

            <div className={`ex-meter ${sv?.cls ?? ''}`}>
              <div className="ex-meter-head">
                <span>Perdita informativa</span>
                <b>{current ? `${sv!.label} · ${fmtPct(current.perdita)}` : campi.length ? 'calcolo…' : '–'}</b>
              </div>
              <div className="ex-bar">
                <i style={{ width: `${Math.min(100, (current?.perdita ?? 0) * 100)}%` }} />
              </div>
              {current && (
                <p>
                  Restano {fmt(current.gruppi_esportati)} gruppi su {fmt(current.gruppi_totali)}, con il {fmtPct(1 - current.perdita)} degli spostamenti.
                  {sv!.cls === 'high' && ' Riduci i campi o scegli un livello territoriale meno dettagliato.'}
                </p>
              )}
            </div>

            <div className="ex-preview">
              <div className="ex-preview-head">
                <span>Anteprima della struttura</span>
                <small>valori di esempio, non reali</small>
              </div>
              <div className="ex-table">
                <table>
                  <thead>
                    <tr>
                      {header.map((h) => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {campi.length ? (
                      examples.map((r, i) => (
                        <tr key={i}>
                          {r.map((v, j) => (
                            <td key={j}>{v}</td>
                          ))}
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={header.length}>Seleziona almeno un campo</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <p className="ex-legend">
                Valori dei campi: genere {Object.keys(GENERI).join(' / ')}; fasce {Object.keys(FASCE).join(', ')}. File CSV con separatore «;».
              </p>
            </div>

            {error && <p className="ex-error">Esportazione non riuscita: {error}</p>}
            <div className="ex-actions">
              <button className="ex-cancel" onClick={onClose}>
                Annulla
              </button>
              <button className="ex-go" onClick={download} disabled={!campi.length || downloading || !current}>
                {downloading ? 'Preparazione…' : `Scarica CSV${current ? ` · ${fmt(current.gruppi_esportati)} righe` : ''}`}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
