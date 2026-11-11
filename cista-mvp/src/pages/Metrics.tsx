import { useState } from 'react';
import { clearEvents, events, type EventName } from '../model/analytics';

const FUNNEL: [EventName, string][] = [
  ['project_created', 'Progetti iniziati'],
  ['item_placed', 'Mobili posati'],
  ['slot_search_opened', 'Ricerche per spazio'],
  ['product_viewed', 'Prodotti visti'],
  ['product_tried_in_3d', 'Prove nel 3D'],
  ['product_chosen', 'Prodotti scelti'],
  ['list_viewed', 'Liste aperte'],
  ['outbound_click', 'Clic verso i negozi'],
];

/** metriche locali per validare il modello di business (CTR verso i negozi, compatibilità dei clic) */
export default function Metrics() {
  const [, refresh] = useState(0);
  const all = events();
  const count = (n: EventName) => all.filter((e) => e.name === n).length;
  const clicks = all.filter((e) => e.name === 'outbound_click');
  const views = count('product_viewed');
  const by = (key: string) =>
    Object.entries(
      clicks.reduce<Record<string, number>>((a, e) => {
        const k = String(e.props?.[key] ?? '—');
        a[k] = (a[k] ?? 0) + 1;
        return a;
      }, {}),
    ).sort((a, b) => b[1] - a[1]);
  const compat = clicks.filter((e) => e.props?.status === 'ok' || e.props?.status === 'chosen').length;
  const pct = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(1).replace('.', ',')}%` : '—');
  return (
    <div className="page-in">
      <div style={{ display: 'grid', gap: 8 }}>
        <span className="eyebrow">Solo questo browser · {all.length} eventi</span>
        <h1>Metriche</h1>
        <p className="lead">Gli stessi eventi vanno a un servizio di statistiche quando è configurato (VITE_ANALYTICS_URL). Qui servono a provare il funnel durante i test con gli utenti.</p>
      </div>
      <div className="kpis">
        <div className="kpi">
          <b>{pct(clicks.length, views)}</b>
          <span>Clic verso i negozi su prodotti visti (CTR)</span>
        </div>
        <div className="kpi">
          <b>{pct(compat, clicks.length)}</b>
          <span>Clic su prodotti compatibili o scelti</span>
        </div>
        <div className="kpi">
          <b>{count('product_chosen')}</b>
          <span>Prodotti scelti</span>
        </div>
        <div className="kpi">
          <b>{clicks.length}</b>
          <span>Clic verso i negozi</span>
        </div>
      </div>
      <h2>Funnel</h2>
      <div className="table-wrap">
        <table>
          <tbody>
            {FUNNEL.map(([n, l]) => (
              <tr key={n}>
                <td>{l}</td>
                <td className="num">{count(n)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="cards">
        {(['retailer', 'category', 'status'] as const).map((k) => (
          <div key={k}>
            <h2 style={{ fontSize: 20 }}>Clic per {k === 'retailer' ? 'negozio' : k === 'category' ? 'categoria' : 'compatibilità'}</h2>
            <div className="table-wrap">
              <table>
                <tbody>
                  {by(k).map(([name, n]) => (
                    <tr key={name}>
                      <td>{name}</td>
                      <td className="num">{n}</td>
                    </tr>
                  ))}
                  {!clicks.length && (
                    <tr>
                      <td className="note">Nessun clic ancora</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
      <p>
        <button
          className="btn small"
          onClick={() => {
            clearEvents();
            refresh((n) => n + 1);
          }}
        >
          Azzera gli eventi di questo browser
        </button>
      </p>
    </div>
  );
}
