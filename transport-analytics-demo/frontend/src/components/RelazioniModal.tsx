import { useEffect, useMemo, useState } from 'react'
import type { Relazioni, Selection } from '../api'
import { SOGLIA_MIN, fmt, fmtN, fmtPct } from '../labels'
import { toCsv } from './ExportModal'
import { IconDownload } from './icons'

const PAGE = 300

interface Props {
  rel: Relazioni
  titolo: string
  selection: Selection
  onSelectLink: (a: number, b: number) => void
  onClose: () => void
}

/** Elenco completo delle relazioni sopra la soglia di anonimizzazione, con ricerca. */
export default function RelazioniModal({ rel, titolo, selection, onSelectLink, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [shown, setShown] = useState(PAGE)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // la posizione in classifica resta quella dell'elenco completo anche quando si filtra per nome
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    const all = rel.relazioni.map((r, i) => ({ r, rank: i + 1 }))
    return q ? all.filter(({ r }) => `${r.o_nome} ${r.d_nome}`.toLowerCase().includes(q)) : all
  }, [rel, query])

  // CSV dell'elenco (filtrato dalla ricerca, se presente); i valori sotto soglia restano mascherati
  const download = () => {
    const mask = (v: number) => (v < SOGLIA_MIN ? `<${SOGLIA_MIN}` : Math.round(v * 10) / 10)
    const header = ['posizione', 'origine', 'destinazione', 'spostamenti_medi_giorno', 'spostamenti_periodo', 'quota']
    const data = rows.map(({ r, rank }) => [rank, r.o_nome, r.d_nome, mask(r.media), mask(r.n), Math.round((r.n / rel.totale) * 1e5) / 1e5])
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([toCsv(header, data)], { type: 'text/csv;charset=utf-8' }))
    a.download = `transport-analytics_relazioni${query ? '_' + query.trim().replace(/\W+/g, '-') : ''}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(a.href), 5000)
  }

  const isSel = (o: number, d: number) =>
    selection?.type === 'link' && ((o === selection.a && d === selection.b) || (o === selection.b && d === selection.a))

  return (
    <div className="xp-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="rl" role="dialog" aria-modal="true" aria-labelledby="rl-title">
        <header className="xp-head">
          <div>
            <span className="xp-eyebrow">Relazioni origine–destinazione</span>
            <h2 id="rl-title">{titolo}</h2>
          </div>
          <div className="xp-head-right">
            <span className="xp-shield" title={`Sono escluse le relazioni con meno di ${rel.soglia} spostamenti nel periodo`}>
              {fmt(rel.relazioni.length)} relazioni · k ≥ {rel.soglia}
            </span>
            <button className="xp-x" onClick={onClose} aria-label="Chiudi">
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
                <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </header>
        <div className="rl-tools">
          <input
            id="rl-search"
            type="search"
            placeholder="Cerca una zona…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setShown(PAGE)
            }}
          />
          <span>
            {query ? `${fmt(rows.length)} risultati · ` : ''}
            {fmt(rel.sotto_soglia)} relazioni sotto soglia non mostrate
          </span>
          <button className="rl-export" onClick={download} title={query ? 'Esporta i risultati della ricerca (CSV)' : 'Esporta tutte le relazioni (CSV)'} aria-label="Esporta in CSV">
            <IconDownload width={17} height={17} />
          </button>
        </div>
        <div className="rl-body">
          <table className="rl-table">
            <thead>
              <tr>
                <th className="num">#</th>
                <th>Origine</th>
                <th>Destinazione</th>
                <th className="num">Spostamenti medi / giorno</th>
                <th className="num">Spostamenti nel periodo</th>
                <th className="num">Quota</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, shown).map(({ r, rank }) => (
                <tr
                  key={`${r.o}-${r.d}`}
                  className={isSel(r.o, r.d) ? 'sel' : ''}
                  onClick={() => {
                    onSelectLink(r.o, r.d)
                    onClose()
                  }}
                >
                  <td className="num muted">{fmt(rank)}</td>
                  <td>{r.o_nome}</td>
                  <td>{r.d_nome}</td>
                  <td className="num strong">{fmtN(r.media)}</td>
                  <td className="num">{fmtN(r.n)}</td>
                  <td className="num muted">{fmtPct(r.n / rel.totale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > shown && (
            <button className="rl-more" onClick={() => setShown((n) => n + PAGE)}>
              Mostra altre {fmt(Math.min(PAGE, rows.length - shown))} di {fmt(rows.length - shown)}
            </button>
          )}
          {rows.length === 0 && <p className="sb-empty">Nessuna relazione per «{query}».</p>}
        </div>
      </div>
    </div>
  )
}
