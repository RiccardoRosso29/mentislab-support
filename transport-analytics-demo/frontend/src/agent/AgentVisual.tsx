import type { EChartsOption } from 'echarts'
import { Chart } from '../components/Charts'
import { toCsv } from '../components/ExportModal'
import { IconDownload } from '../components/icons'
import { COLORS, fmt, fmtCompactN, fmtN, fmtPct, getLocale } from '../labels'
import type { Visual } from './tools'
import { t } from '../settings'

// stessa tavolozza della dashboard: arancio primario, grigio scuro secondario, poi i colori di categoria
// letta a ogni grafico: segue il template (il terzo colore è quello che contrasta con il principale)
const palette = () => [COLORS.accent, COLORS.secondary, COLORS.in, COLORS.blue, COLORS.green, COLORS.yellow]
const FONT = "Montserrat, 'Helvetica Neue', Arial, sans-serif"

type Cell = number | string | null
interface Serie {
  nome: string
  valori: Cell[]
  ruolo?: 'dato' | 'benchmark' | 'evidenza'
}
interface ChartSpec {
  tipo: 'bar' | 'barh' | 'stacked' | 'line' | 'donut' | 'heatmap'
  titolo: string
  sottotitolo?: string
  categorie?: string[]
  serie?: Serie[]
  colonne_heatmap?: string[]
  matrice?: Cell[][]
  unita: 'spostamenti' | 'percentuale' | 'numero'
  nota?: string
}

// i valori mascherati ("<100") non si disegnano: restano vuoti e così compaiono nel tooltip
const num = (v: Cell) => (typeof v === 'number' && Number.isFinite(v) ? v : null)

function formatter(unit: ChartSpec['unita']) {
  if (unit === 'percentuale') return { full: (v: number) => fmtPct(v), short: (v: number) => fmtPct(v) }
  if (unit === 'spostamenti') return { full: (v: number) => fmtN(v), short: (v: number) => fmtCompactN(v) }
  return { full: (v: number) => fmt(v), short: (v: number) => fmt(v) }
}

function buildOption(s: ChartSpec): EChartsOption | null {
  const f = formatter(s.unita)
  const cats = s.categorie ?? []
  const serie = (s.serie ?? []).filter((x) => Array.isArray(x.valori))
  const value = {
    type: 'value' as const,
    axisLabel: { formatter: (v: number) => f.short(v), color: COLORS.muted },
    splitLine: { lineStyle: { color: '#eee' } },
  }
  const cat = (data: string[]) => ({
    type: 'category' as const,
    data,
    axisTick: { show: false },
    axisLine: { lineStyle: { color: '#ccc' } },
    axisLabel: { color: COLORS.text, interval: 0, width: 70, overflow: 'break' as const, fontSize: 11, lineHeight: 13 },
  })
  const tooltip = { trigger: 'axis' as const, axisPointer: { type: 'shadow' as const }, valueFormatter: (v: unknown) => (v == null ? '<100' : f.full(v as number)) }
  // il benchmark ha la sua nota sotto il grafico (linea tratteggiata): in legenda solo le serie di dati
  const dati = serie.filter((x) => x.ruolo !== 'benchmark')
  const legend =
    dati.length > 1 ? { top: 0, right: 0, icon: 'rect', itemWidth: 10, itemHeight: 10, data: dati.map((x) => x.nome), textStyle: { fontFamily: FONT, fontSize: 11 } } : undefined
  const top = dati.length > 1 ? 30 : 14

  // colore per serie: "evidenza" nel colore principale, i dati nell'ordine della tavolozza, il benchmark sempre blu tratteggiato
  let k = 0
  const PALETTE = palette()
  const color = (x: Serie) => (x.ruolo === 'evidenza' ? COLORS.accent : PALETTE[k++ % PALETTE.length])
  const benchLine = (x: Serie) => ({
    type: 'line' as const,
    name: x.nome,
    data: x.valori.map(num),
    symbol: 'circle',
    symbolSize: 5,
    lineStyle: { color: COLORS.bench, width: 1.2, type: [4, 3] as number[] },
    itemStyle: { color: COLORS.bench, borderColor: '#fff', borderWidth: 1 },
    emphasis: { disabled: true },
    z: 10,
  })

  if (s.tipo === 'donut') {
    const x = serie[0]
    if (!x) return null
    const data = cats.map((c, i) => ({ name: c, value: num(x.valori[i]) ?? 0, itemStyle: { color: PALETTE[i % PALETTE.length] } }))
    const total = data.reduce((a, d) => a + d.value, 0)
    return {
      tooltip: { trigger: 'item', valueFormatter: (v) => f.full(v as number) },
      series: [
        {
          type: 'pie',
          radius: ['45%', '70%'],
          label: {
            formatter: (p) => `{n|${p.name}}\n{v|${total ? fmtPct((p.value as number) / total) : ''}}`,
            rich: { n: { fontSize: 11, color: COLORS.muted, fontFamily: FONT }, v: { fontSize: 14, fontWeight: 700, fontFamily: FONT, color: COLORS.text } },
          },
          data,
        },
      ],
    }
  }

  if (s.tipo === 'heatmap') {
    const cols = s.colonne_heatmap ?? []
    const m = s.matrice ?? []
    const data = m.flatMap((r, i) => r.map((v, j) => [j, i, num(v)]))
    const max = Math.max(1, ...data.map((d) => (d[2] as number) ?? 0))
    return {
      tooltip: { trigger: 'item', formatter: (p: any) => `${cats[p.value[1]]} · ${cols[p.value[0]]}<br/><b>${p.value[2] == null ? '<100' : f.full(p.value[2])}</b>` },
      grid: { left: 8, right: 8, top: 24, bottom: 4, containLabel: true },
      xAxis: { ...cat(cols), position: 'top' },
      yAxis: { ...cat(cats), inverse: true },
      visualMap: { show: false, min: 0, max, inRange: { color: [COLORS.accentTint, COLORS.accent, COLORS.accentDark] } },
      series: [
        {
          type: 'heatmap',
          data,
          itemStyle: { borderColor: '#fff', borderWidth: 2 },
          label: { show: cats.length * cols.length <= 36, formatter: (p: any) => (p.value[2] == null ? '<100' : f.short(p.value[2])), fontSize: 10.5, fontFamily: FONT },
        },
      ],
    }
  }

  if (s.tipo === 'barh') {
    return {
      tooltip,
      legend,
      grid: { left: 8, right: 16, top, bottom: 4, containLabel: true },
      yAxis: { ...cat(cats), inverse: true, axisLabel: { color: COLORS.text, fontSize: 11, width: 130, overflow: 'truncate' } },
      xAxis: value,
      series: serie.map((x) =>
        x.ruolo === 'benchmark'
          ? { ...benchLine(x), type: 'scatter' as const, symbol: 'rect', symbolSize: [2, 14], itemStyle: { color: COLORS.bench } }
          : { type: 'bar' as const, name: x.nome, data: x.valori.map(num), barMaxWidth: 16, itemStyle: { color: color(x), borderRadius: [0, 2, 2, 0] } },
      ),
    }
  }

  const line = s.tipo === 'line'
  return {
    tooltip: line ? { ...tooltip, axisPointer: { type: 'line' as const } } : tooltip,
    legend,
    grid: { left: 8, right: 12, top, bottom: 4, containLabel: true },
    xAxis: cat(cats),
    yAxis: value,
    series: serie.map((x) => {
      if (x.ruolo === 'benchmark') return benchLine(x)
      const c = color(x)
      return line
        ? { type: 'line' as const, name: x.nome, data: x.valori.map(num), symbol: 'circle', symbolSize: 5, lineStyle: { color: c, width: 2 }, itemStyle: { color: c } }
        : {
            type: 'bar' as const,
            name: x.nome,
            data: x.valori.map(num),
            stack: s.tipo === 'stacked' ? 'tot' : undefined,
            barMaxWidth: 30,
            itemStyle: { color: c, borderRadius: s.tipo === 'stacked' ? 0 : [2, 2, 0, 0] },
          }
    }),
  }
}

