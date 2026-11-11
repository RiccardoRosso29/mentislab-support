import { lazy, Suspense, useEffect, useState } from 'react';
import { useStore, type Tool } from '../model/store';
import Plan2D from './Plan2D';
import Inspector from './Inspector';
import Library from './Library';
import ProductPanel from './ProductPanel';
import Survey from './Survey';
import { deleteSel, duplicateSel, rotateSel } from '../model/edit';
import { exportPng, exportSvg } from './exportPlan';
import { encodeProject } from '../model/share';
import ProDialog from './ProDialog';

const View3D = lazy(() => import('./View3D'));

const ICON: Record<string, JSX.Element> = {
  select: <path d="M5 3l12 9-5 1 3 6-2 1-3-6-4 4z" />,
  wall: <path d="M3 17h18v3H3zM3 10h8v3H3z" />,
  room: <path d="M4 4h16v16H4zM7 7v10h10V7z" fillRule="evenodd" />,
  door: <path d="M4 20h4V8a8 8 0 0 1 8 8h2A10 10 0 0 0 8 6V4H4z" />,
  sliding: <path d="M3 9h11v2H3zM10 13h11v2H10zM3 19h18v1H3z" />,
  gap: <path d="M3 10h5v4H3zM16 10h5v4h-5zM9 11.5h6v1H9z" />,
  window: <path d="M3 9h18v6H3zM3 11h18v.8H3zM3 13h18v.8H3z" fillRule="evenodd" />,
  'window-fixed': <path d="M3 9h18v6H3zM5 11h14v2H5z" fillRule="evenodd" />,
  pillar: <path d="M7 7h10v10H7z" />,
  radiator: <path d="M4 8h16v8H4zM6 9v6h1V9zM9 9v6h1V9zM12 9v6h1V9zM15 9v6h1V9z" fillRule="evenodd" />,
  outlet: <path d="M12 5a7 7 0 1 1 0 14 7 7 0 0 1 0-14zm-3 6v2h2v-2zm4 0v2h2v-2z" fillRule="evenodd" />,
  obstacle: <path d="M4 4h16v6H4zM6 12h2v8H6zM16 12h2v8h-2z" />,
  closet: <path d="M4 3h16v18H4zM6 5v14h5V5zm7 0v14h5V5z" fillRule="evenodd" />,
  measure: <path d="M2 15l13-13 7 7-13 13zM6 15l1 1 2-2-1-1zm3-3l1 1 2-2-1-1zm3-3l1 1 2-2-1-1z" fillRule="evenodd" />,
  calibrate: <path d="M3 3h7v2H5v5H3zM14 3h7v7h-2V5h-5zM3 14h2v5h5v2H3zM19 14h2v7h-7v-2h5z" />,
};

const TOOLS: [Tool, string][] = [
  ['select', 'Seleziona e sposta (trascina il vuoto per spostare la vista)'],
  ['wall', 'Muri a catena: clic per ogni vertice, digita la lunghezza e Invio, Esc per finire'],
  ['room', 'Stanza rettangolare: trascina da un angolo all’altro'],
  ['door', 'Porta a battente'],
  ['sliding', 'Porta scorrevole'],
  ['gap', 'Varco senza porta'],
  ['window', 'Finestra'],
  ['window-fixed', 'Finestra fissa'],
  ['pillar', 'Pilastro'],
  ['radiator', 'Termosifone'],
  ['outlet', 'Presa'],
  ['obstacle', 'Ostacolo in alto (condizionatore, pensile, mensola)'],
  ['closet', 'Armadio a muro'],
  ['measure', 'Metro: due clic per misurare e fissare una quota'],
  ['calibrate', 'Calibra la scala dell’immagine di sfondo'],
];

const HINT: Partial<Record<Tool, string>> = {
  select: 'Clic per selezionare, trascina per spostare. Rotella o pizzico per lo zoom. Canc elimina, R ruota.',
  wall: 'Clic per ogni vertice. Digita la lunghezza in cm e premi Invio. Torna al primo punto per chiudere la stanza. Esc per finire. Maiusc disattiva l’aggancio.',
  room: 'Trascina da un angolo all’angolo opposto.',
  measure: 'Clic sul primo punto e poi sul secondo: la quota resta fissata.',
  calibrate: 'Clic su due punti dell’immagine di cui conosci la distanza reale.',
  place: 'Clic nella pianta per posare il mobile: vicino a un muro si aggancia da solo.',
};

