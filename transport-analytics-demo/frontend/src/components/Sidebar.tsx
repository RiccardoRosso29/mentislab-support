import { memo, useState, type ReactNode } from 'react'
import type { Filters, Livello, Relazioni, Selection, Stats } from '../api'
import {
  COLORS,
  DOW,
  ETA,
  FASCE,
  GENERI,
  MOTIVI,
  MOTIVI_ORDER,
  NAZIONALITA,
  TIPOLOGIE,
  etaLabel,
  fmt,
  fmtDate,
  fmtN,
  fmtPct,
} from '../labels'
import { BarChart, Donut, GroupedBars, Heatmap, LineDaily, StackBar, fmtPp } from './Charts'

// i motivi di spostamento sono un modulo commerciale a sé: sezione separata, sempre per ultima
const SEZIONI = { panoramica: 'Panoramica', comportamenti: 'Comportamenti', profili: 'Profili', motivi: 'Motivi' } as const
type Sezione = keyof typeof SEZIONI
const ALL = new Set(Object.keys(SEZIONI) as Sezione[])

interface Item {
  id: string
  sezione: Sezione
  show?: boolean
  render: () => ReactNode
}

interface Props {
  stats: Stats | null
  loading: boolean
  selection: Selection
  nameOf: (id: number) => string
  fasceOre: Record<string, string>
  onSelectLink: (a: number, b: number) => void
  filters: Filters
  onFilters: (f: Filters) => void
  /** statistiche senza la selezione sulla mappa: profilo medio usato come benchmark */
  bench: Stats | null
  rel: Relazioni | null
  onOpenRelazioni: () => void
  /** statistiche della selezione senza filtri di origine/destinazione: base di "Bilancio" e "Direzioni" */
  odFree: Stats | null
  livello: Livello
}

/** Tabella delle relazioni: classifica generale, relazioni della zona, o posizione della relazione scelta. */
function OdTable({
  rel,
  selection,
  onSelectLink,
  onOpenAll,
}: {
  rel: Relazioni | null
  selection: Selection
  onSelectLink: (a: number, b: number) => void
  onOpenAll: () => void
}) {
  if (!rel) return <p className="sb-empty">Caricamento…</p>
  const list = rel.relazioni
  if (!list.length) return <p className="sb-empty">Nessuna relazione tra zone diverse sopra la soglia di {rel.soglia} spostamenti.</p>

  type Row = { r: (typeof list)[number]; rank: number } | 'gap'
  let rows: Row[]
  const isSel = (x: (typeof list)[number]) =>
    selection?.type === 'link' && ((x.o === selection.a && x.d === selection.b) || (x.o === selection.b && x.d === selection.a))
  if (selection?.type === 'link') {
    // la prima come riferimento, più le relazioni attorno a quella selezionata
    const keep = new Set<number>([0])
    list.forEach((x, i) => isSel(x) && [i - 2, i - 1, i, i + 1, i + 2].forEach((k) => k >= 0 && k < list.length && keep.add(k)))
    const idx = [...keep].sort((a, b) => a - b)
    rows = []
    idx.forEach((k, n) => {
      if (n > 0 && k - idx[n - 1] > 1) rows.push('gap')
      rows.push({ r: list[k], rank: k + 1 })
    })
  } else rows = list.slice(0, 10).map((r, i) => ({ r, rank: i + 1 }))

  return (
    <>
      <table className="od-table">
        <thead>
          <tr>
            <th className="idx">#</th>
            <th>Origine → destinazione</th>
            <th className="num">Medi / giorno</th>
            <th className="num">Quota</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) =>
            row === 'gap' ? (
              <tr key={`gap-${i}`} className="gap">
                <td colSpan={4}>⋯</td>
              </tr>
            ) : (
              <tr key={`${row.r.o}-${row.r.d}`} className={isSel(row.r) ? 'sel' : ''} onClick={() => onSelectLink(row.r.o, row.r.d)}>
                <td className="idx">{fmt(row.rank)}</td>
                <td>
                  {row.r.o_nome} <span className="arrow">→</span> {row.r.d_nome}
                </td>
                <td className="num">{fmtN(row.r.media)}</td>
                <td className="num muted">{fmtPct(row.r.n / rel.totale)}</td>
              </tr>
            ),
          )}
        </tbody>
      </table>
      <button className="od-all" onClick={onOpenAll}>
        Vedi tutte le {fmt(list.length)} relazioni
      </button>
    </>
  )
}

