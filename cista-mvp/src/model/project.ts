import type { Fixture, Item, Node, Opening, Project, Room, Vec, Wall } from './types';
import {
  add,
  closestOnSegment,
  dist,
  dot,
  insetPolygon,
  len,
  mul,
  norm,
  perp,
  polygonArea,
  sub,
  uid,
  v,
} from './geometry';

export type WallGeom = { wall: Wall; a: Vec; b: Vec; dir: Vec; n: Vec; length: number; half: number };

export function nodeById(p: Project, id: string): Node {
  const n = p.nodes.find((x) => x.id === id);
  if (!n) throw new Error(`nodo ${id} mancante`);
  return n;
}

export function wallGeom(p: Project, w: Wall): WallGeom {
  const a = nodeById(p, w.a);
  const b = nodeById(p, w.b);
  const d = sub(b, a);
  const dir = norm(d);
  return { wall: w, a: v(a.x, a.y), b: v(b.x, b.y), dir, n: perp(dir), length: len(d), half: w.thickness / 2 };
}

export function openingsOf(p: Project, wallId: string): Opening[] {
  return p.openings.filter((o) => o.wallId === wallId).sort((a, b) => a.offset - b.offset);
}

/**
 * Quanto prolungare un muro oltre il suo nodo per chiudere l'angolo: metà spessore degli altri muri
 * che condividono lo stesso nodo (angolo). Agli incroci a T e alle estremità libere non si prolunga,
 * così il muro non sporge nella stanza accanto.
 */
export function endExtension(p: Project, w: Wall, nodeId: string): number {
  const others = p.walls.filter((x) => x.id !== w.id && (x.a === nodeId || x.b === nodeId));
  return others.length ? Math.max(...others.map((x) => x.thickness / 2)) : 0;
}

/** tratti pieni del muro (lungo il muro, da 0 a length), escluse le aperture */
export function solidSpans(p: Project, w: Wall): { s0: number; s1: number }[] {
  const g = wallGeom(p, w);
  const spans: { s0: number; s1: number }[] = [];
  const endA = endExtension(p, w, w.a);
  const endB = endExtension(p, w, w.b);
  let s = -endA;
  for (const o of openingsOf(p, w.id)) {
    const o0 = o.offset - o.width / 2;
    const o1 = o.offset + o.width / 2;
    if (o0 > s) spans.push({ s0: s, s1: o0 });
    s = Math.max(s, o1);
  }
  if (g.length + endB > s) spans.push({ s0: s, s1: g.length + endB });
  return spans;
}

/** poligono interno di una stanza (filo finito dei muri) */
export function roomPolygon(p: Project, r: Room): Vec[] {
  if (r.poly) return r.poly;
  if (!r.nodeIds || r.nodeIds.length < 3) return [];
  const pts = r.nodeIds.map((id) => {
    const n = nodeById(p, id);
    return v(n.x, n.y);
  });
  const insets = r.nodeIds.map((id, i) => {
    const nx = r.nodeIds![(i + 1) % r.nodeIds!.length];
    const w = p.walls.find((x) => (x.a === id && x.b === nx) || (x.b === id && x.a === nx));
    return (w?.thickness ?? 10) / 2;
  });
  return insetPolygon(pts, insets);
}

export const roomArea = (p: Project, r: Room) => Math.abs(polygonArea(roomPolygon(p, r))) / 10000;

export function roomAt(p: Project, pt: Vec): Room | undefined {
  return p.rooms.find((r) => {
    const poly = roomPolygon(p, r);
    return poly.length > 2 && pointInPolygonSafe(pt, poly);
  });
}

