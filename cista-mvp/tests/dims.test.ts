import { describe, expect, it } from 'vitest';
import { parseDims, parseOpenDepth } from '../src/model/dims';

describe('estrazione delle misure', () => {
  const cases: [string, number | null, number | null, number | null][] = [
    ['140 × 80 cm · h 75', 140, 80, 75],
    ['Escritorio 120x60x75 cm Roble y blanco', 120, 60, 75],
    ['Mesa Centro rectangular, Medidas 45x110x55 cm (Alto-Ancho-Fondo). Marco recto.', 110, 55, 45],
    ['Armario 2 puertas acabado roble cortez/blanco 200 cm(alto)100 cm(ancho)50 cm(fondo)', 100, 50, 200],
    ['Medidas: 140 cm (largo) x 80 cm (ancho) x 76,5 cm (alto)', 140, 80, 76.5],
    ['Mesita de noche 25x20x60 cm en metacrilato', 25, 20, 60],
    ['Escritorio 1200 x 600 mm', 120, 60, null],
    ['L 120 × P 60 × H 75 cm', 120, 60, 75],
    ['71 × 71 cm · h 132–137', 71, 71, 137],
    ['profondo 60 · h 137', null, 60, 137],
    ['circa 190 cm di larghezza', 190, null, null],
    ['Tendedero 3 Alturas Plegable, Vertical, Metal y PP, 47x41x136 cm', 47, 41, 136],
  ];
  for (const [text, w, d, h] of cases) {
    it(text, () => {
      const r = parseDims(text);
      expect([r.w, r.d, r.h]).toEqual([w, d, h]);
    });
  }

  it('confidenza alta con le etichette, bassa con una sola misura', () => {
    expect(parseDims('200 cm(alto)100 cm(ancho)50 cm(fondo)').confidence).toBeGreaterThanOrEqual(0.9);
    expect(parseDims('circa 190 cm di larghezza').confidence).toBeLessThan(0.8);
    expect(parseDims('nessuna misura').confidence).toBe(0);
  });

  it('armadio con altezza minore della profondità: confidenza bassa (dati incoerenti)', () => {
    expect(parseDims('Armario 100x200x50 cm').confidence).toBeLessThan(0.8);
  });

  it('ingombro da aperto dei divani letto', () => {
    expect(parseOpenDepth('Aperto arriva a circa 200 cm dalla parete')).toBe(200);
    expect(parseOpenDepth('profundidad abierto 223 cm')).toBe(223);
    expect(parseOpenDepth('nessuna indicazione')).toBeNull();
  });
});
