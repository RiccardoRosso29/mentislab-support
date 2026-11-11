import type { Dimension, Fixture, Item, Opening, Project, Room, Vec } from '../model/types';
import { addWall } from '../model/project';

/**
 * Appartamento demo (Majadahonda, ≈ 63 m²). Le coordinate sono state ricostruite dalla planimetria
 * in «pixel di pianta» (1 px = 1,34 cm) e convertite qui in centimetri; le misure prese in casa
 * (rilievo di novembre 2026) sono nelle quote `measured: true`.
 */
const K = 1.34;
const OX = 103.04;
const OY = 643.04;
const X = (px: number) => Math.round((px - OX) * K * 10) / 10;
const Y = (py: number) => Math.round((py - OY) * K * 10) / 10;
const P = (x: number, y: number): Vec => ({ x: X(x), y: Y(y) });
const E = 8.96;
const I = 3.73;
const LW = 335 + I - E;
const RW = 585 - I + E;

type OpSpec = { from: number; to: number; kind: Opening['kind']; sill?: number; height?: number; measured?: boolean };
const WALLS: { a: [number, number]; b: [number, number]; ext: boolean; ops?: OpSpec[] }[] = [
  { a: [129.2, 672], b: [262, 672], ext: true, ops: [{ from: 145, to: 188, kind: 'window', sill: 125, height: 80 }] },
  { a: [262, 658], b: [348.6, 658], ext: true, ops: [{ from: 266, to: 339.5, kind: 'window-fixed', sill: 0, height: 205, measured: true }] },
  { a: [348.6, 658], b: [348.6, 695], ext: true },
  { a: [348.6, 695], b: [388, 695], ext: true },
  { a: [388, 665], b: [388, 695], ext: true },
  { a: [388, 665], b: [692, 665], ext: true, ops: [{ from: 400, to: 470, kind: 'window', sill: 100, height: 42 }] },
  { a: [718, 652], b: [812, 652], ext: true, ops: [{ from: 735, to: 795, kind: 'door', height: 210 }] },
  { a: [812, 652], b: [812, 1153], ext: true },
  { a: [RW, 1153], b: [812, 1153], ext: true, ops: [{ from: 660, to: 766, kind: 'window', sill: 95, height: 120 }] },
  { a: [RW, 1153], b: [RW, 1225], ext: true, ops: [{ from: 1172, to: 1220, kind: 'window', sill: 75, height: 140 }] },
  { a: [LW, 1225], b: [RW, 1225], ext: true, ops: [{ from: 370, to: 562, kind: 'window', sill: 75, height: 140 }] },
  { a: [LW, 1156], b: [LW, 1225], ext: true },
  { a: [112, 1156], b: [LW, 1156], ext: true, ops: [{ from: 170, to: 268, kind: 'window', sill: 105, height: 110, measured: true }] },
  { a: [112, 695.9], b: [112, 1156], ext: true },
  { a: [112, 695.9], b: [129.2, 695.9], ext: true },
  { a: [129.2, 672], b: [129.2, 695.9], ext: true },
  { a: [262, 658], b: [262, 878], ext: false, ops: [{ from: 808, to: 865, kind: 'door', height: 205 }] },
  { a: [262, 800], b: [388, 800], ext: false },
  { a: [388, 695], b: [388, 800], ext: false, ops: [{ from: 724, to: 790, kind: 'door', height: 205 }] },
  { a: [580, 797], b: [692, 797], ext: false },
  { a: [112, 878], b: [262, 878], ext: false },
  { a: [262, 878], b: [335, 878], ext: false, ops: [{ from: 270, to: 325, kind: 'door', height: 205 }] },
  { a: [335, 878], b: [335, 1156], ext: false },
  { a: [585, 868], b: [585, 1153], ext: false },
  { a: [585, 868], b: [812, 868], ext: false, ops: [{ from: 589, to: 639, kind: 'gap' }, { from: 741.5, to: 802.7, kind: 'door', height: 205 }] },
];

const rect = (x0: number, y0: number, x1: number, y1: number) => ({
  x: (X(x0) + X(x1)) / 2,
  y: (Y(y0) + Y(y1)) / 2,
  w: Math.abs(X(x1) - X(x0)),
  d: Math.abs(Y(y1) - Y(y0)),
});

let seq = 0;
const id = (p: string) => `${p}-${++seq}`;

function fx(kind: Fixture['kind'], label: string, x0: number, y0: number, x1: number, y1: number, z0: number, z1: number, extra: Partial<Fixture> = {}): Fixture {
  return { id: id('f'), kind, label, rot: 0, z0, z1, ...rect(x0, y0, x1, y1), ...extra };
}

/** mobile dato il centro in px di pianta e la rotazione (fronte: 0 giù, 90 sinistra, 180 su, 270 destra) */
function it(type: string, cxPx: number, cyPx: number, rot: number, w: number, d: number, h: number, extra: Partial<Item> = {}): Item {
  return { id: id('i'), type, x: X(cxPx), y: Y(cyPx), rot, w, d, h, ...extra };
}

