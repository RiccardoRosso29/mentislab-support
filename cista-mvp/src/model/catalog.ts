import seed from '../../data/seed-products.json';
import type { Product } from './types';

/** correzioni manuali alle misure fatte nella pagina «Revisione misure» (salvate nel browser) */
const OVERRIDES_KEY = 'cista:dims-overrides';

export type DimsOverride = Pick<Product, 'w' | 'd' | 'h'> & { openDepth?: number | null; approvedAt: string };

export function readOverrides(): Record<string, DimsOverride> {
  try {
    return JSON.parse(localStorage.getItem(OVERRIDES_KEY) ?? '{}');
  } catch {
    return {};
  }
}

export function saveOverride(id: string, o: DimsOverride) {
  const all = readOverrides();
  all[id] = o;
  try {
    localStorage.setItem(OVERRIDES_KEY, JSON.stringify(all));
  } catch {
    /* archiviazione non disponibile */
  }
}

let cache: Product[] | null = null;
export function allProducts(): Product[] {
  if (cache) return cache;
  const ov = readOverrides();
  cache = (seed as Product[]).map((p) => (ov[p.id] ? { ...p, ...ov[p.id], dimsConfidence: 1, dimsSource: 'manual' as const } : p));
  return cache;
}
export const invalidateCatalog = () => {
  cache = null;
};

export const productById = (id?: string) => (id ? allProducts().find((p) => p.id === id) : undefined);
export const productsFor = (category?: string) => (category ? allProducts().filter((p) => p.category === category) : []);

const env = (k: string) => (import.meta.env?.[k] as string | undefined) || '';

/** link verso il negozio con i parametri di affiliazione, se configurati (altrimenti il link normale) */
export function affiliateUrl(p: Product): string {
  if (p.affiliateUrl) return p.affiliateUrl;
  if (p.retailer === 'Amazon') {
    const tag = env('VITE_AMAZON_TAG');
    if (!tag) return p.url;
    const u = new URL(p.url);
    u.searchParams.set('tag', tag);
    return u.toString();
  }
  if (p.retailer === 'Leroy Merlin') {
    const aff = env('VITE_AWIN_AFFID');
    const mid = p.url.includes('leroymerlin.it') ? env('VITE_AWIN_MID_LEROYMERLIN_IT') : env('VITE_AWIN_MID_LEROYMERLIN_ES');
    if (!aff || !mid) return p.url;
    return `https://www.awin1.com/cread.php?awinmid=${mid}&awinaffid=${aff}&ued=${encodeURIComponent(p.url)}`;
  }
  // IKEA: nessun programma di affiliazione pubblico in Italia; link normale
  return p.url;
}

export const isAffiliate = (p: Product) => affiliateUrl(p) !== p.url;
export const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

export const eur = (v: number | null | undefined) =>
  v == null ? 'prezzo da verificare' : `${v.toLocaleString('it-IT', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 })} €`;

export const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });

export const RETAILERS = () => [...new Set(allProducts().map((p) => p.retailer))];
