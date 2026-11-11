import { useMemo, useState } from 'react';
import { fitInBox } from '../model/compat';
import { productsFor } from '../model/catalog';
import { ProductCard } from '../editor/ProductPanel';
import type { FitStatus, Product } from '../model/types';

export type SeoPageDef = {
  id: string;
  short: string;
  title: string;
  intro: string;
  category: string;
  filter: (p: Product) => boolean;
  space: { w: number; d: number; h: number };
  tips: string[];
};

/** pagine «per misura» generate dal catalogo: intercettano chi cerca un mobile di una misura precisa */
export const SEO_PAGES: SeoPageDef[] = [
  {
    id: 'divani-letto-230',
    short: 'Divani letto fino a 230 cm',
    title: 'Divani letto lunghi fino a 230 cm',
    intro: 'Divani letto reali con la lunghezza entro 2,30 m, con l’ingombro da aperto quando il negozio lo indica. Inserisci lo spazio della tua parete e la profondità libera davanti per vedere quali ci stanno.',
    category: 'sofa-bed',
    filter: (p) => (p.w ?? 999) <= 230,
    space: { w: 230, d: 100, h: 120 },
    tips: ['Misura la parete fino a dove arriva la porta aperta, non fino all’angolo.', 'L’ingombro da aperto conta più della profondità da chiuso: lascia almeno 50–60 cm per passare accanto al letto.'],
  },
  {
    id: 'armadi-profondi-50',
    short: 'Armadi profondi fino a 50 cm',
    title: 'Armadi profondi fino a 50 cm',
    intro: 'Armadi poco profondi per stanze strette o corridoi. Inserisci larghezza, profondità e altezza disponibili.',
    category: 'wardrobe',
    filter: (p) => (p.d ?? 999) <= 50,
    space: { w: 100, d: 50, h: 240 },
    tips: ['Con ante a battente serve spazio davanti pari alla larghezza dell’anta (40–60 cm).', 'Lascia 20–25 cm sopra l’armadio per poterlo montare e alzare.'],
  },
  {
    id: 'stendini-sotto-140',
    short: 'Stendini sotto i 140 cm',
    title: 'Stendini a torre alti meno di 140 cm',
    intro: 'Per lavanderie piccole o spazi sotto un condizionatore o un pensile. Inserisci lo spazio a terra e l’altezza libera.',
    category: 'drying-rack',
    filter: (p) => (p.h ?? 999) <= 140,
    space: { w: 99, d: 80, h: 140 },
    tips: ['Misura l’altezza fino al punto più basso dell’ostacolo (es. il fondo del motore del condizionatore).', 'Uno stendino a torre da 71 × 71 cm ha circa 30 m di filo: basta per un carico da 7–8 kg.'],
  },
];

const LABEL: Record<FitStatus, string> = { ok: 'Ci sta', warn: 'Con riserva', no: 'Non entra' };

export default function SeoPage({ page }: { page: SeoPageDef }) {
  const [w, setW] = useState(String(page.space.w));
  const [d, setD] = useState(String(page.space.d));
  const [h, setH] = useState(String(page.space.h));
  const space = { w: Number(w) || 0, d: Number(d) || 0, h: Number(h) || 0 };
  const list = useMemo(
    () =>
      productsFor(page.category)
        .filter(page.filter)
        .map((p) => ({ p, fit: fitInBox(space, p) }))
        .sort((a, b) => ['ok', 'warn', 'no'].indexOf(a.fit.status) - ['ok', 'warn', 'no'].indexOf(b.fit.status) || (a.p.price ?? 1e9) - (b.p.price ?? 1e9)),
    [page, w, d, h], // eslint-disable-line react-hooks/exhaustive-deps
  );
  return (
    <div className="page-in">
      <div style={{ display: 'grid', gap: 8 }}>
        <span className="eyebrow">Ci sta a casa tua?</span>
        <h1>{page.title}</h1>
        <p className="lead">{page.intro}</p>
      </div>
      <div className="hero-sheet" style={{ maxWidth: 560 }}>
        <span className="eyebrow">Lo spazio che hai (cm)</span>
        <div className="fields" style={{ gridTemplateColumns: 'repeat(3, minmax(0,1fr))' }}>
          <label className="field">
            Larghezza
            <input inputMode="numeric" value={w} onChange={(e) => setW(e.target.value.replace(/\D/g, ''))} />
          </label>
          <label className="field">
            Profondità
            <input inputMode="numeric" value={d} onChange={(e) => setD(e.target.value.replace(/\D/g, ''))} />
          </label>
          <label className="field">
            Altezza
            <input inputMode="numeric" value={h} onChange={(e) => setH(e.target.value.replace(/\D/g, ''))} />
          </label>
        </div>
        <p className="note">
          {list.filter((x) => x.fit.status === 'ok').length} ci stanno, {list.filter((x) => x.fit.status === 'warn').length} con riserva, {list.filter((x) => x.fit.status === 'no').length} non entrano. Per controllare anche passaggi, porte e ostacoli, <a href="#editor">disegna la stanza</a>.
        </p>
      </div>
      <ul className="reasons notes">
        {page.tips.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
      <div className="cards">
        {list.map(({ p, fit }) => (
          <ProductCard key={p.id} p={p} fit={{ status: fit.status, reasons: fit.status === 'ok' ? [] : fit.reasons, notes: fit.status === 'ok' ? fit.reasons : [], place: { x: 0, y: 0, rot: 0, w: 0, d: 0, h: 0 } }} />
        ))}
      </div>
      {list.length === 0 && <p className="note">Nessun prodotto del catalogo con queste caratteristiche.</p>}
      <p className="disclosure">Etichette: {Object.values(LABEL).join(' · ')}. Alcuni link sono di affiliazione. <a href="#come-guadagniamo">Come guadagniamo</a></p>
    </div>
  );
}
