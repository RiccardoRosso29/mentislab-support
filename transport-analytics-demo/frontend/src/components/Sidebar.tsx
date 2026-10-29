import { memo, useState, type ReactNode } from 'react'
import type { Filters, Selection, Stats } from '../api'
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
  fmtPct,
} from '../labels'
import { BarChart, Donut, GroupedBars, Heatmap, LineDaily, StackBar } from './Charts'

const SEZIONI = { panoramica: 'Panoramica', comportamenti: 'Comportamenti', profili: 'Profili' } as const
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
}

interface CardProps {
  title: string
  subtitle?: string
  children: ReactNode
  /** Grafico cliccabile: filtro attivo sulla sua dimensione e comando per rimuoverlo. */
  filtro?: { attivo: string | null; onClear: () => void }
}

function Card({ title, subtitle, children, filtro }: CardProps) {
  return (
    <section className={`card ${filtro ? 'interactive' : ''}`}>
      <header>
        <div className="card-title">
          <h3>{title}</h3>
          {filtro?.attivo && (
            <button className="card-filter" onClick={filtro.onClear} title="Rimuovi il filtro">
              {filtro.attivo} <span aria-hidden>✕</span>
            </button>
          )}
        </div>
        {subtitle && <p>{subtitle}</p>}
        {filtro && <p className="card-hint">Clic per filtrare · Ctrl+clic per selezionare più valori</p>}
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

function Sidebar({ stats, loading, selection, nameOf, fasceOre, onSelectLink, filters, onFilters }: Props) {
  const [focus, setFocus] = useState<Set<Sezione>>(ALL)
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
  const genereTot = (g: string) => cx.genere[g] ?? 0
  const etaBy = (g: string) => ETA.filter((e) => e !== 'NA').map((e) => perDay(cx.eta.find((r) => r.genere === g && r.eta === e)?.n ?? 0))
  const naDemo = genereTot('NA')

  const mot = MOTIVI_ORDER.map((mo) => MOTIVI_ORDER.map((md) => cx.motivi.find((r) => r.mo === mo && r.md === md)?.n ?? 0))
  const motTot = cx.motivi.reduce((s, r) => s + r.n, 0)
  const motRank = cx.motivi
    .filter((r) => r.n > 0)
    .map((r) => ({ label: `${MOTIVI[r.mo]} → ${MOTIVI[r.md]}`, n: r.n }))
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

  const nodo = stats.kpi.nodo
  const linkA = selection?.type === 'link' ? selection.a : null

  const items: Item[] = [
    {
      id: 'kpi',
      sezione: 'panoramica',
      render: () => (
        <div className="kpi-grid">
          <Kpi label="Spostamenti medi / giorno" value={fmt(stats.kpi.media_giornaliera)} />
          <Kpi label="Spostamenti nel periodo" value={fmt(total)} />
        </div>
      ),
    },
    {
      id: 'bilancio',
      sezione: 'panoramica',
      show: Boolean(stats.kpi.nodo),
      render: () => (
        <Card title="Bilancio della zona" subtitle="Spostamenti medi giornalieri">
          <StackBar
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
        <Card title="Direzioni" subtitle="Spostamenti medi giornalieri">
          <StackBar
            items={[...stats.top_od]
              .sort((x, y) => Number(y.o === linkA) - Number(x.o === linkA))
              .map((r) => ({
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
          subtitle="Spostamenti totali per giorno · in grigio scuro il fine settimana"
          filtro={{ attivo: periodoAttivo, onClear: () => onFilters({ ...filters, periodo: [] }) }}
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
          />
        </Card>
      ),
    },
    {
      id: 'top_od',
      sezione: 'panoramica',
      show: selection?.type !== 'link',
      render: () => (
        <Card title="Principali relazioni OD" subtitle="Spostamenti medi giornalieri · clic per selezionare">
          {stats.top_od.length === 0 && (
            <p className="sb-empty">Nessuna relazione tra zone diverse con i filtri attivi: gli spostamenti sono tutti interni alle zone.</p>
          )}
          <table className="od-table">
            <tbody>
              {stats.top_od.map((r, i) => (
                <tr key={`${r.o}-${r.d}`} onClick={() => onSelectLink(r.o, r.d)}>
                  <td className="idx">{i + 1}</td>
                  <td>
                    {r.o_nome} <span className="arrow">→</span> {r.d_nome}
                  </td>
                  <td className="num">{fmt(r.media)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ),
    },
    {
      id: 'dow',
      sezione: 'comportamenti',
      render: () => (
        <Card title="Giorno della settimana" subtitle="Spostamenti medi per giorno" filtro={filtro('dow', (v) => DOW[Number(v) - 1].short)}>
          <BarChart
            onPick={(p) => choose('dow', p.dataIndex + 1, p.multi)}
            highlight={hl('dow', (i) => i + 1)}
            labels={DOW.map((d) => d.short)}
            values={cx.per_dow.map((d) => d.media)}
            colors={cx.per_dow.map((d) => (d.dow >= 6 ? COLORS.secondary : COLORS.accent))}
          />
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
            labels={Object.keys(FASCE).map((k) => `${FASCE[k]}\n${fasceOre[k] ?? ''}`)} values={fasce} color={COLORS.accent} height={200} />
        </Card>
      ),
    },
    {
      id: 'motivo',
      sezione: 'comportamenti',
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
            {motRank.slice(0, 5).map((r) => (
              <li key={r.label}>
                <span>{r.label}</span>
                <span className="rank-bar">
                  <i style={{ width: `${(r.n / motRank[0].n) * 100}%` }} />
                </span>
                <b>{fmtPct(r.n / motTot)}</b>
              </li>
            ))}
          </ol>
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
          subtitle={naDemo > 0 ? `N/D: viaggiatori stranieri, senza profilo sociodemografico` : undefined}
          filtro={filtro('genere', (v) => GENERI[v])}
        >
          <Donut
            height={190}
            onPick={(p) => choose('genere', ['f', 'm', 'NA'][p.dataIndex], p.multi)}
            selected={hl('genere', (i) => ['f', 'm', 'NA'][i])}
            items={[
              { name: GENERI.f, value: perDay(genereTot('f')), color: COLORS.purple },
              { name: GENERI.m, value: perDay(genereTot('m')), color: COLORS.accent },
              { name: GENERI.NA, value: perDay(naDemo), color: COLORS.grey },
            ]}
          />
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
              { name: GENERI.f, values: etaBy('f'), color: COLORS.purple },
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
