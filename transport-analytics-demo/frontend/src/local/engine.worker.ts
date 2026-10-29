/// <reference lib="webworker" />
/**
 * Motore analitico nel browser per la versione statica della demo (nessun backend).
 * Riproduce /api/meta, /api/stats e /api/flows di backend/app/queries.py sullo stesso dataset,
 * esportato da pipeline/export_static.py in colonne binarie compresse.
 */

const FASCE = ['notte', 'mattina_punta', 'centrale', 'sera_punta', 'sera']
const TIPOLOGIE = ['interno', 'di scambio']
const NAZIONALITA = ['nazionale', 'internazionale']
const GENERI = ['f', 'm', 'NA']
const ETA = ['18-25', '26-35', '36-45', '46-55', '56-65', '66+', 'NA']
const MOTIVI = ['residente', 'lavoratore', 'visitatore']
const DOW_LABELS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']
const N_P1 = 70
const N_P2 = 128
const N_P3 = 9
const KEY = 4096 // chiave coppia = indice denso origine * KEY + indice denso destinazione

interface MetaFile {
  periodo: { da: string; a: string; giorni: number }
  zone: { id: number; nome: string }[]
  province: { id: number; nome: string }[]
  ace: { id: number; nome: string }[]
  indice_zone: number[] // id ACE in ordine di indice
  comune_zone: number[]
  prov_zone: number[]
  scala_n: number
  overflow: { righe: number[]; n: number[] }
  [k: string]: unknown
}

type Livello = 'ace' | 'comune' | 'provincia'

/** Per ogni livello: indice denso della zona di ciascuna ACE e id delle zone dense. */
interface LevelIndex {
  ofAce: Int32Array
  ids: number[]
}

interface Data {
  meta: MetaFile
  zoneId: Int32Array
  zoneComune: Int32Array
  zoneProv: Int32Array
  levels: Record<Livello, LevelIndex>
  pzo: Uint16Array
  pzd: Uint16Array
  pStart: Uint32Array
  p1: Uint8Array
  p2: Uint8Array
  p3: Uint8Array
  n: Float32Array
  days: { iso: string; dow: number }[]
  names: Record<Livello, Map<number, string>>
}

let base = ''
let metaPromise: Promise<MetaFile> | null = null
let dataPromise: Promise<Data> | null = null

async function fetchBin(name: string, onBytes: (n: number) => void): Promise<ArrayBuffer> {
  const res = await fetch(base + name)
  if (!res.ok || !res.body) throw new Error(`${name}: HTTP ${res.status}`)
  const counted = res.body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, ctrl) {
        onBytes(chunk.byteLength)
        ctrl.enqueue(chunk)
      },
    }),
  )
  return new Response(counted.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()
}

function loadMeta() {
  metaPromise ??= fetch(base + 'meta.json').then((r) => {
    if (!r.ok) throw new Error(`meta.json: HTTP ${r.status}`)
    return r.json()
  })
  return metaPromise
}

