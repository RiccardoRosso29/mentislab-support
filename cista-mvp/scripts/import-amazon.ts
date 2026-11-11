/**
 * Amazon.es: catalogo dalla Creators API (che sostituisce la Product Advertising API 5.0, dismessa nel 2026).
 *
 * L'accesso alla Creators API richiede un account Affiliazione Amazon approvato e, di norma, vendite già generate;
 * le credenziali si creano in Associates Central (OAuth 2.0, le vecchie chiavi AWS non funzionano).
 * Finché l'accesso non c'è, questo script lavora in modalità «elenco ASIN»: legge un CSV curato a mano
 * (asin, title, w, d, h, price, category, color) e produce prodotti con il link alla scheda; il tag di
 * affiliazione viene aggiunto dal sito (VITE_AMAZON_TAG).
 *
 *   npm run import:amazon -- --asins data/fixtures/amazon-asins.csv
 *
 * Documentazione: programma-affiliazione.amazon.it/creatorsapi/docs/en-us/migrating-to-creatorsapi-from-paapi
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseCsv } from './lib/csv';
import { price, toProduct } from './lib/normalize';
import type { Product } from '../src/model/types';

async function fromCreatorsApi(): Promise<Product[]> {
  // Gli endpoint e i nomi dei campi vanno presi dalla documentazione della Creators API al momento dell'accesso:
  // non li indoviniamo qui. Implementare: token OAuth (client credentials) → ricerca per parola chiave o ASIN →
  // mappatura di titolo, prezzo, immagine e attributi «ItemDimensions» in toProduct().
  throw new Error('Creators API non ancora configurata: usa --asins finché l’account non ha accesso (vedi commento in testa al file).');
}

async function main() {
  const args = process.argv.slice(2);
  const i = args.indexOf('--asins');
  let products: Product[];
  if (i >= 0) {
    products = parseCsv(fs.readFileSync(args[i + 1], 'utf8'))
      .map((r) => {
        const p = toProduct({
          id: `az-${r.asin.toLowerCase()}`,
          retailer: 'Amazon',
          sku: r.asin,
          title: r.title,
          url: `https://www.amazon.es/dp/${r.asin}`,
          price: price(r.price),
          color: r.color,
          category: r.category || null,
          dimsText: r.dims || `${r.w} x ${r.d} x ${r.h} cm`,
          source: 'manual',
        });
        if (p && r.w && r.d && r.h) Object.assign(p, { w: +r.w, d: +r.d, h: +r.h, dimsConfidence: 1 });
        return p;
      })
      .filter((p): p is Product => !!p);
  } else if (process.env.AMAZON_CREATORS_CLIENT_ID) {
    products = await fromCreatorsApi();
  } else {
    console.error('Usa --asins <file.csv> oppure configura le credenziali della Creators API (.env.example).');
    process.exit(1);
  }
  const dest = path.join('data/imported', 'amazon.json');
  fs.mkdirSync('data/imported', { recursive: true });
  fs.writeFileSync(dest, JSON.stringify(products, null, 1) + '\n');
  console.log(`${products.length} prodotti Amazon → ${dest}`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