function pointInPolygonSafe(p: Vec, poly: Vec[]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** muro più vicino a un punto, con la posizione lungo il muro e la faccia (lato) su cui sta il punto */
export function nearestWall(p: Project, pt: Vec, maxDist = Infinity) {
  let best: { g: WallGeom; t: number; s: number; d: number; side: 1 | -1 } | null = null;
  for (const w of p.walls) {
    const g = wallGeom(p, w);
    const c = closestOnSegment(pt, g.a, g.b);
    const d = dist(pt, c.point);
    if (d < maxDist && (!best || d < best.d)) {
      const side: 1 | -1 = dot(sub(pt, c.point), g.n) >= 0 ? 1 : -1;
      best = { g, t: c.t, s: c.t * g.length, d, side };
    }
  }
  return best;
}

/** porta un mobile (o un elemento fisso) con il retro contro la faccia del muro più vicino */
export function snapToWall<T extends { x: number; y: number; rot: number; d: number }>(
  p: Project,
  obj: T,
  maxDist = 25,
): T | null {
  const nw = nearestWall(p, v(obj.x, obj.y), maxDist + obj.d / 2 + 30);
  if (!nw) return null;
  const { g, side, s } = nw;
  if (s < 0 || s > g.length) return null;
  const faceDist = g.half + obj.d / 2;
  const back = dist(v(obj.x, obj.y), add(g.a, mul(g.dir, s))) - faceDist;
  if (Math.abs(back) > maxDist) return null;
  // il fronte (y locale +) guarda lontano dal muro: direzione = side * n
  const front = mul(g.n, side);
  const rot = Math.round(((Math.atan2(-front.x, front.y) * 180) / Math.PI + 360) % 360);
  const c = add(add(g.a, mul(g.dir, s)), mul(front, faceDist));
  return { ...obj, x: c.x, y: c.y, rot };
}

export function moveNode(p: Project, id: string, to: Vec): Project {
  return { ...p, nodes: p.nodes.map((n) => (n.id === id ? { ...n, x: to.x, y: to.y } : n)) };
}

/**
 * Cambia la lunghezza di un muro di `delta` cm spostando il nodo scelto lungo la direzione del muro.
 * Tutti i muri collegati a quel nodo lo seguono (come in Floorplanner).
 */
export function changeWallLength(p: Project, wallId: string, delta: number, moveEnd: 'a' | 'b'): Project {
  const w = p.walls.find((x) => x.id === wallId);
  if (!w) return p;
  const g = wallGeom(p, w);
  const nodeId = moveEnd === 'b' ? w.b : w.a;
  const node = nodeById(p, nodeId);
  const shift = moveEnd === 'b' ? mul(g.dir, delta) : mul(g.dir, -delta);
  let next = moveNode(p, nodeId, add(v(node.x, node.y), shift));
  // il muro collegato (non parallelo) trasla insieme al nodo: una stanza rettangolare resta rettangolare
  for (const o of p.walls) {
    if (o.id === w.id || (o.a !== nodeId && o.b !== nodeId)) continue;
    const og = wallGeom(p, o);
    if (Math.abs(og.dir.x * g.dir.x + og.dir.y * g.dir.y) > 0.99) continue;
    const far = o.a === nodeId ? o.b : o.a;
    const fn = nodeById(next, far);
    next = moveNode(next, far, add(v(fn.x, fn.y), shift));
  }
  // le aperture misurate dal nodo a restano dove sono se si sposta b; se si sposta a, si compensano
  if (moveEnd === 'a') {
    next = {
      ...next,
      openings: next.openings.map((o) => (o.wallId === wallId ? { ...o, offset: o.offset + delta } : o)),
    };
  }
  return next;
}

/** aggiunge un nodo riusando quelli già presenti nello stesso punto */
export function ensureNode(p: Project, pt: Vec, tol = 0.5): { p: Project; id: string } {
  const ex = p.nodes.find((n) => Math.abs(n.x - pt.x) < tol && Math.abs(n.y - pt.y) < tol);
  if (ex) return { p, id: ex.id };
  const id = uid('n');
  return { p: { ...p, nodes: [...p.nodes, { id, x: pt.x, y: pt.y }] }, id };
}

export function addWall(p: Project, a: Vec, b: Vec, opts: Partial<Wall> = {}): { p: Project; wall: Wall } {
  const r1 = ensureNode(p, a);
  const r2 = ensureNode(r1.p, b);
  const wall: Wall = {
    id: uid('w'),
    a: r1.id,
    b: r2.id,
    thickness: opts.thickness ?? 10,
    height: opts.height ?? p.ceiling,
    kind: opts.kind ?? 'int',
  };
  return { p: { ...r2.p, walls: [...r2.p.walls, wall] }, wall };
}

export function removeWall(p: Project, id: string): Project {
  const walls = p.walls.filter((w) => w.id !== id);
  const used = new Set(walls.flatMap((w) => [w.a, w.b]));
  return {
    ...p,
    walls,
    openings: p.openings.filter((o) => o.wallId !== id),
    nodes: p.nodes.filter((n) => used.has(n.id) || p.rooms.some((r) => r.nodeIds?.includes(n.id))),
    rooms: p.rooms.filter((r) => !r.nodeIds || r.nodeIds.every((nid) => used.has(nid))),
  };
}

export function openingEnds(p: Project, o: Opening) {
  const w = p.walls.find((x) => x.id === o.wallId)!;
  const g = wallGeom(p, w);
  const s0 = o.offset - o.width / 2;
  const s1 = o.offset + o.width / 2;
  return { g, p0: add(g.a, mul(g.dir, s0)), p1: add(g.a, mul(g.dir, s1)), s0, s1 };
}

export const itemLabel = (i: Item) => i.label;
export const fixtureLabel = (f: Fixture) => f.label;

export function emptyProject(name = 'Nuova casa'): Project {
  return {
    version: 1,
    id: uid('p'),
    name,
    ceiling: 260,
    nodes: [],
    walls: [],
    openings: [],
    fixtures: [],
    items: [],
    rooms: [],
    dims: [],
    settings: { passageMin: 45, passageComfort: 60, tolerance: 2 },
  };
}
