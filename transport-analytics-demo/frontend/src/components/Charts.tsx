import { useMemo, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption, LineSeriesOption } from 'echarts'
import { COLORS, fmtCompact, fmtCompactN, fmtN as fmt, fmtPct } from '../labels'

const FONT = "Montserrat, 'Helvetica Neue', Arial, sans-serif"

const base = (o: EChartsOption): EChartsOption => ({
  textStyle: { fontFamily: FONT, color: COLORS.text },
  animationDuration: 300,
  grid: { left: 8, right: 12, top: 18, bottom: 4, containLabel: true },
  tooltip: {
    trigger: 'axis',
    axisPointer: { type: 'shadow' },
    textStyle: { fontFamily: FONT },
    valueFormatter: (v) => fmt(v as number),
  },
  ...o,
})

const valueAxis = { type: 'value' as const, axisLabel: { formatter: (v: number) => fmtCompact(v), color: COLORS.muted }, splitLine: { lineStyle: { color: '#eee' } } }
const catAxis = (data: string[]) => ({
  type: 'category' as const,
  data,
  axisTick: { show: false },
  axisLine: { lineStyle: { color: '#ccc' } },
  axisLabel: { color: COLORS.text },
})

/** Elemento cliccato in un grafico: usato per filtrare la dashboard. */
export interface Pick {
  dataIndex: number
  seriesIndex: number
  name: string
  value: unknown
  /** Ctrl/⌘ premuto: aggiunge o toglie il valore dalla selezione invece di sostituirla */
  multi: boolean
}

// opacità degli elementi non selezionati quando un grafico ha una selezione attiva
const DIM = 0.28

/** Colore riservato al benchmark: diverso da tutti quelli dei dati, così il riferimento resta riconoscibile. */
export const BENCH = '#2563eb'

/** Serie del benchmark: linea tratteggiata sottile che unisce i valori attesi con il profilo medio, con un pallino per barra. */
const benchSeries = (bench: (number | null)[]): LineSeriesOption => ({
  type: 'line',
  name: 'Profilo medio',
  data: bench,
  z: 10,
  symbol: 'circle',
  symbolSize: 5,
  showSymbol: true,
  connectNulls: true,
  lineStyle: { color: BENCH, width: 1.2, type: [4, 3] },
  itemStyle: { color: BENCH, borderColor: '#fff', borderWidth: 1 },
  // nessun effetto al passaggio del mouse: la linea resta ferma, il valore compare solo nel tooltip
  emphasis: { disabled: true },
  tooltip: { valueFormatter: (v: unknown) => fmt(v as number) },
  animation: false,
})
type OnPick = (p: Pick) => void

export function Chart({ option, height = 180, onPick }: { option: EChartsOption; height?: number; onPick?: OnPick }) {
  // L'opzione contiene funzioni (formatter) e cambia identità a ogni render: la si ricrea solo quando
  // cambiano i dati, altrimenti ECharts ridisegna il grafico da zero (effetto "lampeggio").
  const key = JSON.stringify(option)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const opt = useMemo(() => base(option), [key])
  return (
    <ReactECharts
      option={opt}
      style={{ height, cursor: onPick ? 'pointer' : undefined }}
      notMerge
      lazyUpdate
      opts={{ renderer: 'svg' }}
      onEvents={
        onPick
          ? {
              click: (e: Omit<Pick, 'multi'> & { event?: { event?: MouseEvent } }) => {
                const ev = e.event?.event
                onPick({ ...e, multi: Boolean(ev && (ev.ctrlKey || ev.metaKey)) })
              },
            }
          : undefined
      }
    />
  )
}

export function BarChart({
  labels,
  values,
  color = COLORS.accent,
  colors,
  height,
  highlight,
  onPick,
  bench,
}: {
  labels: string[]
  values: (number | null)[]
  color?: string
  colors?: string[]
  height?: number
  highlight?: (i: number) => boolean
  onPick?: OnPick
  bench?: (number | null)[]
}) {
  return (
    <Chart
      height={height}
      onPick={onPick}
      option={{
        // etichette a capo entro la larghezza della barra: niente sovrapposizioni con nomi lunghi
        xAxis: { ...catAxis(labels), axisLabel: { color: COLORS.text, interval: 0, lineHeight: 13, fontSize: 11, width: 62, overflow: 'break' } },
        yAxis: valueAxis,
        series: [
          {
            type: 'bar',
            name: bench ? 'Selezione' : undefined,
            barMaxWidth: 34,
            data: values.map((v, i) => ({
              value: v,
              itemStyle: {
                color: colors?.[i] ?? color,
                opacity: highlight && !highlight(i) ? DIM : 1,
                borderRadius: [2, 2, 0, 0],
              },
            })),
            label: { show: labels.length <= 7 && !bench, position: 'top', formatter: (p) => fmtCompactN(p.value as number), fontSize: 11, color: COLORS.muted },
          },
          ...(bench ? [benchSeries(bench)] : []),
        ],
      }}
    />
  )
}

