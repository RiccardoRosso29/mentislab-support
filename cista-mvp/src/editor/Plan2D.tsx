import { useEffect, useMemo, useRef, useState } from 'react';
import type { Dimension, Fixture, Item, Opening, Project, Vec } from '../model/types';
import { useStore, type Tool } from '../model/store';
import { add, dist, fmtCm, labelPoint, mul, norm, perp, sub, uid, v } from '../model/geometry';
import { addWall, changeWallLength, ensureNode, moveNode, roomArea, roomPolygon, snapToWall, solidSpans, wallGeom } from '../model/project';
import { defOf, newItem, zonesOf, type Part } from '../model/furniture';
import { addFixtureAt, addItem, addOpeningAt, clearances, collisions, slideOpening } from '../model/edit';
import { track } from '../model/analytics';

type ViewT = { s: number; tx: number; ty: number };
type Drag =
  | { mode: 'pan'; sx: number; sy: number; t: ViewT }
  | { mode: 'item' | 'fixture'; id: string; start: Vec; orig: { x: number; y: number }; moved: boolean }
  | { mode: 'node'; id: string; moved: boolean }
  | { mode: 'wall'; id: string; start: Vec; a: Vec; b: Vec; moved: boolean }
  | { mode: 'opening'; id: string; moved: boolean }
  | { mode: 'room-rect'; start: Vec; cur: Vec }
  | { mode: 'pinch'; d0: number; t: ViewT; mid: Vec };

const MAT_2D: Record<Part['mat'], string> = {
  main: '',
  cushion: '',
  wood: '#c9a77d',
  metal: '#aeb4b8',
  white: '#f2f1ec',
  dark: '#4a4f54',
  glass: '#cfe3ee',
  ceramic: '#fbfbf9',
  linen: '#efece6',
  screen: '#24292e',
  green: '#7a9a55',
};