function loadData(): Promise<Data> {
  dataPromise ??= (async () => {
    const meta = await loadMeta()
    // estensione .bin.wasm: vedi pipeline/export_static.py
    const files = ['pairs_zo', 'pairs_zd', 'pairs_len', 'rows_p1', 'rows_p2', 'rows_p3', 'rows_nlo', 'rows_nhi']
    const TOTAL_BYTES = 33_500_000 // dimensione indicativa del pacchetto, solo per la barra di avanzamento
    let loaded = 0
    const progress = (b: number) => {
      loaded += b
      postMessage({ type: 'progress', value: Math.min(0.99, loaded / TOTAL_BYTES) })
    }
    const [zo, zd, len, p1, p2, p3, nlo, nhi] = await Promise.all(files.map((f) => fetchBin(`${f}.bin.wasm`, progress)))

    const lengths = new Uint32Array(len)
    const pStart = new Uint32Array(lengths.length + 1)
    for (let i = 0; i < lengths.length; i++) pStart[i + 1] = pStart[i] + lengths[i]

    const lo = new Uint8Array(nlo)
    const hi = new Uint8Array(nhi)
    const n = new Float32Array(lo.length)
    for (let i = 0; i < lo.length; i++) n[i] = (lo[i] | (hi[i] << 8)) / meta.scala_n
    meta.overflow.righe.forEach((r, i) => (n[r] = meta.overflow.n[i]))

    const d0 = new Date(meta.periodo.da + 'T00:00:00Z')
    const days = Array.from({ length: meta.periodo.giorni }, (_, i) => {
      const d = new Date(d0.getTime() + i * 86400000)
      return { iso: d.toISOString().slice(0, 10), dow: ((d.getUTCDay() + 6) % 7) + 1 }
    })

    const level = (ids: number[]): LevelIndex => {
      const dense = new Map<number, number>()
      const ofAce = Int32Array.from(ids, (id) => {
        if (!dense.has(id)) dense.set(id, dense.size)
        return dense.get(id)!
      })
      return { ofAce, ids: [...dense.keys()] }
    }

    postMessage({ type: 'progress', value: 1 })
    return {
      meta,
      zoneId: Int32Array.from(meta.indice_zone),
      zoneComune: Int32Array.from(meta.comune_zone),
      zoneProv: Int32Array.from(meta.prov_zone),
      levels: { ace: level(meta.indice_zone), comune: level(meta.comune_zone), provincia: level(meta.prov_zone) },
      pzo: new Uint16Array(zo),
      pzd: new Uint16Array(zd),
      pStart,
      p1: new Uint8Array(p1),
      p2: new Uint8Array(p2),
      p3: new Uint8Array(p3),
      n,
      days,
      names: {
        ace: new Map(meta.ace.map((z) => [z.id, z.nome])),
        comune: new Map(meta.zone.map((z) => [z.id, z.nome])),
        provincia: new Map(meta.province.map((p) => [p.id, p.nome])),
      },
    }
  })()
  return dataPromise
}

// ------------------------------------------------------------------ filtri
class BadRequest extends Error {}

interface Filters {
  livello: Livello
  dow: number[]
  fascia: string[]
  tipologia: string[]
  nazionalita: string[]
  genere: string[]
  eta: string[]
  motivo: [string, string][]
  origine: ZoneSel
  destinazione: ZoneSel
  nodo: number | null
  link: [number, number] | null
  da: string | null
  a: string | null
}

const DATE = /^\d{4}-\d{2}-\d{2}$/
/** Giorno incluso nel periodo filtrato (intervallo di date e giorni della settimana). */
const inPeriod = (f: Filters, x: { iso: string; dow: number }) =>
  (f.dow.length === 0 || f.dow.includes(x.dow)) && (!f.da || x.iso >= f.da) && (!f.a || x.iso <= f.a)

const split = (v: string | null) => (v ? v.split(',').filter(Boolean) : [])
function enumList(q: URLSearchParams, k: string, allowed: string[]) {
  const v = split(q.get(k))
  if (v.some((x) => !allowed.includes(x))) throw new BadRequest(`valori non validi per ${k}`)
  return v
}
/** Token 'p:<provincia>', 'c:<comune>', 'a:<ACE>'. */
interface ZoneSel {
  prov: Set<number>
  zone: Set<number>
  ace: Set<number>
}
function zones(raw: string | null): ZoneSel {
  const out: ZoneSel = { prov: new Set(), zone: new Set(), ace: new Set() }
  const by: Record<string, Set<number>> = { p: out.prov, c: out.zone, a: out.ace }
  for (const tok of split(raw)) {
    const [kind, val] = tok.split(':')
    if (!/^\d+$/.test(val ?? '') || !by[kind]) throw new BadRequest(`token non valido: ${tok}`)
    by[kind].add(Number(val))
  }
  return out
}