/** Differenza in punti percentuali, con segno: «+1,2 pp». */
export const fmtPp = (d: number) => `${d > 0 ? '+' : d < 0 ? '−' : '±'}${Math.abs(d * 100).toLocaleString('it-IT', { maximumFractionDigits: 1, minimumFractionDigits: 1 })} pp`

export function Donut({
  items,
  height = 170,
  onPick,
  selected,
  deltas,
}: {
  items: { name: string; value: number; color: string }[]
  height?: number
  onPick?: OnPick
  selected?: (i: number) => boolean
  /** scarto di ogni quota rispetto al profilo medio (benchmark), in frazione */
  deltas?: (number | null)[]
}) {
  const total = items.reduce((s, i) => s + i.value, 0)
  return (
    <Chart
      height={height}
      onPick={onPick}
      option={{
        tooltip: { trigger: 'item', valueFormatter: (v) => fmt(v as number) },
        series: [
          {
            type: 'pie',
            radius: ['45%', '70%'],
            center: ['50%', '50%'],
            label: {
              show: true,
              formatter: (p) => {
                // lo scarto viaggia nei dati della serie: così un suo cambiamento ridisegna il grafico
                const d = (p.data as { delta?: number | null }).delta
                return `{n|${p.name}}\n{v|${total ? fmtPct((p.value as number) / total) : ''}}${d != null ? `\n{d|${fmtPp(d)}}` : ''}`
              },
              rich: {
                n: { fontSize: 12, color: COLORS.muted, fontFamily: FONT },
                v: { fontSize: 16, fontWeight: 700, fontFamily: FONT, color: COLORS.text },
                d: { fontSize: 10.5, fontWeight: 600, fontFamily: FONT, color: BENCH, padding: [2, 0, 0, 0] },
              },
            },
            labelLine: { length: 8, length2: 10 },
            data: items.map((it, i) => ({
              name: it.name,
              value: it.value,
              delta: deltas?.[i] ?? null,
              itemStyle: { color: it.color, opacity: selected && !selected(i) ? DIM : 1 },
            })),
          },
        ],
      }}
    />
  )
}

export function GroupedBars({
  labels,
  series,
  height = 200,
  stack,
  onPick,
  selected,
}: {
  labels: string[]
  series: { name: string; values: number[]; color: string }[]
  height?: number
  stack?: boolean
  onPick?: OnPick
  selected?: (i: number) => boolean
}) {
  return (
    <Chart
      height={height}
      onPick={onPick}
      option={{
        legend: { top: 0, right: 0, icon: 'rect', itemWidth: 10, itemHeight: 10, textStyle: { fontFamily: FONT } },
        grid: { left: 8, right: 12, top: 28, bottom: 4, containLabel: true },
        xAxis: catAxis(labels),
        yAxis: valueAxis,
        series: series.map((s) => ({
          type: 'bar',
          name: s.name,
          stack: stack ? 'tot' : undefined,
          barMaxWidth: 22,
          data: s.values.map((v, i) => ({ value: v, itemStyle: { opacity: selected && !selected(i) ? DIM : 1 } })),
          itemStyle: { color: s.color },
        })),
      }}
    />
  )
}

export function Heatmap({
  rows,
  cols,
  values,
  height = 190,
  total,
  onPick,
  selected,
}: {
  rows: string[]
  cols: string[]
  values: number[][] // [row][col]
  height?: number
  total: number
  onPick?: OnPick
  selected?: (row: number, col: number) => boolean
}) {
  const data = values.flatMap((r, i) =>
    r.map((v, j) => {
      const on = !selected || selected(i, j)
      return {
        value: [j, i, v],
        itemStyle: { opacity: on ? 1 : DIM, borderColor: selected && on ? COLORS.secondary : '#fff', borderWidth: selected && on ? 2.5 : 2 },
      }
    }),
  )
  const max = Math.max(1, ...values.flat())
  return (
    <Chart
      height={height}
      onPick={onPick}
      option={{
        tooltip: {
          trigger: 'item',
          formatter: (p: any) => `${rows[p.value[1]]} → ${cols[p.value[0]]}<br/><b>${fmt(p.value[2])}</b> (${fmtPct(p.value[2] / total)})`,
        },
        grid: { left: 8, right: 8, top: 22, bottom: 4, containLabel: true },
        xAxis: { ...catAxis(cols), position: 'top', name: 'destinazione', nameLocation: 'middle', nameGap: 0, nameTextStyle: { color: 'transparent' } },
        yAxis: { ...catAxis(rows), inverse: true },
        visualMap: { show: false, min: 0, max, inRange: { color: ['#fdf0e2', COLORS.accent, COLORS.accentDark] } },
        series: [
          {
            type: 'heatmap',
            data,
            label: {
              show: true,
              formatter: (p: any) => fmtPct(p.value[2] / total),
              color: COLORS.text,
              fontSize: 12,
              fontFamily: FONT,
            },
          },
        ],
      }}
    />
  )
}

