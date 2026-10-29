import { isStatic, localApi } from './local/client'

export type Livello = 'ace' | 'comune' | 'provincia'

export interface Provincia {
  id: number
  nome: string
  sigla: string
  regione: string
  piemonte: boolean
  lon: number
  lat: number
}

export interface Zona {
  id: number
  nome: string
  prov_id: number
  prov_nome: string
  piemonte: boolean
  lon: number
  lat: number
}

export interface Ace {
  id: number
  nome: string
  comune_id: number
  prov_id: number
  prov_nome: string
  piemonte: boolean
  lon: number
  lat: number
}

export interface Meta {
  periodo: { da: string; a: string; giorni: number }
  fasce: { id: string; da: number; a: number }[]
  province: Provincia[]
  zone: Zona[]
  ace: Ace[]
}

export interface Filters {
  periodo: string[] // [] oppure [da, a] in formato ISO
  dow: number[]
  fascia: string[]
  motivo: string[] // "mo>md"
  origine: string[] // "p:<id>" | "c:<id>" | "a:<id>"
  destinazione: string[]
  genere: string[]
  eta: string[]
  nazionalita: string[]
  tipologia: string[]
  /** ['1'] = esclude gli spostamenti con origine e destinazione nella stessa zona (dal grafico "Bilancio della zona") */
  xi: string[]
}

export type Selection =
  | { type: 'nodo'; id: number }
  | { type: 'link'; a: number; b: number }
  | null

export interface Stats {
  kpi: {
    totale: number
    media_giornaliera: number
    giorni: number
    quota_scambio: number | null
    quota_internazionali: number | null
    nodo?: { uscita: number; ingresso: number; interni: number }
  }
  giornaliero: { giorno: string; dow: number; n: number }[]
  per_dow: { dow: number; label: string; media: number | null }[]
  per_fascia: { fascia: string; media: number }[]
  genere_eta: { genere: string; eta: string; n: number }[]
  motivi: { mo: string; md: string; n: number }[]
  nazionalita: Record<string, number>
  tipologia: Record<string, number>
  top_od: { o: number; o_nome: string; d: number; d_nome: string; n: number; media: number }[]
  /** distribuzioni dei grafici interattivi: ognuna senza il filtro del proprio grafico */
  cross: {
    giornaliero: { giorno: string; dow: number; n: number }[]
    per_dow: { dow: number; label: string; media: number | null }[]
    per_fascia: { fascia: string; media: number }[]
    motivi: { mo: string; md: string; n: number }[]
    tipologia: Record<string, number>
    nazionalita: Record<string, number>
    genere: Record<string, number>
    eta: { genere: string; eta: string; n: number }[]
  }
  n_giorni: number
}

export interface Relazione {
  o: number
  o_nome: string
  d: number
  d_nome: string
  n: number
  media: number
}

/** Relazioni tra zone diverse sopra la soglia di anonimizzazione, in ordine decrescente. */
export interface Relazioni {
  soglia: number
  n_giorni: number
  totale: number
  sotto_soglia: number
  relazioni: Relazione[]
}

export interface Flows {
  livello: Livello
  n_giorni: number
  nodi: { id: number; uscita: number; ingresso: number; interni: number }[]
  flussi: { o: number; d: number; n: number }[]
  coppie_totali: number
  volume_flussi: number
}

export const EMPTY_FILTERS: Filters = {
  periodo: [],
  dow: [],
  fascia: [],
  motivo: [],
  origine: [],
  destinazione: [],
  genere: [],
  eta: [],
  nazionalita: [],
  tipologia: [],
  xi: [],
}

export function buildQuery(livello: Livello, f: Filters, sel: Selection, extra: Record<string, string | number> = {}) {
  const q = new URLSearchParams({ livello })
  for (const [k, v] of Object.entries(f)) {
    if (!v.length) continue
    if (k === 'periodo') {
      q.set('da', v[0])
      q.set('a', v[1])
    } else q.set(k, v.join(','))
  }
  if (sel?.type === 'nodo') q.set('nodo', String(sel.id))
  if (sel?.type === 'link') q.set('link', `${sel.a},${sel.b}`)
  for (const [k, v] of Object.entries(extra)) q.set(k, String(v))
  return q.toString()
}

export const hasActiveFilters = (f: Filters) => Object.values(f).some((v) => v.length > 0)

export async function getJSON<T>(url: string, signal?: AbortSignal): Promise<T> {
  if (isStatic && url.startsWith('/api/')) return localApi<T>(url, signal)
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
  return res.json() as Promise<T>
}
