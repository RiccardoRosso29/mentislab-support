import type { ReactNode } from 'react'
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

export default function Sidebar({ stats, loading, selection, nameOf, fasceOre, onSelectLink }: Props) {
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

  return (
    <aside className={`sidebar ${loading ? 'is-loading' : ''}`}>
      <div className="sb-context">
        {selection?.type === 'nodo' && (
          <>
            <span className="tag">Zona selezionata</span>
            <h2>{nameOf(selection.id)}</h2>
            <p>Spostamenti in partenza, in arrivo e interni alla zona</p>
          </>
        )}
        {selection?.type === 'link' && (
          <>
            <span className="tag">Relazione selezionata</span>
            <h2>
              {nameOf(selection.a)} ⇄ {nameOf(selection.b)}
            </h2>
            <p>Spostamenti nelle due direzioni tra le zone</p>
          </>
        )}
        {!selection && (
          <>
            <span className="tag">Area di studio</span>
            <h2>Tutti gli spostamenti</h2>
            <p>Clicca una zona o un flusso sulla mappa per approfondire</p>
          </>
        )}
      </div>

      <div className="kpi-grid">
        <Kpi label="Spostamenti medi / giorno" value={fmt(stats.kpi.media_giornaliera)} sub={`su ${stats.kpi.giorni} giorni`} />
        <Kpi label="Spostamenti nel periodo" value={fmt(total)} />
        <Kpi label="Quota di scambio" value={fmtPct(stats.kpi.quota_scambio)} sub="da/verso fuori regione" />
        <Kpi label="Viaggiatori stranieri" value={fmtPct(stats.kpi.quota_internazionali)} sub="nazionalità internazionale" />
      </div>

      {stats.kpi.nodo && (
        <Card title="Bilancio della zona" subtitle="Spostamenti medi giornalieri">
          <StackBar
            items={[
              { label: 'In uscita', value: perDay(stats.kpi.nodo.uscita), color: COLORS.out },
              { label: 'In ingresso', value: perDay(stats.kpi.nodo.ingresso), color: COLORS.in },
              { label: 'Interni', value: perDay(stats.kpi.nodo.interni), color: COLORS.blue },
            ]}
          />
        </Card>
      )}

      {selection?.type === 'link' && (
        <Card title="Direzioni" subtitle="Spostamenti medi giornalieri">
          <StackBar
            items={[...stats.top_od]
              .sort((x, y) => Number(y.o === selection.a) - Number(x.o === selection.a))
              .map((r) => ({
                label: `${r.o_nome} → ${r.d_nome}`,
                value: r.media,
                color: r.o === selection.a ? COLORS.out : COLORS.in,
              }))}
          />
        </Card>
      )}

      <Card title="Andamento giornaliero" subtitle="Spostamenti totali per giorno · in giallo il fine settimana">
        <LineDaily
          labels={stats.giornaliero.map((d) => fmtDate(d.giorno, { day: 'numeric', month: 'numeric' }))}
          values={stats.giornaliero.map((d) => d.n)}
          weekend={stats.giornaliero.map((d) => d.dow >= 6)}
        />
      </Card>

      <Card title="Giorno della settimana" subtitle="Spostamenti medi per giorno">
        <BarChart
          labels={DOW.map((d) => d.short)}
          values={stats.per_dow.map((d) => d.media)}
          colors={stats.per_dow.map((d) => (d.dow >= 6 ? COLORS.yellow : COLORS.blue))}
        />
      </Card>

      <Card title="Fascia oraria di partenza" subtitle="Spostamenti medi giornalieri per fascia">
        <BarChart labels={Object.keys(FASCE).map((k) => `${FASCE[k]}\n${fasceOre[k] ?? ''}`)} values={fasce} color={COLORS.accent} height={200} />
      </Card>

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

      <Card title="Genere" subtitle={naDemo > 0 ? `N/D: viaggiatori stranieri, senza profilo sociodemografico` : undefined}>
        <Donut height={190}
          items={[
            { name: GENERI.f, value: perDay(genere('f')), color: COLORS.purple },
            { name: GENERI.m, value: perDay(genere('m')), color: COLORS.accent },
            { name: GENERI.NA, value: perDay(naDemo), color: COLORS.grey },
          ]}
        />
      </Card>

      <Card title="Età e genere" subtitle="Spostamenti medi giornalieri per fascia d'età">
        <GroupedBars
          labels={ETA.filter((e) => e !== 'NA').map(etaLabel)}
          series={[
            { name: GENERI.f, values: etaBy('f'), color: COLORS.purple },
            { name: GENERI.m, values: etaBy('m'), color: COLORS.accent },
          ]}
        />
      </Card>

      <Card title="Profilo dei viaggiatori" subtitle="Spostamenti medi giornalieri">
        <h4 className="mini">Nazionalità</h4>
        <StackBar
          items={Object.entries(NAZIONALITA).map(([k, label], i) => ({
            label,
            value: perDay(stats.nazionalita[k] ?? 0),
            color: i ? COLORS.green : COLORS.blue,
          }))}
        />
        <h4 className="mini">Tipologia di spostamento</h4>
        <StackBar
          items={Object.entries(TIPOLOGIE).map(([k, label], i) => ({
            label,
            value: perDay(stats.tipologia[k] ?? 0),
            color: i ? COLORS.yellow : COLORS.blue,
          }))}
        />
      </Card>

      {selection?.type !== 'link' && (
        <Card title="Principali relazioni OD" subtitle="Spostamenti medi giornalieri · clic per selezionare">
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
      )}
      <footer className="sb-foot">Fonte: estrazione matrice OD Piemonte. I valori sono stime, arrotondate in visualizzazione.</footer>
    </aside>
  )
}
