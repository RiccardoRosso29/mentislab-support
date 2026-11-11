/**
 * Estrazione deterministica delle misure da titoli e descrizioni dei prodotti (italiano e spagnolo).
 * Restituisce larghezza (w), profondità (d), altezza (h) in cm e una confidenza da 0 a 1.
 * Sotto 0,8 il prodotto va in revisione manuale (pagina «Revisione misure»).
 */
export type ParsedDims = { w: number | null; d: number | null; h: number | null; confidence: number; how: string };

type Axis = 'w' | 'd' | 'h' | 'l';

const WORD_AXIS: [RegExp, Axis][] = [
  [/^(alto|alta|altura|altezza|alt|h|height|hauteur)$/i, 'h'],
  [/^(fondo|profundidad|profondit[aà]|profondo|profonda|prof|p|depth|d|f)$/i, 'd'],
  [/^(ancho|anchura|larghezza|largo?\b|larga|width|w|a)$/i, 'w'],
  [/^(largo|lunghezza|longitud|lungo|length|l)$/i, 'l'],
];

function axisOf(word: string): Axis | null {
  const w = word.toLowerCase().replace(/[^a-zàèéìòù]/g, '');
  if (!w) return null;
  // «largo» è lunghezza in spagnolo ma larghezza in italiano: lo trattiamo come lunghezza e lo risolviamo dopo
  if (/^(largo|lunghezza|longitud|lungo|length)$/.test(w)) return 'l';
  for (const [re, ax] of WORD_AXIS) if (re.test(w)) return ax;
  return null;
}

const NUM = String.raw`(\d+(?:[.,]\d+)?)`;
const UNIT = String.raw`\s*(mm|cm|m)?\b`;

function toCm(n: string, unit?: string): number {
  const x = parseFloat(n.replace(',', '.'));
  if (unit === 'mm') return x / 10;
  if (unit === 'm') return x * 100;
  return x;
}

function plausible(v: number) {
  return v > 0.5 && v < 600;
}

function resolve(m: Partial<Record<Axis, number>>): { w: number | null; d: number | null; h: number | null } {
  let w = m.w ?? null;
  let d = m.d ?? null;
  const h = m.h ?? null;
  if (m.l != null) {
    // «largo × ancho»: largo è la larghezza del mobile, ancho la profondità
    if (w != null && d == null) {
      d = w;
      w = m.l;
    } else if (w == null) w = m.l;
    else if (d == null) d = m.l;
  }
  return { w, d, h };
}

