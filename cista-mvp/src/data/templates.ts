import type { Opening, Project, Room } from '../model/types';
import { emptyProject, ensureNode, nearestWall } from '../model/project';
import { uid } from '../model/geometry';

type R = { name: string; x0: number; y0: number; x1: number; y1: number; floor: Room['floor'] };
type O = { kind: Opening['kind']; x: number; y: number; width: number; sill?: number; height?: number; side?: 1 | -1 };

/**
 * Costruisce una casa da rettangoli (coordinate sull'asse dei muri): i lati condivisi diventano tramezzi da 10 cm,
 * quelli esterni muri da 24 cm. Le stanze sono cicli di nodi, quindi si aggiornano quando i muri si spostano.
 */
export function buildFromRects(name: string, rects: R[], openings: O[]): Project {
  let p = emptyProject(name);
  const pts = new Map<string, { x: number; y: number }>();
  const key = (x: number, y: number) => `${x},${y}`;
  for (const r of rects) for (const [x, y] of [[r.x0, r.y0], [r.x1, r.y0], [r.x1, r.y1], [r.x0, r.y1]]) pts.set(key(x, y), { x, y });
  const nodes = [...pts.values()];
  const onSeg = (n: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) =>
    (a.x === b.x && n.x === a.x && n.y >= Math.min(a.y, b.y) && n.y <= Math.max(a.y, b.y)) ||
    (a.y === b.y && n.y === a.y && n.x >= Math.min(a.x, b.x) && n.x <= Math.max(a.x, b.x));
  const sides = (r: R) => [
    [{ x: r.x0, y: r.y0 }, { x: r.x1, y: r.y0 }],
    [{ x: r.x1, y: r.y0 }, { x: r.x1, y: r.y1 }],
    [{ x: r.x1, y: r.y1 }, { x: r.x0, y: r.y1 }],
    [{ x: r.x0, y: r.y1 }, { x: r.x0, y: r.y0 }],
  ];
  const segs = new Map<string, { a: { x: number; y: number }; b: { x: number; y: number }; count: number }>();
  const roomLoops: { r: R; loop: { x: number; y: number }[] }[] = [];
  for (const r of rects) {
    const loop: { x: number; y: number }[] = [];
    for (const [a, b] of sides(r)) {
      const on = nodes.filter((n) => onSeg(n, a, b)).sort((m, n) => Math.hypot(m.x - a.x, m.y - a.y) - Math.hypot(n.x - a.x, n.y - a.y));
      for (let i = 0; i < on.length - 1; i++) {
        const k = [key(on[i].x, on[i].y), key(on[i + 1].x, on[i + 1].y)].sort().join('|');
        const s = segs.get(k);
        if (s) s.count++;
        else segs.set(k, { a: on[i], b: on[i + 1], count: 1 });
        loop.push(on[i]);
      }
    }
    roomLoops.push({ r, loop });
  }
  for (const s of segs.values()) {
    const ext = s.count === 1;
    const ra = ensureNode(p, s.a);
    const rb = ensureNode(ra.p, s.b);
    p = { ...rb.p, walls: [...rb.p.walls, { id: uid('w'), a: ra.id, b: rb.id, thickness: ext ? 24 : 10, height: 260, kind: ext ? 'ext' : 'int' }] };
  }
  p.rooms = roomLoops.map(({ r, loop }) => ({
    id: uid('r'),
    name: r.name,
    floor: r.floor,
    nodeIds: loop.map((pt) => p.nodes.find((n) => n.x === pt.x && n.y === pt.y)!.id),
  }));
  for (const o of openings) {
    const nw = nearestWall(p, o);
    if (!nw) continue;
    const isWindow = o.kind === 'window' || o.kind === 'window-fixed';
    p.openings.push({
      id: uid('o'),
      wallId: nw.g.wall.id,
      kind: o.kind,
      offset: nw.s,
      width: o.width,
      height: o.height ?? (isWindow ? 140 : 210),
      sill: o.sill ?? (isWindow ? 90 : 0),
      hinge: 'end',
      side: o.side ?? 1,
    });
  }
  return p;
}

