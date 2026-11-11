import { describe, expect, it } from 'vitest';
import { insetPolygon, obbOverlap, polygonArea, pointInPolygon, rotate } from '../src/model/geometry';
import { changeWallLength, roomArea, roomPolygon, snapToWall, solidSpans } from '../src/model/project';
import { demoProject } from '../src/data/demo-project';
import { room } from './helpers';

describe('geometria', () => {
  it('area di un rettangolo', () => {
    expect(Math.abs(polygonArea([{ x: 0, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 200 }, { x: 0, y: 200 }]))).toBe(60000);
  });

  it('poligono interno: rientra di metà spessore su ogni lato', () => {
    const r = insetPolygon([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }], [5, 5, 5, 5]);
    expect(r[0].x).toBeCloseTo(5);
    expect(r[0].y).toBeCloseTo(5);
    expect(Math.abs(polygonArea(r))).toBeCloseTo(8100);
  });

  it('una stanza disegnata ha l’area interna giusta (errore < 1%)', () => {
    const p = room(300, 400);
    expect(roomArea(p, p.rooms[0])).toBeCloseTo(12, 1);
  });

  it('cambiare la quota sposta il muro e la stanza si aggiorna', () => {
    const p = room(300, 400);
    const top = p.walls[0];
    const q = changeWallLength(p, top.id, 50, 'b');
    const poly = roomPolygon(q, q.rooms[0]);
    const xs = poly.map((v) => v.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(350, 0);
  });

  it('rettangoli orientati: si toccano o no', () => {
    expect(obbOverlap({ cx: 0, cy: 0, w: 10, d: 10, rot: 0 }, { cx: 9, cy: 0, w: 10, d: 10, rot: 0 })).toBeGreaterThan(0);
    expect(obbOverlap({ cx: 0, cy: 0, w: 10, d: 10, rot: 0 }, { cx: 15, cy: 0, w: 10, d: 10, rot: 45 })).toBeLessThanOrEqual(0.1);
  });

  it('rotazione e punto nel poligono', () => {
    const r = rotate({ x: 0, y: 1 }, 270);
    expect(r.x).toBeCloseTo(1);
    expect(pointInPolygon({ x: 5, y: 5 }, [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }])).toBe(true);
  });

  it('un mobile vicino alla parete si aggancia con il retro al muro', () => {
    const p = room(300, 400);
    const s = snapToWall(p, { x: 150, y: 40, rot: 37, d: 60 });
    expect(s).not.toBeNull();
    expect(s!.y).toBeCloseTo(30, 0);
    expect(s!.rot).toBe(0);
  });

  it('demo: le aperture interrompono i muri e le aree sono plausibili', () => {
    const p = demoProject();
    const door = p.openings.find((o) => o.kind === 'door')!;
    const w = p.walls.find((x) => x.id === door.wallId)!;
    expect(solidSpans(p, w).length).toBe(2);
    const total = p.rooms.reduce((a, r) => a + roomArea(p, r), 0);
    expect(total).toBeGreaterThan(50);
    expect(total).toBeLessThan(70);
  });
});
