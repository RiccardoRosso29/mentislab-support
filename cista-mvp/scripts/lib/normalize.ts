import { parseDims, parseOpenDepth } from '../../src/model/dims';
import type { Product } from '../../src/model/types';

/** categoria del catalogo dal titolo e dalla categoria del negozio (italiano e spagnolo) */
const RULES: [RegExp, string][] = [
  [/sof[aá] ?cama|divano ?letto|clic[- ]?clac/i, 'sofa-bed'],
  [/chaise ?longue|chaiselongue/i, 'sofa-chaise'],
  [/tendeder|stendin|stendibianch/i, 'drying-rack'],
  [/zapater|scarpier/i, 'shoe-cabinet'],
  [/mesita de noche|comodin|mesilla/i, 'nightstand'],
  [/c[oó]moda|com[oò]\b|cassettiera|cajonera|sinfonier/i, 'dresser'],
  [/armario|armadio|guardarropa|ropero/i, 'wardrobe'],
  [/silla (de )?(oficina|escritorio)|sedia (da )?(ufficio|scrivania)|sill[oó]n de oficina/i, 'office-chair'],
  [/escritorio|scrivania/i, 'desk'],
  [/mesa (de )?centro|tavolino|mesa baja/i, 'coffee-table'],
  [/mueble (de )?tv|mesa tv|porta ?tv|mobile tv/i, 'tv-unit'],
  [/mesa (de )?comedor|tavolo (da )?pranzo|mesa extensible/i, 'dining-table'],
  [/estructura de cama|base (tapizada|de cama)|\bcama\b|letto\b|canap[eé]/i, 'bed'],
  [/estanter[ií]a|librer[ií]a|libreria/i, 'bookcase'],
  [/silla|sedia/i, 'chair'],
  [/sof[aá]|divano/i, 'sofa'],
];

export function classify(...texts: string[]): string | null {
  const t = texts.join(' | ');
  for (const [re, cat] of RULES) if (re.test(t)) return cat;
  return null;
}

export function toProduct(input: {
  id: string;
  retailer: string;
  sku: string;
  title: string;
  url: string;
  price?: number | null;
  color?: string;
  category?: string | null;
  dimsText: string;
  image?: string;
  source: Product['dimsSource'];
  fetchedAt?: string;
}): Product | null {
  const category = input.category ?? classify(input.title, input.dimsText);
  if (!category) return null;
  const d = parseDims(input.dimsText);
  return {
    id: input.id,
    retailer: input.retailer,
    sku: input.sku,
    title: input.title,
    color: input.color ?? '',
    category,
    w: d.w,
    d: d.d,
    h: d.h,
    openDepth: category === 'sofa-bed' ? parseOpenDepth(input.dimsText) : null,
    price: input.price ?? null,
    currency: 'EUR',
    url: input.url,
    fetchedAt: input.fetchedAt ?? new Date().toISOString().slice(0, 10),
    dimsSource: input.source,
    dimsConfidence: Math.round(d.confidence * 100) / 100,
    dimsText: input.dimsText.slice(0, 400),
    image: input.image,
  };
}

export const price = (s?: string) => {
  if (!s) return null;
  const n = parseFloat(s.replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
