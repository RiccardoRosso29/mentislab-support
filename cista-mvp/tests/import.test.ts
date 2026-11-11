import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseCsv } from '../scripts/lib/csv';
import { awinRowToProduct } from '../scripts/import-awin';
import { classify } from '../scripts/lib/normalize';

describe('importazione dai feed', () => {
  const rows = parseCsv(fs.readFileSync('data/fixtures/awin-sample.csv', 'utf8'));

  it('legge il CSV con virgolette e virgole decimali', () => {
    expect(rows).toHaveLength(4);
    expect(rows[0].search_price).toBe('191,00');
  });

  it('riga Awin → prodotto con categoria, misure, prezzo e link tracciato', () => {
    const p = awinRowToProduct(rows[0])!;
    expect(p.category).toBe('wardrobe');
    expect([p.w, p.d, p.h]).toEqual([100, 50, 200]);
    expect(p.price).toBe(191);
    expect(p.url).toBe('https://example.com/test-001');
    expect(p.affiliateUrl).toMatch(/awin1\.com/);
  });

  it('divano letto: misure dal campo dimensions e ingombro da aperto dalla descrizione', () => {
    const p = awinRowToProduct(rows[2])!;
    expect(p.category).toBe('sofa-bed');
    expect([p.w, p.d, p.h]).toEqual([190, 88, 87]);
  });

  it('scarta i prodotti che non sono mobili verificabili', () => {
    expect(awinRowToProduct(rows[3])).toBeNull();
  });

  it('classifica titoli italiani e spagnoli', () => {
    expect(classify('Mesita de noche estrecha')).toBe('nightstand');
    expect(classify('Scarpiera slim 3 ante')).toBe('shoe-cabinet');
    expect(classify('Silla de oficina ergonómica')).toBe('office-chair');
    expect(classify('Divano letto 3 posti')).toBe('sofa-bed');
  });
});
