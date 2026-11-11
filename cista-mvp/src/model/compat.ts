import type { FitStatus, Item, Product, Project, Vec } from './types';
import { fmtCm, localExtent, obbCorners, obbOverlap, toWorld, v, type Frame, type OBB } from './geometry';
import { defOf, footprintOf, zonesOf } from './furniture';
import { agree, collectObstacles, prep, type Obstacle } from './obstacles';

export type ProductDims = Pick<Product, 'w' | 'd' | 'h'> & { openDepth?: number | null };

export type FitResult = {
  status: FitStatus;
  /** motivi di «con riserva» o «non entra», con i numeri */
  reasons: string[];
  /** informazioni utili anche quando è compatibile */
  notes: string[];
  /** posizione proposta nel piano (per «prova nel 3D») */
  place: { x: number; y: number; rot: number; w: number; d: number; h: number };
  frontGap?: number;
  gapWidth?: number;
};

/** soglia oltre la quale un ostacolo è «in alto» (motore del condizionatore, pensili): si controlla l'altezza */
const OVERHEAD_Z = 100;
const EPS = 0.5;
const BIG = 2000;
const cm = fmtCm;

type Interval = { x0: number; x1: number; ref: string; id: string; movable: boolean };

/**
 * Verifica se un prodotto ci sta al posto di un mobile (lo «spazio» del mobile).
 * Il prodotto mantiene il retro sulla stessa linea del mobile (contro la parete) e può scorrere lungo la parete
 * finché resta nello spazio libero. I mobili in mezzo alla stanza restano centrati.
 */
