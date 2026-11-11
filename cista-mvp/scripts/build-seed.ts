/**
 * Costruisce data/seed-products.json dai prodotti reali raccolti durante il rilievo (IKEA España,
 * Leroy Merlin España, Amazon.es), normalizzando categorie e misure con il parser deterministico.
 * Fonte: data/sources/session-products-2026-10.json (schede consultate su fonti pubbliche, ottobre–novembre 2026).
 *
 *   npm run seed
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseDims, parseOpenDepth } from '../src/model/dims';
import type { Product } from '../src/model/types';

type Raw = {
  id: string;
  brand: string;
  name: string;
  color: string;
  dims: string;
  price: number | null;
  note: string;
  url: string;
  rating?: number;
  nrat?: number;
  qty?: number | null;
};

const CATEGORY: Record<string, string> = {
  'pranzo-tavolo': 'dining-table',
  'pranzo-sedie': 'chair',
  divano: 'sofa-chaise',
  tavolino: 'coffee-table',
  'mobile-tv': 'tv-unit',
  'scrivania-soggiorno': 'desk',
  'scrivania-c1': 'desk',
  'sedia-uff': 'office-chair',
  'armadio-c1': 'wardrobe',
  'libreria-c1': 'bookcase',
  'divanoletto-c1': 'sofa-bed',
  'letto-c2': 'bed',
  'comodini-c2': 'nightstand',
  'como-c2': 'dresser',
  scarpiere: 'shoe-cabinet',
  stendino: 'drying-rack',
};

// correzioni da fonti verificate durante la ricerca (scheda prodotto o confronto tra più fonti)
const PATCH: Record<string, Partial<Product>> = {
  'lm-msv': { w: 70, d: 60, h: 137, dimsConfidence: 0.85, note: 'Misure 70 × 60 × 137 da scheda Leroy Merlin; il titolo indica 30 m di filo, la scheda 23 m.' },
  'lm-torre-70': { w: 70, d: 70, h: 168 },
  // IKEA España, scheda prodotto: stendini orizzontali (misure da aperti)
  '50228755': { w: 173, d: 57, h: 103, dimsConfidence: 0.85 },
  '40244831': { w: 134, d: 59, h: 93, dimsConfidence: 0.85 },
  'az-vileda-mixer3': { h: 137, note: 'Amazon indica 132 cm, altre schede 137: uso il valore più alto.' },
};

const FETCHED: Record<string, string> = { IKEA: '2026-10-29', 'Leroy Merlin': '2026-10-29', Amazon: '2026-11-08' };

const src = JSON.parse(fs.readFileSync(path.resolve('data/sources/session-products-2026-10.json'), 'utf8')) as Record<string, Raw[]>;
const out = new Map<string, Product>();
const skuOf = (r: Raw) =>
  r.id.replace(/^(lm|az)-/, '') ||
  r.url.match(/(\d{8})(?:\.html|\/?$)/)?.[1] ||
  r.id;

for (const [slot, list] of Object.entries(src)) {
  const category = CATEGORY[slot];
  if (!category) continue;
  for (const r of list) {
    const id = r.brand === 'IKEA' ? `ikea-${r.id}` : r.id;
    if (out.has(id)) continue;
    const parsed = parseDims(`${r.dims}`);
    let { w, d, h } = parsed;
    let confidence = parsed.confidence;
    // letti: l'ingombro reale (testiera compresa) è nella nota «Ingombro 197 × 156 cm»
    const ing = r.note.match(/Ingombro (?:circa )?(\d+(?:[.,]\d+)?) × (\d+(?:[.,]\d+)?)/);
    if (category === 'bed' && ing) {
      d = parseFloat(ing[1].replace(',', '.'));
      w = parseFloat(ing[2].replace(',', '.'));
      confidence = Math.max(confidence, 0.85);
    }
    const openDepth = category === 'sofa-bed' ? parseOpenDepth(r.note) : null;
    const ref = r.note.match(/(?:Ref\.|ASIN)\s*([A-Z0-9]+)/)?.[1];
    const p: Product = {
      id,
      retailer: r.brand,
      sku: ref ?? skuOf(r),
      title: r.name,
      color: r.color,
      category,
      w,
      d,
      h,
      openDepth,
      pack: /Pack (\d+)/i.exec(r.name) ? Number(/Pack (\d+)/i.exec(r.name)![1]) : undefined,
      price: r.price,
      currency: 'EUR',
      url: r.url,
      fetchedAt: FETCHED[r.brand] ?? '2026-10-29',
      dimsSource: 'manual',
      dimsConfidence: Math.round(confidence * 100) / 100,
      dimsText: r.dims,
      rating: r.rating,
      ratingCount: r.nrat,
    };
    Object.assign(p, PATCH[r.id] ?? {});
    out.set(id, p);
  }
}

// prodotti importati dai feed (npm run import:awin / import:csv / import:amazon)
const impDir = path.resolve('data/imported');
for (const f of fs.existsSync(impDir) ? fs.readdirSync(impDir).filter((x) => x.endsWith('.json')) : []) {
  for (const p of JSON.parse(fs.readFileSync(path.join(impDir, f), 'utf8')) as Product[]) if (!out.has(p.id)) out.set(p.id, p);
}

const products = [...out.values()];
fs.writeFileSync(path.resolve('data/seed-products.json'), JSON.stringify(products, null, 1) + '\n');
const by = products.reduce<Record<string, number>>((a, p) => ((a[p.category] = (a[p.category] ?? 0) + 1), a), {});
const low = products.filter((p) => p.dimsConfidence < 0.8).length;
console.log(`${products.length} prodotti, ${low} da rivedere`, by);