function parse(q: URLSearchParams): Filters {
  const link = split(q.get('link')).map(Number)
  return {
    livello: (['ace', 'provincia'] as const).find((l) => l === q.get('livello')) ?? 'comune',
    dow: split(q.get('dow')).map(Number),
    fascia: enumList(q, 'fascia', FASCE),
    tipologia: enumList(q, 'tipologia', TIPOLOGIE),
    nazionalita: enumList(q, 'nazionalita', NAZIONALITA),
    genere: enumList(q, 'genere', GENERI),
    eta: enumList(q, 'eta', ETA),
    motivo: split(q.get('motivo')).map((t) => {
      const [mo, md] = t.split('>')
      if (!MOTIVI.includes(mo) || !MOTIVI.includes(md)) throw new BadRequest(`motivo non valido: ${t}`)
      return [mo, md] as [string, string]
    }),
    origine: zones(q.get('origine')),
    destinazione: zones(q.get('destinazione')),
    nodo: q.get('nodo') ? Number(q.get('nodo')) : null,
    da: DATE.test(q.get('da') ?? '') ? q.get('da') : null,
    a: DATE.test(q.get('a') ?? '') ? q.get('a') : null,
    link: link.length === 2 ? [link[0], link[1]] : null,
  }
}

// ------------------------------------------------------------------ calcolo
interface Result {
  hist: Float64Array
  /** come hist ma senza filtri sugli attributi (solo zone e selezione): base per i grafici "crossfilter" */
  all: Float64Array
  pairs: Map<number, number> // coppie al livello richiesto, chiave su indici densi (vedi pairIds)
  nDays: number
}

const cache = new Map<string, Result>()

function compute(d: Data, f: Filters): Result {
  const has = <T,>(list: T[], v: T) => list.length === 0 || list.includes(v)

  const a1 = new Uint8Array(N_P1)
  for (let g = 0; g < d.days.length; g++)
    for (let fa = 0; fa < 5; fa++) a1[g * 5 + fa] = +(inPeriod(f, d.days[g]) && has(f.fascia, FASCE[fa]))
  const a2 = new Uint8Array(N_P2)
  for (let v = 0; v < N_P2; v++) {
    const tp = v & 1, nz = (v >> 1) & 1, ge = (v >> 2) & 3, et = v >> 4
    if (ge > 2 || et > 6) continue
    a2[v] = +(has(f.tipologia, TIPOLOGIE[tp]) && has(f.nazionalita, NAZIONALITA[nz]) && has(f.genere, GENERI[ge]) && has(f.eta, ETA[et]))
  }
  const a3 = new Uint8Array(N_P3)
  for (let v = 0; v < N_P3; v++) {
    const mo = MOTIVI[Math.floor(v / 3)], md = MOTIVI[v % 3]
    a3[v] = +(f.motivo.length === 0 || f.motivo.some(([x, y]) => x === mo && y === md))
  }

  const empty = (s: ZoneSel) => s.prov.size === 0 && s.zone.size === 0 && s.ace.size === 0
  const sideOk = (sel: ZoneSel, a: number, c: number, p: number) =>
    empty(sel) || sel.prov.has(p) || sel.zone.has(c) || sel.ace.has(a)

  const hist = new Float64Array(N_P1 * N_P2 * N_P3)
  const all = new Float64Array(N_P1 * N_P2 * N_P3)
  const pairs = new Map<number, number>()
  const { pzo, pzd, pStart, p1, p2, p3, n, zoneId, zoneComune, zoneProv } = d
  const lvl = d.levels[f.livello]

  for (let p = 0; p < pzo.length; p++) {
    const io = pzo[p], id = pzd[p]
    // origine E destinazione: un lato senza filtri non vincola
    if (!sideOk(f.origine, zoneId[io], zoneComune[io], zoneProv[io])) continue
    if (!sideOk(f.destinazione, zoneId[id], zoneComune[id], zoneProv[id])) continue
    const ko = lvl.ofAce[io], kd = lvl.ofAce[id]
    const o = lvl.ids[ko], de = lvl.ids[kd]
    if (f.nodo !== null && o !== f.nodo && de !== f.nodo) continue
    if (f.link && !((o === f.link[0] && de === f.link[1]) || (o === f.link[1] && de === f.link[0]))) continue

    let sum = 0
    for (let r = pStart[p], end = pStart[p + 1]; r < end; r++) {
      const b1 = p1[r], b2 = p2[r], b3 = p3[r]
      const bin = (b1 * N_P2 + b2) * N_P3 + b3
      const v = n[r]
      all[bin] += v
      if (a1[b1] & a2[b2] & a3[b3]) {
        hist[bin] += v
        sum += v
      }
    }
    if (sum > 0) {
      const key = ko * KEY + kd
      pairs.set(key, (pairs.get(key) ?? 0) + sum)
    }
  }

  const nDays = d.days.filter((x) => inPeriod(f, x)).length || 1
  return { hist, all, pairs, nDays }
}