export default function Plan2D({ fitKey }: { fitKey: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const project = useStore((s) => s.project);
  const sel = useStore((s) => s.sel);
  const tool = useStore((s) => s.tool);
  const placeType = useStore((s) => s.placeType);
  const showZones = useStore((s) => s.showZones);
  const wallKind = useStore((s) => s.wallKind);
  const wallThickness = useStore((s) => s.wallThickness);
  const { apply, checkpoint, select, setTool } = useStore.getState();

  const [t, setT] = useState<ViewT>({ s: 0.8, tx: 40, ty: 40 });
  const [cursor, setCursor] = useState<Vec | null>(null);
  const [guides, setGuides] = useState<{ x?: number; y?: number }>({});
  const [chain, setChain] = useState<{ pts: Vec[]; first?: string } | null>(null);
  const [typed, setTyped] = useState('');
  const [measure, setMeasure] = useState<Vec | null>(null);
  const [calib, setCalib] = useState<Vec[]>([]);
  const [calibAsk, setCalibAsk] = useState<{ a: Vec; b: Vec } | null>(null);
  const [quote, setQuote] = useState<{ wallId: string; value: string; current: number; at: Vec } | null>(null);
  const drag = useRef<Drag | null>(null);
  const pointers = useRef(new Map<number, Vec>());
  const [, force] = useState(0);

  // adatta la vista al progetto quando cambia progetto
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const pts = project.nodes.length ? project.nodes : [{ x: 0, y: 0 }, { x: 800, y: 600 }];
    const xs = pts.map((n) => n.x);
    const ys = pts.map((n) => n.y);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const r = el.getBoundingClientRect();
    const s = Math.min((r.width - 60) / Math.max(200, x1 - x0), (r.height - 60) / Math.max(200, y1 - y0));
    setT({ s, tx: (r.width - (x1 - x0) * s) / 2 - x0 * s, ty: (r.height - (y1 - y0) * s) / 2 - y0 * s });
  }, [fitKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const toW = (e: { clientX: number; clientY: number }): Vec => {
    const r = svgRef.current!.getBoundingClientRect();
    return v((e.clientX - r.left - t.tx) / t.s, (e.clientY - r.top - t.ty) / t.s);
  };

  /** aggancio: nodi, allineamento con i nodi, angoli multipli di 45° dal punto precedente, griglia di 5 cm */
  const snapPt = (pt: Vec, from?: Vec, free = false): { p: Vec; g: { x?: number; y?: number } } => {
    if (free) return { p: pt, g: {} };
    const tol = 12 / t.s;
    const near = project.nodes.find((n) => dist(n, pt) < tol);
    if (near) return { p: v(near.x, near.y), g: {} };
    let p = pt;
    if (from) {
      const d = sub(pt, from);
      const ang = Math.atan2(d.y, d.x);
      const step = Math.PI / 4;
      const sa = Math.round(ang / step) * step;
      if (Math.abs(sa - ang) < 0.12) {
        const l = Math.round(Math.hypot(d.x, d.y));
        p = add(from, v(Math.cos(sa) * l, Math.sin(sa) * l));
      }
    }
    const g: { x?: number; y?: number } = {};
    for (const n of project.nodes) {
      if (g.x == null && Math.abs(n.x - p.x) < 8 / t.s) {
        p = v(n.x, p.y);
        g.x = n.x;
      }
      if (g.y == null && Math.abs(n.y - p.y) < 8 / t.s) {
        p = v(p.x, n.y);
        g.y = n.y;
      }
    }
    if (g.x == null && !from) p = v(Math.round(p.x / 5) * 5, p.y);
    if (g.y == null && !from) p = v(p.x, Math.round(p.y / 5) * 5);
    return { p, g };
  };

  const hitOf = (e: React.PointerEvent | React.MouseEvent) => {
    const el = (e.target as Element).closest('[data-k]') as HTMLElement | null;
    return el ? { k: el.dataset.k!, id: el.dataset.id! } : null;
  };

  const finishChain = () => {
    setChain(null);
    setTyped('');
  };

  const addChainPoint = (p: Vec) => {
    if (!chain) {
      const r = ensureNode(project, p, 0.5);
      if (r.p !== project) apply(() => r.p);
      setChain({ pts: [p], first: r.id });
      return;
    }
    const last = chain.pts[chain.pts.length - 1];
    if (dist(last, p) < 1) return;
    const firstNode = chain.first ? project.nodes.find((n) => n.id === chain.first) : undefined;
    const closes = firstNode && chain.pts.length >= 3 && dist(firstNode, p) < 1;
    apply((pr) => addWall(pr, last, p, { thickness: wallThickness, kind: wallKind }).p);
    track('wall_drawn');
    if (closes) {
      // ciclo chiuso: nuova stanza dai nodi della catena
      apply((pr) => {
        const ids = chain.pts.map((q) => pr.nodes.find((n) => dist(n, q) < 0.6)!.id);
        const room = { id: uid('r'), name: `Stanza ${pr.rooms.length + 1}`, floor: 'parquet' as const, nodeIds: ids };
        return { ...pr, rooms: [...pr.rooms, room] };
      }, false);
      track('room_closed');
      finishChain();
      return;
    }
    setChain({ ...chain, pts: [...chain.pts, p] });
    setTyped('');
  };

  // ---------- puntatore ----------
  const onDown = (e: React.PointerEvent) => {
    // un clic nella pianta toglie il fuoco ai pulsanti, così Invio e le cifre arrivano all'editor
    (document.activeElement as HTMLElement | null)?.blur?.();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, v(e.clientX, e.clientY));
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      drag.current = { mode: 'pinch', d0: dist(a, b), t, mid: mul(add(a, b), 0.5) };
      return;
    }
    const w = toW(e);
    const hit = hitOf(e);
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      drag.current = { mode: 'pan', sx: e.clientX, sy: e.clientY, t };
      return;
    }
    if (tool === 'wall') {
      const from = chain?.pts[chain.pts.length - 1];
      addChainPoint(snapPt(w, from, e.shiftKey).p);
      return;
    }
    if (tool === 'room') {
      const p = snapPt(w).p;
      drag.current = { mode: 'room-rect', start: p, cur: p };
      return;
    }
    if (tool === 'door' || tool === 'sliding' || tool === 'gap' || tool === 'window' || tool === 'window-fixed') {
      const r = addOpeningAt(project, tool, w);
      if (r) {
        apply(() => r.p);
        select({ kind: 'opening', id: r.id });
        setTool('select');
      }
      return;
    }
    if (tool === 'pillar' || tool === 'radiator' || tool === 'outlet' || tool === 'obstacle' || tool === 'closet') {
      const r = addFixtureAt(project, tool, snapPt(w).p);
      apply(() => r.p);
      select({ kind: 'fixture', id: r.id });
      setTool('select');
      return;
    }
    if (tool === 'place' && placeType) {
      const it = newItem(placeType, w.x, w.y, 0);
      apply((p) => addItem(p, it));
      select({ kind: 'item', id: it.id });
      track('item_placed', { type: placeType });
      setTool('select');
      return;
    }
    if (tool === 'measure') {
      const p = snapPt(w).p;
      if (!measure) setMeasure(p);
      else {
        const d: Dimension = { id: uid('d'), a: measure, b: p, offset: 0, measured: false };
        apply((pr) => ({ ...pr, dims: [...pr.dims, d] }));
        select({ kind: 'dim', id: d.id });
        setMeasure(null);
      }
      return;
    }
    if (tool === 'calibrate') {
      const pts = [...calib, w];
      if (pts.length === 2) {
        setCalibAsk({ a: pts[0], b: pts[1] });
        setCalib([]);
      } else setCalib(pts);
      return;
    }
    // selezione
    if (!hit) {
      select(null);
      drag.current = { mode: 'pan', sx: e.clientX, sy: e.clientY, t };
      return;
    }
    if (hit.k === 'quote') {
      const wl = project.walls.find((x) => x.id === hit.id)!;
      const g = wallGeom(project, wl);
      const cur = Number((e.target as Element).closest('[data-len]')?.getAttribute('data-len') ?? g.length);
      const r = svgRef.current!.getBoundingClientRect();
      setQuote({ wallId: hit.id, value: String(Math.round(cur * 10) / 10).replace('.', ','), current: cur, at: v(Math.min(e.clientX - r.left, r.width - 230), Math.min(e.clientY - r.top, r.height - 150)) });
      return;
    }
    select({ kind: hit.k as never, id: hit.id });
    if (hit.k === 'item') {
      const it = project.items.find((i) => i.id === hit.id)!;
      if (!it.fixed) drag.current = { mode: 'item', id: it.id, start: w, orig: { x: it.x, y: it.y }, moved: false };
    } else if (hit.k === 'fixture') {
      const f = project.fixtures.find((i) => i.id === hit.id)!;
      drag.current = { mode: 'fixture', id: f.id, start: w, orig: { x: f.x, y: f.y }, moved: false };
    } else if (hit.k === 'node') {
      drag.current = { mode: 'node', id: hit.id, moved: false };
    } else if (hit.k === 'wall') {
      const wl = project.walls.find((x) => x.id === hit.id)!;
      const g = wallGeom(project, wl);
      drag.current = { mode: 'wall', id: hit.id, start: w, a: g.a, b: g.b, moved: false };
    } else if (hit.k === 'opening') {
      drag.current = { mode: 'opening', id: hit.id, moved: false };
    }
  };

  const onMove = (e: React.PointerEvent) => {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, v(e.clientX, e.clientY));
    const w = toW(e);
    const dr = drag.current;
    if (dr?.mode === 'pinch' && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const k = dist(a, b) / dr.d0;
      const r = svgRef.current!.getBoundingClientRect();
      const mx = dr.mid.x - r.left;
      const my = dr.mid.y - r.top;
      const s = Math.min(6, Math.max(0.08, dr.t.s * k));
      setT({ s, tx: mx - ((mx - dr.t.tx) / dr.t.s) * s, ty: my - ((my - dr.t.ty) / dr.t.s) * s });
      return;
    }
    const from = tool === 'wall' ? chain?.pts[chain.pts.length - 1] : undefined;
    const sp = snapPt(w, from, e.shiftKey);
    setCursor(tool === 'wall' || tool === 'room' || tool === 'measure' ? sp.p : w);
    setGuides(tool === 'wall' || tool === 'room' || dr?.mode === 'node' ? sp.g : {});
    if (!dr) return;
    if (dr.mode === 'pan') {
      setT({ ...dr.t, tx: dr.t.tx + e.clientX - dr.sx, ty: dr.t.ty + e.clientY - dr.sy });
      return;
    }
    if (dr.mode === 'room-rect') {
      drag.current = { ...dr, cur: sp.p };
      force((n) => n + 1);
      return;
    }
    const begin = () => {
      if (!('moved' in dr) || dr.moved) return;
      checkpoint();
      dr.moved = true;
    };
    if (dr.mode === 'item') {
      begin();
      apply((p) => {
        const it = p.items.find((i) => i.id === dr.id)!;
        let next: Item = { ...it, x: dr.orig.x + w.x - dr.start.x, y: dr.orig.y + w.y - dr.start.y };
        if (!e.shiftKey) next = snapToWall(p, next, 18) ?? next;
        return { ...p, items: p.items.map((i) => (i.id === dr.id ? next : i)) };
      }, false);
    } else if (dr.mode === 'fixture') {
      begin();
      apply((p) => {
        const f = p.fixtures.find((i) => i.id === dr.id)!;
        let next: Fixture = { ...f, x: dr.orig.x + w.x - dr.start.x, y: dr.orig.y + w.y - dr.start.y };
        if (!e.shiftKey && f.kind !== 'pillar') next = snapToWall(p, next, 18) ?? next;
        return { ...p, fixtures: p.fixtures.map((i) => (i.id === dr.id ? next : i)) };
      }, false);
    } else if (dr.mode === 'node') {
      begin();
      apply((p) => moveNode(p, dr.id, sp.p), false);
    } else if (dr.mode === 'wall') {
      begin();
      const g = wallGeom(project, project.walls.find((x) => x.id === dr.id)!);
      const k = Math.round((w.x - dr.start.x) * g.n.x + (w.y - dr.start.y) * g.n.y);
      const shift = mul(g.n, k);
      apply((p) => {
        const wl = p.walls.find((x) => x.id === dr.id)!;
        return moveNode(moveNode(p, wl.a, add(dr.a, shift)), wl.b, add(dr.b, shift));
      }, false);
    } else if (dr.mode === 'opening') {
      begin();
      apply((p) => slideOpening(p, dr.id, w), false);
    }
  };

  const onUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    const dr = drag.current;
    drag.current = null;
    if (dr?.mode === 'room-rect') {
      const a = dr.start;
      const b = dr.cur;
      if (Math.abs(a.x - b.x) > 40 && Math.abs(a.y - b.y) > 40) {
        const corners = [a, v(b.x, a.y), b, v(a.x, b.y)];
        apply((pr) => {
          let p = pr;
          for (let i = 0; i < 4; i++) p = addWall(p, corners[i], corners[(i + 1) % 4], { thickness: wallThickness, kind: wallKind }).p;
          const ids = corners.map((c) => p.nodes.find((n) => dist(n, c) < 0.6)!.id);
          return { ...p, rooms: [...p.rooms, { id: uid('r'), name: `Stanza ${p.rooms.length + 1}`, floor: 'parquet', nodeIds: ids }] };
        });
        track('room_closed');
        setTool('select');
      }
      force((n) => n + 1);
    }
  };

  const onWheel = (e: React.WheelEvent) => {
    const r = svgRef.current!.getBoundingClientRect();
    const mx = e.clientX - r.left;
    const my = e.clientY - r.top;
    const s = Math.min(6, Math.max(0.08, t.s * Math.exp(-e.deltaY * 0.0015)));
    setT({ s, tx: mx - ((mx - t.tx) / t.s) * s, ty: my - ((my - t.ty) / t.s) * s });
  };

  // ---------- tastiera ----------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (tool === 'wall' && chain) {
        if (/^[0-9]$/.test(e.key) || e.key === ',' || e.key === '.') {
          setTyped((s) => s + (e.key === '.' ? ',' : e.key));
          e.preventDefault();
          return;
        }
        if (e.key === 'Backspace') {
          setTyped((s) => s.slice(0, -1));
          e.preventDefault();
          return;
        }
        if (e.key === 'Enter' && typed && cursor) {
          const last = chain.pts[chain.pts.length - 1];
          const dir = norm(sub(cursor, last));
          const len = parseFloat(typed.replace(',', '.'));
          if (len > 0) addChainPoint(add(last, mul(dir, len)));
          e.preventDefault();
          return;
        }
      }
      if (e.key === 'Escape') {
        if (chain) finishChain();
        setMeasure(null);
        setCalib([]);
        setTool('select');
        drag.current = null;
      }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  });

  // ---------- dati derivati ----------
  const bad = useMemo(() => collisions(project), [project]);
  const selItem = sel?.kind === 'item' ? project.items.find((i) => i.id === sel.id) : undefined;
  const clr = useMemo(() => (selItem ? clearances(project, selItem) : []), [project, selItem]);
  const fs = (px: number) => px / t.s;

  const roomDrag = drag.current?.mode === 'room-rect' ? drag.current : null;
  const lastChain = chain?.pts[chain.pts.length - 1];
  const previewEnd = (() => {
    if (!lastChain || !cursor) return null;
    if (!typed) return cursor;
    const len = parseFloat(typed.replace(',', '.'));
    return len > 0 ? add(lastChain, mul(norm(sub(cursor, lastChain)), len)) : cursor;
  })();

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <svg
        ref={svgRef}
        className="plan"
        data-testid="plan"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onWheel={onWheel}
        onDoubleClick={() => chain && finishChain()}
        style={{ cursor: tool === 'select' ? 'default' : 'crosshair' }}
      >
        <defs>
          <pattern id="grid" width={50} height={50} patternUnits="userSpaceOnUse">
            <path d="M50 0H0V50" fill="none" stroke="var(--line)" strokeWidth={0.6} vectorEffect="non-scaling-stroke" />
          </pattern>
        </defs>
        <g transform={`translate(${t.tx} ${t.ty}) scale(${t.s})`}>
          <rect x={-5000} y={-5000} width={10000} height={10000} fill="url(#grid)" />
          {project.background?.visible && (
            <image
              href={project.background.src}
              x={project.background.x}
              y={project.background.y}
              width={project.background.naturalW * project.background.scale}
              height={project.background.naturalH * project.background.scale}
              opacity={project.background.opacity}
              preserveAspectRatio="none"
              style={{ pointerEvents: 'none' }}
            />
          )}
          <Rooms p={project} sel={sel} fs={fs} />
          {project.fixtures.map((f) => (
            <FixtureShape key={f.id} f={f} selected={sel?.kind === 'fixture' && sel.id === f.id} fs={fs} showZone={showZones} showLabel={t.s > 1.3 || (sel?.kind === 'fixture' && sel.id === f.id)} />
          ))}
          {project.items.map((it) => (
            <ItemShape key={it.id} it={it} selected={sel?.kind === 'item' && sel.id === it.id} bad={bad.has(it.id)} showZone={showZones || (sel?.kind === 'item' && sel.id === it.id)} fs={fs} />
          ))}
          <Walls p={project} sel={sel} fs={fs} tool={tool} />
          <RoomLabels p={project} fs={fs} />
          {project.dims.map((d) => (
            <DimLine key={d.id} d={d} fs={fs} selected={sel?.kind === 'dim' && sel.id === d.id} />
          ))}
          {clr.map((c, i) => (
            <g key={i} pointerEvents="none">
              <line x1={c.from.x} y1={c.from.y} x2={c.to.x} y2={c.to.y} stroke="var(--accent)" strokeWidth={1} strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
              <Label at={mul(add(c.from, c.to), 0.5)} text={fmtCm(c.value)} fs={fs} color="var(--accent)" />
            </g>
          ))}
          {/* anteprime degli strumenti */}
          {guides.x != null && <line x1={guides.x} y1={-5000} x2={guides.x} y2={5000} stroke="var(--accent)" strokeWidth={0.6} strokeDasharray="6 4" vectorEffect="non-scaling-stroke" />}
          {guides.y != null && <line x1={-5000} y1={guides.y} x2={5000} y2={guides.y} stroke="var(--accent)" strokeWidth={0.6} strokeDasharray="6 4" vectorEffect="non-scaling-stroke" />}
          {tool === 'wall' && lastChain && previewEnd && (
            <g pointerEvents="none">
              <line x1={lastChain.x} y1={lastChain.y} x2={previewEnd.x} y2={previewEnd.y} stroke="var(--accent)" strokeWidth={wallThickness} strokeOpacity={0.35} />
              <line x1={lastChain.x} y1={lastChain.y} x2={previewEnd.x} y2={previewEnd.y} stroke="var(--accent)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
              <Label at={mul(add(lastChain, previewEnd), 0.5)} text={`${typed || fmtCm(dist(lastChain, previewEnd))} cm`} fs={fs} color="var(--accent)" boxed />
            </g>
          )}
          {chain?.pts.map((q, i) => <circle key={i} cx={q.x} cy={q.y} r={fs(4)} fill="var(--accent)" />)}
          {roomDrag && (
            <g pointerEvents="none">
              <rect
                x={Math.min(roomDrag.start.x, roomDrag.cur.x)}
                y={Math.min(roomDrag.start.y, roomDrag.cur.y)}
                width={Math.abs(roomDrag.cur.x - roomDrag.start.x)}
                height={Math.abs(roomDrag.cur.y - roomDrag.start.y)}
                fill="var(--accent-soft)"
                stroke="var(--accent)"
                strokeWidth={1.5}
                vectorEffect="non-scaling-stroke"
              />
              <Label
                at={mul(add(roomDrag.start, roomDrag.cur), 0.5)}
                text={`${fmtCm(Math.abs(roomDrag.cur.x - roomDrag.start.x))} × ${fmtCm(Math.abs(roomDrag.cur.y - roomDrag.start.y))} cm`}
                fs={fs}
                color="var(--accent)"
                boxed
              />
            </g>
          )}
          {measure && cursor && (
            <g pointerEvents="none">
              <line x1={measure.x} y1={measure.y} x2={cursor.x} y2={cursor.y} stroke="var(--accent)" strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
              <Label at={mul(add(measure, cursor), 0.5)} text={`${fmtCm(dist(measure, cursor))} cm`} fs={fs} color="var(--accent)" boxed />
            </g>
          )}
          {calib.map((q, i) => <circle key={i} cx={q.x} cy={q.y} r={fs(5)} fill="var(--warn)" />)}
        </g>
      </svg>
      {quote && (
        <QuoteEditor
          q={quote}
          onClose={() => setQuote(null)}
          onApply={(len, end) => {
            const delta = len - quote.current;
            if (Math.abs(delta) > 0.05) apply((p) => changeWallLength(p, quote.wallId, delta, end));
            setQuote(null);
          }}
        />
      )}
      {calibAsk && (
        <CalibDialog
          len={dist(calibAsk.a, calibAsk.b)}
          onCancel={() => setCalibAsk(null)}
          onOk={(real) => {
            const k = real / dist(calibAsk.a, calibAsk.b);
            apply((p) =>
              p.background
                ? {
                    ...p,
                    background: {
                      ...p.background,
                      scale: p.background.scale * k,
                      x: calibAsk.a.x - (calibAsk.a.x - p.background.x) * k,
                      y: calibAsk.a.y - (calibAsk.a.y - p.background.y) * k,
                    },
                  }
                : p,
            );
            setCalibAsk(null);
            setTool('select');
          }}
        />
      )}
      <div className="overlay-btns">
        <button className="btn small" onClick={() => setT((x) => ({ ...x, s: Math.min(6, x.s * 1.25) }))} aria-label="Ingrandisci">
          +
        </button>
        <button className="btn small" onClick={() => setT((x) => ({ ...x, s: Math.max(0.08, x.s / 1.25) }))} aria-label="Riduci">
          −
        </button>
        <span className="btn small" style={{ pointerEvents: 'none' }}>
          scala {Math.round(t.s * 100)} px/m
        </span>
      </div>
    </div>
  );
}

