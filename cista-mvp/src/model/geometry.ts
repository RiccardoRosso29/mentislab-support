import type { Vec } from './types';

export const v = (x: number, y: number): Vec => ({ x, y });
export const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y });
export const mul = (a: Vec, k: number): Vec => ({ x: a.x * k, y: a.y * k });
export const dot = (a: Vec, b: Vec) => a.x * b.x + a.y * b.y;
export const cross = (a: Vec, b: Vec) => a.x * b.y - a.y * b.x;
export const len = (a: Vec) => Math.hypot(a.x, a.y);
export const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);
export const norm = (a: Vec): Vec => {
  const l = len(a) || 1;
  return { x: a.x / l, y: a.y / l };
};
/** normale sinistra di una direzione (nel piano con y verso il basso) */
export const perp = (a: Vec): Vec => ({ x: -a.y, y: a.x });
export const lerp = (a: Vec, b: Vec, t: number): Vec => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
export const deg = (r: number) => (r * 180) / Math.PI;
export const rad = (d: number) => (d * Math.PI) / 180;
export const round1 = (n: number) => Math.round(n * 10) / 10;
export const fmtCm = (n: number) => {
  const r = Math.round(n * 2) / 2;
  return Number.isInteger(r) ? String(r) : r.toFixed(1).replace('.', ',');
};

export function rotate(p: Vec, degrees: number): Vec {
  const c = Math.cos(rad(degrees));
  const s = Math.sin(rad(degrees));
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c };
}

/** sistema locale di un oggetto: origine nel centro, x lungo la larghezza, y verso il fronte */
export type Frame = { o: Vec; rot: number };
export const toWorld = (f: Frame, p: Vec): Vec => add(f.o, rotate(p, f.rot));
export const toLocal = (f: Frame, p: Vec): Vec => rotate(sub(p, f.o), -f.rot);

export function polygonArea(poly: Vec[]): number {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

export function polygonCentroid(poly: Vec[]): Vec {
  const a = polygonArea(poly);
  if (Math.abs(a) < 1e-6) {
    const s = poly.reduce((acc, p) => add(acc, p), v(0, 0));
    return mul(s, 1 / Math.max(1, poly.length));
  }
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    const f = p.x * q.y - q.x * p.y;
    cx += (p.x + q.x) * f;
    cy += (p.y + q.y) * f;
  }
  return { x: cx / (6 * a), y: cy / (6 * a) };
}

/** punto dentro al poligono, con un piccolo spostamento verso l'interno per poligoni concavi (etichette) */
export function labelPoint(poly: Vec[]): Vec {
  const c = polygonCentroid(poly);
  if (pointInPolygon(c, poly)) return c;
  // cerca il punto interno più lontano dai bordi su una griglia grossolana
  const xs = poly.map((p) => p.x);
  const ys = poly.map((p) => p.y);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  let best = c;
  let bestD = -1;
  for (let i = 1; i < 20; i++)
    for (let j = 1; j < 20; j++) {
      const p = v(x0 + ((x1 - x0) * i) / 20, y0 + ((y1 - y0) * j) / 20);
      if (!pointInPolygon(p, poly)) continue;
      const d = Math.min(...poly.map((a, k) => distToSegment(p, a, poly[(k + 1) % poly.length])));
      if (d > bestD) {
        bestD = d;
        best = p;
      }
    }
  return best;
}

export function pointInPolygon(p: Vec, poly: Vec[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export function closestOnSegment(p: Vec, a: Vec, b: Vec): { point: Vec; t: number } {
  const ab = sub(b, a);
  const l2 = dot(ab, ab) || 1;
  const t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / l2));
  return { point: lerp(a, b, t), t };
}
export const distToSegment = (p: Vec, a: Vec, b: Vec) => dist(p, closestOnSegment(p, a, b).point);

/** intersezione di due rette (punto + direzione); null se parallele */
export function lineIntersection(p: Vec, r: Vec, q: Vec, s: Vec): Vec | null {
  const d = cross(r, s);
  if (Math.abs(d) < 1e-9) return null;
  const t = cross(sub(q, p), s) / d;
  return add(p, mul(r, t));
}

/**
 * Poligono interno di un ciclo di muri: ogni lato viene spostato verso l'interno di `insets[i]`
 * (metà spessore del muro corrispondente) e i lati consecutivi vengono intersecati.
 */
export function insetPolygon(poly: Vec[], insets: number[]): Vec[] {
  const n = poly.length;
  if (n < 3) return poly;
  const ccw = polygonArea(poly) > 0; // con y verso il basso: area positiva = senso orario a schermo
  const lines = poly.map((a, i) => {
    const b = poly[(i + 1) % n];
    const dir = norm(sub(b, a));
    // normale verso l'interno
    const nrm = ccw ? perp(dir) : mul(perp(dir), -1);
    return { p: add(a, mul(nrm, insets[i])), dir };
  });
  return lines.map((l, i) => {
    const prev = lines[(i - 1 + n) % n];
    return lineIntersection(prev.p, prev.dir, l.p, l.dir) ?? l.p;
  });
}

/** rettangolo orientato: centro, larghezza (x locale), profondità (y locale), rotazione */
export type OBB = { cx: number; cy: number; w: number; d: number; rot: number };

export function obbCorners(o: OBB): Vec[] {
  const f: Frame = { o: v(o.cx, o.cy), rot: o.rot };
  const hw = o.w / 2;
  const hd = o.d / 2;
  return [v(-hw, -hd), v(hw, -hd), v(hw, hd), v(-hw, hd)].map((p) => toWorld(f, p));
}

function project(pts: Vec[], axis: Vec): [number, number] {
  let mn = Infinity;
  let mx = -Infinity;
  for (const p of pts) {
    const d = dot(p, axis);
    if (d < mn) mn = d;
    if (d > mx) mx = d;
  }
  return [mn, mx];
}

/** sovrapposizione tra due rettangoli orientati (SAT). Restituisce la penetrazione minima (≤0 se non si toccano). */
export function obbOverlap(a: OBB, b: OBB): number {
  const ca = obbCorners(a);
  const cb = obbCorners(b);
  const axes = [a.rot, a.rot + 90, b.rot, b.rot + 90].map((r) => rotate(v(1, 0), r));
  let minPen = Infinity;
  for (const ax of axes) {
    const [a0, a1] = project(ca, ax);
    const [b0, b1] = project(cb, ax);
    const pen = Math.min(a1, b1) - Math.max(a0, b0);
    if (pen <= 0) return pen;
    minPen = Math.min(minPen, pen);
  }
  return minPen;
}

/** estensione di un insieme di punti nel sistema locale di un frame */
export function localExtent(f: Frame, pts: Vec[]) {
  const ls = pts.map((p) => toLocal(f, p));
  return {
    x0: Math.min(...ls.map((p) => p.x)),
    x1: Math.max(...ls.map((p) => p.x)),
    y0: Math.min(...ls.map((p) => p.y)),
    y1: Math.max(...ls.map((p) => p.y)),
  };
}

export const snap = (n: number, step: number) => Math.round(n / step) * step;

export function uid(prefix = 'id'): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}
