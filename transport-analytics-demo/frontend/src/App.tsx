import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { EMPTY_FILTERS, buildQuery, getJSON, type Filters, type Flows, type Livello, type Meta, type Selection, type Stats } from './api'
import { useApi, useClickOutside } from './hooks'
import { isStatic } from './local/client'
import { COLORS, fmt, fmtDate } from './labels'
import FilterBar from './components/FilterBar'
import FlowMap, { type NodeInfo } from './components/FlowMap'
import Sidebar from './components/Sidebar'
import Playback, { buildFrames, type PlaybackState } from './components/Playback'

const EXTRA_REGION_OFFSET = 900_000
// slider dei flussi su scala logaritmica: più precisione sui valori bassi
const FLOW_MIN = 20
const FLOW_MAX = 3000
const toSlider = (n: number) => Math.round((Math.log(n / FLOW_MIN) / Math.log(FLOW_MAX / FLOW_MIN)) * 100)
const fromSlider = (v: number) => {
  const n = FLOW_MIN * (FLOW_MAX / FLOW_MIN) ** (v / 100)
  return n < 100 ? Math.round(n / 5) * 5 : n < 1000 ? Math.round(n / 10) * 10 : Math.round(n / 50) * 50
}

const LIVELLI: { id: Livello; label: string; hint: string }[] = [
  { id: 'ace', label: 'ACE ISTAT', hint: 'Aree di censimento, subcomunali nei comuni maggiori' },
  { id: 'comune', label: 'Comuni', hint: 'Confini comunali' },
  { id: 'provincia', label: 'Province', hint: 'Confini provinciali' },
]