// ---------- componenti di disegno ----------

function Label({ at, text, fs, color = 'var(--ink)', boxed, size = 12, weight = 600 }: { at: Vec; text: string; fs: (n: number) => number; color?: string; boxed?: boolean; size?: number; weight?: number }) {
  return (
    <text
      x={at.x}
      y={at.y}
      fontSize={fs(size)}
      fontWeight={weight}
      fill={color}
      textAnchor="middle"
      dominantBaseline="central"
      style={{ paintOrder: 'stroke', stroke: 'var(--sheet)', strokeWidth: boxed ? fs(5) : fs(3.5), strokeLinejoin: 'round' }}
      pointerEvents="none"
    >
      {text}
    </text>
  );
}

const FLOOR: Record<string, string> = {
  parquet: 'var(--floor-parquet)',
  gres: 'var(--floor-gres)',
  'tiles-warm': 'var(--floor-tiles-warm)',
  'tiles-light': 'var(--floor-tiles-light)',
  concrete: 'var(--floor-concrete)',
};

function Rooms({ p, sel, fs }: { p: Project; sel: ReturnType<typeof useStore.getState>['sel']; fs: (n: number) => number }) {
  return (
    <g>
      {p.rooms.map((r) => {
        const poly = roomPolygon(p, r);
        if (poly.length < 3) return null;
        const selected = sel?.kind === 'room' && sel.id === r.id;
        return (
          <g key={r.id}>
            <polygon data-k="room" data-id={r.id} points={poly.map((q) => `${q.x},${q.y}`).join(' ')} fill={FLOOR[r.floor]} stroke={selected ? 'var(--accent)' : 'none'} strokeWidth={2} vectorEffect="non-scaling-stroke" />
            {selected &&
              poly.map((a, i) => {
                const b = poly[(i + 1) % poly.length];
                const mid = mul(add(a, b), 0.5);
                const nrm = norm(perp(sub(b, a)));
                // per le stanze disegnate, il lato interno corrisponde a un muro: la quota si può modificare
                const wallId = r.nodeIds
                  ? p.walls.find((w) => {
                      const n1 = r.nodeIds![i];
                      const n2 = r.nodeIds![(i + 1) % r.nodeIds!.length];
                      return (w.a === n1 && w.b === n2) || (w.a === n2 && w.b === n1);
                    })?.id
                  : undefined;
                const at = add(mid, mul(nrm, fs(12)));
                return (
                  <g key={i} data-k={wallId ? 'quote' : undefined} data-id={wallId} data-len={dist(a, b)} style={{ cursor: wallId ? 'pointer' : 'default' }}>
                    <Label at={at} text={fmtCm(dist(a, b))} fs={fs} color="var(--accent)" boxed />
                    {wallId && <circle cx={at.x} cy={at.y} r={fs(14)} fill="transparent" />}
                  </g>
                );
              })}
          </g>
        );
      })}
    </g>
  );
}