interface CardProps {
  /** controllo opzionale nell'angolo in alto a destra della scheda */
  azione?: ReactNode
  title: string
  subtitle?: string
  children: ReactNode
  /** Grafico cliccabile: filtro attivo sulla sua dimensione e comando per rimuoverlo. */
  filtro?: { attivo: string | null; onClear: () => void }
}

function Card({ title, subtitle, children, filtro, azione }: CardProps) {
  return (
    <section className={`card ${filtro ? 'interactive' : ''}`}>
      <header>
        <div className="card-title">
          <h3>{title}</h3>
          <div className="card-title-right">
            {filtro?.attivo && (
              <button className="card-filter" onClick={filtro.onClear} title="Rimuovi il filtro">
                {filtro.attivo} <span aria-hidden>✕</span>
              </button>
            )}
            {azione}
          </div>
        </div>
        {subtitle && <p>{subtitle}</p>}
      </header>
      {children}
    </section>
  )
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="kpi">
      <span className="kpi-label">{label}</span>
      <span className="kpi-value">{value}</span>
      {sub && <span className="kpi-sub">{sub}</span>}
    </div>
  )
}

function Sidebar({ stats, loading, selection, nameOf, fasceOre, onSelectLink, filters, onFilters, bench, rel, onOpenRelazioni, odFree, livello }: Props) {
  const [focus, setFocus] = useState<Set<Sezione>>(ALL)
  const [hideNA, setHideNA] = useState(true)
  // con tutte le sezioni attive il primo clic isola la sezione; svuotando la selezione si torna a tutte
  const toggle = (k: Sezione) =>
    setFocus((cur) => {
      if (cur.size === ALL.size) return new Set([k])
      const next = new Set(cur)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next.size ? next : ALL
    })

  if (!stats) return <aside className="sidebar">{loading && <div className="sb-loading">Caricamento…</div>}</aside>

  const nd = stats.n_giorni || 1
  const perDay = (v: number) => v / nd
  const total = stats.kpi.totale

  // I grafici interattivi usano le distribuzioni "cross": ognuna ignora il filtro del proprio grafico,
  // così i valori non selezionati restano visibili e quelli scelti sono solo evidenziati.
  const cx = stats.cross
  // Benchmark (solo con una zona o relazione selezionata): profilo medio dell'area di studio con gli stessi
  // filtri, riportato sul totale della selezione. Mostra come sarebbe la selezione se si comportasse come la media.
  const bx = selection && bench ? bench.cross : null
  const scaled = (sel: (number | null)[], ref: (number | null)[]) => {
    const st = sel.reduce<number>((s, v) => s + (v ?? 0), 0)
    const rt = ref.reduce<number>((s, v) => s + (v ?? 0), 0)
    return rt > 0 ? ref.map((v) => (v == null ? null : (v / rt) * st)) : undefined
  }
  const shareFirst = (rec: Record<string, number> | undefined, keys: string[]) => {
    if (!rec) return null
    const t = keys.reduce((s, k) => s + (rec[k] ?? 0), 0)
    return t > 0 ? (rec[keys[0]] ?? 0) / t : null
  }
  /** Scarto di ogni quota della selezione dalla quota corrispondente nel profilo medio. */
  const deltaQuote = (sel: number[], ref: number[]) => {
    const st = sel.reduce((s, v) => s + v, 0)
    const rt = ref.reduce((s, v) => s + v, 0)
    return st > 0 && rt > 0 ? sel.map((v, i) => v / st - ref[i] / rt) : undefined
  }
  const generiVisibili = hideNA ? ['f', 'm'] : ['f', 'm', 'NA']
  // motivi: quota di ogni combinazione nel profilo medio, per la tacca sulle barre orizzontali
  const motBench = (mo: string, md: string) => {
    if (!bx) return null
    const t = bx.motivi.reduce((s, r) => s + r.n, 0)
    return t > 0 ? (bx.motivi.find((r) => r.mo === mo && r.md === md)?.n ?? 0) / t : null
  }
  const legendaSettimana = (
    <p className="day-legend">
      <span>
        <i style={{ background: COLORS.accent }} /> Infrasettimanale
      </span>
      <span>
        <i style={{ background: COLORS.secondary }} /> Weekend
      </span>
    </p>
  )
  const benchNote = bx ? <p className="bench-note"><i /> Profilo medio dell’area di studio, riportato sul totale della selezione</p> : null
  const genereTot = (g: string) => cx.genere[g] ?? 0
  const etaBy = (g: string) => ETA.filter((e) => e !== 'NA').map((e) => perDay(cx.eta.find((r) => r.genere === g && r.eta === e)?.n ?? 0))
  const naDemo = genereTot('NA')

  const mot = MOTIVI_ORDER.map((mo) => MOTIVI_ORDER.map((md) => cx.motivi.find((r) => r.mo === mo && r.md === md)?.n ?? 0))
  const motTot = cx.motivi.reduce((s, r) => s + r.n, 0)
  const motRank = cx.motivi
    .filter((r) => r.n > 0)
    .map((r) => ({ label: `${MOTIVI[r.mo]} → ${MOTIVI[r.md]}`, n: r.n, mo: r.mo, md: r.md }))
    .sort((a, b) => b.n - a.n)

  const fasce = Object.keys(FASCE).map((k) => cx.per_fascia.find((r) => r.fascia === k)?.media ?? 0)

  // filtri dai grafici: clic = seleziona solo quel valore (di nuovo = deseleziona); Ctrl/⌘+clic = aggiunge o toglie
  type ListKey = 'dow' | 'fascia' | 'motivo' | 'genere' | 'eta' | 'nazionalita' | 'tipologia'
  const choose = (k: ListKey, v: string | number, multi: boolean) => {
    const cur = filters[k] as (string | number)[]
    const next = multi ? (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]) : cur.length === 1 && cur[0] === v ? [] : [v]
    onFilters({ ...filters, [k]: k === 'dow' ? (next as number[]).sort() : next })
  }
  const sel = (k: ListKey, v: string | number) => (filters[k] as (string | number)[]).includes(v)
  const hl = <T,>(k: ListKey, f: (i: number) => T) => (filters[k].length ? (i: number) => sel(k, f(i) as string | number) : undefined)
  const [da, a] = filters.periodo
  const pickDay = (day: string, multi: boolean) => {
    if (multi && da) onFilters({ ...filters, periodo: [day < da ? day : da, day > a ? day : a] })
    else onFilters({ ...filters, periodo: da === day && a === day ? [] : [day, day] })
  }
  const filtro = (k: ListKey, label: (v: string | number) => string) => ({
    attivo: filters[k].length ? (filters[k] as (string | number)[]).map(label).join(', ') : null,
    onClear: () => onFilters({ ...filters, [k]: [] }),
  })
  const periodoAttivo = da ? (da === a ? fmtDate(da) : `${fmtDate(da)} – ${fmtDate(a)}`) : null

  // "Bilancio" e "Direzioni" filtrano per origine/destinazione: come gli altri grafici restano completi
  // (dati senza quei filtri) ed evidenziano la parte scelta
  const odBase = odFree ?? stats
  const nodo = odBase.kpi.nodo
  const linkA = selection?.type === 'link' ? selection.a : null
  const tok = (id: number) => `${livello === 'ace' ? 'a' : livello === 'comune' ? 'c' : 'p'}:${id}`
  const same = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i])
  const odState = (o: string[], d: string[], xi: boolean) => same(filters.origine, o) && same(filters.destinazione, d) && filters.xi.length === Number(xi)
  const setOD = (o: string[], d: string[], xi: boolean) =>
    onFilters(odState(o, d, xi) ? { ...filters, origine: [], destinazione: [], xi: [] } : { ...filters, origine: o, destinazione: d, xi: xi ? ['1'] : [] })
  const clearOD = () => onFilters({ ...filters, origine: [], destinazione: [], xi: [] })

  const bilancio = (() => {
    if (selection?.type !== 'nodo') return null
    const t = tok(selection.id)
    const opts = [
      { label: 'In uscita', o: [t], d: [] as string[], xi: true },
      { label: 'In ingresso', o: [] as string[], d: [t], xi: true },
      { label: 'Interni', o: [t], d: [t], xi: false },
    ]
    const attivo = opts.findIndex((x) => odState(x.o, x.d, x.xi))
    return { opts, attivo }
  })()
  const direzioni = (() => {
    if (selection?.type !== 'link') return null
    const rows = [...odBase.top_od].sort((x, y) => Number(y.o === linkA) - Number(x.o === linkA))
    const attivo = rows.findIndex((r) => odState([tok(r.o)], [tok(r.d)], false))
    return { rows, attivo }
  })()

  const items: Item[] = [
    {
      id: 'kpi',
      sezione: 'panoramica',
      render: () => (
        <div className="kpi-grid">
          <Kpi label="Spostamenti medi / giorno" value={fmtN(stats.kpi.media_giornaliera)} />
          <Kpi label="Spostamenti nel periodo" value={fmtN(total)} />
        </div>
      ),
    },
    {
      id: 'bilancio',
      sezione: 'panoramica',
      show: Boolean(stats.kpi.nodo),
      render: () => (
        <Card
          title="Bilancio della zona"
          subtitle="Spostamenti medi giornalieri"
          filtro={{ attivo: bilancio && bilancio.attivo >= 0 ? bilancio.opts[bilancio.attivo].label : null, onClear: clearOD }}
        >
          <StackBar
            onPick={(i) => bilancio && setOD(bilancio.opts[i].o, bilancio.opts[i].d, bilancio.opts[i].xi)}
            selected={bilancio && bilancio.attivo >= 0 ? (i) => i === bilancio.attivo : undefined}
            items={[
              { label: 'In uscita', value: perDay(nodo?.uscita ?? 0), color: COLORS.out },
              { label: 'In ingresso', value: perDay(nodo?.ingresso ?? 0), color: COLORS.in },
              { label: 'Interni', value: perDay(nodo?.interni ?? 0), color: COLORS.secondary },
            ]}
          />
        </Card>
      ),
    },
    {
      id: 'direzioni',
      sezione: 'panoramica',
      show: selection?.type === 'link',
      render: () => (
        <Card
          title="Direzioni"
          subtitle="Spostamenti medi giornalieri"
          filtro={{
            attivo: direzioni && direzioni.attivo >= 0 ? `${direzioni.rows[direzioni.attivo].o_nome} → ${direzioni.rows[direzioni.attivo].d_nome}` : null,
            onClear: clearOD,
          }}
        >
          <StackBar
            onPick={(i) => direzioni && setOD([tok(direzioni.rows[i].o)], [tok(direzioni.rows[i].d)], false)}
            selected={direzioni && direzioni.attivo >= 0 ? (i) => i === direzioni.attivo : undefined}
            items={(direzioni?.rows ?? []).map((r) => ({
                label: `${r.o_nome} → ${r.d_nome}`,
                value: r.media,
                color: r.o === linkA ? COLORS.out : COLORS.in,
              }))}
          />
        </Card>
      ),
    },
    {
      id: 'giornaliero',
      sezione: 'panoramica',
      render: () => (
        <Card
          title="Andamento giornaliero"
          subtitle="Spostamenti totali per giorno"
          filtro={{ attivo: periodoAttivo, onClear: () => onFilters({ ...filters, periodo: [] }) }}
          azione={legendaSettimana}
        >
          <LineDaily
            onPick={(p) => {
              const day = cx.giornaliero[p.dataIndex]?.giorno
              if (day) pickDay(day, p.multi)
            }}
            selected={da ? (i) => cx.giornaliero[i].giorno >= da && cx.giornaliero[i].giorno <= a : undefined}
            labels={cx.giornaliero.map((d) => fmtDate(d.giorno, { day: 'numeric', month: 'numeric' }))}
            values={cx.giornaliero.map((d) => d.n)}
            weekend={cx.giornaliero.map((d) => d.dow >= 6)}
            bench={bx ? scaled(cx.giornaliero.map((d) => d.n), bx.giornaliero.map((d) => d.n)) : undefined}
          />
          {benchNote}
        </Card>
      ),
    },
    {
      id: 'top_od',
      sezione: 'panoramica',
      render: () => (
        <Card
          title={selection?.type === 'nodo' ? 'Relazioni della zona' : selection?.type === 'link' ? 'Posizione nella classifica' : 'Principali relazioni OD'}
          subtitle={
            selection?.type === 'nodo'
              ? 'Relazioni con origine o destinazione nella zona selezionata'
              : selection?.type === 'link'
                ? 'La relazione selezionata tra tutte quelle dell’area di studio'
                : 'Spostamenti medi giornalieri · clic su una riga per selezionarla'
          }
        >
          <OdTable rel={rel} selection={selection} onSelectLink={onSelectLink} onOpenAll={onOpenRelazioni} />
        </Card>
      ),
    },
    {
      id: 'dow',
      sezione: 'comportamenti',
      render: () => (
        <Card
          title="Giorno della settimana"
          subtitle="Spostamenti medi per giorno"
          filtro={filtro('dow', (v) => DOW[Number(v) - 1].short)}
          azione={legendaSettimana}
        >
          <BarChart
            onPick={(p) => choose('dow', p.dataIndex + 1, p.multi)}
            highlight={hl('dow', (i) => i + 1)}
            labels={DOW.map((d) => d.short)}
            values={cx.per_dow.map((d) => d.media)}
            colors={cx.per_dow.map((d) => (d.dow >= 6 ? COLORS.secondary : COLORS.accent))}
            bench={bx ? scaled(cx.per_dow.map((d) => d.media), bx.per_dow.map((d) => d.media)) : undefined}
          />
          {benchNote}
        </Card>
      ),
    },
    {
      id: 'fascia',
      sezione: 'comportamenti',
      render: () => (
        <Card title="Fascia oraria di partenza" subtitle="Spostamenti medi giornalieri per fascia" filtro={filtro('fascia', (v) => FASCE[v])}>
          <BarChart
            onPick={(p) => choose('fascia', Object.keys(FASCE)[p.dataIndex], p.multi)}
            highlight={hl('fascia', (i) => Object.keys(FASCE)[i])}
            labels={Object.keys(FASCE).map((k) => `${FASCE[k]}\n${fasceOre[k] ?? ''}`)}
            values={fasce}
            color={COLORS.accent}
            height={200}
            bench={bx ? scaled(fasce, Object.keys(FASCE).map((k) => bx.per_fascia.find((r) => r.fascia === k)?.media ?? 0)) : undefined}
          />
          {benchNote}
        </Card>
      ),
    },
    {
      id: 'motivo',
      sezione: 'motivi',
      render: () => (
        <Card
          title="Motivo dello spostamento"
          subtitle="Origine (righe) → destinazione (colonne): Casa = luogo di residenza, Lavoro = luogo di lavoro, Altro = luogo visitato"
          filtro={filtro('motivo', (v) => String(v).split('>').map((m) => MOTIVI[m]).join('→'))}
        >
          <Heatmap
            onPick={(p) => {
              const [col, row] = p.value as number[]
              choose('motivo', `${MOTIVI_ORDER[row]}>${MOTIVI_ORDER[col]}`, p.multi)
            }}
            selected={filters.motivo.length ? (row, col) => sel('motivo', `${MOTIVI_ORDER[row]}>${MOTIVI_ORDER[col]}`) : undefined}
            rows={MOTIVI_ORDER.map((m) => MOTIVI[m])}
            cols={MOTIVI_ORDER.map((m) => MOTIVI[m])}
            values={mot}
            total={motTot}
          />
          <ol className="rank">
            {motRank.slice(0, 5).map((r) => {
              const scala = motRank[0].n / motTot // la barra più lunga corrisponde alla quota più alta
              const b = motBench(r.mo, r.md)
              const quota = r.n / motTot
              return (
                <li key={r.label}>
                  <span>{r.label}</span>
                  <span className="rank-bar">
                    <i style={{ width: `${(quota / scala) * 100}%` }} />
                    {b != null && <span className="rank-bench" style={{ left: `${Math.min(100, (b / scala) * 100)}%` }} title={`Profilo medio: ${fmtPct(b)}`} />}
                  </span>
                  <b>
                    {fmtPct(quota)}
                    {b != null && <small className="pp">{fmtPp(quota - b)}</small>}
                  </b>
                </li>
              )
            })}
          </ol>
          {bx && (
            <p className="bench-note tick">
              <i /> Quota della combinazione nel profilo medio dell’area; a destra lo scarto in punti percentuali
            </p>
          )}
        </Card>
      ),
    },
    {
      id: 'tipologia',
      sezione: 'comportamenti',
      render: () => (
        <Card title="Tipologia di spostamento" subtitle="Spostamenti medi giornalieri" filtro={filtro('tipologia', (v) => TIPOLOGIE[v])}>
          <StackBar
            onPick={(i, multi) => choose('tipologia', Object.keys(TIPOLOGIE)[i], multi)}
            selected={hl('tipologia', (i) => Object.keys(TIPOLOGIE)[i])}
            items={Object.entries(TIPOLOGIE).map(([k, label], i) => ({
              label,
              value: perDay(cx.tipologia[k] ?? 0),
              color: i ? COLORS.secondary : COLORS.accent,
            }))}
            benchShare={bx ? shareFirst(bx.tipologia, Object.keys(TIPOLOGIE)) : null}
          />
        </Card>
      ),
    },
    {
      id: 'genere',
      sezione: 'profili',
      render: () => (
        <Card
          title="Genere"
          subtitle={naDemo > 0 && !hideNA ? `N/D: viaggiatori stranieri, senza profilo sociodemografico` : undefined}
          filtro={filtro('genere', (v) => GENERI[v])}
          azione={
            naDemo > 0 && (
              <label className="card-flag">
                <input id="hide-na" type="checkbox" checked={hideNA} onChange={(e) => setHideNA(e.target.checked)} />
                Nascondi N/D
              </label>
            )
          }
        >
          <Donut
            height={bx ? 210 : 190}
            onPick={(p) => choose('genere', generiVisibili[p.dataIndex], p.multi)}
            selected={hl('genere', (i) => generiVisibili[i])}
            items={generiVisibili.map((g) => ({
              name: GENERI[g],
              value: perDay(genereTot(g)),
              color: g === 'f' ? COLORS.secondary : g === 'm' ? COLORS.accent : COLORS.grey,
            }))}
            deltas={bx ? deltaQuote(generiVisibili.map(genereTot), generiVisibili.map((g) => bx.genere[g] ?? 0)) : undefined}
          />
          {benchNote && <p className="bench-note">Sotto ogni quota: scarto in punti percentuali dal profilo medio dell’area</p>}
        </Card>
      ),
    },
    {
      id: 'eta',
      sezione: 'profili',
      render: () => (
        <Card title="Età e genere" subtitle="Spostamenti medi giornalieri per fascia d'età" filtro={filtro('eta', (v) => etaLabel(String(v)))}>
          <GroupedBars
            onPick={(p) => choose('eta', ETA[p.dataIndex], p.multi)}
            selected={hl('eta', (i) => ETA[i])}
            labels={ETA.filter((e) => e !== 'NA').map(etaLabel)}
            series={[
              { name: GENERI.f, values: etaBy('f'), color: COLORS.secondary },
              { name: GENERI.m, values: etaBy('m'), color: COLORS.accent },
            ]}
          />
        </Card>
      ),
    },
    {
      id: 'nazionalita',
      sezione: 'profili',
      render: () => (
        <Card title="Nazionalità" subtitle="Spostamenti medi giornalieri" filtro={filtro('nazionalita', (v) => NAZIONALITA[v])}>
          <StackBar
            onPick={(i, multi) => choose('nazionalita', Object.keys(NAZIONALITA)[i], multi)}
            selected={hl('nazionalita', (i) => Object.keys(NAZIONALITA)[i])}
            items={Object.entries(NAZIONALITA).map(([k, label], i) => ({
              label,
              value: perDay(cx.nazionalita[k] ?? 0),
              color: i ? COLORS.secondary : COLORS.accent,
            }))}
            benchShare={bx ? shareFirst(bx.nazionalita, Object.keys(NAZIONALITA)) : null}
          />
        </Card>
      ),
    },
  ]

  const match = (it: Item) => (it.show ?? true) && focus.has(it.sezione)
  const visible = items.filter(match)

  return (
    <aside className={`sidebar ${loading ? 'is-loading' : ''}`}>
      <div className="sb-top">
        <div className="sb-context">
          <h2>Metriche &amp; Insights</h2>
          <p>
            {selection?.type === 'nodo' && (
              <>
                Zona selezionata: <b>{nameOf(selection.id)}</b>
              </>
            )}
            {selection?.type === 'link' && (
              <>
                Relazione: <b>{nameOf(selection.a)}</b> ⇄ <b>{nameOf(selection.b)}</b>
              </>
            )}
            {!selection && <>Tutta l'area di studio · clicca una zona o un flusso sulla mappa per approfondire</>}
          </p>
        </div>
        <div className="sb-finder">
          <div className="sb-chips" role="group" aria-label="Sezioni visibili">
            {(Object.keys(SEZIONI) as Sezione[]).map((k) => {
              const n = items.filter((it) => it.sezione === k && (it.show ?? true)).length
              return (
                <button
                  key={k}
                  className={focus.has(k) ? 'on' : ''}
                  aria-pressed={focus.has(k)}
                  onClick={() => toggle(k)}
                >
                  {SEZIONI[k]} <span>{n}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {(Object.keys(SEZIONI) as Sezione[]).map((k) => {
        const list = visible.filter((it) => it.sezione === k)
        if (!list.length) return null
        return (
          <section key={k} className="sb-section">
            <h3 className="sb-section-title">{SEZIONI[k]}</h3>
            {list.map((it) => (
              <div key={it.id}>{it.render()}</div>
            ))}
          </section>
        )
      })}
      <footer className="sb-foot">Fonte: estrazione matrice OD Piemonte. I valori sono stime, arrotondate in visualizzazione.</footer>
    </aside>
  )
}

// il pannello non dipende dal playback: senza memo si ridisegnerebbe a ogni fotogramma
export default memo(Sidebar)
