/**
 * Strumenti dell'agente, eseguiti nel browser sul motore di calcolo della dashboard.
 * Ogni conteggio di spostamenti inferiore a 100 viene restituito come "<100": il modello non vede mai
 * valori sotto la soglia di anonimizzazione.
 */
import { EMPTY_FILTERS, buildQuery, getJSON, type Filters, type Flows, type Livello, type Meta, type Relazioni, type Selection, type Stats } from '../api'
import { DOW, FASCE, MOTIVI } from '../labels'

const K = 100

/** Conteggio mascherato: sotto soglia diventa "<100", altrimenti arrotondato all'unità (sono stime). */
const n = (v: number | null | undefined) => (v == null ? null : v > 0 && v < K ? '<100' : Math.round(v))
const q = (v: number, tot: number) => (tot > 0 ? Math.round((v / tot) * 10000) / 10000 : null)

export interface Visual {
  kind: 'chart' | 'table'
  spec: Record<string, unknown>
}

export interface ToolContext {
  meta: Meta
  livello: Livello
  filters: Filters
  selection: Selection
  apply: (s: { filters?: Filters; livello?: Livello; selection?: Selection }) => void
  show: (v: Visual) => void
}

type Args = Record<string, unknown>

const LIVELLI: Livello[] = ['ace', 'comune', 'provincia']
const asLivello = (v: unknown, fallback: Livello): Livello => (LIVELLI.includes(v as Livello) ? (v as Livello) : fallback)
const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [])

/** Filtri dell'agente → filtri della dashboard; senza argomento valgono quelli attivi. */
function toFilters(arg: unknown, current: Filters): Filters {
  if (arg == null || typeof arg !== 'object') return current
  const a = arg as Args
  const per = strs(a.periodo)
  return {
    ...EMPTY_FILTERS,
    periodo: per.length === 2 ? [per[0], per[1]].sort() : [],
    dow: Array.isArray(a.giorni_settimana) ? a.giorni_settimana.map(Number).filter((x) => x >= 1 && x <= 7) : [],
    fascia: strs(a.fasce).filter((x) => x in FASCE),
    motivo: strs(a.motivi).filter((x) => /^(residente|lavoratore|visitatore)>(residente|lavoratore|visitatore)$/.test(x)),
    origine: strs(a.origine).filter((x) => /^[pca]:\d+$/.test(x)),
    destinazione: strs(a.destinazione).filter((x) => /^[pca]:\d+$/.test(x)),
    genere: strs(a.genere),
    eta: strs(a.eta),
    nazionalita: strs(a.nazionalita),
    tipologia: strs(a.tipologia),
  }
}

function zonesOf(meta: Meta, livello: Livello) {
  const list = livello === 'ace' ? meta.ace : livello === 'comune' ? meta.zone : meta.province
  return new Map<number, { id: number; nome: string }>(list.map((z) => [z.id, z]))
}

function toSelection(a: Args, meta: Meta, livello: Livello): Selection {
  const zones = zonesOf(meta, livello)
  if (typeof a.zona === 'number' && zones.has(a.zona)) return { type: 'nodo', id: a.zona }
  const r = Array.isArray(a.relazione) ? a.relazione.map(Number) : []
  if (r.length === 2 && zones.has(r[0]) && zones.has(r[1]) && r[0] !== r[1]) return { type: 'link', a: r[0], b: r[1] }
  return null
}