export function evaluateFit(p: Project, slot: Item, prod: ProductDims): FitResult {
  const def = defOf(slot.type);
  const tol = p.settings.tolerance;
  const reasons: { level: 'no' | 'warn'; text: string }[] = [];
  const notes: string[] = [];
  const missing: string[] = [];
  const w = prod.w ?? (missing.push('larghezza'), slot.w);
  const d = prod.d ?? (missing.push('profondità'), slot.d);
  const h = prod.h ?? (missing.push('altezza'), slot.h);
  if (missing.length)
    reasons.push({ level: 'warn', text: `${cap(missing.join(', '))} non indicat${missing.length > 1 ? 'e' : 'a'} dal negozio: ho usato la misura del modello, verifica sulla scheda.` });

  const F: Frame = { o: v(slot.x, slot.y), rot: slot.rot };
  const free = !!def.freestanding;
  const yb = free ? -d / 2 : -slot.d / 2; // retro del prodotto
  const yc = yb + d / 2; // centro del prodotto
  const yf = yb + d; // fronte del prodotto
  const z0 = slot.z ?? 0;

  const obstacles = collectObstacles(p, { exclude: [slot.id, ...(slotCompanions(p, slot))] });
  const ground = obstacles.filter((o) => o.hard && o.z0 < OVERHEAD_Z && o.kind !== 'outlet');
  const ext = (o: Obstacle) => localExtent(F, obbCorners(o.obb));

  // fascia occupata dal prodotto lungo la parete (per i divani con chaise conta la parte principale)
  const bandD = slot.type === 'sofa-chaise' ? Math.min(d, slot.d) : d;
  const blocked: Interval[] = [];
  for (const o of ground) {
    const e = ext(o);
    const yOverlap = Math.min(e.y1, yb + bandD) - Math.max(e.y0, yb);
    const zOverlap = Math.min(o.z1, z0 + h) - Math.max(o.z0, z0);
    if (yOverlap > EPS && zOverlap > EPS) blocked.push({ x0: e.x0, x1: e.x1, ref: o.ref, id: o.id, movable: o.movable });
  }
  // il divano con chaise resta allineato dal lato della chaise; gli altri mobili restano centrati sul modello
  const prefer = slot.type === 'sofa-chaise' ? (slot.params?.chaiseSide ?? 1) * (slot.w - w) / 2 : 0;
  // un mobile appoggiato alla parete non può andare oltre la fine della parete che ha dietro (porte, varchi, passaggi)
  if (!free) {
    const support = obstacles
      .filter((o) => o.kind === 'wall')
      .map(ext)
      .filter((e) => e.y0 < yb - EPS && e.y1 > yb - 40 && e.y1 < yb + 3)
      .map((e) => ({ x0: e.x0, x1: e.x1 }))
      .sort((a, b) => a.x0 - b.x0);
    const merged: { x0: number; x1: number }[] = [];
    for (const s of support) {
      const last = merged[merged.length - 1];
      if (last && s.x0 <= last.x1 + 3) last.x1 = Math.max(last.x1, s.x1);
      else merged.push({ ...s });
    }
    const wall = merged.find((m) => m.x0 <= prefer + EPS && m.x1 >= prefer - EPS);
    if (wall) {
      blocked.push({ x0: -BIG, x1: wall.x0, ref: 'la fine della parete', id: 'support-l', movable: false });
      blocked.push({ x0: wall.x1, x1: BIG, ref: 'la fine della parete', id: 'support-r', movable: false });
    }
  }
  const gap = freeGap(blocked, prefer, w);
  // spazio contando solo gli ostacoli fissi: se basta, i mobili accanto si possono spostare
  const gapFixed = freeGap(blocked.filter((b) => !b.movable), prefer, w);
  const gapW = gap.R - gap.L;
  const fixedW = gapFixed.R - gapFixed.L;
  let xs = prefer;
  const useGap = gapW >= w || fixedW < w ? gap : gapFixed;
  const useW = useGap.R - useGap.L;
  if (useW >= w) xs = Math.min(Math.max(prefer, useGap.L + w / 2), useGap.R - w / 2);
  else xs = (useGap.L + useGap.R) / 2;
  const between = (g: { leftRef: string; rightRef: string }) => `tra ${g.leftRef} e ${g.rightRef}`;
  if (w <= gapW) {
    if (gapW < BIG) notes.push(`${cap(between(gap))} ci sono ${cm(gapW)} cm: ne restano ${cm(gapW - w)}.`);
  } else if (w <= fixedW) {
    const movers = blocked.filter((b) => b.movable && b.x1 > xs - w / 2 + EPS && b.x0 < xs + w / 2 - EPS).map((b) => b.ref);
    reasons.push({ level: 'warn', text: `È largo ${cm(w)} cm, ${cm(w - gapW)} più dello spazio ${between(gap)}: entra spostando ${uniq(movers).join(' e ') || 'i mobili accanto'}.` });
  } else if (w > fixedW + tol) {
    reasons.push({ level: 'no', text: `È largo ${cm(w)} cm: ${cm(w - fixedW)} cm più dello spazio ${between(gapFixed)} (${cm(fixedW)} cm).` });
  } else {
    reasons.push({ level: 'warn', text: `È largo ${cm(w)} cm su ${cm(fixedW)} disponibili: entra solo se le misure sono esatte al centimetro.` });
  }

  // ingombro reale del prodotto (anche la chaise longue) e controllo delle collisioni
  const prodItem: Item = { ...slot, w, d, h, x: 0, y: 0, rot: 0, params: { ...(slot.params ?? {}), ...(prod.openDepth ? { openDepth: prod.openDepth } : {}) } };
  if (slot.type === 'sofa-chaise' && prod.d && prod.d > slot.d + 30) prodItem.params = { ...prodItem.params, chaiseDepth: prod.d };
  if (slot.type === 'sofa-chaise') prodItem.d = Math.min(d, slot.d);
  const centre = v(xs, slot.type === 'sofa-chaise' ? -slot.d / 2 + prodItem.d / 2 : yc);
  const local = (lx: number, ly: number): Vec => v(centre.x + lx, centre.y + ly);
  const toObb = (r: { x: number; y: number; w: number; d: number }): OBB => {
    const c = toWorld(F, local(r.x, r.y));
    return { cx: c.x, cy: c.y, w: r.w, d: r.d, rot: slot.rot };
  };
  const bodies = footprintOf(prodItem).map(toObb);
  const hitBy = new Set<string>();
  for (const o of obstacles) {
    if (o.kind === 'outlet') continue;
    const zOverlap = Math.min(o.z1, z0 + h) - Math.max(o.z0, z0);
    if (zOverlap <= EPS) continue;
    const pen = Math.max(...bodies.map((b) => obbOverlap(b, o.obb)));
    if (pen <= 1) continue;
    if (o.z0 >= OVERHEAD_Z && o.hard) continue; // gestiti sotto, come altezza
    if (o.kind === 'zone') {
      reasons.push({ level: 'warn', text: `Occupa ${o.ref}.` });
    } else if (!(w > useW && blocked.some((b) => b.id === o.id)) && !hitBy.has(o.ref) && !(o.movable && w > gapW && w <= fixedW)) {
      hitBy.add(o.ref);
      reasons.push({ level: o.movable ? 'warn' : 'no', text: `Tocca ${o.ref}${o.movable ? `: ${agree(o.ref, 'va spostato')}` : ''}.` });
    }
  }

  // ostacoli in alto: motore del condizionatore, pensili, mensole
  for (const o of obstacles.filter((x) => x.hard && x.z0 >= OVERHEAD_Z)) {
    if (Math.max(...bodies.map((b) => obbOverlap(b, o.obb))) <= 1) continue;
    const top = z0 + h;
    if (top > o.z0 + tol) reasons.push({ level: 'no', text: `Alto ${cm(h)} cm: supera di ${cm(top - o.z0)} cm ${o.ref}, che parte da ${cm(o.z0)} cm da terra.` });
    else if (top > o.z0) reasons.push({ level: 'warn', text: `Alto ${cm(h)} cm: arriva a filo ${prep('di', o.ref)} (${cm(o.z0)} cm da terra).` });
    else notes.push(`Sotto ${o.ref} restano ${cm(o.z0 - top)} cm.`);
  }
  const ceiling = p.ceiling;
  if (z0 + h > ceiling - 1) reasons.push({ level: 'no', text: `Alto ${cm(h)} cm: non entra sotto il soffitto (${cm(ceiling)} cm).` });
  else if (h > 200 && ceiling - h < 25)
    reasons.push({ level: 'warn', text: `Ci sta sotto il soffitto (${cm(ceiling)} cm), ma sopra restano solo ${cm(ceiling - h)} cm: servono spazio e attenzione per montarlo, perché si assembla sdraiato e poi si alza.` });

  // passaggio davanti (e dietro per i mobili in mezzo alla stanza)
  const pass = slot.passage ?? def.passage;
  let frontGap: number | undefined;
  const span = { x0: xs - w / 2 + 1, x1: xs + w / 2 - 1 };
  const people = obstacles.filter((o) => o.hard && o.z0 < 150 && o.kind !== 'outlet');
  const gapAhead = (yFace: number, dir: 1 | -1) => {
    let best = Infinity;
    let ref = '';
    for (const o of people) {
      const e = ext(o);
      if (Math.min(e.x1, span.x1) - Math.max(e.x0, span.x0) <= EPS) continue;
      const dd = dir > 0 ? e.y0 - yFace : yFace - e.y1;
      if (dd < -EPS) continue;
      if (dd < best) {
        best = dd;
        ref = o.ref;
      }
    }
    return { gap: best, ref };
  };
  const checkPassage = (yFace: number, dir: 1 | -1, where: string) => {
    const { gap: g, ref } = gapAhead(yFace, dir);
    if (!Number.isFinite(g)) return undefined;
    const diff = dir > 0 && !free ? d - slot.d : 0;
    const more = diff > 1 ? ` È profondo ${cm(d)} cm, ${cm(diff)} più del modello:` : '';
    if (pass.comfort > 0) {
      if (g < pass.min)
        reasons.push({ level: 'no', text: cap(`${more} ${where} restano ${cm(g)} cm fino ${prep('a', ref)}: troppo pochi per passare.`.trim()) });
      else if (g < pass.comfort)
        reasons.push({ level: 'warn', text: cap(`${more} ${where} restano ${cm(g)} cm fino ${prep('a', ref)}: si passa, ma di lato.`.trim()) });
      else notes.push(`${cap(where)} restano ${cm(g)} cm di passaggio fino ${prep('a', ref)}.`);
    }
    return g;
  };
  frontGap = checkPassage(yf, 1, 'davanti');
  if (free) checkPassage(yb, -1, 'dietro');

  // zone che devono restare libere quando si usa il mobile (letto aperto, ante, cassetti)
  for (const zn of zonesOf(prodItem)) {
    const zo = toObb(zn);
    const ze = localExtent(F, obbCorners(zo));
    const hit = obstacles.filter((o) => o.kind !== 'zone' && o.kind !== 'outlet' && o.z0 < 150 && obbOverlap(zo, o.obb) > 1);
    const what = zn.kind === 'open' ? `Aperto arriva a ${cm(ze.y1 - yb)} cm dalla parete` : `${cap(zn.label)}`;
    const fixed = hit.filter((o) => !o.movable);
    const movable = hit.filter((o) => o.movable);
    if (fixed.length) reasons.push({ level: 'no', text: `${what}: urta ${uniq(fixed.map((o) => o.ref)).join(' e ')}.` });
    if (movable.length) {
      const refs = uniq(movable.map((o) => o.ref));
      reasons.push({ level: 'warn', text: `${what}: tocca ${refs.join(' e ')}, che ${refs.length > 1 ? 'vanno spostati' : agree(refs[0], 'va spostato')} ogni volta.` });
    }
    if (!hit.length && zn.kind === 'open') {
      const { gap: g, ref } = gapAhead(ze.y1, 1);
      if (Number.isFinite(g) && g < 10) reasons.push({ level: 'warn', text: `${what}: fino ${prep('a', ref)} restano solo ${cm(g)} cm.` });
      else if (Number.isFinite(g)) notes.push(`${what}: fino ${prep('a', ref)} restano ${cm(g)} cm.`);
      else notes.push(`${what}.`);
    }
  }
  if (slot.type === 'sofa-bed' && !prod.openDepth) notes.push('Il negozio non indica l’ingombro da aperto: ho usato quello del modello, verifica sulla scheda.');

  // confronto con il modello
  if (Math.abs(w - slot.w) < 1 && Math.abs(d - slot.d) < 1) notes.unshift('Misura identica al modello.');

  const status: FitStatus = reasons.some((r) => r.level === 'no') ? 'no' : reasons.some((r) => r.level === 'warn') ? 'warn' : 'ok';
  const wc = toWorld(F, v(xs, slot.type === 'sofa-chaise' ? -slot.d / 2 + Math.min(d, slot.d) / 2 : yc));
  return {
    status,
    reasons: uniq(reasons.filter((r) => (status === 'no' ? r.level === 'no' : true)).map((r) => r.text)),
    notes: uniq(notes),
    place: { x: wc.x, y: wc.y, rot: slot.rot, w, d: slot.type === 'sofa-chaise' ? Math.min(d, slot.d) : d, h },
    frontGap,
    gapWidth: gapW,
  };
}