export function parseDims(textIn: string): ParsedDims {
  const text = textIn.replace(/ /g, ' ').replace(/[×✕]/g, 'x');
  const empty: ParsedDims = { w: null, d: null, h: null, confidence: 0, how: 'nessuna misura trovata' };

  // 1) misure con etichetta accanto: «200 cm(alto)», «L 120», «h 75», «alto: 75 cm», «76,5 cm de alto»
  const labelled: Partial<Record<Axis, number>> = {};
  let nLabelled = 0;
  const after = new RegExp(String.raw`${NUM}${UNIT}\s*\(?\s*(?:de\s+)?(alto|alta|altura|altezza|ancho|anchura|largo|larga|larghezza|fondo|profundidad|profondit[aà]|lunghezza|longitud)\b(?!\s*[-x/,]\s*[a-z])\)?`, 'gi');
  for (const m of text.matchAll(after)) {
    const ax = axisOf(m[3]);
    if (ax && labelled[ax] == null) {
      labelled[ax] = toCm(m[1], m[2]);
      nLabelled++;
    }
  }
  const before = new RegExp(String.raw`\b(alto|alta|altura|altezza|ancho|anchura|largo|larga|larghezza|fondo|profundidad|profondit[aà]|profondo|profonda|lunghezza|longitud|L|P|H|A|F|h)\b\s*[:=]?\s*${NUM}(?:\s*[-–]\s*${NUM})?${UNIT}`, 'g');
  for (const m of text.matchAll(before)) {
    const ax = axisOf(m[1]);
    const val = toCm(m[3] ?? m[2], m[4]); // con un intervallo («h 132–137») prendo il valore più alto
    if (ax && labelled[ax] == null && plausible(val)) {
      labelled[ax] = val;
      nLabelled++;
    }
  }

  // 2) terne e coppie «120x60x75 cm», con eventuale ordine dichiarato «(Alto-Ancho-Fondo)»
  const triple = new RegExp(String.raw`${NUM}\s*(?:mm|cm|m)?\s*x\s*${NUM}\s*(?:mm|cm|m)?\s*(?:x\s*${NUM})?${UNIT}`, 'i');
  const tm = text.match(triple);
  let fromTriple: Partial<Record<Axis, number>> = {};
  let order: Axis[] = ['w', 'd', 'h'];
  const orderHint = text.match(/\(\s*((?:alto|ancho|fondo|largo|profundidad|altezza|larghezza|profondit[aà]|lunghezza)(?:\s*[-x/,]\s*(?:alto|ancho|fondo|largo|profundidad|altezza|larghezza|profondit[aà]|lunghezza)){1,2})\s*\)/i)
    ?? text.match(/\b([LAPH]\s*x\s*[LAPHF](?:\s*x\s*[LAPHF])?)\b/);
  if (orderHint) {
    const words = orderHint[1].split(/\s*[-x/,]\s*/).map((s) => s.trim());
    const ax = words.map((wd) => (wd.length === 1 ? ({ L: 'w', A: 'h', P: 'd', H: 'h', F: 'd' } as Record<string, Axis>)[wd.toUpperCase()] : axisOf(wd)));
    if (ax.every(Boolean)) order = ax as Axis[];
  }
  if (tm) {
    const unit = tm[4] ?? tm[0].match(/\b(mm|cm|m)\b/i)?.[1]?.toLowerCase();
    const nums = [tm[1], tm[2], tm[3]].filter(Boolean).map((n) => toCm(n!, unit));
    nums.forEach((n, i) => {
      const ax = order[i];
      if (ax && fromTriple[ax] == null) fromTriple[ax] = n;
    });
    if (!orderHint && nums.length === 2) fromTriple = { w: nums[0], d: nums[1] };
  }

  const merged = { ...fromTriple, ...labelled };
  const r = resolve(merged);
  if (r.w == null && r.d == null && r.h == null) {
    // 3) una sola misura descritta a parole: «circa 190 cm di larghezza»
    const single = text.match(new RegExp(String.raw`${NUM}${UNIT}\s*(?:di|de)\s+(larghezza|ancho|anchura|profondit[aà]|fondo|altezza|alto)`, 'i'));
    if (single) {
      const ax = axisOf(single[3]);
      const v = toCm(single[1], single[2]);
      return { w: ax === 'w' ? v : null, d: ax === 'd' ? v : null, h: ax === 'h' ? v : null, confidence: 0.4, how: 'una sola misura a parole' };
    }
    return empty;
  }
  for (const k of ['w', 'd', 'h'] as const) if (r[k] != null && !plausible(r[k]!)) r[k] = null;

  const found = [r.w, r.d, r.h].filter((x) => x != null).length;
  let confidence: number;
  let how: string;
  if (nLabelled >= 2 && found === 3) {
    confidence = 0.95;
    how = 'misure con etichetta';
  } else if (tm && orderHint && found === 3) {
    confidence = 0.92;
    how = 'terna con ordine dichiarato';
  } else if (tm && labelled.h != null && found === 3) {
    confidence = 0.9;
    how = 'coppia + altezza indicata';
  } else if (tm && found === 3) {
    confidence = 0.75;
    how = 'terna senza etichette (ordine L×P×H presunto)';
  } else if (found === 2) {
    confidence = 0.6;
    how = 'manca una misura';
  } else {
    confidence = 0.4;
    how = 'una sola misura';
  }
  // incoerenze tipiche dei feed: altezza minore della profondità su un armadio, ecc. → abbasso la confidenza
  if (r.h != null && r.d != null && r.w != null && found === 3 && /armario|armadio|estanter|librer/i.test(text) && r.h < r.d) confidence = Math.min(confidence, 0.5);
  return { ...r, confidence, how };
}

/** ingombro da aperto per i divani letto: «aperto arriva a circa 200 cm», «abierto 223 cm», «cama 140x190» */
export function parseOpenDepth(text: string): number | null {
  const m =
    text.match(/aperto (?:arriva a )?(?:circa )?(\d+(?:[.,]\d+)?)\s*cm/i) ??
    text.match(/abierto[^0-9]{0,20}(\d+(?:[.,]\d+)?)\s*cm/i) ??
    text.match(/profundidad (?:abierto|cama)[^0-9]{0,10}(\d+(?:[.,]\d+)?)/i);
  return m ? parseFloat(m[1].replace(',', '.')) : null;
}
