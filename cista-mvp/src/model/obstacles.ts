import type { Item, Project } from './types';
import { add, deg, mul, obbCorners, type OBB } from './geometry';
import { defOf, footprintOf, zonesOf } from './furniture';
import { solidSpans, wallGeom, openingsOf } from './project';

export type ObstacleKind = 'wall' | 'pillar' | 'radiator' | 'fixture' | 'overhead' | 'item' | 'door-swing' | 'zone' | 'outlet';

export type Obstacle = {
  id: string;
  kind: ObstacleKind;
  /** come chiamarlo in una frase, con l'articolo: «il pilastro», «la porta» */
  ref: string;
  obb: OBB;
  z0: number;
  z1: number;
  /** un ostacolo «duro» non si può occupare; le zone (aperture di ante, sedie) danno solo un avviso */
  hard: boolean;
  /** mobile spostabile (avviso invece di blocco quando lo urta un'apertura) */
  movable: boolean;
  sourceId: string;
};

const FEMININE = new Set([
  'lavatrice', 'cucina', 'scrivania', 'sedia', 'libreria', 'scarpiera', 'credenza', 'poltrona', 'pianta', 'lampada',
  'base', 'mensola', 'doccia', 'vasca', 'televisione', 'porta', 'finestra', 'colonna', 'parete', 'chaise', 'tv',
  'cappa', 'lavastoviglie', 'stufa', 'caldaia', 'presa', 'cassettiera', 'panca', 'specchiera', 'unità',
]);

