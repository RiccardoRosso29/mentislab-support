import type { Item } from './types';

/** parte di un mobile, in coordinate locali: x lungo la larghezza (centro 0), y verso il fronte (centro 0), z da terra */
export type Part = {
  x: number;
  y: number;
  z: number;
  w: number;
  d: number;
  h: number;
  mat: Mat;
  shape?: 'box' | 'round' | 'cyl';
};
export type Mat =
  | 'main'
  | 'cushion'
  | 'wood'
  | 'metal'
  | 'white'
  | 'dark'
  | 'glass'
  | 'ceramic'
  | 'linen'
  | 'screen'
  | 'green';

/** rettangolo locale (centro e dimensioni) */
export type LRect = { x: number; y: number; w: number; d: number };

/** zona che deve restare libera davanti o intorno al mobile quando lo si usa */
export type Zone = LRect & { kind: 'door' | 'drawer' | 'open' | 'seat' | 'access'; label: string };

export type FurnitureDef = {
  type: string;
  label: string;
  group: 'Soggiorno' | 'Camera' | 'Studio' | 'Cucina' | 'Bagno' | 'Ingresso e servizio' | 'Decorazione';
  w: number;
  d: number;
  h: number;
  z?: number;
  color: string;
  params?: Record<string, number>;
  /** categoria dei prodotti reali da proporre per questo mobile */
  catalog?: string;
  /** passaggio da lasciare davanti (min = sotto si passa male, comfort = si passa comodi) */
  passage: { min: number; comfort: number };
  /** mobile in mezzo alla stanza: il passaggio si controlla davanti e dietro */
  freestanding?: boolean;
  /** si può mettere davanti alle prese senza avviso */
  parts: (i: Item) => Part[];
  footprint?: (i: Item) => LRect[];
  zones?: (i: Item) => Zone[];
};

const p = (x: number, y: number, z: number, w: number, d: number, h: number, mat: Mat, shape?: Part['shape']): Part => ({
  x,
  y,
  z,
  w,
  d,
  h,
  mat,
  shape,
});
const legs = (w: number, d: number, h: number, s = 4, mat: Mat = 'wood'): Part[] => [
  p(-w / 2 + s / 2 + 1, -d / 2 + s / 2 + 1, 0, s, s, h, mat),
  p(w / 2 - s / 2 - 1, -d / 2 + s / 2 + 1, 0, s, s, h, mat),
  p(-w / 2 + s / 2 + 1, d / 2 - s / 2 - 1, 0, s, s, h, mat),
  p(w / 2 - s / 2 - 1, d / 2 - s / 2 - 1, 0, s, s, h, mat),
];
const P = (i: Item, k: string, def: number) => i.params?.[k] ?? def;

function sofaParts(i: Item, chaise = false): Part[] {
  const { w, d, h } = i;
  const arm = 14;
  const back = 18;
  const seatH = 44;
  const out: Part[] = [
    p(0, 0, 6, w, d, seatH - 6 - 10, 'main', 'round'),
    p(0, -d / 2 + back / 2, seatH - 10, w, back, h - seatH + 10, 'main', 'round'),
    p(-w / 2 + arm / 2, 0, seatH - 10, arm, d, 22, 'main', 'round'),
    p(w / 2 - arm / 2, 0, seatH - 10, arm, d, 22, 'main', 'round'),
  ];
  const n = Math.max(1, Math.round((w - 2 * arm) / 70));
  const cw = (w - 2 * arm) / n;
  for (let k = 0; k < n; k++) {
    const x = -w / 2 + arm + cw * (k + 0.5);
    out.push(p(x, back / 2 + 1, seatH - 10, cw - 2, d - back - 4, 12, 'cushion', 'round'));
    out.push(p(x, -d / 2 + back + 6, seatH + 2, cw - 4, 12, h - seatH - 8, 'cushion', 'round'));
  }
  if (chaise) {
    const cd = P(i, 'chaiseDepth', 160);
    const cwid = P(i, 'chaiseWidth', 90);
    const side = P(i, 'chaiseSide', 1);
    const cx = side * (w / 2 - cwid / 2);
    out.push(p(cx, -d / 2 + cd / 2, 6, cwid, cd, seatH - 16, 'main', 'round'));
    out.push(p(cx, -d / 2 + cd / 2 + 6, seatH - 10, cwid - 4, cd - 14, 12, 'cushion', 'round'));
  }
  for (const [x, y] of [
    [-w / 2 + 4, -d / 2 + 4],
    [w / 2 - 4, -d / 2 + 4],
    [-w / 2 + 4, d / 2 - 4],
    [w / 2 - 4, d / 2 - 4],
  ])
    out.push(p(x, y, 0, 4, 4, 6, 'dark'));
  return out;
}