function resultFor(d: Data, f: Filters, q: URLSearchParams): Result {
  const k = new URLSearchParams(q)
  k.delete('limit')
  k.sort()
  const key = k.toString()
  let r = cache.get(key)
  if (!r) {
    r = compute(d, f)
    cache.set(key, r)
    if (cache.size > 40) cache.delete(cache.keys().next().value!)
  }
  return r
}

function topOd(d: Data, f: Filters, r: Result, limit: number) {
  const ids = d.levels[f.livello].ids
  const names = d.names[f.livello]
  return [...r.pairs.entries()]
    .map(([k, v]) => ({ o: ids[Math.floor(k / KEY)], d: ids[k % KEY], n: v }))
    .filter((x) => x.o !== x.d)
    .sort((a, b) => b.n - a.n)
    .slice(0, limit)
    .map((x) => ({ o: x.o, o_nome: names.get(x.o) ?? null, d: x.d, d_nome: names.get(x.d) ?? null, n: x.n, media: x.n / r.nDays }))
}

function stats(d: Data, f: Filters, r: Result) {
  const giorno = new Float64Array(d.days.length)
  const fascia = new Float64Array(5)
  const ge = new Map<string, number>()
  const mot = new Float64Array(9)
  const naz = [0, 0]
  const tip = [0, 0]
  let total = 0
  for (let i = 0; i < r.hist.length; i++) {
    const v = r.hist[i]
    if (v === 0) continue
    const b3 = i % N_P3
    const b2 = Math.floor(i / N_P3) % N_P2
    const b1 = Math.floor(i / (N_P3 * N_P2))
    total += v
    giorno[Math.floor(b1 / 5)] += v
    fascia[b1 % 5] += v
    tip[b2 & 1] += v
    naz[(b2 >> 1) & 1] += v
    const k = `${(b2 >> 2) & 3}|${b2 >> 4}`
    ge.set(k, (ge.get(k) ?? 0) + v)
    mot[b3] += v
  }
  const dowSum = new Array(7).fill(0)
  const dowCnt = new Array(7).fill(0)
  d.days.forEach((x, i) => {
    if (!inPeriod(f, x)) return
    dowSum[x.dow - 1] += giorno[i]
    dowCnt[x.dow - 1] += 1
  })

  const kpi: Record<string, unknown> = {
    totale: total,
    media_giornaliera: total / r.nDays,
    giorni: r.nDays,
    quota_scambio: total ? tip[1] / total : null,
    quota_internazionali: total ? naz[1] / total : null,
  }
  if (f.nodo !== null) {
    let uscita = 0, ingresso = 0, interni = 0
    const ids = d.levels[f.livello].ids
    for (const [k, v] of r.pairs) {
      const o = ids[Math.floor(k / KEY)], de = ids[k % KEY]
      if (o === f.nodo && de === f.nodo) interni += v
      else if (o === f.nodo) uscita += v
      else if (de === f.nodo) ingresso += v
    }
    kpi.nodo = { uscita, ingresso, interni }
  }

  const present = (arr: ArrayLike<number>, i: number) => arr[i] > 0
  return {
    cross: crossStats(d, f, r),
    kpi,
    giornaliero: d.days.flatMap((x, i) => (inPeriod(f, x) ? [{ giorno: x.iso, dow: x.dow, n: giorno[i] }] : [])),
    per_dow: DOW_LABELS.map((label, i) => ({ dow: i + 1, label, media: dowCnt[i] ? dowSum[i] / dowCnt[i] : null })),
    per_fascia: FASCE.map((id, i) => ({ fascia: id, media: fascia[i] / r.nDays })).filter((_, i) => present(fascia, i)),
    genere_eta: [...ge.entries()].map(([k, v]) => {
      const [g, e] = k.split('|').map(Number)
      return { genere: GENERI[g], eta: ETA[e], n: v }
    }),
    motivi: [...mot].flatMap((v, i) => (v > 0 ? [{ mo: MOTIVI[Math.floor(i / 3)], md: MOTIVI[i % 3], n: v }] : [])),
    nazionalita: Object.fromEntries(NAZIONALITA.flatMap((k, i) => (naz[i] > 0 ? [[k, naz[i]]] : []))),
    tipologia: Object.fromEntries(TIPOLOGIE.flatMap((k, i) => (tip[i] > 0 ? [[k, tip[i]]] : []))),
    top_od: topOd(d, f, r, 10),
    n_giorni: r.nDays,
  }
}

