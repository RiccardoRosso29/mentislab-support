// Modello dati del progetto. Tutte le misure sono in centimetri.
// Piano: x verso destra, y verso il basso (come in SVG). Rotazioni in gradi, in senso orario.

export type Vec = { x: number; y: number };

export type Node = { id: string; x: number; y: number };

export type Wall = {
  id: string;
  a: string; // id del nodo iniziale
  b: string; // id del nodo finale
  thickness: number;
  height: number;
  kind: 'ext' | 'int';
};

export type OpeningKind = 'door' | 'sliding' | 'gap' | 'window' | 'window-fixed';

export type Opening = {
  id: string;
  wallId: string;
  kind: OpeningKind;
  /** distanza del centro dell'apertura dal nodo `a` del muro, lungo il muro */
  offset: number;
  width: number;
  height: number;
  /** altezza del davanzale (finestre) */
  sill: number;
  /** lato della cerniera (porte a battente) */
  hinge: 'start' | 'end';
  /** verso di apertura: +1 verso la normale sinistra del muro (a→b), -1 verso la destra */
  side: 1 | -1;
  measured?: boolean;
};

export type FixtureKind =
  | 'pillar'
  | 'radiator'
  | 'outlet'
  | 'obstacle'
  | 'closet'
  | 'kitchen'
  | 'appliance';

export type ClosetSection = {
  label: string;
  w: number;
  d: number;
  usableW?: number;
  usableD?: number;
  shelves?: string;
};

export type Fixture = {
  id: string;
  kind: FixtureKind;
  label: string;
  /** centro */
  x: number;
  y: number;
  /** larghezza lungo l'asse locale x, profondità lungo l'asse locale y */
  w: number;
  d: number;
  rot: number;
  /** quota inferiore e superiore da terra */
  z0: number;
  z1: number;
  measured?: boolean;
  /** profondità della zona davanti che deve restare libera (es. ante dell'armadio a muro, sportello del frigo) */
  frontClearance?: number;
  sections?: ClosetSection[];
  color?: string;
};

export type Item = {
  id: string;
  type: string;
  label?: string;
  /** centro dell'ingombro principale */
  x: number;
  y: number;
  /** il fronte del mobile guarda verso +y locale; rot=0 → fronte verso il basso del piano */
  rot: number;
  w: number;
  d: number;
  h: number;
  /** quota da terra della base (mobili appesi) */
  z?: number;
  color?: string;
  params?: Record<string, number>;
  /** prodotto reale scelto o provato */
  productId?: string;
  chosen?: boolean;
  /** misure del modello originale, per tornare indietro dopo «prova nel 3D» */
  model?: { w: number; d: number; h: number; color?: string; params?: Record<string, number> };
  /** mobili fissi (sanitari, elettrodomestici incassati): non si spostano trascinando */
  fixed?: boolean;
  /** passaggio minimo e comodo davanti, se diverso da quello del tipo */
  passage?: { min: number; comfort: number };
};

export type FloorMaterial = 'parquet' | 'gres' | 'tiles-warm' | 'tiles-light' | 'concrete';

export type Room = {
  id: string;
  name: string;
  floor: FloorMaterial;
  /** stanza disegnata: ciclo di nodi (il poligono interno si ricalcola quando i muri si spostano) */
  nodeIds?: string[];
  /** stanza importata o tracciata a mano: poligono interno fisso */
  poly?: Vec[];
};

export type Dimension = {
  id: string;
  a: Vec;
  b: Vec;
  /** scostamento perpendicolare della linea di quota, in cm */
  offset: number;
  measured: boolean;
  /** testo da mostrare al posto della misura disegnata (es. la misura presa in casa) */
  label?: string;
};

export type Background = {
  src: string;
  x: number;
  y: number;
  /** cm per pixel dell'immagine */
  scale: number;
  opacity: number;
  visible: boolean;
  naturalW: number;
  naturalH: number;
};

export type Project = {
  version: 1;
  id: string;
  name: string;
  ceiling: number;
  nodes: Node[];
  walls: Wall[];
  openings: Opening[];
  fixtures: Fixture[];
  items: Item[];
  rooms: Room[];
  dims: Dimension[];
  background?: Background;
  settings: {
    /** passaggio minimo e comodo di default davanti ai mobili */
    passageMin: number;
    passageComfort: number;
    /** tolleranza sulle misure dei prodotti */
    tolerance: number;
  };
};

export type Product = {
  id: string;
  retailer: string;
  sku: string;
  title: string;
  color: string;
  category: string;
  w: number | null;
  d: number | null;
  h: number | null;
  /** ingombro da aperto misurato dalla parete (divani letto, letti estraibili) */
  openDepth?: number | null;
  /** confezione da più pezzi (es. 4 sedie) */
  pack?: number;
  price: number | null;
  currency: 'EUR';
  url: string;
  fetchedAt: string;
  dimsSource: 'manual' | 'feed' | 'parsed' | 'llm';
  dimsConfidence: number;
  dimsText?: string;
  rating?: number;
  ratingCount?: number;
  image?: string;
  note?: string;
};

export type FitStatus = 'ok' | 'warn' | 'no';