function cabinetParts(i: Item, doors: number, opts: { drawers?: number; sliding?: boolean; plinth?: number } = {}): Part[] {
  const { w, d, h } = i;
  const z = 0; // la quota della base (item.z) la aggiunge chi disegna
  const pl = opts.plinth ?? 6;
  const out: Part[] = [p(0, -1, z + pl, w, d - 2, h - pl, 'main'), p(0, -1, z, w - 4, d - 6, pl, 'dark')];
  if (opts.drawers) {
    const dh = (h - pl) / opts.drawers;
    for (let k = 0; k < opts.drawers; k++) {
      out.push(p(0, d / 2 - 1, z + pl + dh * k + 0.4, w - 1, 2, dh - 0.8, 'main'));
      out.push(p(0, d / 2 + 0.6, z + pl + dh * (k + 1) - 6, Math.min(16, w / 4), 1.2, 1.4, 'metal'));
    }
  } else {
    const dw = w / Math.max(1, doors);
    for (let k = 0; k < doors; k++) {
      const x = -w / 2 + dw * (k + 0.5);
      const off = opts.sliding ? (k % 2 ? 0 : 2) : 0;
      out.push(p(x, d / 2 - 1 + off, z + pl + 0.4, dw - 0.8, 2, h - pl - 0.8, 'main'));
      const hx = opts.sliding ? x + (k % 2 ? -dw / 2 + 4 : dw / 2 - 4) : x + (k % 2 ? -dw / 2 + 5 : dw / 2 - 5);
      out.push(p(hx, d / 2 + 0.6 + off, z + pl + (h - pl) * 0.45, 1.4, 1.2, Math.min(30, h * 0.15), 'metal'));
    }
  }
  return out;
}

const tableParts = (i: Item, top = 3, mat: Mat = 'wood'): Part[] => [
  p(0, 0, i.h - top, i.w, i.d, top, 'main'),
  ...legs(i.w, i.d, i.h - top, 5, mat),
];

function chairParts(i: Item): Part[] {
  const { w, d, h } = i;
  return [
    p(0, 1, 42, w, d - 2, 4, 'main'),
    p(0, -d / 2 + 2, 46, w, 3, h - 46, 'main'),
    ...legs(w, d, 42, 3, 'main'),
  ];
}

function officeChairParts(i: Item): Part[] {
  const { w, d, h } = i;
  return [
    p(0, 0, 0, w * 0.9, d * 0.9, 4, 'dark', 'cyl'),
    p(0, 0, 4, 6, 6, 40, 'metal', 'cyl'),
    p(0, 2, 44, w * 0.8, d * 0.75, 8, 'main', 'round'),
    p(0, -d / 2 + 6, 52, w * 0.75, 7, h - 52, 'main', 'round'),
    p(-w / 2 + 4, 4, 58, 5, d * 0.5, 4, 'dark'),
    p(w / 2 - 4, 4, 58, 5, d * 0.5, 4, 'dark'),
  ];
}

function bedParts(i: Item): Part[] {
  const { w, d, h } = i;
  const head = 8;
  return [
    p(0, -d / 2 + head / 2, 0, w, head, h, 'main', 'round'),
    p(0, head / 2, 10, w, d - head, 24, 'main', 'round'),
    p(0, head / 2 + 1, 34, w - 6, d - head - 4, 20, 'linen', 'round'),
    p(0, d * 0.12, 54, w - 4, d * 0.62, 4, 'cushion', 'round'),
    ...(w > 120
      ? [p(-w / 4, -d / 2 + head + 16, 54, w / 2 - 10, 26, 12, 'linen', 'round'), p(w / 4, -d / 2 + head + 16, 54, w / 2 - 10, 26, 12, 'linen', 'round')]
      : [p(0, -d / 2 + head + 16, 54, w - 16, 26, 12, 'linen', 'round')]),
  ];
}

