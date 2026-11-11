import { useRef } from 'react';
import { useStore } from '../model/store';
import { FURNITURE, newItem, type FurnitureDef } from '../model/furniture';
import { TEMPLATES } from '../data/templates';
import { emptyProject } from '../model/project';
import type { Project } from '../model/types';

function MiniPlan({ def }: { def: FurnitureDef }) {
  const it = newItem(def.type, 0, 0);
  const parts = def.parts(it).slice().sort((a, b) => a.z + a.h - (b.z + b.h));
  const pad = 6;
  const vb = `${-it.w / 2 - pad} ${-it.d / 2 - pad} ${it.w + pad * 2} ${it.d + pad * 2}`;
  return (
    <svg viewBox={vb} aria-hidden="true" preserveAspectRatio="xMidYMid meet">
      {parts.map((p, i) =>
        p.shape === 'cyl' ? (
          <ellipse key={i} cx={p.x} cy={p.y} rx={p.w / 2} ry={p.d / 2} fill="var(--sheet)" stroke="currentColor" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        ) : (
          <rect key={i} x={p.x - p.w / 2} y={p.y - p.d / 2} width={p.w} height={p.d} fill="var(--sheet)" stroke="currentColor" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        ),
      )}
    </svg>
  );
}

export default function Library() {
  const tool = useStore((s) => s.tool);
  const placeType = useStore((s) => s.placeType);
  const project = useStore((s) => s.project);
  const wallKind = useStore((s) => s.wallKind);
  const wallThickness = useStore((s) => s.wallThickness);
  const { setTool, apply, load, set } = useStore.getState();
  const fileRef = useRef<HTMLInputElement>(null);
  const jsonRef = useRef<HTMLInputElement>(null);
  const groups = [...new Set(FURNITURE.map((f) => f.group))];

  const onImage = (f: File) => {
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        // scala iniziale: l'immagine larga circa 10 m; poi si calibra con due punti
        const scale = 1000 / img.naturalWidth;
        apply((p) => ({ ...p, background: { src: String(r.result), x: 0, y: 0, scale, opacity: 0.5, visible: true, naturalW: img.naturalWidth, naturalH: img.naturalHeight } }));
        setTool('calibrate');
      };
      img.src = String(r.result);
    };
    r.readAsDataURL(f);
  };

  return (
    <div className="lib">
      <div>
        <p className="eyebrow">Muri</p>
        <div className="fields" style={{ marginTop: 6 }}>
          <label className="field">
            Tipo
            <select value={wallKind} onChange={(e) => set({ wallKind: e.target.value as 'ext' | 'int', wallThickness: e.target.value === 'ext' ? 24 : 10 })}>
              <option value="int">Tramezzo</option>
              <option value="ext">Muro esterno</option>
            </select>
          </label>
          <label className="field">
            Spessore (cm)
            <input type="number" min={4} max={60} value={wallThickness} onChange={(e) => set({ wallThickness: Number(e.target.value) || 10 })} />
          </label>
        </div>
      </div>
      {groups.map((g) => (
        <div key={g}>
          <p className="eyebrow">{g}</p>
          <div className="lib-grid" style={{ marginTop: 6 }}>
            {FURNITURE.filter((f) => f.group === g).map((f) => (
              <button key={f.type} aria-pressed={tool === 'place' && placeType === f.type} onClick={() => setTool('place', f.type)} data-testid={`lib-${f.type}`}>
                <MiniPlan def={f} />
                {f.label}
              </button>
            ))}
          </div>
        </div>
      ))}
      <div>
        <p className="eyebrow">Planimetria da immagine</p>
        <p className="note" style={{ margin: '6px 0' }}>
          Carica una foto o la scansione della planimetria, calibra la scala con una misura che conosci e ricalca i muri.
        </p>
        <div className="row">
          <button className="btn small" onClick={() => fileRef.current?.click()}>
            Carica immagine
          </button>
          {project.background && (
            <>
              <button className="btn small" onClick={() => setTool('calibrate')}>
                Calibra
              </button>
              <button className="btn small" onClick={() => apply((p) => ({ ...p, background: p.background && { ...p.background, visible: !p.background.visible } }))}>
                {project.background.visible ? 'Nascondi' : 'Mostra'}
              </button>
            </>
          )}
        </div>
        {project.background && (
          <label className="field" style={{ marginTop: 8 }}>
            Opacità
            <input type="range" min={0.1} max={1} step={0.05} value={project.background.opacity} onChange={(e) => apply((p) => ({ ...p, background: p.background && { ...p.background, opacity: Number(e.target.value) } }), false)} />
          </label>
        )}
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && onImage(e.target.files[0])} />
      </div>
      <div>
        <p className="eyebrow">Progetto</p>
        <div className="row" style={{ marginTop: 6 }}>
          <button className="btn small" onClick={() => load({ ...emptyProject('La mia casa') })}>
            Nuovo vuoto
          </button>
          {TEMPLATES.map((t) => (
            <button key={t.id} className="btn small" onClick={() => load(t.build())}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="row" style={{ marginTop: 6 }}>
          <button
            className="btn small"
            onClick={() => {
              const blob = new Blob([JSON.stringify(project, null, 1)], { type: 'application/json' });
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = `${project.name.replace(/\W+/g, '-').toLowerCase()}.json`;
              a.click();
            }}
          >
            Esporta JSON
          </button>
          <button className="btn small" onClick={() => jsonRef.current?.click()}>
            Importa JSON
          </button>
          <input
            ref={jsonRef}
            type="file"
            accept="application/json"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                const p = JSON.parse(await f.text()) as Project;
                if (p.version === 1) load(p);
              } catch {
                /* file non valido: ignorato */
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}