/** Descrizione leggibile dei filtri, per il contesto e per le risposte degli strumenti. */
export function describeFilters(f: Filters, meta: Meta): string {
  const parts: string[] = []
  const zoneName = (t: string) => {
    const [k, id] = t.split(':')
    const lv: Livello = k === 'a' ? 'ace' : k === 'c' ? 'comune' : 'provincia'
    return zonesOf(meta, lv).get(Number(id))?.nome ?? t
  }
  if (f.periodo.length === 2) parts.push(`periodo ${f.periodo[0]} → ${f.periodo[1]}`)
  if (f.dow.length) parts.push(`giorni ${f.dow.map((d) => DOW[d - 1].short).join(', ')}`)
  if (f.fascia.length) parts.push(`fasce ${f.fascia.map((x) => FASCE[x]).join(', ')}`)
  if (f.motivo.length) parts.push(`motivi ${f.motivo.map((m) => m.split('>').map((x) => MOTIVI[x]).join('→')).join(', ')}`)
  if (f.origine.length) parts.push(`origine ${f.origine.map(zoneName).join(', ')} (${f.origine.join(', ')})`)
  if (f.destinazione.length) parts.push(`destinazione ${f.destinazione.map(zoneName).join(', ')} (${f.destinazione.join(', ')})`)
  if (f.genere.length) parts.push(`genere ${f.genere.join(', ')}`)
  if (f.eta.length) parts.push(`età ${f.eta.join(', ')}`)
  if (f.nazionalita.length) parts.push(`nazionalità ${f.nazionalita.join(', ')}`)
  if (f.tipologia.length) parts.push(`tipologia ${f.tipologia.join(', ')}`)
  if (f.xi.length) parts.push('esclusi gli spostamenti interni alle zone')
  return parts.length ? parts.join('; ') : 'nessun filtro'
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

async function findZones(a: Args, ctx: ToolContext) {
  const query = norm(String(a.query ?? '').trim())
  if (!query) return { errore: 'query vuota' }
  const levels: Livello[] = a.livello ? [asLivello(a.livello, ctx.livello)] : ['comune', 'provincia', 'ace']
  const out: unknown[] = []
  for (const lv of levels) {
    const list = lv === 'ace' ? ctx.meta.ace : lv === 'comune' ? ctx.meta.zone : ctx.meta.province
    const pref = lv === 'ace' ? 'a' : lv === 'comune' ? 'c' : 'p'
    const hits = list
      .filter((z) => norm(z.nome).includes(query))
      .sort((x, y) => Number(norm(y.nome) === query) - Number(norm(x.nome) === query) || x.nome.length - y.nome.length)
      .slice(0, lv === 'ace' ? 12 : 6)
    for (const z of hits)
      out.push({
        nome: z.nome,
        livello: lv,
        id: z.id,
        token: `${pref}:${z.id}`,
        provincia: 'prov_nome' in z ? z.prov_nome : 'regione' in z ? z.regione : undefined,
      })
  }
  return out.length ? { risultati: out } : { risultati: [], nota: 'nessuna zona trovata: prova con un nome diverso' }
}

function profile(s: Stats) {
  const tot = s.kpi.totale
  const sum = (r: Record<string, number>) => Object.values(r).reduce((x, y) => x + y, 0)
  const fasciaTot = s.per_fascia.reduce((x, r) => x + r.media, 0)
  const dowTot = s.per_dow.reduce((x, r) => x + (r.media ?? 0), 0)
  const motTot = s.motivi.reduce((x, r) => x + r.n, 0)
  const gen: Record<string, number> = {}
  for (const r of s.genere_eta) gen[r.genere] = (gen[r.genere] ?? 0) + r.n
  return {
    quota_per_fascia: Object.fromEntries(s.per_fascia.map((r) => [r.fascia, q(r.media, fasciaTot)])),
    quota_per_giorno_settimana: Object.fromEntries(s.per_dow.map((r) => [r.label, r.media == null ? null : q(r.media, dowTot)])),
    quota_genere: Object.fromEntries(Object.entries(gen).map(([k, v]) => [k, q(v, tot)])),
    quota_tipologia: Object.fromEntries(Object.entries(s.tipologia).map(([k, v]) => [k, q(v, sum(s.tipologia))])),
    quota_nazionalita: Object.fromEntries(Object.entries(s.nazionalita).map(([k, v]) => [k, q(v, sum(s.nazionalita))])),
    quota_motivi: Object.fromEntries(s.motivi.map((r) => [`${r.mo}>${r.md}`, q(r.n, motTot)])),
  }
}

async function getStatistics(a: Args, ctx: ToolContext) {
  const livello = asLivello(a.livello, ctx.livello)
  const f = toFilters(a.filtri, ctx.filters)
  const sel = toSelection(a, ctx.meta, livello)
  const s = await getJSON<Stats>(`/api/stats?${buildQuery(livello, f, sel)}`)
  const zones = zonesOf(ctx.meta, livello)
  const nd = s.n_giorni || 1
  const etaRows: Record<string, Record<string, number | string | null>> = {}
  for (const r of s.genere_eta) {
    etaRows[r.eta] ??= { eta: r.eta }
    etaRows[r.eta][r.genere] = n(r.n / nd)
  }
  const out: Record<string, unknown> = {
    contesto: {
      livello,
      filtri: describeFilters(f, ctx.meta),
      selezione: sel?.type === 'nodo' ? `zona ${zones.get(sel.id)?.nome}` : sel?.type === 'link' ? `relazione ${zones.get(sel.a)?.nome} ⇄ ${zones.get(sel.b)?.nome}` : 'intera area di studio',
      giorni_considerati: nd,
    },
    indicatori: {
      spostamenti_medi_giorno: n(s.kpi.media_giornaliera),
      spostamenti_periodo: n(s.kpi.totale),
      quota_di_scambio: s.kpi.quota_scambio,
      quota_stranieri: s.kpi.quota_internazionali,
      ...(s.kpi.nodo
        ? { bilancio_zona_medi_giorno: { uscita: n(s.kpi.nodo.uscita / nd), ingresso: n(s.kpi.nodo.ingresso / nd), interni: n(s.kpi.nodo.interni / nd) } }
        : {}),
    },
    per_data: s.giornaliero.map((r) => ({ data: r.giorno, giorno: DOW[r.dow - 1].short, spostamenti: n(r.n) })),
    media_per_giorno_settimana: s.per_dow.map((r) => ({ giorno: r.label, media: n(r.media) })),
    media_giornaliera_per_fascia: s.per_fascia.map((r) => {
      const fa = ctx.meta.fasce.find((x) => x.id === r.fascia)
      return { fascia: r.fascia, ore: fa ? `${fa.da}-${fa.a + 1}` : undefined, media: n(r.media) }
    }),
    media_giornaliera_per_eta_e_genere: Object.values(etaRows),
    ...profile(s),
  }
  if (sel?.type === 'link') out.direzioni = s.top_od.map((r) => ({ da: r.o_nome, a: r.d_nome, medi_giorno: n(r.media) }))
  if (sel) {
    // profilo medio dell'area (stessi filtri, senza selezione) per il confronto in quote
    const b = await getJSON<Stats>(`/api/stats?${buildQuery(livello, { ...f, origine: [], destinazione: [], xi: [] }, null)}`)
    out.profilo_medio_area = profile(b)
  }
  return out
}

async function getRelations(a: Args, ctx: ToolContext) {
  const livello = asLivello(a.livello, ctx.livello)
  const f = toFilters(a.filtri, ctx.filters)
  const zones = zonesOf(ctx.meta, livello)
  const zona = typeof a.zona === 'number' && zones.has(a.zona) ? a.zona : null
  const lim = Math.min(100, Math.max(1, Number(a.limite) || 20))
  const r = await getJSON<Relazioni>(`/api/relazioni?${buildQuery(livello, f, zona != null ? { type: 'nodo', id: zona } : null)}&k=${K}`)
  return {
    livello,
    filtri: describeFilters(f, ctx.meta),
    zona: zona != null ? zones.get(zona)?.nome : null,
    relazioni_sopra_soglia: r.relazioni.length,
    relazioni_sotto_soglia_escluse: r.sotto_soglia,
    relazioni: r.relazioni.slice(0, lim).map((x, i) => ({
      posizione: i + 1,
      origine: x.o_nome,
      id_origine: x.o,
      destinazione: x.d_nome,
      id_destinazione: x.d,
      medi_giorno: n(x.media),
      periodo: n(x.n),
      quota_sul_totale: q(x.n, r.totale),
    })),
  }
}

async function getZoneRanking(a: Args, ctx: ToolContext) {
  const livello = asLivello(a.livello, ctx.livello)
  const f = toFilters(a.filtri, ctx.filters)
  const metrica = ['uscita', 'ingresso', 'interni', 'totale'].includes(String(a.metrica)) ? String(a.metrica) : 'totale'
  const lim = Math.min(100, Math.max(1, Number(a.limite) || 15))
  const fl = await getJSON<Flows>(`/api/flows?${buildQuery(livello, f, null, { limit: 10 })}`)
  const zones = zonesOf(ctx.meta, livello)
  const val = (x: Flows['nodi'][number]) =>
    metrica === 'uscita' ? x.uscita : metrica === 'ingresso' ? x.ingresso : metrica === 'interni' ? x.interni : x.uscita + x.ingresso + x.interni
  const sorted = [...fl.nodi].sort((x, y) => (a.ordine === 'crescente' ? val(x) - val(y) : val(y) - val(x)))
  // in ordine crescente si escludono le zone sotto soglia: sarebbero tutte "<100" e non informative
  const list = a.ordine === 'crescente' ? sorted.filter((x) => val(x) >= K) : sorted
  return {
    livello,
    metrica: `${metrica} (spostamenti medi al giorno)`,
    filtri: describeFilters(f, ctx.meta),
    zone: list.slice(0, lim).map((x, i) => ({
      posizione: i + 1,
      zona: zones.get(x.id)?.nome ?? x.id,
      id: x.id,
      // le zone fuori dal Piemonte sono province a qualsiasi livello di zonizzazione
      fuori_regione: livello === 'provincia' ? !ctx.meta.province.find((p) => p.id === x.id)?.piemonte : x.id >= 900_000,
      valore: n(val(x)),
    })),
  }
}

async function aggregate(a: Args, ctx: ToolContext) {
  const campi = strs(a.campi)
  if (!campi.length) return { errore: 'indica almeno un campo' }
  const livello = asLivello(a.livello, ctx.livello)
  const f = toFilters(a.filtri, ctx.filters)
  const lim = Math.min(200, Math.max(1, Number(a.limite) || 50))
  const r = await getJSON<{ header: string[]; rows: (string | number)[][]; perdita: number; gruppi_esportati: number; gruppi_totali: number }>(
    `/api/export?${buildQuery(livello, f, null)}&campi=${campi.join(',')}&k=${K}&righe=1`,
  )
  const idx = r.header.map((h, i) => (h.startsWith('spostamenti') ? i : -1)).filter((i) => i >= 0)
  return {
    livello,
    filtri: describeFilters(f, ctx.meta),
    colonne: r.header,
    righe: r.rows.slice(0, lim).map((row) => row.map((v, i) => (idx.includes(i) ? n(Number(v)) : v))),
    righe_totali: r.gruppi_esportati,
    gruppi_esclusi_sotto_soglia: r.gruppi_totali - r.gruppi_esportati,
    perdita_informativa: Math.round(r.perdita * 1000) / 1000,
  }
}

export async function runTool(name: string, args: Args, ctx: ToolContext): Promise<unknown> {
  switch (name) {
    case 'find_zones':
      return findZones(args, ctx)
    case 'get_statistics':
      return getStatistics(args, ctx)
    case 'get_relations':
      return getRelations(args, ctx)
    case 'get_zone_ranking':
      return getZoneRanking(args, ctx)
    case 'aggregate':
      return aggregate(args, ctx)
    case 'render_chart':
      ctx.show({ kind: 'chart', spec: args })
      return { ok: true, nota: 'grafico mostrato all’utente' }
    case 'render_table':
      ctx.show({ kind: 'table', spec: args })
      return { ok: true, nota: 'tabella mostrata all’utente' }
    case 'apply_dashboard': {
      const livello = asLivello(args.livello, ctx.livello)
      const upd: { filters?: Filters; livello?: Livello; selection?: Selection } = {}
      if (args.filtri) upd.filters = toFilters(args.filtri, ctx.filters)
      if (args.livello) upd.livello = livello
      const sel = toSelection(args, ctx.meta, livello)
      if (sel || args.azzera_selezione) upd.selection = sel
      ctx.apply(upd)
      return { ok: true, applicato: { livello, filtri: upd.filters ? describeFilters(upd.filters, ctx.meta) : 'invariati', selezione: sel ?? (args.azzera_selezione ? 'nessuna' : 'invariata') } }
    }
    default:
      return { errore: `strumento sconosciuto: ${name}` }
  }
}

/** Etichetta mostrata nella chat mentre uno strumento è in esecuzione. */
export const TOOL_LABEL: Record<string, [string, string]> = {
  find_zones: ['Cerco le zone', 'Looking up zones'],
  get_statistics: ['Calcolo statistiche e profili', 'Computing statistics and profiles'],
  get_relations: ['Analizzo le relazioni', 'Analysing relations'],
  get_zone_ranking: ['Confronto le zone', 'Comparing zones'],
  aggregate: ['Aggrego i dati', 'Aggregating data'],
  render_chart: ['Preparo il grafico', 'Preparing the chart'],
  render_table: ['Preparo la tabella', 'Preparing the table'],
  apply_dashboard: ['Aggiorno la dashboard', 'Updating the dashboard'],
}
