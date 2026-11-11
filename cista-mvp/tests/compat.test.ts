import { describe, expect, it } from 'vitest';
import { evaluateFit, fitInBox } from '../src/model/compat';
import { demoProject } from '../src/data/demo-project';
import type { Item, Project } from '../src/model/types';
import { againstTop, fixture, room } from './helpers';

const fit = (p: Project, slot: Item, w: number | null, d: number | null, h: number | null, openDepth?: number) =>
  evaluateFit(p, slot, { w, d, h, openDepth });

describe('stanza rettangolare 300 × 400', () => {
  const base = () => room(300, 400);

  it('1. lo stesso mobile del modello è compatibile', () => {
    const p = base();
    const s = againstTop('wardrobe', 100, 100, 60, 200);
    p.items.push(s);
    expect(fit(p, s, 100, 60, 200).status).toBe('ok');
  });

  it('2. più largo della stanza: non entra, con la differenza in cm', () => {
    const p = base();
    const s = againstTop('wardrobe', 100, 100, 60, 200);
    p.items.push(s);
    const r = fit(p, s, 320, 60, 200);
    expect(r.status).toBe('no');
    expect(r.reasons[0]).toMatch(/È largo 320 cm: 20 cm più dello spazio/);
  });

  it('3. entro la tolleranza di 2 cm: con riserva', () => {
    const p = base();
    const s = againstTop('wardrobe', 100, 100, 60, 200);
    p.items.push(s);
    expect(fit(p, s, 301.5, 60, 200).status).toBe('warn');
  });

  it('4. più alto del soffitto: non entra', () => {
    const p = base();
    const s = againstTop('wardrobe', 100, 100, 60, 200);
    p.items.push(s);
    const r = fit(p, s, 100, 60, 262);
    expect(r.status).toBe('no');
    expect(r.reasons.join(' ')).toMatch(/soffitto/);
  });

  it('5. armadio alto 236: ci sta ma avvisa per il montaggio', () => {
    const p = base();
    const s = againstTop('wardrobe', 100, 100, 60, 200);
    p.items.push(s);
    const r = fit(p, s, 100, 60, 236);
    expect(r.status).toBe('warn');
    expect(r.reasons.join(' ')).toMatch(/restano solo 24 cm/);
  });

  it('6. misura mancante: con riserva e lo dice', () => {
    const p = base();
    const s = againstTop('wardrobe', 100, 100, 60, 200);
    p.items.push(s);
    const r = fit(p, s, 100, null, 200);
    expect(r.status).toBe('warn');
    expect(r.reasons[0]).toMatch(/Profondità non indicata/);
  });

  it('7. scivola lungo la parete se c’è spazio libero di lato', () => {
    const p = base();
    const s = againstTop('wardrobe', 0, 100, 60, 200);
    p.items.push(s);
    const r = fit(p, s, 140, 60, 200);
    expect(r.status).toBe('ok');
    // il centro del prodotto si sposta per non entrare nel muro di sinistra
    expect(r.place.x).toBeCloseTo(70, 0);
  });

  it('8. un pilastro di lato riduce lo spazio e viene nominato', () => {
    const p = base();
    p.fixtures.push(fixture('pillar', 'Pilastro', 200, 0, 240, 40, 0, 260));
    const s = againstTop('wardrobe', 50, 100, 60, 200);
    p.items.push(s);
    const r = fit(p, s, 210, 60, 200);
    expect(r.status).toBe('no');
    expect(r.reasons[0]).toMatch(/il pilastro/);
  });

  it('9. passaggio davanti sufficiente: compatibile, con i cm nelle note', () => {
    const p = base();
    const s = againstTop('dresser', 100, 100, 35, 83);
    const bed = { ...againstTop('bed', 70, 160, 200, 100), y: 400 - 100, rot: 180 };
    p.items.push(s, bed);
    const r = fit(p, s, 100, 35, 83);
    expect(r.status).toBe('ok');
    expect(r.frontGap).toBeCloseTo(165, 0);
  });

  it('10. passaggio tra comò e letto sotto il minimo: non entra', () => {
    const p = base();
    const s = againstTop('dresser', 100, 100, 35, 83);
    const bed = { ...againstTop('bed', 70, 160, 300, 100), y: 400 - 150, rot: 180 };
    p.items.push(s, bed);
    const r = fit(p, s, 100, 35, 83);
    // fronte del comò a 35, piedi del letto a 100: restano 65
    expect(r.status).toBe('ok');
    const deep = fit(p, s, 100, 70, 83);
    expect(deep.status).toBe('no');
    expect(deep.reasons[0]).toMatch(/troppo pochi per passare/);
  });

  it('11. passaggio tra minimo e comodo: con riserva «si passa, ma di lato»', () => {
    const p = base();
    const s = againstTop('dresser', 100, 100, 35, 83);
    const bed = { ...againstTop('bed', 70, 160, 300, 100), y: 400 - 150, rot: 180 };
    p.items.push(s, bed);
    const r = fit(p, s, 100, 58, 83);
    expect(r.status).toBe('warn');
    expect(r.reasons[0]).toMatch(/si passa, ma di lato/);
    expect(r.reasons[0]).toMatch(/23 più del modello/);
  });

  it('12. ostacolo in alto: oltre la tolleranza non entra', () => {
    const p = base();
    p.fixtures.push(fixture('obstacle', 'Motore del condizionatore', 0, 0, 45, 80, 144, 199));
    const s = againstTop('drying-rack', 0, 70, 60, 137);
    p.items.push(s);
    expect(fit(p, s, 70, 60, 137).status).toBe('ok');
    const r = fit(p, s, 70, 70, 168);
    expect(r.status).toBe('no');
    expect(r.reasons[0]).toMatch(/supera di 24 cm il motore del condizionatore, che parte da 144/);
  });

  it('13. ostacolo in alto entro la tolleranza: con riserva', () => {
    const p = base();
    p.fixtures.push(fixture('obstacle', 'Motore del condizionatore', 0, 0, 45, 80, 144, 199));
    const s = againstTop('drying-rack', 0, 70, 60, 137);
    p.items.push(s);
    expect(fit(p, s, 76.5, 70, 145).status).toBe('warn');
  });

  it('14. la porta che si apre limita lo spazio e viene nominata', () => {
    const p = base();
    const top = p.walls[0];
    p.openings.push({ id: 'o', wallId: top.id, kind: 'door', offset: 12 + 250, width: 80, height: 210, sill: 0, hinge: 'end', side: 1 });
    const s = againstTop('wardrobe', 20, 100, 60, 200);
    p.items.push(s);
    const r = fit(p, s, 220, 60, 200);
    expect(r.status).toBe('no');
    expect(r.reasons[0]).toMatch(/la porta|la fine della parete/);
  });

  it('15. un mobile spostabile accanto: con riserva «entra spostando»', () => {
    const p = base();
    const s = againstTop('bed', 0, 160, 200, 100);
    const ns = againstTop('nightstand', 162, 30, 35, 50);
    p.items.push(s, ns);
    const r = fit(p, s, 170, 200, 100);
    expect(r.status).toBe('warn');
    expect(r.reasons[0]).toMatch(/entra spostando il comodino/);
  });

  it('16. divano letto: aperto urta il muro di fronte', () => {
    const p = room(300, 200);
    const s = againstTop('sofa-bed', 30, 200, 85, 84, { params: { openDepth: 180 } });
    p.items.push(s);
    expect(fit(p, s, 200, 85, 84, 180).status).toBe('ok');
    const r = fit(p, s, 200, 85, 84, 215);
    expect(r.status).toBe('no');
    expect(r.reasons[0]).toMatch(/Aperto arriva a 215 cm dalla parete: urta il muro/);
  });

  it('17. divano letto: aperto tocca una sedia spostabile', () => {
    const p = room(300, 300);
    const s = againstTop('sofa-bed', 30, 200, 85, 84);
    const chair = { ...againstTop('office-chair', 100, 65, 65, 116), y: 300 - 120, rot: 180 };
    p.items.push(s, chair);
    const r = fit(p, s, 200, 85, 84, 220);
    expect(r.status).toBe('warn');
    expect(r.reasons[0]).toMatch(/va spostata ogni volta/);
  });

  it('18. armadio a battente davanti a un letto: le ante urtano il letto', () => {
    const p = room(300, 300);
    const s = againstTop('wardrobe', 100, 100, 60, 200);
    const bed = { ...againstTop('bed', 70, 160, 200, 100), y: 300 - 100, rot: 180 };
    p.items.push(s, bed);
    const r = fit(p, s, 100, 60, 200);
    expect(['warn', 'no']).toContain(r.status);
  });

  it('19. non può andare oltre la fine della parete (varco)', () => {
    let p = room(400, 300);
    const top = p.walls[0];
    p.openings.push({ id: 'g', wallId: top.id, kind: 'gap', offset: 12 + 300, width: 100, height: 210, sill: 0, hinge: 'end', side: 1 });
    const s = againstTop('sofa', 50, 200, 90, 85);
    p.items.push(s);
    p = { ...p };
    const r = fit(p, s, 260, 90, 85);
    expect(r.status).toBe('no');
    expect(r.reasons[0]).toMatch(/la fine della parete/);
  });

  it('20. occupare lo spazio di apertura di un armadio a muro dà un avviso', () => {
    const p = room(300, 300);
    p.fixtures.push({ ...fixture('closet', 'Armadio a muro', 0, 0, 150, 60, 0, 240), frontClearance: 50 });
    const s = { ...againstTop('nightstand', 160, 40, 35, 50) };
    p.items.push(s);
    const r = fit(p, s, 40, 35, 50);
    expect(r.status).toBe('ok');
    const big = { ...againstTop('dresser', 0, 100, 40, 80), y: 60 + 20 + 30 };
    p.items.push(big);
    expect(fit(p, big, 100, 40, 80).reasons.join(' ')).toMatch(/lo spazio per aprire le ante/);
  });
});