function RoomLabels({ p, fs }: { p: Project; fs: (n: number) => number }) {
  return (
    <g pointerEvents="none">
      {p.rooms.map((r) => {
        const poly = roomPolygon(p, r);
        if (poly.length < 3) return null;
        const c = labelPoint(poly);
        return (
          <g key={r.id}>
            <Label at={v(c.x, c.y - fs(8))} text={r.name.toUpperCase()} fs={fs} size={14} weight={700} />
            <Label at={v(c.x, c.y + fs(9))} text={`${roomArea(p, r).toFixed(1).replace('.', ',')} m²`} fs={fs} size={12} weight={500} color="var(--muted)" />
          </g>
        );
      })}
    </g>
  );
}

function Walls({ p, sel, fs, tool }: { p: Project; sel: ReturnType<typeof useStore.getState>['sel']; fs: (n: number) => number; tool: Tool }) {
  return (
    <g>
      {p.walls.map((w) => {
        const g = wallGeom(p, w);
        const ang = (Math.atan2(g.dir.y, g.dir.x) * 180) / Math.PI;
        const selected = sel?.kind === 'wall' && sel.id === w.id;
        return (
          <g key={w.id}>
            {solidSpans(p, w).map((s, i) => {
              const c = add(g.a, mul(g.dir, (s.s0 + s.s1) / 2));
              return (
                <rect
                  key={i}
                  data-k="wall"
                  data-id={w.id}
                  x={-(s.s1 - s.s0) / 2}
                  y={-w.thickness / 2}
                  width={s.s1 - s.s0}
                  height={w.thickness}
                  transform={`translate(${c.x} ${c.y}) rotate(${ang})`}
                  fill={selected ? 'var(--accent)' : 'var(--wall)'}
                />
              );
            })}
            {p.openings
              .filter((o) => o.wallId === w.id)
              .map((o) => (
                <OpeningShape key={o.id} o={o} p={p} selected={sel?.kind === 'opening' && sel.id === o.id} />
              ))}
            {selected && (
              <g data-k="quote" data-id={w.id} data-len={g.length} style={{ cursor: 'pointer' }}>
                <Label at={add(mul(add(g.a, g.b), 0.5), mul(g.n, w.thickness / 2 + fs(14)))} text={`${fmtCm(g.length)} (asse)`} fs={fs} color="var(--accent)" boxed />
                <circle cx={(g.a.x + g.b.x) / 2 + g.n.x * (w.thickness / 2 + fs(14))} cy={(g.a.y + g.b.y) / 2 + g.n.y * (w.thickness / 2 + fs(14))} r={fs(16)} fill="transparent" />
              </g>
            )}
          </g>
        );
      })}
      {(tool === 'select' || tool === 'wall') &&
        p.nodes.map((n) => {
          const used = p.walls.some((w) => w.a === n.id || w.b === n.id);
          if (!used) return null;
          const show = sel?.kind === 'wall' && p.walls.some((w) => w.id === sel.id && (w.a === n.id || w.b === n.id));
          return (
            <circle
              key={n.id}
              data-k="node"
              data-id={n.id}
              cx={n.x}
              cy={n.y}
              r={fs(show ? 6 : 4)}
              fill={show ? 'var(--panel)' : 'transparent'}
              stroke={show ? 'var(--accent)' : 'transparent'}
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
              style={{ cursor: 'move' }}
            />
          );
        })}
    </g>
  );
}

