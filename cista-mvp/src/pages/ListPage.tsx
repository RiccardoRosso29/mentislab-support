import { useEffect } from 'react';
import { useStore } from '../model/store';
import { affiliateUrl, eur, fmtDate, hostOf, isAffiliate, productById } from '../model/catalog';
import { roomAt } from '../model/project';
import { defOf } from '../model/furniture';
import { track } from '../model/analytics';
import { dimsText } from '../editor/ProductPanel';
import type { Product } from '../model/types';

export default function ListPage() {
  const project = useStore((s) => s.project);
  useEffect(() => track('list_viewed', { items: project.items.filter((i) => i.chosen).length }), []); // eslint-disable-line react-hooks/exhaustive-deps

  // stesso prodotto scelto più volte (es. 4 sedie): una riga con la quantità
  const rows = new Map<string, { p: Product; qty: number; rooms: Set<string>; label: string }>();
  for (const it of project.items) {
    if (!it.chosen || !it.productId) continue;
    const p = productById(it.productId);
    if (!p) continue;
    const room = roomAt(project, it)?.name ?? 'Senza stanza';
    const r = rows.get(p.id) ?? { p, qty: 0, rooms: new Set<string>(), label: it.label ?? defOf(it.type).label };
    r.qty++;
    r.rooms.add(room);
    rows.set(p.id, r);
  }
  const list = [...rows.values()];
  const units = (r: (typeof list)[number]) => (r.p.pack ? Math.ceil(r.qty / r.p.pack) : r.qty);
  const total = list.reduce((a, r) => a + (r.p.price ?? 0) * units(r), 0);
  const missing = list.filter((r) => r.p.price == null).length;

  return (
    <div className="page-in">
      <div style={{ display: 'grid', gap: 8 }}>
        <span className="eyebrow">{project.name}</span>
        <h1>Lista acquisti</h1>
        <p className="lead">I prodotti che hai scelto per i mobili della casa, con il negozio e il prezzo rilevato. Prima di ordinare controlla misure e prezzo sulla scheda.</p>
      </div>
      {list.length === 0 ? (
        <div className="callout">
          Non hai ancora scelto prodotti. Apri la <a href="#demo">demo</a> o <a href="#editor">la tua casa</a>, seleziona un mobile e premi «Scegli» su un prodotto nel pannello <b>Prodotti</b>.
        </div>
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Stanza</th>
                  <th>Mobile</th>
                  <th>Prodotto</th>
                  <th>Misure</th>
                  <th className="num">Qtà</th>
                  <th className="num">Prezzo</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.p.id} data-testid="list-row">
                    <td>{[...r.rooms].join(', ')}</td>
                    <td>{r.label}</td>
                    <td>
                      <span className="retailer">{r.p.retailer}</span>
                      <br />
                      {r.p.title}
                    </td>
                    <td>{dimsText(r.p)}</td>
                    <td className="num">{r.p.pack ? `${units(r)} conf. da ${r.p.pack}` : r.qty}</td>
                    <td className="num">
                      {eur(r.p.price != null ? r.p.price * units(r) : null)}
                      <br />
                      <small className="note">{fmtDate(r.p.fetchedAt)}</small>
                    </td>
                    <td>
                      <a
                        className="btn small"
                        href={affiliateUrl(r.p)}
                        target="_blank"
                        rel={`noopener ${isAffiliate(r.p) ? 'sponsored nofollow' : ''}`.trim()}
                        onClick={() => track('outbound_click', { retailer: r.p.retailer, category: r.p.category, status: 'chosen', price: r.p.price, product: r.p.id })}
                      >
                        {hostOf(r.p.url)} ↗
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: 18 }}>
            Totale indicativo: <b data-testid="list-total">{eur(total)}</b>
            {missing > 0 && <span className="note"> + {missing} {missing > 1 ? 'prodotti' : 'prodotto'} senza prezzo nei dati del negozio</span>}
          </p>
        </>
      )}
      <p className="disclosure">
        Alcuni link sono di affiliazione: se acquisti, riceviamo una commissione senza costi per te. I prezzi sono quelli rilevati alla data indicata e possono cambiare. <a href="#come-guadagniamo">Come guadagniamo</a>
      </p>
    </div>
  );
}