/** aggiunge l'articolo determinativo a un nome comune (euristica sufficiente per l'arredamento) */
export function withArticle(label: string): string {
  const t = label.trim();
  const low = t.charAt(0).toLowerCase() + t.slice(1);
  if (/^(il|lo|la|l'|i|gli|le) /i.test(low) || /^l'/.test(low)) return low;
  const first = low.split(/[\s']/)[0];
  if (/^[aeiouàèéìòù]/.test(first)) return `l'${low}`;
  if (FEMININE.has(first)) return `la ${low}`;
  if (/^(s[bcdfgklmnpqrtv]|z|gn|ps|x|y)/.test(first)) return `lo ${low}`;
  return `il ${low}`;
}

/** preposizione articolata: a + il = al, di + la = della, ... */
export function prep(p: 'a' | 'di' | 'da' | 'su', ref: string): string {
  const m = ref.match(/^(il|lo|la|i|gli|le) (.*)$/) ?? ref.match(/^(l')(.*)$/);
  if (!m) return `${p} ${ref}`;
  const table: Record<string, Record<string, string>> = {
    a: { il: 'al', lo: 'allo', la: 'alla', "l'": "all'", i: 'ai', gli: 'agli', le: 'alle' },
    di: { il: 'del', lo: 'dello', la: 'della', "l'": "dell'", i: 'dei', gli: 'degli', le: 'delle' },
    da: { il: 'dal', lo: 'dallo', la: 'dalla', "l'": "dall'", i: 'dai', gli: 'dagli', le: 'dalle' },
    su: { il: 'sul', lo: 'sullo', la: 'sulla', "l'": "sull'", i: 'sui', gli: 'sugli', le: 'sulle' },
  };
  const art = table[p][m[1]];
  return art.endsWith("'") ? `${art}${m[2]}` : `${art} ${m[2]}`;
}

/** accordo del participio: «va spostato» / «va spostata» */
export const agree = (ref: string, masc: string) => (/^(la|le) /.test(ref) ? masc.replace(/o$/, 'a') : masc);

export function itemRef(i: Item): string {
  return withArticle(i.label ?? defOf(i.type).label);
}

const rotOf = (dir: { x: number; y: number }) => deg(Math.atan2(dir.y, dir.x));

export function collectObstacles(p: Project, opts: { exclude?: string[] } = {}): Obstacle[] {
  const ex = new Set(opts.exclude ?? []);
  const out: Obstacle[] = [];

  for (const w of p.walls) {
    const g = wallGeom(p, w);
    const r = rotOf(g.dir);
    for (const s of solidSpans(p, w)) {
      const mid = (s.s0 + s.s1) / 2;
      const c = add(g.a, mul(g.dir, mid));
      out.push({
        id: `${w.id}:${s.s0.toFixed(1)}`,
        kind: 'wall',
        ref: 'il muro',
        obb: { cx: c.x, cy: c.y, w: s.s1 - s.s0, d: w.thickness, rot: r },
        z0: 0,
        z1: w.height,
        hard: true,
        movable: false,
        sourceId: w.id,
      });
    }
    for (const o of openingsOf(p, w.id)) {
      const c = add(g.a, mul(g.dir, o.offset));
      if ((o.kind === 'window' || o.kind === 'window-fixed') && o.sill > 0) {
        out.push({
          id: `${o.id}:sill`,
          kind: 'wall',
          ref: 'il davanzale della finestra',
          obb: { cx: c.x, cy: c.y, w: o.width, d: w.thickness, rot: r },
          z0: 0,
          z1: o.sill,
          hard: true,
          movable: false,
          sourceId: o.id,
        });
      }
      if (o.kind === 'door') {
        // quadrato che contiene l'arco di apertura dell'anta, sul lato verso cui si apre
        const out0 = mul(g.n, o.side * (g.half + o.width / 2));
        const cc = add(c, out0);
        out.push({
          id: `${o.id}:swing`,
          kind: 'door-swing',
          ref: 'la porta quando si apre',
          obb: { cx: cc.x, cy: cc.y, w: o.width, d: o.width, rot: r },
          z0: 0,
          z1: 210,
          hard: true,
          movable: false,
          sourceId: o.id,
        });
      }
    }
  }

  for (const f of p.fixtures) {
    if (ex.has(f.id)) continue;
    const obb: OBB = { cx: f.x, cy: f.y, w: f.w, d: f.d, rot: f.rot };
    const ref = withArticle(f.label);
    const kind: ObstacleKind =
      f.kind === 'pillar' ? 'pillar' : f.kind === 'radiator' ? 'radiator' : f.kind === 'outlet' ? 'outlet' : f.z0 >= 100 ? 'overhead' : 'fixture';
    out.push({ id: f.id, kind, ref, obb, z0: f.z0, z1: f.z1, hard: f.kind !== 'outlet', movable: false, sourceId: f.id });
    if (f.frontClearance) {
      const off = { x: 0, y: f.d / 2 + f.frontClearance / 2 };
      const r = { x: off.x * Math.cos((f.rot * Math.PI) / 180) - off.y * Math.sin((f.rot * Math.PI) / 180), y: off.x * Math.sin((f.rot * Math.PI) / 180) + off.y * Math.cos((f.rot * Math.PI) / 180) };
      out.push({
        id: `${f.id}:front`,
        kind: 'zone',
        ref: `lo spazio per aprire ${f.kind === 'closet' ? `le ante ${prep('di', withArticle(f.label))}` : withArticle(f.label)}`,
        obb: { cx: f.x + r.x, cy: f.y + r.y, w: f.w, d: f.frontClearance, rot: f.rot },
        z0: 0,
        z1: 200,
        hard: false,
        movable: false,
        sourceId: f.id,
      });
    }
  }

  for (const i of p.items) {
    if (ex.has(i.id)) continue;
    const ref = itemRef(i);
    const z0 = i.z ?? 0;
    const rad = (i.rot * Math.PI) / 180;
    const tw = (lx: number, ly: number) => ({ x: i.x + lx * Math.cos(rad) - ly * Math.sin(rad), y: i.y + lx * Math.sin(rad) + ly * Math.cos(rad) });
    footprintOf(i).forEach((r, k) => {
      const c = tw(r.x, r.y);
      out.push({
        id: `${i.id}:${k}`,
        kind: z0 >= 100 ? 'overhead' : 'item',
        ref,
        obb: { cx: c.x, cy: c.y, w: r.w, d: r.d, rot: i.rot },
        z0,
        z1: z0 + i.h,
        hard: true,
        movable: !i.fixed,
        sourceId: i.id,
      });
    });
    for (const zn of zonesOf(i)) {
      const c = tw(zn.x, zn.y);
      out.push({
        id: `${i.id}:zone:${zn.kind}`,
        kind: 'zone',
        ref: `${zn.label} (${ref})`,
        obb: { cx: c.x, cy: c.y, w: zn.w, d: zn.d, rot: i.rot },
        z0: 0,
        z1: 200,
        hard: false,
        movable: true,
        sourceId: i.id,
      });
    }
  }
  return out;
}

export const obstacleCorners = (o: Obstacle) => obbCorners(o.obb);