function OpeningShape({ o, p, selected }: { o: Opening; p: Project; selected: boolean }) {
  const w = p.walls.find((x) => x.id === o.wallId)!;
  const g = wallGeom(p, w);
  const s0 = o.offset - o.width / 2;
  const s1 = o.offset + o.width / 2;
  const at = (s: number, off = 0) => add(add(g.a, mul(g.dir, s)), mul(g.n, off));
  const stroke = selected ? 'var(--accent)' : 'var(--ink)';
  const hit = (
    <polygon
      data-k="opening"
      data-id={o.id}
      points={[at(s0, -g.half), at(s1, -g.half), at(s1, g.half), at(s0, g.half)].map((q) => `${q.x},${q.y}`).join(' ')}
      fill={selected ? 'var(--accent-soft)' : 'transparent'}
      style={{ cursor: 'ew-resize' }}
    />
  );
  if (o.kind === 'window' || o.kind === 'window-fixed') {
    return (
      <g>
        {hit}
        {[-g.half, -g.half / 3, g.half / 3, g.half].map((off, i) => {
          const a = at(s0, off);
          const b = at(s1, off);
          return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={stroke} strokeWidth={0.9} vectorEffect="non-scaling-stroke" pointerEvents="none" />;
        })}
      </g>
    );
  }
  if (o.kind === 'gap') {
    const a = at(s0, 0);
    const b = at(s1, 0);
    return (
      <g>
        {hit}
        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={stroke} strokeWidth={0.8} strokeDasharray="5 4" vectorEffect="non-scaling-stroke" pointerEvents="none" />
      </g>
    );
  }
  if (o.kind === 'sliding') {
    const a1 = at(s0, -g.half / 3);
    const b1 = at(o.offset + 4, -g.half / 3);
    const a2 = at(o.offset - 4, g.half / 3);
    const b2 = at(s1, g.half / 3);
    return (
      <g pointerEvents="none">
        {hit}
        <line x1={a1.x} y1={a1.y} x2={b1.x} y2={b1.y} stroke={stroke} strokeWidth={2.2} vectorEffect="non-scaling-stroke" />
        <line x1={a2.x} y1={a2.y} x2={b2.x} y2={b2.y} stroke={stroke} strokeWidth={2.2} vectorEffect="non-scaling-stroke" />
      </g>
    );
  }
  // porta a battente: anta aperta a 90° e arco di apertura
  const hs = o.hinge === 'end' ? s1 : s0;
  const os = o.hinge === 'end' ? s0 : s1;
  const face = g.half * o.side;
  const hinge = at(hs, face);
  const leafEnd = add(hinge, mul(g.n, o.side * o.width));
  const other = at(os, face);
  const cr = (leafEnd.x - hinge.x) * (other.y - hinge.y) - (leafEnd.y - hinge.y) * (other.x - hinge.x);
  return (
    <g>
      {hit}
      <line x1={hinge.x} y1={hinge.y} x2={leafEnd.x} y2={leafEnd.y} stroke={stroke} strokeWidth={2.2} vectorEffect="non-scaling-stroke" pointerEvents="none" />
      <path d={`M${leafEnd.x},${leafEnd.y} A${o.width},${o.width} 0 0 ${cr > 0 ? 1 : 0} ${other.x},${other.y}`} fill="none" stroke="var(--muted)" strokeWidth={0.8} strokeDasharray="4 3" vectorEffect="non-scaling-stroke" pointerEvents="none" />
    </g>
  );
}

