import { useEffect, useMemo, useRef, useState } from 'react'
import DeckGL, { type DeckGLRef } from '@deck.gl/react'
import { GeoJsonLayer, PathLayer, ScatterplotLayer, TextLayer } from '@deck.gl/layers'
import { FlyToInterpolator, WebMercatorViewport, type MapViewState, type PickingInfo } from '@deck.gl/core'
import MapGL from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { Flows, Livello, Selection } from '../api'
import { fmt } from '../labels'
import { isStatic } from '../local/client'

type RGBA = [number, number, number, number]
type Feature = { type: 'Feature'; properties: Record<string, any>; geometry: any }
type FC = { type: 'FeatureCollection'; features: Feature[] }

export interface NodeInfo {
  id: number
  nome: string
  lon: number
  lat: number
}

interface Props {
  livello: Livello
  flows: Flows | null
  nodes: Map<number, NodeInfo>
  aree: FC | null // poligoni del livello fine attivo: ACE o comuni
  province: FC | null
  selection: Selection
  onSelect: (s: Selection) => void
  extraRegionOffset: number
  /** Massimi fissi per archi e nodi: durante il playback la scala non cambia da un fotogramma all'altro. */
  scale?: { arc: number; node: number } | null
  basemap?: Basemap
}

export type Basemap = 'chiara' | 'strade' | 'satellite'
export const BASEMAPS: { id: Basemap; label: string }[] = [
  { id: 'chiara', label: 'Chiara' },
  { id: 'strade', label: 'Strade' },
  { id: 'satellite', label: 'Satellite' },
]
/** La mappa di base usa tessere esterne: esclusa solo dove l'hosting le blocca (Artifact claude.ai). */
export const BASEMAP_DISPONIBILE = !isStatic || import.meta.env.VITE_BASEMAP === '1'

const STYLES: Record<Basemap, string | object> = {
  chiara: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  strade: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
  satellite: {
    version: 8,
    sources: {
      esri: {
        type: 'raster',
        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
        tileSize: 256,
        maxzoom: 19,
        attribution: 'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
      },
    },
    layers: [{ id: 'esri', type: 'raster', source: 'esri' }],
  },
}
const INITIAL_VIEW = { longitude: 7.95, latitude: 45.05, zoom: 7.3, pitch: 0, bearing: 0 }

const OUT: RGBA = [242, 140, 40, 220]
const IN: RGBA = [111, 66, 193, 210]
const NEUTRAL_LO: RGBA = [246, 178, 107, 30]
const NEUTRAL_HI: RGBA = [224, 108, 0, 240]

const lerp = (a: RGBA, b: RGBA, t: number): RGBA => a.map((v, i) => Math.round(v + (b[i] - v) * t)) as RGBA
// l'opacità cresce con il volume: i flussi minori restano sullo sfondo
const withAlpha = (c: RGBA, t: number): RGBA => [c[0], c[1], c[2], Math.round(40 + 210 * t)]

/** Curva quadratica tra due punti, piegata a sinistra della direzione: A→B e B→A restano distinguibili. */
function curve(a: [number, number], b: [number, number], steps = 24): [number, number][] {
  const k = Math.cos(((a[1] + b[1]) / 2) * (Math.PI / 180))
  const dx = (b[0] - a[0]) * k
  const dy = b[1] - a[1]
  const c: [number, number] = [(a[0] + b[0]) / 2 + (-dy * 0.18) / k, (a[1] + b[1]) / 2 + dx * 0.18]
  const pts: [number, number][] = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const u = 1 - t
    pts.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]])
  }
  return pts
}

interface Arc {
  o: number
  d: number
  n: number
  path: [number, number][]
  color: RGBA
  width: number
}

