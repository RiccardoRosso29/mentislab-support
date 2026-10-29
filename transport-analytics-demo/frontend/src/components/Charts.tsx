import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import { COLORS, fmt, fmtCompact, fmtPct } from '../labels'

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

export function Chart({ option, height = 180 }: { option: EChartsOption; height?: number }) {
  return <ReactECharts option={base(option)} style={{ height }} notMerge lazyUpdate opts={{ renderer: 'svg' }} />
}

export function BarChart({
  labels,
  values,
  color = COLORS.accent,
  colors,
  height,
  highlight,
}: {
  labels: string[]
  values: (number | null)[]
  color?: string
  colors?: string[]
  height?: number
  highlight?: (i: number) => boolean
}) {
  return (
    <Chart
      height={height}
      option={{
        xAxis: { ...catAxis(labels), axisLabel: { color: COLORS.text, interval: 0, lineHeight: 14 } },
        yAxis: valueAxis,
        series: [
          {
            type: 'bar',
            barMaxWidth: 34,
            data: values.map((v, i) => ({
              value: v,
              itemStyle: {
                color: colors?.[i] ?? (highlight && !highlight(i) ? COLORS.grey : color),
                borderRadius: [2, 2, 0, 0],
              },
            })),
            label: { show: labels.length <= 7, position: 'top', formatter: (p) => fmtCompact(p.value as number), fontSize: 11, color: COLORS.muted },
          },
        ],
      }}
    />
  )
}

export function Donut({ items, height = 170 }: { items: { name: string; value: number; color: string }[]; height?: number }) {
  const total = items.reduce((s, i) => s + i.value, 0)
  return (
    <Chart
      height={height}
      option={{
        tooltip: { trigger: 'item', valueFormatter: (v) => fmt(v as number) },
        series: [
          {
            type: 'pie',
            radius: ['45%', '70%'],
            center: ['50%', '50%'],
            label: {
              show: true,
              formatter: (p) => `{n|${p.name}}\n{v|${total ? fmtPct((p.value as number) / total) : ''}}`,
              rich: { n: { fontSize: 12, color: COLORS.muted, fontFamily: FONT }, v: { fontSize: 16, fontWeight: 700, fontFamily: FONT, color: COLORS.text } },
            },
            labelLine: { length: 8, length2: 10 },
            data: items.map((i) => ({ name: i.name, value: i.value, itemStyle: { color: i.color } })),
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
}: {
  labels: string[]
  series: { name: string; values: number[]; color: string }[]
  height?: number
  stack?: boolean
}) {
  return (
    <Chart
      height={height}
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
          data: s.values,
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
}: {
  rows: string[]
  cols: string[]
  values: number[][] // [row][col]
  height?: number
  total: number
}) {
  const data = values.flatMap((r, i) => r.map((v, j) => [j, i, v]))
  const max = Math.max(1, ...values.flat())
  return (
    <Chart
      height={height}
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
            itemStyle: { borderColor: '#fff', borderWidth: 2 },
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
}: {
  labels: string[]
  values: number[]
  weekend: boolean[]
  height?: number
}) {
  return (
    <Chart
      height={height}
      option={{
        xAxis: { ...catAxis(labels), axisLabel: { color: COLORS.muted, interval: 0, rotate: labels.length > 8 ? 45 : 0, fontSize: 10 } },
        yAxis: valueAxis,
        series: [
          {
            type: 'bar',
            barMaxWidth: 18,
            data: values.map((v, i) => ({ value: v, itemStyle: { color: weekend[i] ? COLORS.secondary : COLORS.accent } })),
          },
        ],
      }}
    />
  )
}

/** Barra impilata 100% in stile card KPI della piattaforma. */
export function StackBar({ items }: { items: { label: string; value: number; color: string }[] }) {
  const total = items.reduce((s, i) => s + i.value, 0)
  return (
    <div className="stackbar-wrap">
      <div className="stackbar">
        {items.map((i) =>
          total && i.value > 0 ? (
            <div key={i.label} style={{ width: `${(i.value / total) * 100}%`, background: i.color }} title={`${i.label}: ${fmt(i.value)}`}>
              {i.value / total > 0.08 ? fmtPct(i.value / total) : ''}
            </div>
          ) : null,
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