export const FURNITURE: FurnitureDef[] = [
  {
    type: 'sofa',
    label: 'Divano',
    group: 'Soggiorno',
    w: 200,
    d: 90,
    h: 85,
    color: '#7c8184',
    catalog: 'sofa',
    passage: { min: 15, comfort: 22 },
    parts: (i) => sofaParts(i),
  },
  {
    type: 'sofa-chaise',
    label: 'Divano con chaise longue',
    group: 'Soggiorno',
    w: 228,
    d: 90,
    h: 86,
    color: '#7c8184',
    params: { chaiseDepth: 160, chaiseWidth: 90, chaiseSide: 1 },
    catalog: 'sofa-chaise',
    passage: { min: 15, comfort: 22 },
    parts: (i) => sofaParts(i, true),
    footprint: (i) => {
      const cd = P(i, 'chaiseDepth', 160);
      const cw = P(i, 'chaiseWidth', 90);
      const side = P(i, 'chaiseSide', 1);
      return [
        { x: 0, y: 0, w: i.w, d: i.d },
        { x: side * (i.w / 2 - cw / 2), y: -i.d / 2 + cd / 2, w: cw, d: cd },
      ];
    },
  },
  {
    type: 'sofa-bed',
    label: 'Divano letto',
    group: 'Camera',
    w: 200,
    d: 85,
    h: 84,
    color: '#8a8f93',
    params: { openDepth: 220 },
    catalog: 'sofa-bed',
    passage: { min: 0, comfort: 0 },
    parts: (i) => sofaParts(i),
    zones: (i) => {
      const od = P(i, 'openDepth', 220);
      const extra = Math.max(0, od - i.d);
      return extra > 0 ? [{ x: 0, y: i.d / 2 + extra / 2, w: i.w, d: extra, kind: 'open', label: 'letto aperto' }] : [];
    },
  },
  {
    type: 'armchair',
    label: 'Poltrona',
    group: 'Soggiorno',
    w: 80,
    d: 85,
    h: 85,
    color: '#a07a5a',
    catalog: 'armchair',
    passage: { min: 30, comfort: 45 },
    parts: (i) => sofaParts(i),
  },
  {
    type: 'coffee-table',
    label: 'Tavolino',
    group: 'Soggiorno',
    w: 110,
    d: 55,
    h: 40,
    color: '#b98f5d',
    catalog: 'coffee-table',
    freestanding: true,
    passage: { min: 18, comfort: 22 },
    parts: (i) => tableParts(i, 4),
  },
  {
    type: 'tv-unit',
    label: 'Mobile TV',
    group: 'Soggiorno',
    w: 123,
    d: 35,
    h: 49,
    color: '#f2f1ec',
    catalog: 'tv-unit',
    passage: { min: 45, comfort: 60 },
    parts: (i) => cabinetParts(i, 2),
  },
  {
    type: 'tv',
    label: 'Televisore',
    group: 'Soggiorno',
    w: 123,
    d: 8,
    h: 76,
    z: 50,
    color: '#15181c',
    passage: { min: 0, comfort: 0 },
    parts: (i) => {
      const z = 0;
      return [p(0, 0, z, 30, i.d + 14, 2, 'dark'), p(0, -1, z + 2, 6, 4, 6, 'dark'), p(0, 0, z + 6, i.w, 4, i.h - 6, 'screen')];
    },
  },
  {
    type: 'sideboard',
    label: 'Credenza',
    group: 'Soggiorno',
    w: 160,
    d: 45,
    h: 80,
    color: '#cdb393',
    catalog: 'sideboard',
    passage: { min: 45, comfort: 60 },
    parts: (i) => cabinetParts(i, 3),
    zones: (i) => [{ x: 0, y: i.d / 2 + 20, w: i.w, d: 40, kind: 'door', label: 'apertura delle ante' }],
  },
  {
    type: 'bookcase',
    label: 'Libreria',
    group: 'Studio',
    w: 80,
    d: 30,
    h: 180,
    color: '#f2f1ec',
    catalog: 'bookcase',
    passage: { min: 45, comfort: 60 },
    parts: (i) => {
      const out: Part[] = [p(-i.w / 2 + 1, 0, 0, 2, i.d, i.h, 'main'), p(i.w / 2 - 1, 0, 0, 2, i.d, i.h, 'main'), p(0, -i.d / 2 + 0.5, 0, i.w, 1, i.h, 'main')];
      const n = Math.max(2, Math.round(i.h / 36));
      for (let k = 0; k <= n; k++) out.push(p(0, 0, (i.h - 2) * (k / n), i.w - 4, i.d - 1, 2, 'main'));
      return out;
    },
  },
  {
    type: 'dining-table',
    label: 'Tavolo da pranzo',
    group: 'Soggiorno',
    w: 140,
    d: 80,
    h: 75,
    color: '#b98f5d',
    catalog: 'dining-table',
    freestanding: true,
    passage: { min: 0, comfort: 0 },
    parts: (i) => tableParts(i),
  },
  {
    type: 'chair',
    label: 'Sedia',
    group: 'Soggiorno',
    w: 43,
    d: 50,
    h: 85,
    color: '#b98f5d',
    catalog: 'chair',
    passage: { min: 0, comfort: 0 },
    parts: chairParts,
    zones: (i) => [{ x: 0, y: -i.d / 2 - 15, w: i.w, d: 30, kind: 'seat', label: 'spazio per arretrare la sedia' }],
  },
  {
    type: 'stool',
    label: 'Sgabello',
    group: 'Cucina',
    w: 38,
    d: 38,
    h: 75,
    color: '#3a3f44',
    passage: { min: 0, comfort: 0 },
    parts: (i) => [p(0, 0, i.h - 4, i.w, i.d, 4, 'main', 'cyl'), ...legs(i.w * 0.8, i.d * 0.8, i.h - 4, 3, 'metal')],
  },
  {
    type: 'desk',
    label: 'Scrivania',
    group: 'Studio',
    w: 120,
    d: 60,
    h: 75,
    color: '#b98f5d',
    catalog: 'desk',
    passage: { min: 0, comfort: 0 },
    parts: (i) => [p(0, 0, i.h - 3.5, i.w, i.d, 3.5, 'main'), ...legs(i.w, i.d, i.h - 3.5, 4, 'white')],
    zones: (i) => [{ x: 0, y: i.d / 2 + 35, w: Math.min(i.w, 80), d: 70, kind: 'seat', label: 'spazio per la sedia' }],
  },
  {
    type: 'office-chair',
    label: 'Sedia da ufficio',
    group: 'Studio',
    w: 65,
    d: 65,
    h: 116,
    color: '#25282b',
    catalog: 'office-chair',
    passage: { min: 0, comfort: 0 },
    parts: officeChairParts,
  },
  {
    type: 'bed',
    label: 'Letto',
    group: 'Camera',
    w: 160,
    d: 200,
    h: 100,
    color: '#c9c2b4',
    catalog: 'bed',
    passage: { min: 40, comfort: 45 },
    parts: bedParts,
  },
  {
    type: 'nightstand',
    label: 'Comodino',
    group: 'Camera',
    w: 40,
    d: 35,
    h: 50,
    color: '#f2f1ec',
    catalog: 'nightstand',
    passage: { min: 0, comfort: 0 },
    parts: (i) => cabinetParts(i, 0, { drawers: 2, plinth: 8 }),
  },
  {
    type: 'dresser',
    label: 'Comò',
    group: 'Camera',
    w: 100,
    d: 45,
    h: 83,
    color: '#f2f1ec',
    catalog: 'dresser',
    passage: { min: 40, comfort: 45 },
    parts: (i) => cabinetParts(i, 0, { drawers: 3 }),
    zones: (i) => [{ x: 0, y: i.d / 2 + 20, w: i.w, d: 40, kind: 'drawer', label: 'apertura dei cassetti' }],
  },
  {
    type: 'wardrobe',
    label: 'Armadio',
    group: 'Camera',
    w: 100,
    d: 60,
    h: 200,
    color: '#f2f1ec',
    params: { sliding: 0 },
    catalog: 'wardrobe',
    passage: { min: 45, comfort: 60 },
    parts: (i) => cabinetParts(i, Math.max(1, Math.round(i.w / 50)), { sliding: P(i, 'sliding', 0) === 1 }),
    zones: (i) => {
      if (P(i, 'sliding', 0) === 1) return [];
      const doorW = Math.min(60, i.w / Math.max(1, Math.round(i.w / 50)));
      return [{ x: 0, y: i.d / 2 + doorW / 2, w: i.w, d: doorW, kind: 'door', label: 'apertura delle ante' }];
    },
  },
  {
    type: 'shoe-cabinet',
    label: 'Scarpiera',
    group: 'Ingresso e servizio',
    w: 60,
    d: 24,
    h: 115,
    color: '#f2f1ec',
    catalog: 'shoe-cabinet',
    passage: { min: 60, comfort: 75 },
    parts: (i) => cabinetParts(i, 0, { drawers: Math.max(2, Math.round(i.h / 45)), plinth: 8 }),
  },
  {
    type: 'drying-rack',
    label: 'Stendino a torre',
    group: 'Ingresso e servizio',
    w: 70,
    d: 60,
    h: 137,
    color: '#f2f2f0',
    catalog: 'drying-rack',
    passage: { min: 0, comfort: 0 },
    parts: (i) => {
      const out: Part[] = [];
      for (const [x, y] of [
        [-i.w / 2 + 1, -i.d / 2 + 1],
        [i.w / 2 - 1, -i.d / 2 + 1],
        [-i.w / 2 + 1, i.d / 2 - 1],
        [i.w / 2 - 1, i.d / 2 - 1],
      ])
        out.push(p(x, y, 0, 2, 2, i.h, 'metal'));
      for (const z of [i.h * 0.3, i.h * 0.6, i.h - 2]) {
        for (let k = 0; k < 9; k++) out.push(p(-i.w / 2 + (i.w * (k + 0.5)) / 9, 0, z, 0.6, i.d, 0.8, 'main'));
        out.push(p(0, -i.d / 2 + 0.5, z, i.w, 1, 1, 'metal'), p(0, i.d / 2 - 0.5, z, i.w, 1, 1, 'metal'));
      }
      return out;
    },
  },
  {
    type: 'washing-machine',
    label: 'Lavatrice',
    group: 'Ingresso e servizio',
    w: 60,
    d: 60,
    h: 85,
    color: '#f5f5f2',
    passage: { min: 0, comfort: 0 },
    parts: (i) => [p(0, 0, 0, i.w, i.d, i.h, 'main'), p(0, i.d / 2, i.h * 0.25, i.w * 0.55, 1, i.w * 0.55, 'glass', 'cyl')],
    zones: (i) => [{ x: 0, y: i.d / 2 + 25, w: i.w, d: 50, kind: 'door', label: 'apertura dell’oblò' }],
  },
  {
    type: 'fridge',
    label: 'Frigorifero',
    group: 'Cucina',
    w: 60,
    d: 65,
    h: 186,
    color: '#f5f5f2',
    passage: { min: 0, comfort: 0 },
    parts: (i) => [p(0, 0, 0, i.w, i.d, i.h, 'main'), p(-i.w / 2 + 5, i.d / 2 + 1, i.h * 0.45, 2, 2, 30, 'metal')],
    zones: (i) => [{ x: 0, y: i.d / 2 + i.w / 2, w: i.w, d: i.w, kind: 'door', label: 'apertura dello sportello' }],
  },
  {
    type: 'kitchen-base',
    label: 'Base cucina',
    group: 'Cucina',
    w: 60,
    d: 60,
    h: 90,
    color: '#b4c21c',
    passage: { min: 0, comfort: 0 },
    parts: (i) => [...cabinetParts({ ...i, h: i.h - 4 }, 1, { plinth: 10 }), p(0, 1, i.h - 4, i.w, i.d + 2, 4, 'white')],
  },
  {
    type: 'kitchen-wall',
    label: 'Pensile',
    group: 'Cucina',
    w: 60,
    d: 35,
    h: 70,
    z: 150,
    color: '#b4c21c',
    passage: { min: 0, comfort: 0 },
    parts: (i) => cabinetParts(i, 1, { plinth: 0 }),
  },
  {
    type: 'shelf',
    label: 'Mensola',
    group: 'Decorazione',
    w: 80,
    d: 25,
    h: 3,
    z: 150,
    color: '#b98f5d',
    passage: { min: 0, comfort: 0 },
    parts: (i) => [p(0, 0, 0, i.w, i.d, i.h, 'main')],
  },
  {
    type: 'toilet',
    label: 'Wc',
    group: 'Bagno',
    w: 40,
    d: 65,
    h: 80,
    color: '#fbfbf9',
    passage: { min: 0, comfort: 0 },
    parts: (i) => [p(0, -i.d / 2 + 9, 40, i.w, 18, 40, 'ceramic'), p(0, 6, 0, i.w * 0.75, i.d - 22, 40, 'ceramic', 'cyl')],
    zones: (i) => [{ x: 0, y: i.d / 2 + 25, w: 70, d: 50, kind: 'access', label: 'spazio davanti al wc' }],
  },
  {
    type: 'bidet',
    label: 'Bidet',
    group: 'Bagno',
    w: 36,
    d: 55,
    h: 40,
    color: '#fbfbf9',
    passage: { min: 0, comfort: 0 },
    parts: (i) => [p(0, 2, 0, i.w, i.d - 6, i.h, 'ceramic', 'cyl')],
  },
  {
    type: 'vanity',
    label: 'Mobile lavabo',
    group: 'Bagno',
    w: 80,
    d: 56,
    h: 88,
    color: '#4a2b1d',
    passage: { min: 0, comfort: 0 },
    parts: (i) => [...cabinetParts({ ...i, h: i.h - 4, d: i.d - 4 }, 0, { drawers: 3, plinth: 30 }), p(0, 0, i.h - 4, i.w, i.d, 4, 'ceramic')],
  },
  {
    type: 'shower',
    label: 'Doccia',
    group: 'Bagno',
    w: 80,
    d: 80,
    h: 190,
    color: '#eef2f3',
    passage: { min: 0, comfort: 0 },
    parts: (i) => [p(0, 0, 0, i.w, i.d, 6, 'ceramic'), p(0, i.d / 2 - 1, 6, i.w, 1.5, i.h - 6, 'glass'), p(-i.w / 2 + 1, 0, 6, 1.5, i.d, i.h - 6, 'glass')],
  },
  {
    type: 'bathtub',
    label: 'Vasca',
    group: 'Bagno',
    w: 170,
    d: 75,
    h: 55,
    color: '#fbfbf9',
    passage: { min: 0, comfort: 0 },
    parts: (i) => [p(0, 0, 0, i.w, i.d, i.h, 'ceramic', 'round')],
  },
  {
    type: 'rug',
    label: 'Tappeto',
    group: 'Decorazione',
    w: 160,
    d: 230,
    h: 1,
    color: '#c9b9a0',
    passage: { min: 0, comfort: 0 },
    parts: (i) => [p(0, 0, 0, i.w, i.d, 1, 'main')],
  },
  {
    type: 'plant',
    label: 'Pianta',
    group: 'Decorazione',
    w: 40,
    d: 40,
    h: 120,
    color: '#5c7a3a',
    passage: { min: 0, comfort: 0 },
    parts: (i) => [p(0, 0, 0, i.w * 0.6, i.d * 0.6, 30, 'white', 'cyl'), p(0, 0, 30, i.w, i.d, i.h - 30, 'green', 'cyl')],
  },
  {
    type: 'floor-lamp',
    label: 'Lampada da terra',
    group: 'Decorazione',
    w: 35,
    d: 35,
    h: 160,
    color: '#e8dcc4',
    passage: { min: 0, comfort: 0 },
    parts: (i) => [p(0, 0, 0, i.w * 0.8, i.d * 0.8, 3, 'dark', 'cyl'), p(0, 0, 3, 2, 2, i.h - 35, 'metal', 'cyl'), p(0, 0, i.h - 32, i.w, i.d, 32, 'main', 'cyl')],
  },
];