/**
 * Distribuzioni per i grafici interattivi: ogni grafico applica tutti i filtri tranne il proprio,
 * così i valori non selezionati restano visibili (evidenziati solo quelli scelti).
 */
function crossStats(d: Data, f: Filters, r: Result) {
  const has = <T,>(list: T[], v: T) => list.length === 0 || list.includes(v)
  const dateOk = d.days.map((x) => (!f.da || x.iso >= f.da) && (!f.a || x.iso <= f.a))
  const dowOk = d.days.map((x) => has(f.dow, x.dow))
  const fasOk = FASCE.map((x) => has(f.fascia, x))
  const tipOk = TIPOLOGIE.map((x) => has(f.tipologia, x))
  const nazOk = NAZIONALITA.map((x) => has(f.nazionalita, x))
  const genOk = GENERI.map((x) => has(f.genere, x))
  const etaOk = ETA.map((x) => has(f.eta, x))
  const motOk = Array.from({ length: 9 }, (_, v) => f.motivo.length === 0 || f.motivo.some(([x, y]) => x === MOTIVI[Math.floor(v / 3)] && y === MOTIVI[v % 3]))

  type Dim = 'date' | 'dow' | 'fascia' | 'tip' | 'naz' | 'gen' | 'eta' | 'mot'
  /** Somma i bin che rispettano tutti i filtri tranne `relax`, passando le componenti decodificate. */
  const scan = (relax: Dim, add: (v: number, g: number, fa: number, b2: number, b3: number) => void) => {
    for (let i = 0; i < r.all.length; i++) {
      const v = r.all[i]
      if (v === 0) continue
      const b3 = i % N_P3
      const b2 = Math.floor(i / N_P3) % N_P2
      const b1 = Math.floor(i / (N_P3 * N_P2))
      const g = Math.floor(b1 / 5), fa = b1 % 5
      const tp = b2 & 1, nz = (b2 >> 1) & 1, ge = (b2 >> 2) & 3, et = b2 >> 4
      if (relax !== 'date' && !dateOk[g]) continue
      if (relax !== 'dow' && !dowOk[g]) continue
      if (relax !== 'fascia' && !fasOk[fa]) continue
      if (relax !== 'tip' && !tipOk[tp]) continue
      if (relax !== 'naz' && !nazOk[nz]) continue
      if (relax !== 'gen' && !genOk[ge]) continue
      if (relax !== 'eta' && !etaOk[et]) continue
      if (relax !== 'mot' && !motOk[b3]) continue
      add(v, g, fa, b2, b3)
    }
  }

  const giorno = new Float64Array(d.days.length)
  scan('date', (v, g) => (giorno[g] += v))

  const dowSum = new Array(7).fill(0)
  scan('dow', (v, g) => (dowSum[d.days[g].dow - 1] += v))
  const dowCnt = new Array(7).fill(0)
  d.days.forEach((x, g) => dateOk[g] && dowCnt[x.dow - 1]++)

  const fascia = new Float64Array(5)
  scan('fascia', (v, _g, fa) => (fascia[fa] += v))
  const mot = new Float64Array(9)
  scan('mot', (v, _g, _fa, _b2, b3) => (mot[b3] += v))
  const tip = [0, 0]
  scan('tip', (v, _g, _fa, b2) => (tip[b2 & 1] += v))
  const naz = [0, 0]
  scan('naz', (v, _g, _fa, b2) => (naz[(b2 >> 1) & 1] += v))
  const gen = [0, 0, 0]
  scan('gen', (v, _g, _fa, b2) => (gen[(b2 >> 2) & 3] += v))
  const eta = new Map<string, number>()
  scan('eta', (v, _g, _fa, b2) => {
    const k = `${GENERI[(b2 >> 2) & 3]}|${ETA[b2 >> 4]}`
    eta.set(k, (eta.get(k) ?? 0) + v)
  })

  return {
    giornaliero: d.days.map((x, i) => ({ giorno: x.iso, dow: x.dow, n: giorno[i] })),
    per_dow: DOW_LABELS.map((label, i) => ({ dow: i + 1, label, media: dowCnt[i] ? dowSum[i] / dowCnt[i] : null })),
    per_fascia: FASCE.map((id, i) => ({ fascia: id, media: fascia[i] / r.nDays })),
    motivi: [...mot].map((v, i) => ({ mo: MOTIVI[Math.floor(i / 3)], md: MOTIVI[i % 3], n: v })),
    tipologia: Object.fromEntries(TIPOLOGIE.map((k, i) => [k, tip[i]])),
    nazionalita: Object.fromEntries(NAZIONALITA.map((k, i) => [k, naz[i]])),
    genere: Object.fromEntries(GENERI.map((k, i) => [k, gen[i]])),
    eta: [...eta.entries()].map(([k, v]) => {
      const [genere, e] = k.split('|')
      return { genere, eta: e, n: v }
    }),
  }
}

