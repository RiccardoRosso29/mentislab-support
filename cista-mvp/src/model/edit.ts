import type { Fixture, Item, Opening, Project, Vec } from './types';
import type { Sel } from './store';
import { add, localExtent, mul, obbCorners, obbOverlap, toWorld, uid, v, type Frame } from './geometry';
import { collectObstacles } from './obstacles';
import { footprintOf } from './furniture';
import { nearestWall, snapToWall, wallGeom, removeWall } from './project';

export const FIXTURE_DEFAULTS: Record<string, Omit<Fixture, 'id' | 'x' | 'y' | 'rot'>> = {
  pillar: { kind: 'pillar', label: 'Pilastro', w: 30, d: 30, z0: 0, z1: 260 },
  radiator: { kind: 'radiator', label: 'Termosifone', w: 80, d: 10, z0: 15, z1: 75 },
  outlet: { kind: 'outlet', label: 'Presa', w: 8, d: 2, z0: 28, z1: 36 },
  obstacle: { kind: 'obstacle', label: 'Ostacolo in alto', w: 80, d: 45, z0: 150, z1: 205 },
  closet: {
    kind: 'closet',
    label: 'Armadio a muro',
    w: 150,
    d: 60,
    z0: 0,
    z1: 240,
    frontClearance: 50,
    sections: [{ label: 'Interno', w: 140, d: 55 }],
  },
};

export const OPENING_DEFAULTS: Record<string, Pick<Opening, 'kind' | 'width' | 'height' | 'sill'>> = {
  door: { kind: 'door', width: 80, height: 210, sill: 0 },
  sliding: { kind: 'sliding', width: 80, height: 210, sill: 0 },
  gap: { kind: 'gap', width: 90, height: 210, sill: 0 },
  window: { kind: 'window', width: 120, height: 130, sill: 90 },
  'window-fixed': { kind: 'window-fixed', width: 100, height: 130, sill: 90 },
};

export function addOpeningAt(p: Project, kind: string, pt: Vec): { p: Project; id: string } | null {
  const nw = nearestWall(p, pt, 40);
  if (!nw) return null;
  const d = OPENING_DEFAULTS[kind];
  const width = Math.min(d.width, nw.g.length - 10);
  const offset = Math.min(Math.max(nw.s, width / 2 + 5), nw.g.length - width / 2 - 5);
  const o: Opening = { id: uid('o'), wallId: nw.g.wall.id, ...d, width, offset, hinge: 'end', side: nw.side };
  return { p: { ...p, openings: [...p.openings, o] }, id: o.id };
}

export function addFixtureAt(p: Project, kind: string, pt: Vec): { p: Project; id: string } {
  const d = FIXTURE_DEFAULTS[kind];
  let f: Fixture = { id: uid('f'), x: pt.x, y: pt.y, rot: 0, ...d, sections: d.sections?.map((s) => ({ ...s })) };
  if (kind !== 'pillar') {
    const s = snapToWall(p, f, 60);
    if (s) f = s;
  }
  return { p: { ...p, fixtures: [...p.fixtures, f] }, id: f.id };
}

export function addItem(p: Project, it: Item): Project {
  const s = snapToWall(p, it, 30);
  return { ...p, items: [...p.items, s ?? it] };
}

export function deleteSel(p: Project, s: Sel): Project {
  if (!s) return p;
  switch (s.kind) {
    case 'item':
      return { ...p, items: p.items.filter((i) => i.id !== s.id) };
    case 'fixture':
      return { ...p, fixtures: p.fixtures.filter((i) => i.id !== s.id) };
    case 'opening':
      return { ...p, openings: p.openings.filter((i) => i.id !== s.id) };
    case 'wall':
      return removeWall(p, s.id);
    case 'room':
      return { ...p, rooms: p.rooms.filter((i) => i.id !== s.id) };
    case 'dim':
      return { ...p, dims: p.dims.filter((i) => i.id !== s.id) };
    default:
      return p;
  }
}

export function rotateSel(p: Project, s: Sel, by: number): Project {
  if (!s) return p;
  const r = (x: number) => (((x + by) % 360) + 360) % 360;
  if (s.kind === 'item') return { ...p, items: p.items.map((i) => (i.id === s.id ? { ...i, rot: r(i.rot) } : i)) };
  if (s.kind === 'fixture') return { ...p, fixtures: p.fixtures.map((i) => (i.id === s.id ? { ...i, rot: r(i.rot) } : i)) };
  return p;
}

export function duplicateSel(p: Project, s: Sel): { p: Project; sel: Sel } {
  if (s?.kind === 'item') {
    const it = p.items.find((i) => i.id === s.id);
    if (!it) return { p, sel: s };
    const copy = { ...it, id: uid('i'), x: it.x + 30, y: it.y + 30, chosen: false };
    return { p: { ...p, items: [...p.items, copy] }, sel: { kind: 'item', id: copy.id } };
  }
  return { p, sel: s };
}