export const DEF: Record<string, FurnitureDef> = Object.fromEntries(FURNITURE.map((f) => [f.type, f]));

export const defOf = (type: string): FurnitureDef => DEF[type] ?? DEF['sideboard'];

export function footprintOf(i: Item): LRect[] {
  const def = defOf(i.type);
  return def.footprint ? def.footprint(i) : [{ x: 0, y: 0, w: i.w, d: i.d }];
}

export const zonesOf = (i: Item): Zone[] => defOf(i.type).zones?.(i) ?? [];

export function newItem(type: string, x: number, y: number, rot = 0): Item {
  const def = defOf(type);
  return {
    id: `i-${Math.random().toString(36).slice(2, 9)}`,
    type,
    x,
    y,
    rot,
    w: def.w,
    d: def.d,
    h: def.h,
    z: def.z,
    color: def.color,
    params: def.params ? { ...def.params } : undefined,
  };
}

/** categorie dei prodotti, con l'etichetta da mostrare */
export const CATALOG_LABEL: Record<string, string> = {
  sofa: 'Divani',
  'sofa-chaise': 'Divani con chaise longue',
  'sofa-bed': 'Divani letto',
  'coffee-table': 'Tavolini',
  'tv-unit': 'Mobili TV',
  'dining-table': 'Tavoli da pranzo',
  chair: 'Sedie',
  desk: 'Scrivanie',
  'office-chair': 'Sedie da ufficio',
  bed: 'Letti',
  nightstand: 'Comodini',
  dresser: 'Comò',
  wardrobe: 'Armadi',
  bookcase: 'Librerie',
  'shoe-cabinet': 'Scarpiere',
  'drying-rack': 'Stendini',
  sideboard: 'Credenze',
  armchair: 'Poltrone',
};