function FixtureShape({ f, selected, fs, showZone, showLabel }: { f: Fixture; selected: boolean; fs: (n: number) => number; showZone: boolean; showLabel: boolean }) {
  const tr = `translate(${f.x} ${f.y}) rotate(${f.rot})`;
  const sw = { strokeWidth: selected ? 2.2 : 1.1, vectorEffect: 'non-scaling-stroke' as const };
  const stroke = selected ? 'var(--accent)' : undefined;
  const common = { 'data-k': 'fixture', 'data-id': f.id };
  const body = (() => {
    switch (f.kind) {
      case 'pillar':
        return <rect {...common} x={-f.w / 2} y={-f.d / 2} width={f.w} height={f.d} fill="var(--wall)" stroke={stroke ?? 'var(--wall)'} {...sw} />;
      case 'radiator':
        return <rect {...common} x={-f.w / 2} y={-f.d / 2} width={f.w} height={f.d} fill="var(--sheet)" stroke={stroke ?? 'var(--rad)'} {...sw} />;
      case 'outlet':
        return <rect {...common} x={-Math.max(f.w, fs(8)) / 2} y={-f.d / 2} width={Math.max(f.w, fs(8))} height={Math.max(f.d, fs(4))} fill="var(--rad)" stroke={stroke} {...sw} />;
      case 'obstacle':
        return <rect {...common} x={-f.w / 2} y={-f.d / 2} width={f.w} height={f.d} fill="transparent" stroke={stroke ?? 'var(--muted)'} strokeDasharray="3 3" {...sw} />;
      case 'closet':
        return (
          <g>
            <rect {...common} x={-f.w / 2} y={-f.d / 2} width={f.w} height={f.d} fill="var(--sheet)" stroke={stroke ?? 'var(--muted)'} strokeDasharray="6 3" {...sw} />
            <line x1={-f.w / 2} y1={-f.d / 2} x2={f.w / 2} y2={f.d / 2} stroke="var(--muted)" strokeWidth={0.7} strokeDasharray="6 3" vectorEffect="non-scaling-stroke" pointerEvents="none" />
          </g>
        );
      default:
        return (
          <g>
            <rect {...common} x={-f.w / 2} y={-f.d / 2} width={f.w} height={f.d} fill="var(--panel)" stroke={stroke ?? 'var(--ink)'} {...sw} />
            {f.kind === 'appliance' && <line x1={-f.w / 2} y1={-f.d / 2} x2={f.w / 2} y2={f.d / 2} stroke="var(--muted)" strokeWidth={0.7} vectorEffect="non-scaling-stroke" pointerEvents="none" />}
          </g>
        );
    }
  })();
  const label =
    f.kind === 'obstacle' ? `${f.label.toLowerCase()} · da h ${fmtCm(f.z0)}` : f.kind === 'closet' || f.kind === 'kitchen' || f.kind === 'appliance' ? f.label.toLowerCase() : '';
  return (
    <g>
      <g transform={tr}>
        {body}
        {showZone && f.frontClearance ? (
          <rect x={-f.w / 2} y={f.d / 2} width={f.w} height={f.frontClearance} fill="var(--zone)" stroke="var(--accent)" strokeDasharray="3 3" strokeWidth={0.6} vectorEffect="non-scaling-stroke" pointerEvents="none" />
        ) : null}
      </g>
      {label && showLabel && <Label at={v(f.x, f.y)} text={label} fs={fs} size={10.5} weight={500} color="var(--muted)" />}
    </g>
  );
}