export function LineDaily({
  labels,
  values,
  weekend,
  height = 170,
  onPick,
  selected,
  bench,
}: {
  labels: string[]
  values: number[]
  weekend: boolean[]
  height?: number
  onPick?: OnPick
  selected?: (i: number) => boolean
  bench?: (number | null)[]
}) {
  return (
    <Chart
      height={height}
      onPick={onPick}
      option={{
        xAxis: { ...catAxis(labels), axisLabel: { color: COLORS.muted, interval: 0, rotate: labels.length > 8 ? 45 : 0, fontSize: 10 } },
        yAxis: valueAxis,
        series: [
          {
            type: 'bar',
            name: bench ? 'Selezione' : undefined,
            barMaxWidth: 18,
            data: values.map((v, i) => ({
              value: v,
              itemStyle: { color: weekend[i] ? COLORS.secondary : COLORS.accent, opacity: selected && !selected(i) ? DIM : 1 },
            })),
          },
          ...(bench ? [benchSeries(bench)] : []),
        ],
      }}
    />
  )
}

/** Barra impilata 100% in stile card KPI della piattaforma, con etichetta al passaggio del mouse. */
export function StackBar({
  items,
  onPick,
  selected,
  benchShare,
}: {
  items: { label: string; value: number; color: string }[]
  onPick?: (i: number, multi: boolean) => void
  selected?: (i: number) => boolean
  /** quota del primo elemento nel profilo medio: segnata come riferimento sulla barra */
  benchShare?: number | null
}) {
  const total = items.reduce((s, i) => s + i.value, 0)
  const [tip, setTip] = useState<{ i: number; x: number; w: number } | null>(null)
  return (
    <div className="stackbar-wrap">
      <div className="stackbar" onMouseLeave={() => setTip(null)}>
        {items.map((it, i) =>
          total && it.value > 0 ? (
            <div
              key={it.label}
              style={{
                width: `${(it.value / total) * 100}%`,
                background: it.color,
                opacity: selected && !selected(i) ? DIM : 1,
                cursor: onPick ? 'pointer' : undefined,
              }}
              onMouseMove={(e) => {
                const box = e.currentTarget.parentElement!.getBoundingClientRect()
                setTip({ i, x: e.clientX - box.left, w: box.width })
              }}
              onClick={onPick ? (e) => onPick(i, e.ctrlKey || e.metaKey) : undefined}
            >
              {it.value / total > 0.08 ? fmtPct(it.value / total) : ''}
            </div>
          ) : null,
        )}
        {benchShare != null && (
          <span className="stack-bench" style={{ left: `${benchShare * 100}%` }} title={`Profilo medio: ${fmtPct(benchShare)} ${items[0].label}`}>
            <i>media {fmtPct(benchShare)}</i>
          </span>
        )}
        {tip && items[tip.i] && (
          <div
            className="chart-tip"
            // ancorata a sinistra o a destra vicino ai bordi, così resta dentro la scheda
            style={{ left: tip.x, transform: `translateX(${tip.x < tip.w * 0.25 ? '-10%' : tip.x > tip.w * 0.75 ? '-90%' : '-50%'})` }}
          >
            <span className="chart-tip-dot" style={{ background: items[tip.i].color }} />
            {items[tip.i].label}
            <b>{fmt(items[tip.i].value)}</b>
            <span className="chart-tip-pct">{fmtPct(items[tip.i].value / total)}</span>
          </div>
        )}
      </div>
      <div className="stackbar-legend">
        {items.map((i) => (
          <span key={i.label}>
            <i style={{ background: i.color }} />
            {i.label} <b>{fmt(i.value)}</b>
          </span>
        ))}
      </div>
    </div>
  )
}
