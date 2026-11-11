import { create } from 'zustand';
import type { Project } from './types';
import { demoProject } from '../data/demo-project';
import { track } from './analytics';

export type Tool =
  | 'select'
  | 'wall'
  | 'room'
  | 'door'
  | 'sliding'
  | 'gap'
  | 'window'
  | 'window-fixed'
  | 'pillar'
  | 'radiator'
  | 'outlet'
  | 'obstacle'
  | 'closet'
  | 'measure'
  | 'calibrate'
  | 'place';

export type Sel =
  | { kind: 'item' | 'fixture' | 'opening' | 'wall' | 'node' | 'room' | 'dim'; id: string }
  | null;

export type ViewMode = '2d' | '3d' | 'split';
export type CamMode = 'orbit' | 'top' | 'walk';
export type SidePanel = 'inspector' | 'products' | 'library' | 'survey';

type State = {
  project: Project;
  past: Project[];
  future: Project[];
  sel: Sel;
  tool: Tool;
  placeType: string | null;
  view: ViewMode;
  cam: CamMode;
  lowWalls: boolean;
  showZones: boolean;
  panel: SidePanel;
  wallKind: 'ext' | 'int';
  wallThickness: number;
  /** id del progetto salvato in locale, per non sovrascrivere la demo */
  saved: boolean;
  load: (p: Project) => void;
  /** applica una modifica; `record=false` per i trascinamenti (la cronologia si salva una volta all'inizio) */
  apply: (fn: (p: Project) => Project, record?: boolean) => void;
  checkpoint: () => void;
  undo: () => void;
  redo: () => void;
  select: (s: Sel) => void;
  setTool: (t: Tool, placeType?: string | null) => void;
  set: (patch: Partial<Pick<State, 'view' | 'cam' | 'lowWalls' | 'showZones' | 'panel' | 'wallKind' | 'wallThickness'>>) => void;
};

const KEY = 'cista:project';
const MAX_HISTORY = 100;

export function loadSaved(): Project | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Project) : null;
  } catch {
    return null;
  }
}

function persist(p: Project) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* archiviazione non disponibile: il progetto resta in memoria */
  }
}

export const useStore = create<State>((set, get) => ({
  project: demoProject(),
  past: [],
  future: [],
  sel: null,
  tool: 'select',
  placeType: null,
  view: 'split',
  cam: 'orbit',
  lowWalls: false,
  showZones: true,
  panel: 'library',
  wallKind: 'int',
  wallThickness: 10,
  saved: false,
  load: (p) => set({ project: p, past: [], future: [], sel: null, tool: 'select', placeType: null, saved: p.id !== 'demo-majadahonda' }),
  apply: (fn, record = true) => {
    const cur = get().project;
    const next = fn(cur);
    if (next === cur) return;
    set((s) => ({
      project: next,
      past: record ? [...s.past, cur].slice(-MAX_HISTORY) : s.past,
      future: record ? [] : s.future,
    }));
  },
  checkpoint: () => set((s) => ({ past: [...s.past, s.project].slice(-MAX_HISTORY), future: [] })),
  undo: () => {
    const { past, project, future } = get();
    if (!past.length) return;
    set({ project: past[past.length - 1], past: past.slice(0, -1), future: [project, ...future], sel: null });
  },
  redo: () => {
    const { past, project, future } = get();
    if (!future.length) return;
    set({ project: future[0], future: future.slice(1), past: [...past, project], sel: null });
  },
  select: (s) => set({ sel: s }),
  setTool: (t, placeType = null) => set({ tool: t, placeType, sel: t === 'select' ? get().sel : null }),
  set: (patch) => set(patch),
}));

// salvataggio automatico dei progetti dell'utente (la demo si ricarica sempre pulita)
let timer: ReturnType<typeof setTimeout> | undefined;
let firstEdit = true;
useStore.subscribe((s, prev) => {
  if (s.project === prev.project) return;
  if (s.project.id === 'demo-majadahonda') return;
  if (firstEdit) {
    firstEdit = false;
    track('project_created', { from: s.project.name });
  }
  clearTimeout(timer);
  timer = setTimeout(() => persist(s.project), 400);
});

export const sel = () => useStore.getState().sel;