export default function FlowMap({ livello, flows, nodes, aree, province, selection, onSelect, extraRegionOffset, scale, basemap = 'chiara' }: Props) {
  // zoom arrotondato a 0,5: basta per distanziare le etichette senza ricalcolarle a ogni frame
  const [zoom, setZoom] = useState(INITIAL_VIEW.zoom)

  const nodeTotals = useMemo(() => {
    const m = new Map<number, { uscita: number; ingresso: number; interni: number; tot: number }>()
    for (const n of flows?.nodi ?? []) m.set(n.id, { ...n, tot: n.uscita + n.ingresso + n.interni })
    return m
  }, [flows])

  const arcs = useMemo<Arc[]>(() => {
    if (!flows) return []
    const max = scale?.arc ?? Math.max(1, ...flows.flussi.map((f) => f.n))
    const selNode = selection?.type === 'nodo' ? selection.id : null
    const out: Arc[] = []
    for (const f of flows.flussi) {
      const a = nodes.get(f.o)
      const b = nodes.get(f.d)
      if (!a || !b) continue
      const t = Math.min(1, Math.sqrt(f.n / max))
      const color =
        selNode != null
          ? withAlpha(f.o === selNode ? OUT : IN, t)
          : selection?.type === 'link'
            ? withAlpha(f.o === selection.a ? OUT : IN, Math.max(t, 0.7))
            : lerp(NEUTRAL_LO, NEUTRAL_HI, t)
      out.push({ ...f, path: curve([a.lon, a.lat], [b.lon, b.lat]), color, width: 1 + t * 11 })
    }
    return out.reverse() // i flussi maggiori disegnati per ultimi, sopra gli altri
  }, [flows, nodes, selection, scale])

  const maxTot = useMemo(
    () => scale?.node ?? Math.max(1, ...[...nodeTotals.values()].map((v) => v.tot)),
    [nodeTotals, scale],
  )
  // Punti solo per le zone toccate dai flussi visibili: il volume di tutte le altre è nel riempimento delle aree
  const nodeList = useMemo(() => {
    const visible = new Set<number>(arcs.flatMap((a) => [a.o, a.d]))
    if (selection?.type === 'nodo') visible.add(selection.id)
    // con pochi flussi tra zone diverse (es. origine e destinazione nello stesso comune) si mostrano
    // anche le zone con soli spostamenti interni, altrimenti la mappa resterebbe vuota
    if (arcs.length < 20) for (const [id, t] of nodeTotals) if (t.interni > 0) visible.add(id)
    return [...nodeTotals.entries()]
      .filter(([id]) => visible.has(id))
      .map(([id, t]) => ({ ...t, info: nodes.get(id)! }))
      .filter((n) => n.info)
      .sort((a, b) => b.tot - a.tot)
  }, [nodeTotals, nodes, arcs, selection])

  const selKey = selection?.type === 'nodo' ? [selection.id] : selection?.type === 'link' ? [selection.a, selection.b] : []
  const labels = useMemo(() => {
    // le zone selezionate hanno sempre l'etichetta, le altre solo se non si sovrappongono
    const picked: typeof nodeList = nodeList.filter((n) => selKey.includes(n.info.id))
    // distanza minima tra etichette: ~90 px sullo schermo, convertiti in gradi allo zoom corrente
    const minDist = (90 * 360) / (256 * 2 ** zoom)
    for (const n of nodeList) {
      if (picked.length >= 16) break
      const far = picked.every((p) => Math.hypot(p.info.lon - n.info.lon, p.info.lat - n.info.lat) > minDist)
      if (far && !picked.includes(n)) picked.push(n)
    }
    return picked
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeList, zoom, selKey.join(',')])

  const selectedIds = new Set<number>(
    selection?.type === 'nodo' ? [selection.id] : selection?.type === 'link' ? [selection.a, selection.b] : [],
  )

  const zoneId = (f: Feature, kind: 'aree' | 'provincia'): number => {
    if (kind === 'aree') return f.properties.id
    if (livello === 'provincia') return f.properties.id
    return f.properties.piemonte ? -1 : extraRegionOffset + f.properties.id
  }

  // aree neutre: il volume è già nei nodi e nei flussi; il colore evidenzia solo le zone selezionate
  const fillFor = (id: number): RGBA => {
    if (selectedIds.has(id)) return [242, 140, 40, 90]
    // sopra strade e satellite le aree restano quasi trasparenti (ma cliccabili)
    if (BASEMAP_DISPONIBILE && basemap !== 'chiara') return [255, 255, 255, basemap === 'satellite' ? 1 : 30]
    return nodeTotals.has(id) ? [255, 255, 255, 110] : [255, 255, 255, 40]
  }

  const sat = BASEMAP_DISPONIBILE && basemap === 'satellite'
  const layers = [
    new GeoJsonLayer({
      id: 'province',
      data: province ?? { type: 'FeatureCollection', features: [] },
      stroked: true,
      filled: true,
      pickable: true,
      getLineColor: (f: any) => (sat ? [255, 255, 255, f.properties.piemonte ? 230 : 140] : f.properties.piemonte ? [60, 60, 60, 200] : [120, 120, 120, 120]),
      getLineWidth: (f: any) => (f.properties.piemonte ? 1.6 : 0.8),
      lineWidthUnits: 'pixels',
      getFillColor: (f: any) => {
        const id = zoneId(f, 'provincia')
        return livello === 'provincia' || !f.properties.piemonte ? fillFor(id) : [0, 0, 0, 0]
      },
      updateTriggers: { getFillColor: [livello, flows, selection, basemap], getLineColor: [basemap] },
    }),
    livello !== 'provincia' &&
      new GeoJsonLayer({
        id: 'aree',
        data: aree ?? { type: 'FeatureCollection', features: [] },
        stroked: true,
        filled: true,
        pickable: true,
        autoHighlight: true,
        highlightColor: [242, 140, 40, 70],
        getLineColor: sat ? [255, 255, 255, 110] : [150, 150, 150, 90],
        getLineWidth: 0.5,
        lineWidthUnits: 'pixels',
        getFillColor: (f: any) => fillFor(f.properties.id),
        updateTriggers: { getFillColor: [flows, selection, livello, basemap], getLineColor: [basemap] },
      }),
    new PathLayer<Arc>({
      id: 'flussi',
      data: arcs,
      pickable: true,
      autoHighlight: true,
      highlightColor: [30, 30, 30, 230],
      widthUnits: 'pixels',
      capRounded: true,
      jointRounded: true,
      getPath: (d) => d.path,
      getColor: (d) =>
        selection?.type === 'link' && !(selectedIds.has(d.o) && selectedIds.has(d.d)) ? [180, 180, 180, 60] : d.color,
      getWidth: (d) => d.width,
      updateTriggers: { getColor: [selection] },
    }),
    new ScatterplotLayer({
      id: 'nodi',
      data: nodeList,
      pickable: true,
      radiusUnits: 'pixels',
      stroked: true,
      getPosition: (d: any) => [d.info.lon, d.info.lat],
      getRadius: (d: any) => 3 + 15 * Math.sqrt(Math.min(1, d.tot / maxTot)),
      getFillColor: (d: any) =>
        selectedIds.has(d.info.id) ? [242, 140, 40, 255] : [40, 40, 40, Math.round(70 + 170 * Math.sqrt(Math.min(1, d.tot / maxTot)))],
      getLineColor: [255, 255, 255, 255],
      lineWidthMinPixels: 1,
      updateTriggers: { getFillColor: [selection, maxTot] },
    }),
    new TextLayer({
      id: 'etichette',
      data: labels,
      getPosition: (d: any) => [d.info.lon, d.info.lat],
      getText: (d: any) => d.info.nome,
      getSize: 11,
      getColor: [20, 20, 20, 255],
      getPixelOffset: (d: any) => [0, -(9 + 15 * Math.sqrt(Math.min(1, d.tot / maxTot)))],
      fontFamily: 'Montserrat, Helvetica Neue, Arial, sans-serif',
      fontWeight: 600,
      outlineWidth: 3,
      outlineColor: [255, 255, 255, 230],
      fontSettings: { sdf: true },
      characterSet: 'auto',
    }),
  ].filter(Boolean)

  const describe = (info: PickingInfo): string | null => {
    if (!info.object) return null
    const o: any = info.object
    const layer = info.layer?.id
    if (layer === 'flussi') {
      const back = flows?.flussi.find((f) => f.o === o.d && f.d === o.o)
      return `${nodes.get(o.o)?.nome} → ${nodes.get(o.d)?.nome}\n${fmt(o.n)} spostamenti/giorno${
        back ? `\n(ritorno: ${fmt(back.n)})` : ''
      }`
    }
    const id = layer === 'nodi' ? o.info.id : zoneId(o, layer === 'aree' ? 'aree' : 'provincia')
    const t = nodeTotals.get(id)
    const nome = nodes.get(id)?.nome
    if (!nome || !t) return null
    return `${nome}\nIn uscita: ${fmt(t.uscita)} · In ingresso: ${fmt(t.ingresso)}\nInterni: ${fmt(t.interni)} (medi/giorno)`
  }

  const onClick = (info: PickingInfo) => {
    const o: any = info.object
    if (!o) return onSelect(null)
    const layer = info.layer?.id
    if (layer === 'flussi') {
      const same = selection?.type === 'link' && selectedIds.has(o.o) && selectedIds.has(o.d)
      return onSelect(same ? null : { type: 'link', a: o.o, b: o.d })
    }
    const id = layer === 'nodi' ? o.info.id : zoneId(o, layer === 'aree' ? 'aree' : 'provincia')
    if (id < 0 || !nodes.has(id)) return
    onSelect(selection?.type === 'nodo' && selection.id === id ? null : { type: 'nodo', id })
  }

  // Il click è gestito sul contenitore con picking esplicito: più affidabile dell'evento tap di deck.gl,
  // e un trascinamento della mappa (pan) non viene interpretato come selezione.
  const deckRef = useRef<DeckGLRef>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const downAt = useRef<[number, number] | null>(null)
  const [viewState, setViewState] = useState<MapViewState>(INITIAL_VIEW)

  // Selezionando una relazione la mappa inquadra le due zone
  const linkKey = selection?.type === 'link' ? `${selection.a}-${selection.b}` : null
  useEffect(() => {
    if (selection?.type !== 'link' || !wrapRef.current) return
    const a = nodes.get(selection.a)
    const b = nodes.get(selection.b)
    if (!a || !b) return
    const { clientWidth: width, clientHeight: height } = wrapRef.current
    const pad = 0.02
    const fit = new WebMercatorViewport({ width, height }).fitBounds(
      [
        [Math.min(a.lon, b.lon) - pad, Math.min(a.lat, b.lat) - pad],
        [Math.max(a.lon, b.lon) + pad, Math.max(a.lat, b.lat) + pad],
      ],
      { padding: Math.min(160, width / 5) },
    )
    setViewState({
      longitude: fit.longitude,
      latitude: fit.latitude,
      zoom: Math.min(fit.zoom, 11),
      pitch: 0,
      bearing: 0,
      transitionDuration: 900,
      transitionInterpolator: new FlyToInterpolator(),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkKey, nodes])

  // Al livello ACE le zone sono piccole: selezionandone una la mappa si avvicina
  const nodeKey = selection?.type === 'nodo' && livello === 'ace' ? selection.id : null
  useEffect(() => {
    if (nodeKey == null) return
    const z = nodes.get(nodeKey)
    if (!z) return
    setViewState({
      longitude: z.lon,
      latitude: z.lat,
      zoom: Math.max(zoom, 10),
      pitch: 0,
      bearing: 0,
      transitionDuration: 900,
      transitionInterpolator: new FlyToInterpolator(),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeKey, nodes])
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const start = downAt.current
    if (!start || Math.hypot(e.clientX - start[0], e.clientY - start[1]) > 5) return
    const rect = e.currentTarget.getBoundingClientRect()
    const info = deckRef.current?.pickObject({ x: e.clientX - rect.left, y: e.clientY - rect.top, radius: 4 })
    onClick(info ?? ({ object: null } as unknown as PickingInfo))
  }

  return (
    <div
      className="map-wrap"
      ref={wrapRef}
      onMouseDown={(e) => (downAt.current = [e.clientX, e.clientY])}
      onClick={handleClick}
    >
      <DeckGL
        ref={deckRef}
        initialViewState={viewState}
        onViewStateChange={({ viewState: vs }) => {
          const z = Math.round((vs as MapViewState).zoom * 2) / 2
          if (z !== zoom) setZoom(z)
        }}
        controller={{ doubleClickZoom: false }}
        layers={layers}
        getCursor={({ isHovering }) => (isHovering ? 'pointer' : 'grab')}
        getTooltip={(info) => {
          const text = describe(info)
          return text ? { text, className: 'deck-tip' } : null
        }}
      >
        {BASEMAP_DISPONIBILE && <MapGL mapStyle={STYLES[basemap] as string} />}
      </DeckGL>
    </div>
  )
}
