import { memo, useState, type ReactNode } from 'react'
import type { Selection, Stats } from '../api'
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
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="card">
      <header>
        <h3>{title}</h3>
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

function Sidebar({ stats, loading, selection, nameOf, fasceOre, onSelectLink }: Props) {
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

  const genere = (g: string) => stats.genere_eta.filter((r) => r.genere === g).reduce((s, r) => s + r.n, 0)
  const etaBy = (g: string) => ETA.filter((e) => e !== 'NA').map((e) => perDay(stats.genere_eta.find((r) => r.genere === g && r.eta === e)?.n ?? 0))
  const naDemo = genere('NA')

  const mot = MOTIVI_ORDER.map((mo) => MOTIVI_ORDER.map((md) => stats.motivi.find((r) => r.mo === mo && r.md === md)?.n ?? 0))
  const motRank = stats.motivi
    .map((r) => ({ label: `${MOTIVI[r.mo]} → ${MOTIVI[r.md]}`, n: r.n }))
    .sort((a, b) => b.n - a.n)

  const fasce = Object.keys(FASCE).map((k) => stats.per_fascia.find((r) => r.fascia === k)?.media ?? 0)

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
        <Card title="Andamento giornaliero" subtitle="Spostamenti totali per giorno · in grigio scuro il fine settimana">
          <LineDaily
            labels={stats.giornaliero.map((d) => fmtDate(d.giorno, { day: 'numeric', month: 'numeric' }))}
            values={stats.giornaliero.map((d) => d.n)}
            weekend={stats.giornaliero.map((d) => d.dow >= 6)}
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
        <Card title="Giorno della settimana" subtitle="Spostamenti medi per giorno">
          <BarChart
            labels={DOW.map((d) => d.short)}
            values={stats.per_dow.map((d) => d.media)}
            colors={stats.per_dow.map((d) => (d.dow >= 6 ? COLORS.secondary : COLORS.accent))}
          />
        </Card>
      ),
    },
    {
      id: 'fascia',
      sezione: 'comportamenti',
      render: () => (
        <Card title="Fascia oraria di partenza" subtitle="Spostamenti medi giornalieri per fascia">
          <BarChart labels={Object.keys(FASCE).map((k) => `${FASCE[k]}\n${fasceOre[k] ?? ''}`)} values={fasce} color={COLORS.accent} height={200} />
        </Card>
      ),
    },
    {
      id: 'motivo',
      sezione: 'comportamenti',
      render: () => (
        <Card title="Motivo dello spostamento" subtitle="Origine (righe) → destinazione (colonne): Casa = luogo di residenza, Lavoro = luogo di lavoro, Altro = luogo visitato">
          <Heatmap
            rows={MOTIVI_ORDER.map((m) => MOTIVI[m])}
            cols={MOTIVI_ORDER.map((m) => MOTIVI[m])}
            values={mot}
            total={total}
          />
          <ol className="rank">
            {motRank.slice(0, 5).map((r) => (
              <li key={r.label}>
                <span>{r.label}</span>
                <span className="rank-bar">
                  <i style={{ width: `${(r.n / motRank[0].n) * 100}%` }} />
                </span>
                <b>{fmtPct(r.n / total)}</b>
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
        <Card title="Tipologia di spostamento" subtitle="Spostamenti medi giornalieri">
          <StackBar
            items={Object.entries(TIPOLOGIE).map(([k, label], i) => ({
              label,
              value: perDay(stats.tipologia[k] ?? 0),
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
        <Card title="Genere" subtitle={naDemo > 0 ? `N/D: viaggiatori stranieri, senza profilo sociodemografico` : undefined}>
          <Donut height={190}
            items={[
              { name: GENERI.f, value: perDay(genere('f')), color: COLORS.purple },
              { name: GENERI.m, value: perDay(genere('m')), color: COLORS.accent },
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
        <Card title="Età e genere" subtitle="Spostamenti medi giornalieri per fascia d'età">
          <GroupedBars
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
        <Card title="Nazionalità" subtitle="Spostamenti medi giornalieri">
          <StackBar
            items={Object.entries(NAZIONALITA).map(([k, label], i) => ({
              label,
              value: perDay(stats.nazionalita[k] ?? 0),
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