export const TEMPLATES: { id: string; label: string; area: string; build: () => Project }[] = [
  {
    id: 'monolocale',
    label: 'Monolocale',
    area: '≈ 40 m²',
    build: () =>
      buildFromRects(
        'Monolocale',
        [
          { name: 'Soggiorno con cucina', x0: 0, y0: 0, x1: 620, y1: 500, floor: 'parquet' },
          { name: 'Bagno', x0: 620, y0: 0, x1: 840, y1: 250, floor: 'tiles-light' },
          { name: 'Ingresso', x0: 620, y0: 250, x1: 840, y1: 500, floor: 'parquet' },
        ],
        [
          { kind: 'door', x: 840, y: 400, width: 90, side: 1 },
          { kind: 'door', x: 730, y: 250, width: 75, side: -1 },
          { kind: 'gap', x: 620, y: 380, width: 100 },
          { kind: 'window', x: 180, y: 500, width: 140, sill: 80 },
          { kind: 'window', x: 440, y: 500, width: 120, sill: 80 },
          { kind: 'window', x: 730, y: 0, width: 60, sill: 130, height: 70 },
        ],
      ),
  },
  {
    id: 'bilocale',
    label: 'Bilocale',
    area: '≈ 55 m²',
    build: () =>
      buildFromRects(
        'Bilocale',
        [
          { name: 'Soggiorno con cucina', x0: 0, y0: 0, x1: 560, y1: 450, floor: 'parquet' },
          { name: 'Camera', x0: 0, y0: 450, x1: 380, y1: 800, floor: 'parquet' },
          { name: 'Bagno', x0: 380, y0: 450, x1: 560, y1: 680, floor: 'tiles-light' },
          { name: 'Ripostiglio', x0: 380, y0: 680, x1: 560, y1: 800, floor: 'gres' },
        ],
        [
          { kind: 'door', x: 470, y: 0, width: 90, side: 1 },
          { kind: 'door', x: 300, y: 450, width: 80, side: 1 },
          { kind: 'door', x: 470, y: 450, width: 70, side: 1 },
          { kind: 'door', x: 470, y: 680, width: 70, side: -1 },
          { kind: 'window', x: 0, y: 220, width: 150, sill: 80 },
          { kind: 'window', x: 190, y: 800, width: 130, sill: 90 },
          { kind: 'window', x: 560, y: 560, width: 60, sill: 130, height: 70 },
        ],
      ),
  },
  {
    id: 'trilocale',
    label: 'Trilocale',
    area: '≈ 75 m²',
    build: () =>
      buildFromRects(
        'Trilocale',
        [
          { name: 'Soggiorno', x0: 0, y0: 0, x1: 500, y1: 450, floor: 'parquet' },
          { name: 'Cucina', x0: 500, y0: 0, x1: 800, y1: 300, floor: 'gres' },
          { name: 'Disimpegno', x0: 500, y0: 300, x1: 800, y1: 450, floor: 'parquet' },
          { name: 'Camera 1', x0: 0, y0: 450, x1: 400, y1: 800, floor: 'parquet' },
          { name: 'Camera 2', x0: 400, y0: 450, x1: 650, y1: 800, floor: 'parquet' },
          { name: 'Bagno', x0: 650, y0: 450, x1: 800, y1: 800, floor: 'tiles-light' },
        ],
        [
          { kind: 'door', x: 800, y: 375, width: 90, side: 1 },
          { kind: 'gap', x: 500, y: 375, width: 110 },
          { kind: 'gap', x: 650, y: 300, width: 100 },
          { kind: 'door', x: 330, y: 450, width: 80, side: 1 },
          { kind: 'door', x: 540, y: 450, width: 80, side: 1 },
          { kind: 'door', x: 725, y: 450, width: 70, side: 1 },
          { kind: 'window', x: 0, y: 220, width: 160, sill: 80 },
          { kind: 'window', x: 650, y: 0, width: 120, sill: 100 },
          { kind: 'window', x: 200, y: 800, width: 130, sill: 90 },
          { kind: 'window', x: 525, y: 800, width: 110, sill: 90 },
          { kind: 'window', x: 800, y: 620, width: 60, sill: 130, height: 70 },
        ],
      ),
  },
];