export type Clearance = { from: Vec; to: Vec; value: number };

/** distanze dai lati e dal fronte di un mobile fino agli ostacoli più vicini (mostrate mentre lo si trascina) */
export function clearances(p: Project, it: Item): Clearance[] {
  const F: Frame = { o: v(it.x, it.y), rot: it.rot };
  const obs = collectObstacles(p, { exclude: [it.id] }).filter((o) => o.hard && o.z0 < 100 && o.kind !== 'outlet' && o.kind !== 'door-swing');
  const out: Clearance[] = [];
  const hw = it.w / 2;
  const hd = it.d / 2;
  const dirs: { axis: 'x' | 'y'; sign: 1 | -1 }[] = [
    { axis: 'x', sign: -1 },
    { axis: 'x', sign: 1 },
    { axis: 'y', sign: 1 },
  ];
  for (const dd of dirs) {
    let best = Infinity;
    for (const o of obs) {
      const e = localExtent(F, obbCorners(o.obb));
      if (dd.axis === 'x') {
        if (Math.min(e.y1, hd) - Math.max(e.y0, -hd) <= 0.5) continue;
        const g = dd.sign > 0 ? e.x0 - hw : -hw - e.x1;
        if (g >= -0.5 && g < best) best = g;
      } else {
        if (Math.min(e.x1, hw) - Math.max(e.x0, -hw) <= 0.5) continue;
        const g = e.y0 - hd;
        if (g >= -0.5 && g < best) best = g;
      }
    }
    if (!Number.isFinite(best) || best > 400) continue;
    const g = Math.max(0, best);
    if (dd.axis === 'x') {
      const x0 = dd.sign * hw;
      out.push({ from: toWorld(F, v(x0, 0)), to: toWorld(F, v(x0 + dd.sign * g, 0)), value: g });
    } else {
      out.push({ from: toWorld(F, v(0, hd)), to: toWorld(F, v(0, hd + g)), value: g });
    }
  }
  return out;
}

const SEATS = new Set(['chair', 'office-chair', 'stool']);
const TABLES = new Set(['desk', 'dining-table']);
/** coppie che si sovrappongono per natura: sedia sotto il tavolo, TV sul mobile, tappeto sotto tutto */
function companions(a: Item, b: Item | undefined) {
  if (!b) return false;
  if (a.type === 'rug' || b.type === 'rug') return true;
  if ((SEATS.has(a.type) && TABLES.has(b.type)) || (SEATS.has(b.type) && TABLES.has(a.type))) return true;
  return (a.type === 'tv' && b.type === 'tv-unit') || (a.type === 'tv-unit' && b.type === 'tv');
}

/** mobili che urtano qualcosa di fisso o un altro mobile (bordo rosso nella pianta) */
export function collisions(p: Project): Set<string> {
  const bad = new Set<string>();
  const obs = collectObstacles(p).filter((o) => o.hard && o.kind !== 'outlet');
  for (const it of p.items) {
    const rad = (it.rot * Math.PI) / 180;
    const bodies = footprintOf(it).map((r) => ({
      cx: it.x + r.x * Math.cos(rad) - r.y * Math.sin(rad),
      cy: it.y + r.x * Math.sin(rad) + r.y * Math.cos(rad),
      w: r.w,
      d: r.d,
      rot: it.rot,
    }));
    const z0 = it.z ?? 0;
    for (const o of obs) {
      if (o.sourceId === it.id) continue;
      if (Math.min(o.z1, z0 + it.h) - Math.max(o.z0, z0) <= 1) continue;
      if (o.kind === 'door-swing' && it.fixed) continue;
      if (o.kind === 'item' || o.kind === 'overhead') {
        const other = p.items.find((x) => x.id === o.sourceId);
        if (companions(it, other)) continue;
      }
      if (bodies.some((b) => obbOverlap(b, o.obb) > 2)) {
        bad.add(it.id);
        break;
      }
    }
  }
  return bad;
}

/** posizione di un'apertura dopo il trascinamento lungo il suo muro */
export function slideOpening(p: Project, id: string, pt: Vec): Project {
  const o = p.openings.find((x) => x.id === id);
  if (!o) return p;
  const w = p.walls.find((x) => x.id === o.wallId);
  if (!w) return p;
  const g = wallGeom(p, w);
  const rel = (pt.x - g.a.x) * g.dir.x + (pt.y - g.a.y) * g.dir.y;
  const offset = Math.min(Math.max(rel, o.width / 2 + 2), g.length - o.width / 2 - 2);
  return { ...p, openings: p.openings.map((x) => (x.id === id ? { ...x, offset: Math.round(offset) } : x)) };
}

export const wallPoint = (p: Project, wallId: string, s: number) => {
  const g = wallGeom(p, p.walls.find((w) => w.id === wallId)!);
  return add(g.a, mul(g.dir, s));
};