function flows(d: Data, f: Filters, r: Result, limit: number) {
  const ids = d.levels[f.livello].ids
  const nodes = new Map<number, [number, number, number]>()
  const node = (id: number) => {
    let v = nodes.get(id)
    if (!v) nodes.set(id, (v = [0, 0, 0]))
    return v
  }
  const links: { o: number; d: number; n: number }[] = []
  let volume = 0
  for (const [k, v] of r.pairs) {
    const o = ids[Math.floor(k / KEY)], de = ids[k % KEY]
    if (o === de) {
      node(o)[2] += v
      continue
    }
    node(o)[0] += v
    node(de)[1] += v
    links.push({ o, d: de, n: v })
    volume += v
  }
  links.sort((a, b) => b.n - a.n)
  const nd = r.nDays
  return {
    livello: f.livello,
    n_giorni: nd,
    nodi: [...nodes.entries()].map(([id, [u, i, x]]) => ({ id, uscita: u / nd, ingresso: i / nd, interni: x / nd })),
    flussi: links.slice(0, limit).map((l) => ({ ...l, n: l.n / nd })),
    coppie_totali: links.length,
    volume_flussi: volume / nd,
  }
}


// ------------------------------------------------------------------ export
/** Campi esportabili, nello stesso ordine delle colonne del file. */
const CAMPI = [
  'origine', 'destinazione', 'giorno', 'giorno_settimana', 'fascia_oraria',
  'genere', 'eta', 'nazionalita', 'tipologia', 'motivo_origine', 'motivo_destinazione',
] as const
type Campo = (typeof CAMPI)[number]
// oltre questa soglia di gruppi il dataset è troppo dettagliato per essere calcolato nel browser
const MAX_GRUPPI = 4_000_000

interface ExportResult {
  campi: Campo[]
  groups: Map<number, number>
  totale: number
  nDays: number
  zoneIds: number[]
}

const exportCache = new Map<string, ExportResult>()

