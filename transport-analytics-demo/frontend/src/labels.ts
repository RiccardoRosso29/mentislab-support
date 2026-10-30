export const COLORS = {
  accent: '#f28c28',
  accentDark: '#e06c00',
  /** tinta più chiara del colore principale (inizio delle scale, es. matrice dei motivi) */
  accentTint: '#fdf0e2',
  /** benchmark (profilo medio): tratteggio di un colore distinto da tutti quelli dei dati */
  bench: '#2563eb',
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

/** Palette dei template: cambia il colore principale; il secondario (grigio scuro) resta. */
const PALETTE = {
  windtre: { accent: '#f28c28', accentDark: '#e06c00', accentTint: '#fdf0e2', out: '#f28c28', in: '#6f42c1', bench: '#2563eb' },
  // Three: viola come colore principale; i flussi in ingresso passano all'arancione e il benchmark al verde acqua,
  // perché il blu sarebbe troppo vicino al viola
  three: { accent: '#9966ff', accentDark: '#6c2bd9', accentTint: '#efe7ff', out: '#9966ff', in: '#ed8f26', bench: '#0e9384' },
}
export function setPalette(theme: keyof typeof PALETTE) {
  Object.assign(COLORS, PALETTE[theme])
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

export const FASCE: Record<string, string> = {}

// motivo_visita_* descrive il rapporto del viaggiatore con il luogo: lì risiede, lavora o è in visita
export const MOTIVI: Record<string, string> = {}
export const MOTIVI_ORDER = ['residente', 'lavoratore', 'visitatore']
export const MOTIVO_PAIRS = MOTIVI_ORDER.flatMap((mo) => MOTIVI_ORDER.map((md) => `${mo}>${md}`))
export const motivoPairLabel = (pair: string) => {
  const [mo, md] = pair.split('>')
  return `${MOTIVI[mo]} → ${MOTIVI[md]}`
}

export const GENERI: Record<string, string> = {}
export const ETA = ['18-25', '26-35', '36-45', '46-55', '56-65', '66+', 'NA']
export const etaLabel = (e: string) => (e === 'NA' ? GENERI.NA : e)
export const NAZIONALITA: Record<string, string> = {}
export const TIPOLOGIE: Record<string, string> = {}

// Etichette e formati nelle due lingue: gli oggetti esportati restano gli stessi e ne cambia il contenuto
const TESTI = {
  it: {
    dow: [['Lunedì', 'Lun'], ['Martedì', 'Mar'], ['Mercoledì', 'Mer'], ['Giovedì', 'Gio'], ['Venerdì', 'Ven'], ['Sabato', 'Sab'], ['Domenica', 'Dom']],
    fasce: { notte: 'Notte', mattina_punta: 'Punta mattina', centrale: 'Centrale', sera_punta: 'Punta sera', sera: 'Sera' },
    motivi: { residente: 'Casa', lavoratore: 'Lavoro', visitatore: 'Altro' },
    generi: { f: 'Femmina', m: 'Maschio', NA: 'N/D' },
    nazionalita: { nazionale: 'Italiani', internazionale: 'Stranieri' },
    tipologie: { interno: 'Interni al Piemonte', 'di scambio': 'Di scambio (extra-regione)' },
  },
  en: {
    dow: [['Monday', 'Mon'], ['Tuesday', 'Tue'], ['Wednesday', 'Wed'], ['Thursday', 'Thu'], ['Friday', 'Fri'], ['Saturday', 'Sat'], ['Sunday', 'Sun']],
    fasce: { notte: 'Night', mattina_punta: 'Morning peak', centrale: 'Midday', sera_punta: 'Evening peak', sera: 'Evening' },
    motivi: { residente: 'Home', lavoratore: 'Work', visitatore: 'Other' },
    generi: { f: 'Female', m: 'Male', NA: 'N/A' },
    nazionalita: { nazionale: 'Italian', internazionale: 'Foreign' },
    tipologie: { interno: 'Within Piedmont', 'di scambio': 'Cross-border (outside the region)' },
  },
}

let locale = 'it-IT'
let nf0 = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 })
let nf1 = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 })
export const getLocale = () => locale

export function setLabelsLang(lang: 'it' | 'en') {
  const x = TESTI[lang]
  x.dow.forEach(([label, short], i) => Object.assign(DOW[i], { label, short }))
  Object.assign(FASCE, x.fasce)
  Object.assign(MOTIVI, x.motivi)
  Object.assign(GENERI, x.generi)
  Object.assign(NAZIONALITA, x.nazionalita)
  Object.assign(TIPOLOGIE, x.tipologie)
  locale = lang === 'en' ? 'en-GB' : 'it-IT'
  nf0 = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 })
  nf1 = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 })
}
setLabelsLang('it')

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
  new Date(iso + 'T00:00:00').toLocaleDateString(locale, opts)