function ItemShape({ it, selected, bad, showZone, fs }: { it: Item; selected: boolean; bad: boolean; showZone: boolean; fs: (n: number) => number }) {
  const def = defOf(it.type);
  const parts = def.parts(it).slice().sort((a, b) => a.z + a.h - (b.z + b.h));
  const color = it.color ?? def.color;
  const stroke = bad ? 'var(--no)' : selected ? 'var(--accent)' : 'var(--ink)';
  return (
    <g transform={`translate(${it.x} ${it.y}) rotate(${it.rot})`} data-k="item" data-id={it.id} style={{ cursor: it.fixed ? 'pointer' : 'move' }} data-testid={`item-${it.type}`}>
      {showZone &&
        zonesOf(it).map((z, i) => (
          <rect key={i} x={z.x - z.w / 2} y={z.y - z.d / 2} width={z.w} height={z.d} fill="var(--zone)" stroke="var(--accent)" strokeDasharray="3 3" strokeWidth={0.6} vectorEffect="non-scaling-stroke" pointerEvents="none" />
        ))}
      {parts.map((pt, i) => {
        const fill = pt.mat === 'main' ? color : pt.mat === 'cushion' ? color : MAT_2D[pt.mat];
        const op = pt.mat === 'cushion' ? 0.75 : 1;
        if (pt.shape === 'cyl')
          return <ellipse key={i} cx={pt.x} cy={pt.y} rx={pt.w / 2} ry={pt.d / 2} fill={fill} fillOpacity={op} stroke={stroke} strokeWidth={0.5} vectorEffect="non-scaling-stroke" />;
        return (
          <rect key={i} x={pt.x - pt.w / 2} y={pt.y - pt.d / 2} width={pt.w} height={pt.d} rx={pt.shape === 'round' ? Math.min(4, pt.w / 4, pt.d / 4) : 0} fill={fill} fillOpacity={op} stroke={stroke} strokeWidth={0.5} vectorEffect="non-scaling-stroke" />
        );
      })}
      <rect x={-it.w / 2} y={-it.d / 2} width={it.w} height={it.d} fill="transparent" stroke={selected || bad ? stroke : 'transparent'} strokeWidth={2} vectorEffect="non-scaling-stroke" />
      {selected && (
        <text y={-it.d / 2 - fs(10)} fontSize={fs(11)} textAnchor="middle" fill="var(--accent)" fontWeight={600} transform={`rotate(${-it.rot} 0 ${-it.d / 2 - fs(10)})`} pointerEvents="none">
          {`${fmtCm(it.w)} × ${fmtCm(it.d)} · h ${fmtCm(it.h)}`}
        </text>
      )}
    </g>
  );
}