/** Aggrega i dati filtrati sulle dimensioni scelte, con chiave numerica a radice mista (< 2^53). */
function exportGroups(d: Data, f: Filters, campi: Campo[]): ExportResult {
  const has = <T,>(list: T[], v: T) => list.length === 0 || list.includes(v)
  const on = (c: Campo) => campi.includes(c)
  const lvl = d.levels[f.livello]
  const Z = lvl.ids.length

  // parti della chiave derivate da ciascun byte di attributi; 0 dove il campo non è richiesto
  const t1 = new Int32Array(N_P1).fill(-1)
  for (let g = 0; g < d.days.length; g++)
    for (let fa = 0; fa < 5; fa++) {
      if (!(inPeriod(f, d.days[g]) && has(f.fascia, FASCE[fa]))) continue
      const t = on('giorno') ? g : on('giorno_settimana') ? d.days[g].dow - 1 : 0
      t1[g * 5 + fa] = t * 5 + (on('fascia_oraria') ? fa : 0)
    }
  const t2 = new Int32Array(N_P2).fill(-1)
  for (let v = 0; v < N_P2; v++) {
    const tp = v & 1, nz = (v >> 1) & 1, ge = (v >> 2) & 3, et = v >> 4
    if (ge > 2 || et > 6) continue
    if (!(has(f.tipologia, TIPOLOGIE[tp]) && has(f.nazionalita, NAZIONALITA[nz]) && has(f.genere, GENERI[ge]) && has(f.eta, ETA[et]))) continue
    t2[v] = (on('tipologia') ? tp : 0) | (on('nazionalita') ? nz << 1 : 0) | (on('genere') ? ge << 2 : 0) | (on('eta') ? et << 4 : 0)
  }
  const t3 = new Int32Array(N_P3).fill(-1)
  for (let v = 0; v < N_P3; v++) {
    const mo = Math.floor(v / 3), md = v % 3
    if (!(f.motivo.length === 0 || f.motivo.some(([x, y]) => x === MOTIVI[mo] && y === MOTIVI[md]))) continue
    t3[v] = (on('motivo_origine') ? mo : 0) * 3 + (on('motivo_destinazione') ? md : 0)
  }

  const empty = (s: ZoneSel) => s.prov.size === 0 && s.zone.size === 0 && s.ace.size === 0
  const sideOk = (sel: ZoneSel, a: number, c: number, p: number) =>
    empty(sel) || sel.prov.has(p) || sel.zone.has(c) || sel.ace.has(a)
  const { pzo, pzd, pStart, p1, p2, p3, n, zoneId, zoneComune, zoneProv } = d
  const groups = new Map<number, number>()
  let totale = 0

  for (let p = 0; p < pzo.length; p++) {
    const io = pzo[p], id = pzd[p]
    if (!sideOk(f.origine, zoneId[io], zoneComune[io], zoneProv[io])) continue
    if (!sideOk(f.destinazione, zoneId[id], zoneComune[id], zoneProv[id])) continue
    const zk = (on('origine') ? lvl.ofAce[io] : 0) * Z + (on('destinazione') ? lvl.ofAce[id] : 0)
    for (let r = pStart[p], end = pStart[p + 1]; r < end; r++) {
      const k1 = t1[p1[r]], k2 = t2[p2[r]], k3 = t3[p3[r]]
      if (k1 < 0 || k2 < 0 || k3 < 0) continue
      const key = ((zk * N_P1 + k1) * N_P2 + k2) * N_P3 + k3
      const v = n[r]
      groups.set(key, (groups.get(key) ?? 0) + v)
      totale += v
    }
    if (groups.size > MAX_GRUPPI)
      throw new BadRequest('combinazione di campi troppo dettagliata: rimuovi qualche campo o scegli un livello territoriale meno fine')
  }
  const nDays = d.days.filter((x) => inPeriod(f, x)).length || 1
  return { campi, groups, totale, nDays, zoneIds: lvl.ids }
}

function exportFor(d: Data, f: Filters, campi: Campo[], q: URLSearchParams): ExportResult {
  const k = new URLSearchParams(q)
  for (const x of ['k', 'righe', 'limit', 'nodo', 'link']) k.delete(x)
  k.sort()
  const key = k.toString()
  let r = exportCache.get(key)
  if (!r) {
    r = exportGroups(d, f, campi)
    exportCache.set(key, r)
    if (exportCache.size > 12) exportCache.delete(exportCache.keys().next().value!)
  }
  return r
}

