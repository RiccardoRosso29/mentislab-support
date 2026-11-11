import { useMemo, useState } from 'react';
import { useStore } from '../model/store';
import { defOf, CATALOG_LABEL } from '../model/furniture';
import { evaluateFit, type FitResult } from '../model/compat';
import { affiliateUrl, eur, fmtDate, hostOf, isAffiliate, productsFor } from '../model/catalog';
import { fmtCm } from '../model/geometry';
import { track } from '../model/analytics';
import type { FitStatus, Item, Product } from '../model/types';

const LABEL: Record<FitStatus, string> = { ok: 'Ci sta', warn: 'Con riserva', no: 'Non entra' };
const RANK: Record<FitStatus, number> = { ok: 0, warn: 1, no: 2 };

export function dimsText(p: Product) {
  const parts = [p.w != null ? fmtCm(p.w) : '?', p.d != null ? fmtCm(p.d) : '?'];
  return `${parts.join(' × ')} cm${p.h != null ? ` · h ${fmtCm(p.h)}` : ''}${p.openDepth ? ` · aperto ${fmtCm(p.openDepth)}` : ''}`;
}

export function ProductCard({ p, fit, slot, onTry, onChoose }: { p: Product; fit?: FitResult; slot?: Item; onTry?: () => void; onChoose?: () => void }) {
  const chosen = slot?.productId === p.id && slot.chosen;
  const trying = slot?.productId === p.id && !slot.chosen;
  return (
    <article className={`pcard${chosen ? ' chosen' : ''}`} data-testid="product-card" data-status={fit?.status}>
      <div className="ptop">
        <span className="retailer">{p.retailer}</span>
        {fit && <span className={`pill ${fit.status}`}>{LABEL[fit.status]}</span>}
        {p.rating ? (
          <span className="note">
            ★ {p.rating} ({p.ratingCount})
          </span>
        ) : null}
      </div>
      <h4>{p.title}</h4>
      {p.color && <p className="note">{p.color}</p>}
      <div className="pdims">
        {dimsText(p)} {p.dimsConfidence < 0.8 && <small>· misure da verificare</small>}
      </div>
      {fit && fit.reasons.length > 0 && (
        <ul className={`reasons ${fit.status}`}>
          {fit.reasons.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      )}
      {fit && fit.status !== 'no' && fit.notes.length > 0 && (
        <ul className="reasons notes">
          {fit.notes.slice(0, 3).map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      )}
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="price">
          {p.pack ? `${eur(p.price)} per ${p.pack}` : eur(p.price)}
          <br />
          <small>{p.price != null ? `rilevato il ${fmtDate(p.fetchedAt)}, può cambiare` : 'il negozio non lo indica nei dati'}</small>
        </span>
        <a
          className="btn small"
          href={affiliateUrl(p)}
          target="_blank"
          rel={`noopener ${isAffiliate(p) ? 'sponsored nofollow' : ''}`.trim()}
          onClick={() => track('outbound_click', { retailer: p.retailer, category: p.category, status: fit?.status ?? null, price: p.price, product: p.id })}
        >
          Vedi su {hostOf(p.url)} ↗
        </a>
      </div>
      {(onTry || onChoose) && (
        <div className="row">
          {onTry && fit?.status !== 'no' && (
            <button className="btn small" aria-pressed={trying} onClick={onTry} data-testid="try-3d">
              {trying ? 'In prova nel 3D' : 'Prova nel 3D'}
            </button>
          )}
          {onChoose && (
            <button className={`btn small${chosen ? '' : ' primary'}`} aria-pressed={chosen} onClick={onChoose} data-testid="choose">
              {chosen ? 'Scelto ✓ (togli)' : 'Scegli'}
            </button>
          )}
        </div>
      )}
    </article>
  );
}

export default function ProductPanel() {
  const sel = useStore((s) => s.sel);
  const project = useStore((s) => s.project);
  const { apply } = useStore.getState();
  const [retailer, setRetailer] = useState('Tutti');
  const [maxPrice, setMaxPrice] = useState('');
  const [showNo, setShowNo] = useState(false);
  const slot = sel?.kind === 'item' ? project.items.find((i) => i.id === sel.id) : undefined;
  const def = slot ? defOf(slot.type) : undefined;
  // la verifica usa lo spazio del modello (non il prodotto in prova)
  const base = useMemo(() => (slot?.model ? { ...slot, ...slot.model } : slot), [slot]);

  const results = useMemo(() => {
    if (!base || !def?.catalog) return [];
    return productsFor(def.catalog)
      .map((p) => ({ p, fit: evaluateFit(project, base, p) }))
      .sort((a, b) => RANK[a.fit.status] - RANK[b.fit.status] || (a.p.price ?? 1e9) - (b.p.price ?? 1e9));
  }, [project, base, def]);

  if (!slot || !def) {
    return (
      <>
        <h3>Prodotti che ci stanno</h3>
        <p className="note">Seleziona un mobile nella pianta o nel 3D: qui vedrai i prodotti reali che ci stanno in quello spazio, prima quelli compatibili, con il motivo in centimetri.</p>
      </>
    );
  }
  if (!def.catalog) {
    return (
      <>
        <h3>{def.label}</h3>
        <p className="note">Per questo tipo di mobile non ci sono ancora prodotti nel catalogo. Prova con divani, letti, armadi, scrivanie, tavoli, comò, scarpiere o stendini.</p>
      </>
    );
  }
  const retailers = ['Tutti', ...new Set(results.map((r) => r.p.retailer))];
  const shown = results.filter((r) => (retailer === 'Tutti' || r.p.retailer === retailer) && (!maxPrice || (r.p.price ?? 0) <= Number(maxPrice)));
  const count = (s: FitStatus) => shown.filter((r) => r.fit.status === s).length;

  const tryIn3d = (p: Product, fit: FitResult) => {
    track('product_tried_in_3d', { product: p.id, status: fit.status });
    apply((pr) => ({
      ...pr,
      items: pr.items.map((i) =>
        i.id === slot.id
          ? {
              ...i,
              model: i.model ?? { w: i.w, d: i.d, h: i.h, x: i.x, y: i.y, color: i.color, params: i.params },
              x: fit.place.x,
              y: fit.place.y,
              w: fit.place.w,
              d: fit.place.d,
              h: fit.place.h,
              params: { ...(i.params ?? {}), ...(p.openDepth ? { openDepth: p.openDepth } : {}) },
              productId: p.id,
              chosen: i.productId === p.id ? i.chosen : false,
            }
          : i,
      ),
    }));
  };
  const choose = (p: Product, fit: FitResult) => {
    const already = slot.productId === p.id && slot.chosen;
    if (!already) {
      tryIn3d(p, fit);
      track('product_chosen', { product: p.id, retailer: p.retailer, status: fit.status, price: p.price });
    }
    apply((pr) => ({ ...pr, items: pr.items.map((i) => (i.id === slot.id ? { ...i, chosen: !already } : i)) }));
  };

  const groups: FitStatus[] = showNo ? ['ok', 'warn', 'no'] : ['ok', 'warn'];
  return (
    <>
      <div>
        <p className="eyebrow">
          {CATALOG_LABEL[def.catalog]} · spazio del modello {fmtCm(base!.w)} × {fmtCm(base!.d)} · h {fmtCm(base!.h)}
        </p>
        <h3>Prodotti che ci stanno</h3>
        <p className="note">
          {count('ok')} ci stanno, {count('warn')} con riserva, {count('no')} non entrano. Controllo passaggi, ante, fine della parete, termosifoni e ostacoli in alto.
        </p>
      </div>
      <div className="filters">
        <label className="field">
          Negozio
          <select value={retailer} onChange={(e) => setRetailer(e.target.value)}>
            {retailers.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
        <label className="field">
          Prezzo massimo (€)
          <input inputMode="numeric" value={maxPrice} placeholder="nessuno" onChange={(e) => setMaxPrice(e.target.value.replace(/\D/g, ''))} />
        </label>
      </div>
      {groups.map((g) => {
        const list = shown.filter((r) => r.fit.status === g);
        if (!list.length) return null;
        return (
          <section key={g} style={{ display: 'grid', gap: 10 }}>
            <div className="group-title">
              <span className={`pill ${g}`}>{LABEL[g]}</span>
              <span className="note">{list.length}</span>
            </div>
            {list.map(({ p, fit }) => (
              <ProductCardTracked key={p.id} p={p} fit={fit} slot={slot} onTry={() => tryIn3d(p, fit)} onChoose={() => choose(p, fit)} />
            ))}
          </section>
        );
      })}
      {count('no') > 0 && (
        <button className="btn small" onClick={() => setShowNo(!showNo)}>
          {showNo ? 'Nascondi quelli che non entrano' : `Mostra anche i ${count('no')} che non entrano, con il motivo`}
        </button>
      )}
      <p className="disclosure">
        Alcuni link sono di affiliazione: se acquisti, riceviamo una commissione senza costi per te. L’ordine dipende solo dalla compatibilità e dal prezzo. Le misure vengono dai negozi: verificale sempre sulla scheda prima di comprare.{' '}
        <a href="#come-guadagniamo">Come guadagniamo</a>
      </p>
    </>
  );
}

const seen = new Set<string>();
function ProductCardTracked(props: Parameters<typeof ProductCard>[0]) {
  if (!seen.has(props.p.id)) {
    seen.add(props.p.id);
    track('product_viewed', { product: props.p.id, status: props.fit?.status ?? null });
  }
  return <ProductCard {...props} />;
}