export function demoProject(): Project {
  seq = 0;
  let p: Project = {
    version: 1,
    id: 'demo-majadahonda',
    name: 'Casa a Majadahonda (demo)',
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
  for (const w of WALLS) {
    const r = addWall(p, P(...w.a), P(...w.b), { thickness: w.ext ? 24 : 10, kind: w.ext ? 'ext' : 'int', height: 260 });
    p = r.p;
    const horiz = w.a[1] === w.b[1];
    const start = horiz ? w.a[0] : w.a[1];
    for (const o of w.ops ?? []) {
      const width = Math.round((o.to - o.from) * K);
      p.openings.push({
        id: id('o'),
        wallId: r.wall.id,
        kind: o.kind,
        offset: Math.round(((o.from + o.to) / 2 - start) * K * 10) / 10,
        width,
        height: o.height ?? 205,
        sill: o.sill ?? 0,
        hinge: 'end',
        side: 1,
        measured: o.measured,
      });
    }
  }

  const rooms: [string, Room['floor'], [number, number][]][] = [
    ['Bagno', 'tiles-warm', [[138.2, 680.96], [258.27, 680.96], [258.27, 874.27], [120.96, 874.27], [120.96, 704.9], [138.2, 704.9]]],
    ['Lavanderia', 'gres', [[265.73, 666.96], [339.6, 666.96], [339.6, 703.96], [384.27, 703.96], [384.27, 796.27], [265.73, 796.27]]],
    ['Cucina', 'gres', [[391.73, 673.96], [692, 673.96], [692, 793.27], [391.73, 793.27]]],
    ['Soggiorno', 'parquet', [[265.73, 803.73], [391.73, 803.73], [391.73, 797], [580, 797], [580, 800.73], [720.2, 800.73], [720.2, 864.27], [581.27, 864.27], [581.27, 1216.04], [338.73, 1216.04], [338.73, 874.27], [265.73, 874.27]]],
    ['Ingresso', 'parquet', [[720.2, 660.96], [803.04, 660.96], [803.04, 864.27], [720.2, 864.27]]],
    ['Camera 1', 'parquet', [[588.73, 871.73], [803.04, 871.73], [803.04, 1144.04], [618.6, 1144.04], [618.6, 1110.5], [588.73, 1110.5]]],
    ['Camera 2', 'parquet', [[120.96, 881.73], [331.27, 881.73], [331.27, 1122.3], [306.4, 1122.3], [306.4, 1147.04], [145.6, 1147.04], [145.6, 1122.3], [120.96, 1122.3]]],
  ];
  p.rooms = rooms.map(([name, floor, pts]) => ({ id: id('r'), name, floor, poly: pts.map(([x, y]) => P(x, y)) }));

  p.fixtures = [
    // cavedio impianti: muro pieno tra cucina e ingresso (corridoio d'ingresso largo 111 cm misurati)
    fx('pillar', 'Cavedio impianti', 692, 652, 720.2, 797, 0, 260),
    fx('pillar', 'Pilastro', 588.73, 1110.5, 618.6, 1144.04, 0, 260, { measured: true }),
    fx('pillar', 'Pilastro', 120.96, 1122.3, 145.6, 1147.04, 0, 260, { measured: true }),
    fx('pillar', 'Pilastro', 306.4, 1122.3, 331.27, 1147.04, 0, 260, { measured: true }),
    fx('radiator', 'Termosifone', 147.9, 681.7, 189.7, 686, 15, 75, { measured: true }),
    fx('radiator', 'Termosifone', 599.4, 786.3, 665.1, 793.27, 15, 75, { measured: true }),
    fx('radiator', 'Termosifone', 449.2, 1204.8, 514.1, 1216.04, 14, 65, { measured: true }),
    fx('radiator', 'Termosifone', 675, 1139.5, 751, 1144.04, 15, 75),
    fx('radiator', 'Termosifone', 210.9, 1142, 254.2, 1147.04, 15, 60, { measured: true }),
    fx('obstacle', 'Motore del condizionatore', 265.73, 669, 299.3, 729, 144, 199, { measured: true }),
    fx('obstacle', 'Condizionatore', 285, 804, 345, 818, 204, 233),
    fx('kitchen', 'Cucina', 391.73, 673.96, 642, 722, 0, 90),
    fx('obstacle', 'Pensili della cucina', 392, 674, 640, 704, 150, 220),
    fx('appliance', 'Frigorifero', 642, 673.96, 688, 721.4, 0, 186, { frontClearance: 60 }),
    // armadio a muro della camera 1: due ante sulla camera e, a sinistra, un'anta che si apre sul corridoio
    fx('closet', 'Armadio a muro', 639, 864.27, 740, 911, 0, 240, {
      frontClearance: 50,
      sections: [{ label: 'Due ante sulla camera', w: 96, d: 56, shelves: 'mensola a 180 cm' }],
      measured: true,
    }),
    fx('closet', 'Armadio a muro (anta sul corridoio)', 589, 864.27, 639, 911, 0, 240),
    fx('closet', 'Armadio a muro', 120.96, 881.73, 262, 927.6, 0, 240, {
      frontClearance: 50,
      measured: true,
      sections: [
        { label: 'Anta di sinistra', w: 51.5, d: 59, usableW: 48.5, usableD: 53 },
        { label: 'Due ante di destra (interno unito)', w: 107, d: 58.5, usableW: 101, usableD: 53, shelves: 'in basso mensole divise al centro, 51 cm per lato' },
      ],
    }),
    ...[894.1, 1056.8, 1066.4, 1076, 1085.6].map((y) => fx('outlet', 'Presa', 580.3, y - 3, 581.27, y + 3, 28, 36, { measured: true })),
    ...[1164.9, 1174.6].map((y) => fx('outlet', 'Presa', 338.73, y - 3, 339.7, y + 3, 28, 36, { measured: true })),
  ];

  p.items = [
    it('sofa-chaise', 373, 965, 270, 228, 88, 86, { params: { chaiseDepth: 160, chaiseWidth: 84, chaiseSide: 1 } }),
    it('coffee-table', 445, 995, 270, 107, 56, 40),
    it('tv-unit', 568.2, 998.6, 90, 123, 35, 49),
    it('tv', 567.4, 998.6, 90, 123, 8, 76, { z: 50 }),
    it('dining-table', 507.5, 1126, 0, 140, 80, 75),
    it('chair', 482, 1080.2, 0, 43, 45, 90),
    it('chair', 533, 1080.2, 0, 43, 45, 90),
    it('chair', 482, 1174.8, 180, 43, 45, 90),
    it('chair', 533, 1174.8, 180, 43, 45, 90),
    it('desk', 362.5, 1145, 270, 120, 60, 75),
    it('office-chair', 401.4, 1145, 90, 65, 65, 116),
    it('wardrobe', 611.4, 950.3, 270, 100, 60, 200),
    it('desk', 611.4, 1058.25, 270, 140, 60, 75),
    it('office-chair', 650.2, 1058.25, 90, 65, 65, 116),
    it('sofa-bed', 771.3, 1051.2, 90, 230, 85, 84, { params: { openDepth: 220 } }),
    it('bed', 195.6, 1043.9, 270, 160, 200, 105),
    it('nightstand', 132.2, 974.9, 270, 25, 30, 50),
    it('nightstand', 132.2, 1112.97, 270, 25, 30, 50),
    it('dresser', 318, 1043.5, 90, 100, 35, 83),
    it('shoe-cabinet', 790, 743.64, 90, 58, 35, 186),
    it('shoe-cabinet', 790, 787.44, 90, 58, 35, 186),
    it('washing-machine', 288.5, 749.2, 270, 60, 60, 85, { fixed: true }),
    it('drying-rack', 288.1, 696.8, 270, 70, 60, 137),
    it('toilet', 145, 769.85, 270, 40, 64, 80, { fixed: true }),
    it('bidet', 143.5, 730, 270, 36, 60, 40, { fixed: true }),
    it('vanity', 142, 833.5, 270, 80, 56, 88, { fixed: true }),
    it('shower', 230.1, 709, 0, 75, 75, 190, { fixed: true }),
  ];

  // quote: in blu (measured) le misure prese in casa, in grigio con ≈ quelle stimate dal disegno
  const dims: [number, number, number, number, number, string | undefined, boolean][] = [
    [720.2, 705, 803.04, 705, 0, '111', true],
    [745, 660.96, 745, 864.27, 0, '265', true],
    [338.73, 1150, 581.27, 1150, 0, '322', true],
    [566, 871.73, 566, 1216.04, 0, '466', true],
    [352, 881.73, 352, 1216.04, 0, undefined, false],
    [449.2, 1196, 514.1, 1196, 0, '87', true],
    [514.1, 1196, 581.27, 1196, 0, '90', true],
    [588.73, 1085, 803.04, 1085, 0, '283', true],
    [602, 911, 602, 1110.5, 0, '266', true],
    [618.6, 1128, 803.04, 1128, 0, '240', true],
    [588.73, 1100, 618.6, 1100, 0, '40', true],
    [790, 932.8, 790, 1144.04, 0, '283', true],
    [599.4, 780, 665.1, 780, 0, '88', true],
    [665.1, 780, 692, 780, 0, '36', true],
    [265.73, 705, 339.6, 705, 0, '99', true],
    [326, 666.96, 326, 726.7, 0, '80', true],
    [120.96, 712, 138.2, 712, 0, '23', true],
    [182, 704.9, 182, 754.9, 0, '67', true],
    [182, 784.8, 182, 803.5, 0, '25', true],
    [182, 803.5, 182, 863.5, 0, '80', true],
    [202, 750, 258.27, 750, 0, '75', true],
    [250, 737, 250, 808, 0, '95', true],
    [210.9, 1132, 254.2, 1132, 0, '58', true],
    [254.2, 1132, 306.4, 1132, 0, '70', true],
    [120.96, 1010, 331.27, 1010, 0, undefined, false],
    [391.73, 734, 692, 734, 0, undefined, false],
  ];
  p.dims = dims.map(([x0, y0, x1, y1, off, label, measured]): Dimension => ({ id: id('d'), a: P(x0, y0), b: P(x1, y1), offset: off, label, measured }));
  return p;
}