function exportResponse(d: Data, f: Filters, q: URLSearchParams) {
  const campi = split(q.get('campi')) as Campo[]
  if (!campi.length) throw new BadRequest('seleziona almeno un campo')
  if (campi.some((c) => !CAMPI.includes(c))) throw new BadRequest('campo non valido')
  const soglia = Math.max(0, Number(q.get('k')) || 100)
  const ordered = CAMPI.filter((c) => campi.includes(c))
  const r = exportFor(d, f, ordered, q)

  let gruppiEsportati = 0
  let spostamentiEsportati = 0
  for (const v of r.groups.values())
    if (v >= soglia) {
      gruppiEsportati++
      spostamentiEsportati += v
    }
  const summary = {
    campi: ordered,
    soglia,
    gruppi_totali: r.groups.size,
    gruppi_esportati: gruppiEsportati,
    spostamenti_totali: r.totale,
    spostamenti_esportati: spostamentiEsportati,
    perdita: r.totale ? 1 - spostamentiEsportati / r.totale : 0,
    n_giorni: r.nDays,
  }
  if (q.get('righe') !== '1') return summary

  // decodifica delle chiavi in righe con etichette leggibili
  const names = d.names[f.livello]
  const Z = r.zoneIds.length
  const media = !ordered.includes('giorno')
  const rows: (string | number)[][] = []
  for (const [key, v] of r.groups) {
    if (v < soglia) continue
    const k3 = key % N_P3
    const k2 = Math.floor(key / N_P3) % N_P2
    const k1 = Math.floor(key / (N_P3 * N_P2)) % N_P1
    const zk = Math.floor(key / (N_P3 * N_P2 * N_P1))
    const t = Math.floor(k1 / 5)
    const val: Record<Campo, string | number> = {
      origine: names.get(r.zoneIds[Math.floor(zk / Z)]) ?? '',
      destinazione: names.get(r.zoneIds[zk % Z]) ?? '',
      giorno: d.days[t]?.iso ?? '',
      giorno_settimana: DOW_LABELS[ordered.includes('giorno') ? d.days[t].dow - 1 : t],
      fascia_oraria: FASCE[k1 % 5],
      genere: GENERI[(k2 >> 2) & 3],
      eta: ETA[k2 >> 4],
      nazionalita: NAZIONALITA[(k2 >> 1) & 1],
      tipologia: TIPOLOGIE[k2 & 1],
      motivo_origine: MOTIVI[Math.floor(k3 / 3)],
      motivo_destinazione: MOTIVI[k3 % 3],
    }
    const row: (string | number)[] = ordered.map((c) => val[c])
    row.push(Math.round(v * 10) / 10)
    if (media) row.push(Math.round((v / r.nDays) * 10) / 10)
    rows.push(row)
  }
  rows.sort((a, b) => (b[ordered.length] as number) - (a[ordered.length] as number))
  const header = [...ordered, 'spostamenti_periodo', ...(media ? ['spostamenti_medi_giorno'] : [])]
  return { ...summary, header, rows }
}

async function handle(url: string) {
  const u = new URL(url, 'http://local')
  if (u.pathname === '/api/meta') {
    const m = await loadMeta()
    return { periodo: m.periodo, fasce: m.fasce, province: m.province, zone: m.zone, ace: m.ace }
  }
  const d = await loadData()
  const f = parse(u.searchParams)
  if (u.pathname === '/api/export') return exportResponse(d, f, u.searchParams)
  const r = resultFor(d, f, u.searchParams)
  if (u.pathname === '/api/stats') return stats(d, f, r)
  if (u.pathname === '/api/flows') {
    const limit = Math.min(3000, Math.max(10, Number(u.searchParams.get('limit')) || 300))
    return flows(d, f, r, limit)
  }
  throw new BadRequest(`endpoint sconosciuto: ${u.pathname}`)
}

self.onmessage = async (e: MessageEvent) => {
  const { id, type, url } = e.data
  if (type === 'init') {
    base = e.data.base
    loadData().catch(() => undefined) // avvia subito il download dei dati
    return
  }
  try {
    postMessage({ id, ok: true, body: await handle(url) })
  } catch (err) {
    postMessage({ id, ok: false, error: (err as Error).message })
  }
}
