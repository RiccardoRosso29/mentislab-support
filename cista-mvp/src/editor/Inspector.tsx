import { useEffect, useState } from 'react';
import { useStore } from '../model/store';
import type { Fixture, Item, Opening, Project, Room, Wall } from '../model/types';
import { defOf, CATALOG_LABEL } from '../model/furniture';
import { deleteSel, duplicateSel, rotateSel } from '../model/edit';
import { roomArea, wallGeom } from '../model/project';
import { fmtCm } from '../model/geometry';
import { productById } from '../model/catalog';
import { track } from '../model/analytics';

function Num({ label, value, onCommit, step = 1, full }: { label: string; value: number; onCommit: (n: number) => void; step?: number; full?: boolean }) {
  const [s, setS] = useState(String(Math.round(value * 10) / 10).replace('.', ','));
  useEffect(() => setS(String(Math.round(value * 10) / 10).replace('.', ',')), [value]);
  const commit = () => {
    const n = parseFloat(s.replace(',', '.'));
    if (Number.isFinite(n) && Math.abs(n - value) > 0.01) onCommit(n);
    else setS(String(Math.round(value * 10) / 10).replace('.', ','));
  };
  const id = `f-${label.replace(/\W+/g, '-')}`;
  return (
    <label className={`field${full ? ' full' : ''}`} htmlFor={id}>
      {label}
      <input id={id} inputMode="decimal" value={s} step={step} onChange={(e) => setS(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === 'Enter' && commit()} />
    </label>
  );
}

function Txt({ label, value, onCommit, full = true }: { label: string; value: string; onCommit: (s: string) => void; full?: boolean }) {
  const [s, setS] = useState(value);
  useEffect(() => setS(value), [value]);
  const id = `t-${label.replace(/\W+/g, '-')}`;
  return (
    <label className={`field${full ? ' full' : ''}`} htmlFor={id}>
      {label}
      <input id={id} value={s} onChange={(e) => setS(e.target.value)} onBlur={() => s !== value && onCommit(s)} onKeyDown={(e) => e.key === 'Enter' && s !== value && onCommit(s)} />
    </label>
  );
}

export default function Inspector() {
  const sel = useStore((s) => s.sel);
  const project = useStore((s) => s.project);
  const { apply, select, set } = useStore.getState();
  if (!sel) {
    return (
      <>
        <h3>Nessuna selezione</h3>
        <p className="note">Tocca un mobile, un muro, una porta o una stanza nella pianta (o un mobile nel 3D) per vederne le misure e modificarle.</p>
        <div className="callout">
          Il cuore di CiSta: seleziona un mobile e apri <b>Prodotti</b> per vedere solo i prodotti reali che ci stanno in quello spazio, con il motivo in centimetri.
        </div>
      </>
    );
  }
  const actions = (
    <div className="row">
      {(sel.kind === 'item' || sel.kind === 'fixture') && (
        <button className="btn small" onClick={() => apply((p) => rotateSel(p, sel, 90))}>
          Ruota 90°
        </button>
      )}
      {sel.kind === 'item' && (
        <button
          className="btn small"
          onClick={() => {
            const r = duplicateSel(project, sel);
            apply(() => r.p);
            select(r.sel);
          }}
        >
          Duplica
        </button>
      )}
      <button
        className="btn small"
        onClick={() => {
          apply((p) => deleteSel(p, sel));
          select(null);
        }}
      >
        Elimina
      </button>
    </div>
  );

  if (sel.kind === 'item') {
    const it = project.items.find((i) => i.id === sel.id);
    if (!it) return null;
    const def = defOf(it.type);
    const up = (patch: Partial<Item>) => apply((p) => ({ ...p, items: p.items.map((i) => (i.id === it.id ? { ...i, ...patch } : i)) }));
    const upParam = (k: string, val: number) => up({ params: { ...(it.params ?? {}), [k]: val } });
    const prod = productById(it.productId);
    return (
      <>
        <div>
          <p className="eyebrow">{def.group}</p>
          <h3>{it.label ?? def.label}</h3>
          {prod && (
            <p className="note" style={{ marginTop: 4 }}>
              {it.chosen ? 'Scelto' : 'In prova'}: {prod.retailer} · {prod.title}
            </p>
          )}
        </div>
        {def.catalog && (
          <button
            className="btn primary"
            data-testid="find-products"
            onClick={() => {
              set({ panel: 'products' });
              track('slot_search_opened', { type: it.type });
            }}
          >
            Trova {CATALOG_LABEL[def.catalog]?.toLowerCase() ?? 'prodotti'} che ci stanno
          </button>
        )}
        <div className="fields">
          <Num label="Larghezza (cm)" value={it.w} onCommit={(n) => up({ w: n })} />
          <Num label="Profondità (cm)" value={it.d} onCommit={(n) => up({ d: n })} />
          <Num label="Altezza (cm)" value={it.h} onCommit={(n) => up({ h: n })} />
          <Num label="Rotazione (°)" value={it.rot} onCommit={(n) => up({ rot: ((n % 360) + 360) % 360 })} />
          {def.z != null && <Num label="Da terra (cm)" value={it.z ?? def.z} onCommit={(n) => up({ z: n })} />}
          {it.type === 'sofa-bed' && <Num label="Ingombro da aperto (cm)" value={it.params?.openDepth ?? 220} onCommit={(n) => upParam('openDepth', n)} />}
          {it.type === 'sofa-chaise' && (
            <>
              <Num label="Profondità chaise (cm)" value={it.params?.chaiseDepth ?? 160} onCommit={(n) => upParam('chaiseDepth', n)} />
              <Num label="Larghezza chaise (cm)" value={it.params?.chaiseWidth ?? 90} onCommit={(n) => upParam('chaiseWidth', n)} />
              <label className="field">
                Chaise a
                <select value={it.params?.chaiseSide ?? 1} onChange={(e) => upParam('chaiseSide', Number(e.target.value))}>
                  <option value={1}>destra</option>
                  <option value={-1}>sinistra</option>
                </select>
              </label>
            </>
          )}
          {it.type === 'wardrobe' && (
            <label className="field">
              Ante
              <select value={it.params?.sliding ?? 0} onChange={(e) => upParam('sliding', Number(e.target.value))}>
                <option value={0}>a battente</option>
                <option value={1}>scorrevoli</option>
              </select>
            </label>
          )}
          <label className="field">
            Colore
            <input type="color" value={it.color ?? def.color} onChange={(e) => up({ color: e.target.value })} />
          </label>
          <Num label="Passaggio minimo davanti" value={it.passage?.min ?? def.passage.min} onCommit={(n) => up({ passage: { min: n, comfort: Math.max(n, it.passage?.comfort ?? def.passage.comfort) } })} />
          <Num label="Passaggio comodo davanti" value={it.passage?.comfort ?? def.passage.comfort} onCommit={(n) => up({ passage: { min: Math.min(n, it.passage?.min ?? def.passage.min), comfort: n } })} />
        </div>
        <label className="check">
          <input type="checkbox" checked={!!it.fixed} onChange={(e) => up({ fixed: e.target.checked })} /> Fisso (non si sposta trascinando)
        </label>
        {it.model && (
          <button className="btn small" onClick={() => up({ ...it.model!, productId: undefined, chosen: false, model: undefined })}>
            Torna al modello ({fmtCm(it.model.w)} × {fmtCm(it.model.d)})
          </button>
        )}
        {actions}
      </>
    );
  }

  if (sel.kind === 'fixture') {
    const f = project.fixtures.find((i) => i.id === sel.id);
    if (!f) return null;
    const up = (patch: Partial<Fixture>) => apply((p) => ({ ...p, fixtures: p.fixtures.map((i) => (i.id === f.id ? { ...i, ...patch } : i)) }));
    return (
      <>
        <div>
          <p className="eyebrow">Elemento fisso</p>
          <h3>{f.label}</h3>
        </div>
        <div className="fields">
          <Txt label="Nome" value={f.label} onCommit={(s) => up({ label: s })} />
          <Num label="Larghezza (cm)" value={f.w} onCommit={(n) => up({ w: n })} />
          <Num label="Profondità / sporgenza (cm)" value={f.d} onCommit={(n) => up({ d: n })} />
          <Num label="Da terra (cm)" value={f.z0} onCommit={(n) => up({ z0: n })} />
          <Num label="Fino a (cm)" value={f.z1} onCommit={(n) => up({ z1: n })} />
          <Num label="Rotazione (°)" value={f.rot} onCommit={(n) => up({ rot: n })} />
          {(f.kind === 'closet' || f.kind === 'appliance' || f.kind === 'kitchen') && (
            <Num label="Spazio libero davanti (cm)" value={f.frontClearance ?? 0} onCommit={(n) => up({ frontClearance: n })} />
          )}
        </div>
        <label className="check">
          <input type="checkbox" checked={!!f.measured} onChange={(e) => up({ measured: e.target.checked })} /> Misure prese in casa
        </label>
        {f.kind === 'closet' && (
          <div>
            <p className="eyebrow">Interni</p>
            {(f.sections ?? []).map((s, k) => {
              const upS = (patch: Partial<NonNullable<Fixture['sections']>[number]>) =>
                up({ sections: (f.sections ?? []).map((x, j) => (j === k ? { ...x, ...patch } : x)) });
              return (
                <div key={k} className="fields" style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--line)' }}>
                  <Txt label="Parte" value={s.label} onCommit={(v) => upS({ label: v })} />
                  <Num label="Larghezza interna" value={s.w} onCommit={(n) => upS({ w: n })} />
                  <Num label="Profondità interna" value={s.d} onCommit={(n) => upS({ d: n })} />
                  <Num label="Larghezza utile" value={s.usableW ?? s.w} onCommit={(n) => upS({ usableW: n })} />
                  <Num label="Profondità utile" value={s.usableD ?? s.d} onCommit={(n) => upS({ usableD: n })} />
                  <Txt label="Mensole e note" value={s.shelves ?? ''} onCommit={(v) => upS({ shelves: v })} />
                </div>
              );
            })}
            <button className="btn small" style={{ marginTop: 8 }} onClick={() => up({ sections: [...(f.sections ?? []), { label: 'Nuova parte', w: 50, d: 55 }] })}>
              Aggiungi parte
            </button>
          </div>
        )}
        {actions}
      </>
    );
  }

  if (sel.kind === 'opening') {
    const o = project.openings.find((i) => i.id === sel.id);
    if (!o) return null;
    const up = (patch: Partial<Opening>) => apply((p) => ({ ...p, openings: p.openings.map((i) => (i.id === o.id ? { ...i, ...patch } : i)) }));
    const isWin = o.kind === 'window' || o.kind === 'window-fixed';
    return (
      <>
        <div>
          <p className="eyebrow">Apertura</p>
          <h3>{isWin ? 'Finestra' : o.kind === 'gap' ? 'Varco' : o.kind === 'sliding' ? 'Porta scorrevole' : 'Porta'}</h3>
        </div>
        <div className="fields">
          <label className="field full">
            Tipo
            <select value={o.kind} onChange={(e) => up({ kind: e.target.value as Opening['kind'] })}>
              <option value="door">Porta a battente</option>
              <option value="sliding">Porta scorrevole</option>
              <option value="gap">Varco</option>
              <option value="window">Finestra apribile</option>
              <option value="window-fixed">Finestra fissa</option>
            </select>
          </label>
          <Num label="Larghezza senza coprifilo" value={o.width} onCommit={(n) => up({ width: n })} />
          <Num label="Altezza" value={o.height} onCommit={(n) => up({ height: n })} />
          {isWin && <Num label="Davanzale da terra" value={o.sill} onCommit={(n) => up({ sill: n })} />}
          <Num label="Posizione sul muro" value={o.offset} onCommit={(n) => up({ offset: n })} />
          {o.kind === 'door' && (
            <>
              <label className="field">
                Cerniera
                <select value={o.hinge} onChange={(e) => up({ hinge: e.target.value as Opening['hinge'] })}>
                  <option value="start">a un lato</option>
                  <option value="end">all’altro lato</option>
                </select>
              </label>
              <label className="field">
                Si apre
                <select value={o.side} onChange={(e) => up({ side: Number(e.target.value) as 1 | -1 })}>
                  <option value={1}>verso un lato</option>
                  <option value={-1}>verso l’altro</option>
                </select>
              </label>
            </>
          )}
        </div>
        <label className="check">
          <input type="checkbox" checked={!!o.measured} onChange={(e) => up({ measured: e.target.checked })} /> Misurata in casa
        </label>
        {actions}
      </>
    );
  }

  if (sel.kind === 'wall') {
    const w = project.walls.find((i) => i.id === sel.id);
    if (!w) return null;
    const g = wallGeom(project, w);
    const up = (patch: Partial<Wall>) => apply((p: Project) => ({ ...p, walls: p.walls.map((i) => (i.id === w.id ? { ...i, ...patch } : i)) }));
    return (
      <>
        <div>
          <p className="eyebrow">Muro</p>
          <h3>{w.kind === 'ext' ? 'Muro esterno' : 'Tramezzo'}</h3>
          <p className="note">Lunghezza sull’asse {fmtCm(g.length)} cm. Per la misura esatta tocca la quota blu nella pianta, oppure seleziona la stanza e tocca il lato interno.</p>
        </div>
        <div className="fields">
          <Num label="Spessore (cm)" value={w.thickness} onCommit={(n) => up({ thickness: n })} />
          <Num label="Altezza (cm)" value={w.height} onCommit={(n) => up({ height: n })} />
          <label className="field full">
            Tipo
            <select value={w.kind} onChange={(e) => up({ kind: e.target.value as Wall['kind'] })}>
              <option value="ext">Muro esterno</option>
              <option value="int">Tramezzo</option>
            </select>
          </label>
        </div>
        {actions}
      </>
    );
  }

  if (sel.kind === 'room') {
    const r = project.rooms.find((i) => i.id === sel.id);
    if (!r) return null;
    const up = (patch: Partial<Room>) => apply((p) => ({ ...p, rooms: p.rooms.map((i) => (i.id === r.id ? { ...i, ...patch } : i)) }));
    return (
      <>
        <div>
          <p className="eyebrow">Stanza · {roomArea(project, r).toFixed(1).replace('.', ',')} m²</p>
          <h3>{r.name}</h3>
          <p className="note">Le quote blu lungo i lati sono le misure interne, a filo dei muri finiti.{r.nodeIds ? ' Toccane una per scrivere la misura esatta.' : ''}</p>
        </div>
        <div className="fields">
          <Txt label="Nome" value={r.name} onCommit={(s) => up({ name: s })} />
          <label className="field full">
            Pavimento
            <select value={r.floor} onChange={(e) => up({ floor: e.target.value as Room['floor'] })}>
              <option value="parquet">Parquet / laminato</option>
              <option value="gres">Gres grigio</option>
              <option value="tiles-warm">Piastrelle calde</option>
              <option value="tiles-light">Piastrelle chiare</option>
              <option value="concrete">Cemento</option>
            </select>
          </label>
        </div>
        {actions}
      </>
    );
  }

  if (sel.kind === 'dim') {
    const d = project.dims.find((i) => i.id === sel.id);
    if (!d) return null;
    const up = (patch: Partial<typeof d>) => apply((p) => ({ ...p, dims: p.dims.map((i) => (i.id === d.id ? { ...i, ...patch } : i)) }));
    return (
      <>
        <div>
          <p className="eyebrow">Quota</p>
          <h3>{d.label ?? `${fmtCm(Math.hypot(d.b.x - d.a.x, d.b.y - d.a.y))} cm`}</h3>
          <p className="note">Le misure prese in casa si vedono in blu e prevalgono sul disegno; quelle stimate in grigio con «≈».</p>
        </div>
        <label className="check">
          <input type="checkbox" checked={d.measured} onChange={(e) => up({ measured: e.target.checked })} /> Misura presa in casa
        </label>
        <div className="fields">
          <Txt label="Testo della quota (la misura reale)" value={d.label ?? ''} onCommit={(s) => up({ label: s || undefined })} />
          <Num label="Scostamento dalla linea (cm)" value={d.offset} onCommit={(n) => up({ offset: n })} />
        </div>
        {actions}
      </>
    );
  }
  return null;
}
