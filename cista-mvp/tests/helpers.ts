import { addWall, emptyProject } from '../src/model/project';
import { newItem } from '../src/model/furniture';
import type { Fixture, Item, Project } from '../src/model/types';

/** stanza rettangolare chiusa: interno largo `w` e profondo `d` (muri esterni da 24 cm, centri a ±12) */
export function room(w: number, d: number): Project {
  let p = emptyProject('test');
  const t = 24;
  const pts = [
    { x: -t / 2, y: -t / 2 },
    { x: w + t / 2, y: -t / 2 },
    { x: w + t / 2, y: d + t / 2 },
    { x: -t / 2, y: d + t / 2 },
  ];
  for (let i = 0; i < 4; i++) p = addWall(p, pts[i], pts[(i + 1) % 4], { thickness: t, kind: 'ext' }).p;
  p.rooms = [{ id: 'r', name: 'Stanza', floor: 'parquet', nodeIds: p.nodes.map((n) => n.id) }];
  return p;
}

/** mobile con il retro contro la parete in alto (y=0), a `x` cm dalla parete sinistra (bordo sinistro) */
export function againstTop(type: string, x: number, w: number, d: number, h: number, extra: Partial<Item> = {}): Item {
  // rot 0: il fronte guarda verso +y, quindi il retro sta a y = centro - d/2
  return { ...newItem(type, x + w / 2, d / 2, 0), w, d, h, ...extra };
}

export function fixture(kind: Fixture['kind'], label: string, x0: number, y0: number, x1: number, y1: number, z0: number, z1: number): Fixture {
  return { id: `f-${label}-${x0}`, kind, label, x: (x0 + x1) / 2, y: (y0 + y1) / 2, w: x1 - x0, d: y1 - y0, rot: 0, z0, z1 };
}