function DimLine({ d, fs, selected }: { d: Dimension; fs: (n: number) => number; selected: boolean }) {
  const dir = norm(sub(d.b, d.a));
  const n = perp(dir);
  const a = add(d.a, mul(n, d.offset));
  const b = add(d.b, mul(n, d.offset));
  const color = d.measured ? 'var(--accent)' : 'var(--est)';
  const len = dist(d.a, d.b);
  const text = d.label ?? `${d.measured ? '' : '≈'}${fmtCm(len)}`;
  const tick = (q: Vec) => {
    const k = mul(add(dir, n), fs(4));
    return <line x1={q.x - k.x} y1={q.y - k.y} x2={q.x + k.x} y2={q.y + k.y} stroke={color} strokeWidth={1.3} vectorEffect="non-scaling-stroke" />;
  };
  const mid = mul(add(a, b), 0.5);
  const ang = (Math.atan2(dir.y, dir.x) * 180) / Math.PI;
  const up = ang > 90 || ang <= -90 ? ang + 180 : ang;
  return (
    <g data-k="dim" data-id={d.id} style={{ cursor: 'pointer' }}>
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth={selected ? 2 : 0.9} strokeDasharray={d.measured ? undefined : '5 3'} vectorEffect="non-scaling-stroke" />
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={fs(10)} />
      {tick(a)}
      {tick(b)}
      <text
        x={mid.x}
        y={mid.y}
        transform={`rotate(${up} ${mid.x} ${mid.y}) translate(0 ${-fs(6)})`}
        fontSize={fs(12.5)}
        fontWeight={d.measured ? 700 : 500}
        fill={color}
        textAnchor="middle"
        style={{ paintOrder: 'stroke', stroke: 'var(--sheet)', strokeWidth: fs(4), strokeLinejoin: 'round' }}
      >
        {text}
      </text>
    </g>
  );
}

function QuoteEditor({ q, onClose, onApply }: { q: { value: string; at: Vec; current: number }; onClose: () => void; onApply: (len: number, end: 'a' | 'b') => void }) {
  const [val, setVal] = useState(q.value);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.select(), []);
  const len = parseFloat(val.replace(',', '.'));
  return (
    <div className="quote-edit" style={{ left: Math.max(4, q.at.x + 8), top: Math.max(4, q.at.y + 8) }}>
      <label className="eyebrow" htmlFor="quote-input">
        Misura esatta (cm)
      </label>
      <input
        id="quote-input"
        ref={ref}
        autoFocus
        value={val}
        inputMode="decimal"
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && len > 0) onApply(len, 'b');
          if (e.key === 'Escape') onClose();
        }}
      />
      <div className="row">
        <button className="btn small" disabled={!(len > 0)} onClick={() => onApply(len, 'a')}>
          Sposta l'inizio
        </button>
        <button className="btn small primary" disabled={!(len > 0)} onClick={() => onApply(len, 'b')}>
          Sposta la fine
        </button>
      </div>
      <button className="btn small" onClick={onClose}>
        Annulla
      </button>
    </div>
  );
}

function CalibDialog({ len, onOk, onCancel }: { len: number; onOk: (real: number) => void; onCancel: () => void }) {
  const [val, setVal] = useState('');
  const real = parseFloat(val.replace(',', '.'));
  return (
    <div className="modal-back">
      <div className="modal" role="dialog" aria-labelledby="calib-t">
        <h3 id="calib-t">Calibra la scala</h3>
        <p className="note">Nel disegno i due punti distano {fmtCm(len)} cm. Quanto misurano davvero? Di solito si usa una parete lunga di cui conosci la misura.</p>
        <div className="field">
          <label htmlFor="calib-in">Distanza reale in cm</label>
          <input id="calib-in" autoFocus inputMode="decimal" value={val} onChange={(e) => setVal(e.target.value)} />
        </div>
        <div className="row">
          <button className="btn primary" disabled={!(real > 0)} onClick={() => onOk(real)}>
            Applica la scala
          </button>
          <button className="btn" onClick={onCancel}>
            Annulla
          </button>
        </div>
      </div>
    </div>
  );
}

