export const COLORS = {
  accent: '#f28c28',
  accentDark: '#e06c00',
  blue: '#4c78a8',
  purple: '#6f42c1',
  green: '#54a24b',
  yellow: '#eeca3b',
  grey: '#b9b9b9',
  secondary: '#3d3d3d',
  out: '#f28c28',
  in: '#6f42c1',
  text: '#1f1f1f',
  muted: '#6b6b6b',
}

export const DOW = [
  { id: 1, label: 'Lunedì', short: 'Lun' },
  { id: 2, label: 'Martedì', short: 'Mar' },
  { id: 3, label: 'Mercoledì', short: 'Mer' },
  { id: 4, label: 'Giovedì', short: 'Gio' },
  { id: 5, label: 'Venerdì', short: 'Ven' },
  { id: 6, label: 'Sabato', short: 'Sab' },
  { id: 7, label: 'Domenica', short: 'Dom' },
]

export const FASCE: Record<string, string> = {
  notte: 'Notte',
  mattina_punta: 'Punta mattina',
  centrale: 'Centrale',
  sera_punta: 'Punta sera',
  sera: 'Sera',
}

// motivo_visita_* descrive il rapporto del viaggiatore con il luogo: lì risiede, lavora o è in visita
export const MOTIVI: Record<string, string> = {
  residente: 'Casa',
  lavoratore: 'Lavoro',
  visitatore: 'Altro',
}
export const MOTIVI_ORDER = ['residente', 'lavoratore', 'visitatore']
export const MOTIVO_PAIRS = MOTIVI_ORDER.flatMap((mo) => MOTIVI_ORDER.map((md) => `${mo}>${md}`))
export const motivoPairLabel = (pair: string) => {
  const [mo, md] = pair.split('>')
  return `${MOTIVI[mo]} → ${MOTIVI[md]}`
}

export const GENERI: Record<string, string> = { f: 'Femmina', m: 'Maschio', NA: 'N/D' }
export const ETA = ['18-25', '26-35', '36-45', '46-55', '56-65', '66+', 'NA']
export const etaLabel = (e: string) => (e === 'NA' ? 'N/D' : e)
export const NAZIONALITA: Record<string, string> = { nazionale: 'Italiani', internazionale: 'Stranieri' }
export const TIPOLOGIE: Record<string, string> = { interno: 'Interni al Piemonte', 'di scambio': 'Di scambio (extra-regione)' }

const nf0 = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0 })
const nf1 = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 1 })

export const fmt = (v: number | null | undefined) => (v == null ? '–' : nf0.format(Math.round(v)))
/** Soglia minima mostrabile: nessun conteggio di spostamenti sotto 100 compare in grafici, tabelle o tooltip. */
export const SOGLIA_MIN = 100
/** Formatta un numero di spostamenti mascherando i valori sotto soglia. */
export const fmtN = (v: number | null | undefined) => (v == null ? '–' : v > 0 && v < SOGLIA_MIN ? `<${SOGLIA_MIN}` : nf0.format(Math.round(v)))
export const fmtPct = (v: number | null | undefined) => (v == null ? '–' : `${nf1.format(v * 100)}%`)
/** Come fmtCompact, per conteggi di spostamenti: sotto soglia mostra «<100». */
export const fmtCompactN = (v: number) => (v > 0 && v < SOGLIA_MIN ? `<${SOGLIA_MIN}` : fmtCompact(v))
export function fmtCompact(v: number) {
  if (Math.abs(v) >= 1e6) return `${nf1.format(v / 1e6)} M`
  if (Math.abs(v) >= 1e3) return `${nf1.format(v / 1e3)} k`
  return nf0.format(v)
}
export const fmtDate = (iso: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('it-IT', opts)
