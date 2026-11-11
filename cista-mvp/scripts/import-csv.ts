/**
 * Importa prodotti da un CSV preparato a mano o esportato da un altro programma di affiliazione.
 * Colonne riconosciute: retailer, sku, title, url, price, color, category (opzionale), w, d, h (opzionali), dims (testo).
 *
 *   npm run import:csv -- percorso/prodotti.csv
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseCsv } from './lib/csv';
import { price, toProduct } from './lib/normalize';
import type { Product } from '../src/model/types';

const file = process.argv[2];
if (!file) {
  console.error('Uso: npm run import:csv -- percorso/prodotti.csv');
  process.exit(1);
}
const rows = parseCsv(fs.readFileSync(file, 'utf8'));
const out: Product[] = [];
for (const r of rows) {
  const p = toProduct({
    id: `csv-${(r.retailer || 'x').toLowerCase().replace(/\W+/g, '')}-${r.sku}`,
    retailer: r.retailer,
    sku: r.sku,
    title: r.title,
    url: r.url,
    price: price(r.price),
    color: r.color,
    category: r.category || null,
    dimsText: r.dims || `${r.w} x ${r.d} x ${r.h} cm`,
    source: 'manual',
  });
  if (!p) continue;
  // misure esplicite: prevalgono sul testo
  for (const k of ['w', 'd', 'h'] as const) if (r[k]) p[k] = Number(r[k].replace(',', '.'));
  if (r.w && r.d && r.h) p.dimsConfidence = 1;
  out.push(p);
}
const dest = path.join('data/imported', `csv-${path.basename(file, '.csv')}.json`);
fs.mkdirSync('data/imported', { recursive: true });
fs.writeFileSync(dest, JSON.stringify(out, null, 1) + '\n');
console.log(`${out.length} prodotti → ${dest}`);