/** sedie intorno a un tavolo, monitor sulla scrivania: si muovono con il mobile e non contano come ostacoli */
function slotCompanions(p: Project, slot: Item): string[] {
  if (slot.type === 'dining-table') {
    return p.items.filter((i) => i.type === 'chair' && Math.hypot(i.x - slot.x, i.y - slot.y) < Math.max(slot.w, slot.d)).map((i) => i.id);
  }
  if (slot.type === 'tv-unit') return p.items.filter((i) => i.type === 'tv' && Math.hypot(i.x - slot.x, i.y - slot.y) < slot.w / 2).map((i) => i.id);
  if (slot.type === 'desk')
    return p.items.filter((i) => (i.type === 'office-chair' || i.type === 'chair') && Math.hypot(i.x - slot.x, i.y - slot.y) < slot.d / 2 + 70).map((i) => i.id);
  return [];
}

function freeGap(blocked: Interval[], at: number, want: number) {
  const iv = [...blocked].sort((a, b) => a.x0 - b.x0);
  // spazi liberi tra gli intervalli occupati
  const gaps: { L: number; R: number; leftRef: string; rightRef: string }[] = [];
  let cur = -BIG;
  let curRef = 'lo spazio libero';
  for (const b of iv) {
    if (b.x0 > cur) gaps.push({ L: cur, R: b.x0, leftRef: curRef, rightRef: b.ref });
    if (b.x1 > cur) {
      cur = b.x1;
      curRef = b.ref;
    }
  }
  gaps.push({ L: cur, R: BIG, leftRef: curRef, rightRef: 'lo spazio libero' });
  const containing = gaps.find((g) => g.L <= at + EPS && g.R >= at - EPS);
  if (containing) return containing;
  // il centro del mobile è occupato: prendi lo spazio che si sovrappone di più all'ingombro voluto
  return gaps.sort((a, b) => overlapLen(b, at, want) - overlapLen(a, at, want))[0];
}
const overlapLen = (g: { L: number; R: number }, at: number, want: number) => Math.min(g.R, at + want / 2) - Math.max(g.L, at - want / 2);
const uniq = <T,>(a: T[]) => [...new Set(a)];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** verifica semplice in uno spazio rettangolare (widget delle pagine «ci sta?») */
export function fitInBox(space: { w: number; d: number; h: number; passage?: number }, prod: ProductDims): { status: FitStatus; reasons: string[] } {
  const reasons: string[] = [];
  let status: FitStatus = 'ok';
  const bump = (s: FitStatus) => {
    if (s === 'no' || (s === 'warn' && status === 'ok')) status = s;
  };
  const check = (val: number | null | undefined, max: number, name: string) => {
    if (val == null) {
      reasons.push(`${cap(name)} non indicata dal negozio: verifica sulla scheda.`);
      bump('warn');
    } else if (val > max + 2) {
      reasons.push(`${cap(name)} ${cm(val)} cm: ${cm(val - max)} cm più dello spazio (${cm(max)}).`);
      bump('no');
    } else if (val > max) {
      reasons.push(`${cap(name)} ${cm(val)} cm su ${cm(max)}: entra solo se le misure sono esatte.`);
      bump('warn');
    }
  };
  check(prod.w, space.w, 'larghezza');
  check(prod.d, space.d, 'profondità');
  check(prod.h, space.h, 'altezza');
  if (status === 'ok') reasons.push(`Restano ${cm(space.w - (prod.w ?? 0))} cm in larghezza e ${cm(space.d - (prod.d ?? 0))} in profondità.`);
  return { status, reasons };
}