function ZoningSelect({ value, onChange }: { value: Livello; onChange: (l: Livello) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setOpen(false), [])
  useClickOutside(ref, close, open)
  const current = LIVELLI.find((l) => l.id === value)!
  return (
    <div className={`zoning ${open ? 'open' : ''}`} ref={ref}>
      <button className="zoning-btn" onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open}>
        <span className="zoning-label">Zonizzazione</span>
        <span className="zoning-value">{current.label}</span>
        <span className="zoning-caret">▾</span>
      </button>
      {open && (
        <ul className="zoning-menu" role="listbox" aria-label="Zonizzazione">
          {LIVELLI.map((l) => (
            <li key={l.id}>
              <button
                role="option"
                aria-selected={l.id === value}
                className={l.id === value ? 'on' : ''}
                onClick={() => {
                  onChange(l.id)
                  close()
                }}
              >
                <span>{l.label}</span>
                <small>{l.hint}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

interface UrlState {
  livello: Livello
  filters: Filters
  selection: Selection
  limit: number
}

/** Lo stato dell'analisi vive nell'URL: ogni vista è condivisibile e sopravvive al refresh. */
function readUrl(): UrlState {
  const q = new URLSearchParams(window.location.search)
  const list = (k: string) => (q.get(k) ? q.get(k)!.split(',') : [])
  const filters = Object.fromEntries(Object.keys(EMPTY_FILTERS).map((k) => [k, list(k)])) as unknown as Filters
  filters.dow = (filters.dow as unknown as string[]).map(Number)
  filters.periodo = q.get('da') && q.get('a') ? [q.get('da')!, q.get('a')!] : []
  const nodo = q.get('nodo')
  const link = q.get('link')?.split(',').map(Number)
  return {
    livello: (['ace', 'provincia'] as const).find((l) => l === q.get('livello')) ?? 'comune',
    filters,
    selection: nodo ? { type: 'nodo', id: Number(nodo) } : link?.length === 2 ? { type: 'link', a: link[0], b: link[1] } : null,
    limit: Number(q.get('limit')) || 300,
  }
}

export default function App() {
  const initial = useMemo(readUrl, [])
  const [livello, setLivello] = useState<Livello>(initial.livello)
  const [filters, setFilters] = useState<Filters>(initial.filters)
  const [selection, setSelection] = useState<Selection>(initial.selection)
  const [limit, setLimit] = useState(initial.limit)
  const [panelOpen, setPanelOpen] = useState(false)
  const [geo, setGeo] = useState<{ ace: any; comuni: any; province: any }>({ ace: null, comuni: null, province: null })

  const { data: meta, error: metaError } = useApi<Meta>('/api/meta', 0)
  const [progress, setProgress] = useState<number | null>(null)
  useEffect(() => {
    const on = (e: Event) => setProgress((e as CustomEvent<number>).detail)
    window.addEventListener('engine-progress', on)
    return () => window.removeEventListener('engine-progress', on)
  }, [])

  useEffect(() => {
    Promise.all([getJSON('geo/ace.geojson'), getJSON('geo/comuni.geojson'), getJSON('geo/province.geojson')]).then(
      ([ace, comuni, province]) => setGeo({ ace, comuni, province }),
    )
  }, [])

  const query = buildQuery(livello, filters, selection)
  useEffect(() => {
    if (isStatic) return // ospitata in un frame che non accetta query string nell'URL
    const q = new URLSearchParams(query)
    q.delete('livello')
    if (livello !== 'comune') q.set('livello', livello)
    if (limit !== 300) q.set('limit', String(limit))
    const s = q.toString()
    window.history.replaceState(null, '', s ? `?${s}` : window.location.pathname)
  }, [query, livello, limit])

  const stats = useApi<Stats>(meta ? `/api/stats?${query}` : null)

  // ---- playback: la mappa scorre per fasce orarie (giornata tipo) o per giorno e fascia (periodo)
  const [pb, setPb] = useState<PlaybackState>({ open: false, playing: false, mode: 'tipo', frame: 0, speed: 1 })
  const updatePb = useCallback((s: Partial<PlaybackState>) => setPb((cur) => ({ ...cur, ...s })), [])
  const frames = useMemo(() => {
    if (!meta) return []
    const [da, a] = filters.periodo.length ? filters.periodo : [meta.periodo.da, meta.periodo.a]
    const days: string[] = []
    for (let d = new Date(da + 'T00:00:00Z'); d.toISOString().slice(0, 10) <= a; d.setUTCDate(d.getUTCDate() + 1)) {
      const dow = ((d.getUTCDay() + 6) % 7) + 1
      if (!filters.dow.length || filters.dow.includes(dow)) days.push(d.toISOString().slice(0, 10))
    }
    const fasce = meta.fasce.map((f) => f.id).filter((id) => !filters.fascia.length || filters.fascia.includes(id))
    return buildFrames(pb.mode, days, fasce)
  }, [meta, filters.periodo, filters.dow, filters.fascia, pb.mode])
  const frameFilters = (i: number): Filters => {
    const fr = frames[i]
    if (!fr) return filters
    return { ...filters, fascia: [fr.fascia], periodo: fr.day ? [fr.day, fr.day] : filters.periodo }
  }
  const flowsUrl = (fl: Filters) => `/api/flows?${buildQuery(livello, fl, selection, { limit })}`
  const pbActive = pb.open && frames.length > 0
  const currentFlowsUrl = meta ? flowsUrl(pbActive ? frameFilters(pb.frame) : filters) : null
  const flows = useApi<Flows>(currentFlowsUrl, pbActive ? 0 : 120)

  // scala fissa durante il playback, presa dalla vista complessiva: una fascia pesa al più ~40% del giorno
  const [pbScale, setPbScale] = useState<{ arc: number; node: number } | null>(null)
  useEffect(() => {
    if (pbActive || !flows.data) return
    const d = flows.data
    setPbScale({
      arc: Math.max(1, ...d.flussi.map((x) => x.n)) * 0.4,
      node: Math.max(1, ...d.nodi.map((x) => x.uscita + x.ingresso + x.interni)) * 0.4,
    })
  }, [pbActive, flows.data])

  // avanzamento: il fotogramma successivo parte solo quando quello corrente è stato disegnato
  const frameReady = flows.dataUrl === currentFlowsUrl
  useEffect(() => {
    if (!pbActive || !pb.playing || !frameReady) return
    const next = (pb.frame + 1) % frames.length
    getJSON(flowsUrl(frameFilters(next))).catch(() => undefined) // precalcolo
    const t = setTimeout(() => updatePb({ frame: next }), (pb.mode === 'tipo' ? 1600 : 900) / pb.speed)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pbActive, pb.playing, pb.frame, pb.speed, frameReady, frames.length])
  useEffect(() => {
    if (pb.frame >= frames.length) updatePb({ frame: 0 })
  }, [frames.length, pb.frame, updatePb])

  const nodes = useMemo(() => {
    const m = new Map<number, NodeInfo>()
    if (!meta) return m
    if (livello === 'ace') meta.ace.forEach((z) => m.set(z.id, z))
    else if (livello === 'comune') meta.zone.forEach((z) => m.set(z.id, z))
    else meta.province.forEach((p) => m.set(p.id, p))
    return m
  }, [meta, livello])
  const nameOf = useCallback((id: number) => nodes.get(id)?.nome ?? `#${id}`, [nodes])
  const selectLink = useCallback((a: number, b: number) => setSelection({ type: 'link', a, b }), [])

  const changeLivello = (l: Livello) => {
    setLivello(l)
    setSelection(null)
  }

  const fasceOre = useMemo(
    () => Object.fromEntries((meta?.fasce ?? []).map((f) => [f.id, `${f.da}–${f.a + 1}`])),
    [meta],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelection(null)
      const tag = (e.target as HTMLElement).tagName
      if (e.key === ' ' && tag !== 'INPUT' && tag !== 'BUTTON') {
        e.preventDefault()
        setPb((cur) => (cur.open ? { ...cur, playing: !cur.playing } : cur))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (metaError) return <div className="fatal">Impossibile contattare l'API: {metaError}</div>
  if (!meta) return <div className="fatal">Caricamento…</div>

  const f = flows.data
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img src="logo-windtre-business.png" alt="WINDTRE Business" className="logo-w3" />
          <span className="brand-sep" />
          <img src="logo-ckdelta.png" alt="CKDelta" className="logo-ck" />
        </div>
        <div className="title">
          <h1>Transport Analytics</h1>
          <span>
            Matrice Origine–Destinazione · Piemonte · {fmtDate(meta.periodo.da, { day: 'numeric', month: 'long' })} →{' '}
            {fmtDate(meta.periodo.a, { day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
        </div>
        <ZoningSelect value={livello} onChange={changeLivello} />
      </header>

      <FilterBar meta={meta} filters={filters} onChange={setFilters} />

      <main className="body">
        <Sidebar
          stats={stats.data}
          loading={stats.loading}
          selection={selection}
          nameOf={nameOf}
          fasceOre={fasceOre}
          onSelectLink={selectLink}
        />
        <section className="map-area">
          <FlowMap
            livello={livello}
            flows={f}
            nodes={nodes}
            aree={livello === 'ace' ? geo.ace : geo.comuni}
            province={geo.province}
            selection={selection}
            onSelect={setSelection}
            extraRegionOffset={EXTRA_REGION_OFFSET}
            scale={pbActive ? pbScale : null}
          />

          {pbActive ? (
            <Playback
              state={pb}
              frames={frames}
              fasceOre={fasceOre}
              volume={frameReady && f ? f.volume_flussi : null}
              onChange={updatePb}
            />
          ) : (
            <button className="pb-open" onClick={() => updatePb({ open: true, playing: true, frame: 0 })}>
              <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden>
                <path d="M7 4.5v15l13-7.5z" fill="currentColor" />
              </svg>
              Riproduci la giornata
            </button>
          )}

          {selection && (
            <div className="sel-chip">
              <span>
                {selection.type === 'nodo' ? (
                  <>
                    Zona: <b>{nameOf(selection.id)}</b>
                  </>
                ) : (
                  <>
                    Relazione: <b>{nameOf(selection.a)}</b> ⇄ <b>{nameOf(selection.b)}</b>
                  </>
                )}
              </span>
              <button onClick={() => setSelection(null)} title="Rimuovi selezione (Esc)">
                ✕
              </button>
            </div>
          )}

          <div className={`map-panel ${panelOpen ? 'open' : ''}`}>
            <button className="mp-toggle" onClick={() => setPanelOpen((o) => !o)} aria-expanded={panelOpen} aria-controls="mp-body">
              <span>Flussi mostrati</span>
              <b className="mp-value">{fmt(f ? Math.min(limit, f.coppie_totali) : limit)}</b>
              <span className="mp-caret">▾</span>
            </button>
            {panelOpen && (
              <div id="mp-body" className="mp-body">
                <input
                  id="flow-limit"
                  aria-label="Numero di flussi mostrati"
                  className="slider"
                  type="range"
                  min={0}
                  max={100}
                  value={toSlider(limit)}
                  style={{ '--fill': `${toSlider(limit)}%` } as React.CSSProperties}
                  onChange={(e) => setLimit(fromSlider(Number(e.target.value)))}
                />
                <div className="slider-scale">
                  <span>{FLOW_MIN}</span>
                  <span>principali</span>
                  <span>{fmt(FLOW_MAX)}</span>
                </div>
                {f && (
                  <p className="mp-note">
                    {fmt(Math.min(limit, f.coppie_totali))} di {fmt(f.coppie_totali)} relazioni attive ·{' '}
                    {fmt(f.volume_flussi)} spostamenti medi/giorno tra zone diverse
                  </p>
                )}
                <div className="legend">
                  {selection ? (
                    <>
                      <span>
                        <i style={{ background: COLORS.out }} /> {selection.type === 'nodo' ? 'In uscita' : `Da ${nameOf(selection.a)}`}
                      </span>
                      <span>
                        <i style={{ background: COLORS.in }} /> {selection.type === 'nodo' ? 'In ingresso' : `Da ${nameOf(selection.b)}`}
                      </span>
                    </>
                  ) : (
                    <span className="grad">
                      <i /> spostamenti medi/giorno: più intenso e opaco = flusso maggiore
                    </span>
                  )}
                </div>
                <p className="mp-hint">Clic su una zona: flussi in ingresso e uscita · clic su un flusso: relazione tra le due zone</p>
              </div>
            )}
          </div>

          {progress !== null && progress < 1 ? (
            <div className="busy">Caricamento dei dati · {Math.round(progress * 100)}%</div>
          ) : (
            !pbActive && (flows.loading || stats.loading) && <div className="busy">Aggiornamento…</div>
          )}
        </section>
      </main>
    </div>
  )
}
