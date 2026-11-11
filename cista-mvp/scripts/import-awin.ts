/**
 * Importa i prodotti di arredamento dai feed Awin (Leroy Merlin, Conforama, ManoMano, ...).
 *
 *   npm run import:awin                          # con AWIN_FEED_API_KEY e AWIN_ADVERTISER_IDS nel .env
 *   npm run import:awin -- --fixture data/fixtures/awin-sample.csv   # prova offline
 *
 * Dopo l'importazione: `npm run seed` unisce data/imported/*.json al catalogo del sito.
 * Documentazione Awin: wiki.awin.com/index.php/Product_Feed_List_Download e Downloading_feeds_using_Create-a-Feed.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { parseCsv } from './lib/csv';
import { price, toProduct } from './lib/normalize';
import type { Product } from '../src/model/types';

const pick = (row: Record<string, string>, ...keys: string[]) => {
  for (const k of keys) {
    const hit = Object.keys(row).find((h) => h.toLowerCase().replace(/\W+/g, '_') === k);
    if (hit && row[hit]) return row[hit];
  }
  return '';
};

/** una riga del feed Awin → prodotto del catalogo (null se non è un mobile che sappiamo verificare) */
export function awinRowToProduct(row: Record<string, string>): Product | null {
  const merchant = pick(row, 'merchant_name', 'advertiser_name') || 'Awin';
  const sku = pick(row, 'merchant_product_id', 'aw_product_id');
  const url = pick(row, 'merchant_deep_link', 'aw_deep_link');
  if (!sku || !url) return null;
  const dimsText = [pick(row, 'dimensions'), pick(row, 'product_name'), pick(row, 'specifications'), pick(row, 'product_short_description'), pick(row, 'description')]
    .filter(Boolean)
    .join(' · ');
  const p = toProduct({
    id: `awin-${pick(row, 'merchant_id', 'advertiser_id') || merchant}-${sku}`.toLowerCase().replace(/[^a-z0-9-]+/g, '-'),
    retailer: merchant.replace(/\s+(ES|IT)$/i, ''),
    sku,
    title: pick(row, 'product_name'),
    url,
    price: price(pick(row, 'search_price', 'store_price', 'display_price')),
    color: pick(row, 'colour', 'color'),
    category: null,
    dimsText,
    image: pick(row, 'merchant_image_url', 'aw_image_url') || undefined,
    source: 'feed',
    fetchedAt: (pick(row, 'last_updated') || new Date().toISOString()).slice(0, 10),
  });
  if (!p) return null;
  const tracked = pick(row, 'aw_deep_link');
  return tracked ? { ...p, affiliateUrl: tracked } : p;
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} su ${new URL(url).host}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return (buf[0] === 0x1f && buf[1] === 0x8b ? zlib.gunzipSync(buf) : buf).toString('utf8');
}

async function main() {
  const args = process.argv.slice(2);
  const fx = args.indexOf('--fixture');
  const feeds: { name: string; csv: string }[] = [];
  if (fx >= 0) {
    feeds.push({ name: path.basename(args[fx + 1], '.csv'), csv: fs.readFileSync(args[fx + 1], 'utf8') });
  } else {
    const key = process.env.AWIN_FEED_API_KEY;
    if (!key) {
      console.error('Manca AWIN_FEED_API_KEY (chiave dei feed, diversa da quella dell’API publisher): vedi .env.example.');
      process.exit(1);
    }
    const wanted = new Set((process.env.AWIN_ADVERTISER_IDS ?? '').split(',').map((s) => s.trim()).filter(Boolean));
    const list = parseCsv(await fetchText(`https://productdata.awin.com/datafeed/list/apikey/${key}`));
    for (const row of list) {
      const id = pick(row, 'advertiser_id');
      const joined = /joined|active|approved/i.test(pick(row, 'membership_status') || 'joined');
      const url = pick(row, 'url', 'download_url');
      if (!url || !joined || (wanted.size && !wanted.has(id))) continue;
      feeds.push({ name: `awin-${id}`, csv: await fetchText(url) });
    }
  }
  fs.mkdirSync('data/imported', { recursive: true });
  for (const f of feeds) {
    const rows = parseCsv(f.csv);
    const products = rows.map(awinRowToProduct).filter((p): p is Product => !!p);
    const out = path.join('data/imported', `${f.name}.json`);
    fs.writeFileSync(out, JSON.stringify(products, null, 1) + '\n');
    const low = products.filter((p) => p.dimsConfidence < 0.8).length;
    console.log(`${f.name}: ${rows.length} righe, ${products.length} mobili importati (${low} da rivedere) → ${out}`);
  }
}

if (process.argv[1]?.includes('import-awin')) main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
