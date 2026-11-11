import { useState } from 'react';
import { allProducts, invalidateCatalog, readOverrides, saveOverride } from '../model/catalog';
import { CATALOG_LABEL } from '../model/furniture';
import type { Product } from '../model/types';

/** coda di revisione: prodotti con misure a bassa confidenza (sotto 0,8) da verificare a mano sulla scheda */
export default function Review() {
  const [, refresh] = useState(0);
  const ov = readOverrides();
  const queue = allProducts().filter((p) => p.dimsConfidence < 0.8 || ov[p.id]);
  return (
    <div className="page-in">
      <div style={{ display: 'grid', gap: 8 }}>
        <span className="eyebrow">Catalogo · {queue.length} prodotti</span>
        <h1>Revisione misure</h1>
        <p className="lead">
          Prodotti per cui le misure lette dal negozio sono incomplete o incoerenti. Controlla la scheda, correggi e approva: la correzione vale subito in questo browser; con «Esporta» la porti nel catalogo (data/overrides.json).
        </p>
        <p>
          <button
            className="btn small"
            onClick={() => {
              const blob = new Blob([JSON.stringify(readOverrides(), null, 1)], { type: 'application/json' });
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = 'overrides.json';
              a.click();
            }}
          >
            Esporta le correzioni (JSON)
          </button>
        </p>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Prodotto</th>
              <th>Testo del negozio</th>
              <th>Larg.</th>
              <th>Prof.</th>
              <th>Alt.</th>
              <th>Confidenza</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {queue.map((p) => (
              <Row
                key={p.id}
                p={p}
                approved={!!ov[p.id]}
                onSave={(w, d, h) => {
                  saveOverride(p.id, { w, d, h, approvedAt: new Date().toISOString() });
                  invalidateCatalog();
                  refresh((n) => n + 1);
                }}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Row({ p, approved, onSave }: { p: Product; approved: boolean; onSave: (w: number | null, d: number | null, h: number | null) => void }) {
  const [w, setW] = useState(p.w?.toString() ?? '');
  const [d, setD] = useState(p.d?.toString() ?? '');
  const [h, setH] = useState(p.h?.toString() ?? '');
  const n = (s: string) => (s.trim() ? Number(s.replace(',', '.')) : null);
  const cell = (val: string, set: (s: string) => void, label: string) => (
    <td>
      <input aria-label={`${label} ${p.title}`} style={{ width: 64 }} inputMode="decimal" value={val} onChange={(e) => set(e.target.value)} />
    </td>
  );
  return (
    <tr>
      <td>
        <span className="retailer">
          {p.retailer} · {CATALOG_LABEL[p.category] ?? p.category}
        </span>
        <br />
        <a href={p.url} target="_blank" rel="noopener">
          {p.title}
        </a>
      </td>
      <td className="note">{p.dimsText}</td>
      {cell(w, setW, 'Larghezza')}
      {cell(d, setD, 'Profondità')}
      {cell(h, setH, 'Altezza')}
      <td className="num">{approved ? 'approvato' : p.dimsConfidence.toFixed(2).replace('.', ',')}</td>
      <td>
        <button className="btn small" onClick={() => onSave(n(w), n(d), n(h))}>
          Approva
        </button>
      </td>
    </tr>
  );
}
