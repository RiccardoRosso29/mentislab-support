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
      if (a1[b1] & a2[b2] & a3[b3]) {
        const v = n[r]
        hist[(b1 * N_P2 + b2) * N_P3 + b3] += v
        sum += v
      }
    }
    if (sum > 0) {
      const key = ko * KEY + kd
      pairs.set(key, (pairs.get(key) ?? 0) + sum)
    }
  }

  const nDays = d.days.filter((x) => inPeriod(f, x)).length || 1
  return { hist, pairs, nDays }
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

async function handle(url: string) {
  const u = new URL(url, 'http://local')
  if (u.pathname === '/api/meta') {
    const m = await loadMeta()
    return { periodo: m.periodo, fasce: m.fasce, province: m.province, zone: m.zone, ace: m.ace }
  }
  const d = await loadData()
  const f = parse(u.searchParams)
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