function TableView({ spec }: { spec: Record<string, unknown> }) {
  const colonne = (spec.colonne as string[]) ?? []
  const righe = (spec.righe as Cell[][]) ?? []
  const titolo = String(spec.titolo ?? t('Tabella', 'Table'))
  const download = () => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([toCsv(colonne, righe.map((r) => r.map((v) => (v == null ? '' : v))))], { type: 'text/csv;charset=utf-8' }))
    a.download = `${titolo.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60) || t('tabella', 'table')}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(a.href), 5000)
  }
  return (
    <div className="ag-visual">
      <div className="ag-visual-head">
        <h4>{titolo}</h4>
        <button className="ag-dl" onClick={download} title={t('Scarica la tabella (CSV)', 'Download the table (CSV)')} aria-label={t('Scarica la tabella in CSV', 'Download the table as CSV')}>
          <IconDownload width={14} height={14} />
        </button>
      </div>
      <div className="ag-table">
        <table>
          <thead>
            <tr>
              {colonne.map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {righe.slice(0, 200).map((r, i) => (
              <tr key={i}>
                {r.map((v, j) => (
                  <td key={j} className={typeof v === 'number' ? 'num' : ''}>
                    {typeof v === 'number' ? (Number.isInteger(v) || Math.abs(v) >= 100 ? fmt(v) : v.toLocaleString(getLocale(), { maximumFractionDigits: 3 })) : (v ?? '–')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {typeof spec.nota === 'string' && <p className="ag-note">{spec.nota}</p>}
    </div>
  )
}

export default function AgentVisual({ v }: { v: Visual }) {
  if (v.kind === 'table') return <TableView spec={v.spec} />
  const spec = v.spec as unknown as ChartSpec
  const option = buildOption(spec)
  if (!option) return null
  const rows = spec.tipo === 'barh' ? (spec.categorie?.length ?? 0) : 0
  const height = spec.tipo === 'barh' ? Math.max(160, rows * 26 + 40) : spec.tipo === 'heatmap' ? Math.max(200, (spec.categorie?.length ?? 0) * 30 + 50) : 220
  return (
    <div className="ag-visual">
      <div className="ag-visual-head">
        <div>
          <h4>{spec.titolo}</h4>
          {spec.sottotitolo && <p>{spec.sottotitolo}</p>}
        </div>
      </div>
      <Chart option={option} height={height} />
      {spec.serie?.some((x) => x.ruolo === 'benchmark') && (
        <p className="bench-note">
          <i /> {spec.serie.find((x) => x.ruolo === 'benchmark')?.nome}
        </p>
      )}
      {spec.nota && <p className="ag-note">{spec.nota}</p>}
    </div>
  )
}