describe('appartamento demo (misure reali)', () => {
  const p = demoProject();
  const slot = (type: string, n = 0) => p.items.filter((i) => i.type === type)[n];

  it('21. stendino Gimi Modular 3 (71 × 71 × 132): compatibile, 12 cm sotto il motore', () => {
    const r = fit(p, slot('drying-rack'), 71, 71, 132);
    expect(r.status).toBe('ok');
    expect(r.notes.join(' ')).toMatch(/Sotto il motore del condizionatore restano 12 cm/);
  });

  it('22. stendino a torre alto 168: non entra per il motore', () => {
    const r = fit(p, slot('drying-rack'), 70, 70, 168);
    expect(r.status).toBe('no');
    expect(r.reasons[0]).toMatch(/supera di 24 cm il motore del condizionatore/);
  });

  it('23. stendino orizzontale lungo 173: non entra in 80 cm', () => {
    expect(fit(p, slot('drying-rack'), 173, 57, 103).status).toBe('no');
  });

  it('24. lo spazio dello stendino tra lavatrice e finestra è di circa 80 cm', () => {
    const r = fit(p, slot('drying-rack'), 71, 71, 132);
    expect(r.gapWidth!).toBeGreaterThan(79);
    expect(r.gapWidth!).toBeLessThan(82);
  });

  it('25. divano letto da 2,30 m nella camera 1: lo spazio lungo la parete è circa 277 cm (283 − termosifone)', () => {
    const r = fit(p, slot('sofa-bed'), 230, 85, 84, 220);
    expect(r.gapWidth!).toBeGreaterThan(274);
    expect(r.gapWidth!).toBeLessThan(280);
    expect(r.status).toBe('warn'); // aperto tocca la sedia della scrivania
  });

  it('26. letto 150 × 190 (Leroy Merlin): compatibile in camera 2', () => {
    expect(fit(p, slot('bed'), 150, 190, 30).status).toBe('ok');
  });

  it('27. letto lungo 209 cm: ai piedi restano meno di 40 cm, non entra', () => {
    const r = fit(p, slot('bed'), 156, 209, 100);
    expect(r.status).toBe('no');
    expect(r.reasons.join(' ')).toMatch(/troppo pochi per passare/);
  });

  it('28. comò profondo 35: compatibile; profondo 44: non entra', () => {
    expect(fit(p, slot('dresser'), 90, 35, 75).status).toBe('ok');
    expect(fit(p, slot('dresser'), 60, 44, 57).status).toBe('no');
  });

  it('29. scarpiera profonda 35 nel corridoio da 111: restano 76 cm', () => {
    const r = fit(p, slot('shoe-cabinet'), 58, 35, 186);
    expect(r.frontGap!).toBeGreaterThan(74);
    expect(r.frontGap!).toBeLessThan(78);
    expect(r.status).toBe('ok');
  });

  it('30. armadio 100 × 60 in camera 1: compatibile; alto 236: con riserva per il montaggio', () => {
    expect(fit(p, slot('wardrobe'), 100, 60, 201).status).toBe('ok');
    expect(fit(p, slot('wardrobe'), 100, 60, 236).status).toBe('warn');
  });

  it('31. scrivania 140 in camera 1: la sedia davanti non conta come ostacolo', () => {
    expect(fit(p, slot('desk', 1), 140, 60, 75).status).toBe('ok');
  });
});

describe('verifica in uno spazio rettangolare (pagine «ci sta?»)', () => {
  it('32. dentro lo spazio: compatibile con i cm che restano', () => {
    const r = fitInBox({ w: 99, d: 80, h: 140 }, { w: 71, d: 71, h: 132 });
    expect(r.status).toBe('ok');
    expect(r.reasons[0]).toMatch(/Restano 28 cm in larghezza e 9 in profondità/);
  });
  it('33. troppo alto: non entra', () => {
    expect(fitInBox({ w: 99, d: 80, h: 140 }, { w: 73, d: 64, h: 172 }).status).toBe('no');
  });
  it('34. misura mancante: con riserva', () => {
    expect(fitInBox({ w: 99, d: 80, h: 140 }, { w: 71, d: null, h: 132 }).status).toBe('warn');
  });
});