export default function EditorPage({ readOnlyHint }: { readOnlyHint?: boolean }) {
  const project = useStore((s) => s.project);
  const tool = useStore((s) => s.tool);
  const view = useStore((s) => s.view);
  const cam = useStore((s) => s.cam);
  const low = useStore((s) => s.lowWalls);
  const zones = useStore((s) => s.showZones);
  const panel = useStore((s) => s.panel);
  const sel = useStore((s) => s.sel);
  const past = useStore((s) => s.past);
  const future = useStore((s) => s.future);
  const { setTool, set, undo, redo, apply, select } = useStore.getState();
  const [shareMsg, setShareMsg] = useState('');
  const [pro, setPro] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      const s = useStore.getState().sel;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd' && s) {
        e.preventDefault();
        const r = duplicateSel(useStore.getState().project, s);
        apply(() => r.p);
        select(r.sel);
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && s && useStore.getState().tool === 'select') {
        apply((p) => deleteSel(p, s));
        select(null);
      } else if (e.key.toLowerCase() === 'r' && s && !e.ctrlKey && !e.metaKey && useStore.getState().tool === 'select') {
        apply((p) => rotateSel(p, s, e.shiftKey ? 15 : 90));
      } else if (s?.kind === 'item' && e.key.startsWith('Arrow') && useStore.getState().cam !== 'walk') {
        const k = e.shiftKey ? 10 : 1;
        const d = { ArrowLeft: [-k, 0], ArrowRight: [k, 0], ArrowUp: [0, -k], ArrowDown: [0, k] }[e.key]!;
        e.preventDefault();
        apply((p) => ({ ...p, items: p.items.map((i) => (i.id === s.id ? { ...i, x: i.x + d[0], y: i.y + d[1] } : i)) }));
      }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [apply, redo, select, undo]);

  useEffect(() => {
    if (sel && panel === 'library') set({ panel: 'inspector' });
  }, [sel]); // eslint-disable-line react-hooks/exhaustive-deps

  const share = async () => {
    const code = await encodeProject(project);
    const url = `${location.href.split('#')[0]}#progetto-${code}`;
    try {
      await navigator.clipboard.writeText(url);
      setShareMsg('Link copiato negli appunti.');
    } catch {
      setShareMsg(`Copia questo link: ${url.slice(0, 80)}…`);
    }
    setTimeout(() => setShareMsg(''), 4000);
  };

  return (
    <div className="editor">
      <div className="tools" role="toolbar" aria-label="Strumenti">
        {TOOLS.map(([id, label], i) => (
          <span key={id} style={{ display: 'contents' }}>
            {(i === 3 || i === 8 || i === 13) && <span className="sep" />}
            <button className="tool" title={label} aria-label={label} aria-pressed={tool === id} onClick={() => setTool(id)} data-testid={`tool-${id}`}>
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                {ICON[id]}
              </svg>
            </button>
          </span>
        ))}
      </div>
      <div className="stage">
        <div className="stagebar">
          <div className="seg" role="group" aria-label="Vista">
            {(['2d', 'split', '3d'] as const).map((m) => (
              <button key={m} aria-pressed={view === m} onClick={() => set({ view: m })}>
                {m === '2d' ? 'Pianta' : m === '3d' ? '3D' : 'Pianta + 3D'}
              </button>
            ))}
          </div>
          {view !== '2d' && (
            <div className="seg" role="group" aria-label="Camera">
              {(['orbit', 'top', 'walk'] as const).map((m) => (
                <button key={m} aria-pressed={cam === m} onClick={() => set({ cam: m })}>
                  {m === 'orbit' ? 'Panoramica' : m === 'top' ? 'Dall’alto' : 'Cammina'}
                </button>
              ))}
            </div>
          )}
          <button className="btn small" aria-pressed={low} onClick={() => set({ lowWalls: !low })}>
            Pareti basse
          </button>
          <button className="btn small" aria-pressed={zones} onClick={() => set({ showZones: !zones })}>
            Zone d’uso
          </button>
          <button className="btn small" onClick={undo} disabled={!past.length} title="Annulla (Ctrl+Z)">
            ↶ Annulla
          </button>
          <button className="btn small" onClick={redo} disabled={!future.length} title="Ripeti (Ctrl+Maiusc+Z)">
            ↷ Ripeti
          </button>
          <button className="btn small" onClick={() => exportSvg(project)}>
            Planimetria SVG
          </button>
          <button className="btn small" onClick={() => exportPng(project)}>
            PNG
          </button>
          <button className="btn small" onClick={share}>
            Condividi
          </button>
          <button className="btn small" onClick={() => setPro(true)}>
            Assistente Pro
          </button>
          <span className="hint">{shareMsg || (readOnlyHint ? 'Progetto condiviso: le modifiche restano solo in questa pagina.' : HINT[tool] ?? '')}</span>
        </div>
        <div className={`views ${view === 'split' ? 'split' : ''}`}>
          {view !== '3d' && <Plan2D fitKey={project.id} />}
          {view !== '2d' && (
            <Suspense fallback={<div className="three" />}>
              <View3D />
            </Suspense>
          )}
        </div>
      </div>
      <aside className="side" aria-label="Pannello">
        <div className="tabs" role="tablist">
          {(
            [
              ['library', 'Mobili'],
              ['inspector', 'Proprietà'],
              ['products', 'Prodotti'],
              ['survey', 'Rilievo'],
            ] as const
          ).map(([id, label]) => (
            <button key={id} role="tab" aria-selected={panel === id} onClick={() => set({ panel: id })} data-testid={`tab-${id}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="panelbody">
          {panel === 'library' && <Library />}
          {panel === 'inspector' && <Inspector />}
          {panel === 'products' && <ProductPanel />}
          {panel === 'survey' && <Survey />}
        </div>
      </aside>
      {pro && <ProDialog onClose={() => setPro(false)} />}
    </div>
  );
}
