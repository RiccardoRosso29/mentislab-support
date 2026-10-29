import { useCallback, useEffect, useMemo, useState } from 'react'
import { EMPTY_FILTERS, buildQuery, getJSON, type Filters, type Flows, type Livello, type Meta, type Selection, type Stats } from './api'
import { useApi } from './hooks'
import { isStatic } from './local/client'
import { COLORS, fmt, fmtDate } from './labels'
import FilterBar from './components/FilterBar'
import FlowMap, { type NodeInfo } from './components/FlowMap'
import Sidebar from './components/Sidebar'

const EXTRA_REGION_OFFSET = 900_000
const FLOW_LIMITS = [100, 300, 600, 1200]

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
  const nodo = q.get('nodo')
  const link = q.get('link')?.split(',').map(Number)
  return {
    livello: q.get('livello') === 'provincia' ? 'provincia' : 'comune',
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
  const [geo, setGeo] = useState<{ comuni: any; province: any }>({ comuni: null, province: null })

  const { data: meta, error: metaError } = useApi<Meta>('/api/meta', 0)
  const [progress, setProgress] = useState<number | null>(null)
  useEffect(() => {
    const on = (e: Event) => setProgress((e as CustomEvent<number>).detail)
    window.addEventListener('engine-progress', on)
    return () => window.removeEventListener('engine-progress', on)
  }, [])

  useEffect(() => {
    Promise.all([getJSON('geo/comuni.geojson'), getJSON('geo/province.geojson')]).then(([comuni, province]) =>
      setGeo({ comuni, province }),
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
  const flows = useApi<Flows>(meta ? `/api/flows?${buildQuery(livello, filters, selection, { limit })}` : null)

  const nodes = useMemo(() => {
    const m = new Map<number, NodeInfo>()
    if (!meta) return m
    if (livello === 'comune') meta.zone.forEach((z) => m.set(z.id, z))
    else meta.province.forEach((p) => m.set(p.id, p))
    return m
  }, [meta, livello])
  const nameOf = useCallback((id: number) => nodes.get(id)?.nome ?? `#${id}`, [nodes])

  const changeLivello = (l: Livello) => {
    setLivello(l)
    setSelection(null)
  }

  const fasceOre = useMemo(
    () => Object.fromEntries((meta?.fasce ?? []).map((f) => [f.id, `${f.da}–${f.a + 1}`])),
    [meta],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setSelection(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (metaError) return <div className="fatal">Impossibile contattare l'API: {metaError}</div>
  if (!meta) return <div className="fatal">Caricamento…</div>

  const f = flows.data
  return (
    <div className="app">
      <header className="topbar">
        <img src="logo-ckdelta.png" alt="CKDelta" className="logo" />
        <div className="title">
          <h1>Mobility Analytics</h1>
          <span>
            Matrice Origine–Destinazione · Piemonte · {fmtDate(meta.periodo.da, { day: 'numeric', month: 'long' })} →{' '}
            {fmtDate(meta.periodo.a, { day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
        </div>
        <div className="seg">
          <span>Zonizzazione</span>
          <button className={livello === 'comune' ? 'on' : ''} onClick={() => changeLivello('comune')}>
            Comuni
          </button>
          <button className={livello === 'provincia' ? 'on' : ''} onClick={() => changeLivello('provincia')}>
            Province
          </button>
        </div>
      </header>

      <FilterBar meta={meta} filters={filters} onChange={setFilters} />

      <main className="body">
        <Sidebar
          stats={stats.data}
          loading={stats.loading}
          selection={selection}
          nameOf={nameOf}
          fasceOre={fasceOre}
          onSelectLink={(a, b) => setSelection({ type: 'link', a, b })}
        />
        <section className="map-area">
          <FlowMap
            livello={livello}
            flows={f}
            nodes={nodes}
            comuni={geo.comuni}
            province={geo.province}
            selection={selection}
            onSelect={setSelection}
            extraRegionOffset={EXTRA_REGION_OFFSET}
          />

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

          <div className="map-panel">
            <div className="mp-row">
              <span>Flussi mostrati</span>
              <div className="seg small">
                {FLOW_LIMITS.map((l) => (
                  <button key={l} className={limit === l ? 'on' : ''} onClick={() => setLimit(l)}>
                    {l}
                  </button>
                ))}
              </div>
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
                  <i /> intensità del flusso (spostamenti medi/giorno)
                </span>
              )}
            </div>
            <p className="mp-hint">Clic su una zona: flussi in ingresso e uscita · clic su un flusso: relazione tra le due zone</p>
          </div>

          {progress !== null && progress < 1 ? (
            <div className="busy">Caricamento dei dati · {Math.round(progress * 100)}%</div>
          ) : (
            (flows.loading || stats.loading) && <div className="busy">Aggiornamento…</div>
          )}
        </section>
      </main>
    </div>
  )
}
