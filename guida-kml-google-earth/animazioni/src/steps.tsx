import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {Backdrop, Camera, center, Cursor, Label, Pt, Rect, Ripple, Shot, Spotlight, toScreen, tween} from './components';
import {colors, SRC_H, SRC_W} from './theme';

/**
 * Punto attorno a cui zoomare (fattore z) perché il bersaglio finisca al centro
 * dell'inquadratura senza uscire dai bordi dello screenshot.
 */
const focusFor = (target: Pt, z: number): Pt => {
  const axis = (c: number, size: number) => {
    const view = size / z;
    const left = Math.min(Math.max(c - view / 2, 0), size - view);
    return (left * z) / (z - 1);
  };
  return {x: axis(target.x, SRC_W), y: axis(target.y, SRC_H)};
};

const lerp = (a: Pt, b: Pt, t: number): Pt => ({x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t});

/** Durata dei passaggi "clic": 5 secondi a 30 fps. */
export const CLICK_FRAMES = 150;

export type ClickStepProps = {
  src: string;
  /** Screenshot mostrato dopo il clic (risultato dell'azione). */
  next?: string;
  target: Rect;
  zoom: number;
  label: string;
  labelAbove?: boolean;
  cursorFrom?: Pt;
};

/**
 * Passaggio con un solo clic:
 * zoom verso il bersaglio, il cursore ci arriva, clic con onda,
 * riquadro arancione con l'istruzione e, se c'è, dissolvenza sul risultato.
 */
export const ClickStep: React.FC<ClickStepProps> = ({src, next, target, zoom, label, labelAbove, cursorFrom}) => {
  const frame = useCurrentFrame();
  const tc = center(target);
  const f = focusFor(tc, zoom);

  const zoomIn = tween(frame, [8, 42], [1, zoom]);
  const zoomOut = next ? tween(frame, [96, 122], [0, 1]) : 0;
  const cam: Camera = {z: zoomIn + (1 - zoomIn) * zoomOut, f};

  const start = cursorFrom ?? {x: SRC_W * 0.55, y: SRC_H * 0.7};
  const cursorPt = lerp(start, tc, tween(frame, [18, 56], [0, 1]));
  const pressed = interpolate(frame, [58, 61, 66], [0, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

  const spot = Math.min(tween(frame, [62, 72], [0, 1]), next ? tween(frame, [92, 100], [1, 0]) : 1);
  const nextOpacity = next ? tween(frame, [96, 112], [0, 1]) : 0;
  const cursorOpacity = next ? tween(frame, [92, 100], [1, 0]) : 1;
  const fade = Math.min(tween(frame, [0, 8], [0, 1]), tween(frame, [CLICK_FRAMES - 10, CLICK_FRAMES], [1, 0]));

  const targetOnScreen = toScreen(tc, cam);
  const edge = toScreen({x: tc.x, y: labelAbove ? target.y : target.y + target.h}, cam);

  return (
    <AbsoluteFill>
      <Backdrop />
      <AbsoluteFill style={{opacity: fade}}>
        <Shot src={src} cam={cam} />
        {next ? <Shot src={next} cam={cam} opacity={nextOpacity} /> : null}
        <Spotlight rect={target} cam={cam} opacity={spot} />
        <Ripple at={targetOnScreen} t={(frame - 60) / 20} />
        <Label at={edge} text={label} opacity={spot} above={labelAbove} />
        <div style={{opacity: cursorOpacity}}>
          <Cursor at={toScreen(cursorPt, cam)} pressed={pressed} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/**
 * Vertici del poligono di La Spezia, letti dallo screenshot con il poligono completato
 * (5-poligono.png). Nello screenshot della mappa vuota (4-mappa.png) la mappa è
 * spostata di (+186, +6) px perché non c'è il pannello laterale aperto.
 */
const POLY_IN_RESULT: Pt[] = [
  {x: 1114, y: 280}, {x: 1233, y: 364}, {x: 1316, y: 360}, {x: 1254, y: 644}, {x: 1185, y: 548},
  {x: 1031, y: 566}, {x: 1017, y: 588}, {x: 1069, y: 633}, {x: 1021, y: 691}, {x: 957, y: 650},
  {x: 843, y: 566}, {x: 803, y: 594}, {x: 756, y: 519}, {x: 826, y: 444}, {x: 924, y: 459},
  {x: 970, y: 441}, {x: 1005, y: 405}, {x: 1042, y: 316},
];
const SHIFT: Pt = {x: 186, y: 6};
const POLY: Pt[] = POLY_IN_RESULT.map((p) => ({x: p.x + SHIFT.x, y: p.y + SHIFT.y}));

const SAVE_BUTTON: Rect = {x: 1656, y: 602, w: 168, h: 39};

const PER_VERTEX = 9;
const DRAW_START = 40;
const CLOSE_AT = DRAW_START + POLY.length * PER_VERTEX; // clic finale sul primo punto
const PAN_START = CLOSE_AT + 40;
const SAVE_CLICK = PAN_START + 70;
export const DRAW_FRAMES = SAVE_CLICK + 70;

/** Passaggio 5: il cursore clicca i vertici, chiude il poligono e lo salva nel progetto. */
export const DrawStep: React.FC = () => {
  const frame = useCurrentFrame();

  const polyCenter: Pt = {x: 1220, y: 490};
  const zoomIn = tween(frame, [0, 34], [1, 1.45]);
  const zoomOut = tween(frame, [PAN_START, PAN_START + 30], [0, 1]);
  const z = zoomIn + (1 - zoomIn) * zoomOut;
  // Durante lo zoom out la mappa scivola a sinistra come quando si apre il pannello.
  const slide = tween(frame, [PAN_START + 10, PAN_START + 34], [0, 1]);
  const camMap: Camera = {z, f: polyCenter, dx: -SHIFT.x * slide, dy: -SHIFT.y * slide};
  const camResult: Camera = {z, f: polyCenter};
  const resultOpacity = tween(frame, [PAN_START + 30, PAN_START + 42], [0, 1]);

  // Posizione del cursore lungo i vertici.
  const path = [...POLY, POLY[0]];
  const t = (frame - DRAW_START) / PER_VERTEX;
  let cursor: Pt;
  let placed: number;
  if (t < 0) {
    cursor = lerp({x: 1500, y: 760}, path[0], tween(frame, [16, DRAW_START], [0, 1]));
    placed = 0;
  } else if (t >= path.length - 1) {
    cursor = path[path.length - 1];
    placed = path.length;
  } else {
    const i = Math.floor(t);
    const local = Math.min(1, (t - i) / 0.7); // pausa breve su ogni vertice = clic
    cursor = lerp(path[i], path[i + 1], local);
    placed = i + 1;
  }
  const closed = frame >= CLOSE_AT;
  const fill = tween(frame, [CLOSE_AT, CLOSE_AT + 12], [0, 0.28]);

  const saveTarget = center(SAVE_BUTTON);
  const afterPan = frame >= PAN_START + 34;
  const saveCursor = lerp(POLY_IN_RESULT[0], saveTarget, tween(frame, [PAN_START + 36, SAVE_CLICK - 4], [0, 1]));
  const cursorPt = afterPan ? saveCursor : cursor;
  const cursorCam = afterPan ? camResult : camMap;

  const drawPress = t >= 0 && t < path.length - 1 + 0.5 && (t % 1) < 0.25 ? 1 : 0;
  const savePress = interpolate(frame, [SAVE_CLICK - 2, SAVE_CLICK + 1, SAVE_CLICK + 6], [0, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const drawLabel = Math.min(tween(frame, [DRAW_START - 10, DRAW_START], [0, 1]), tween(frame, [CLOSE_AT - 8, CLOSE_AT], [1, 0]));
  const closeLabel = Math.min(tween(frame, [CLOSE_AT, CLOSE_AT + 8], [0, 1]), tween(frame, [PAN_START, PAN_START + 8], [1, 0]));
  const saveSpot = tween(frame, [SAVE_CLICK + 2, SAVE_CLICK + 12], [0, 1]);
  const fade = Math.min(tween(frame, [0, 8], [0, 1]), tween(frame, [DRAW_FRAMES - 10, DRAW_FRAMES], [1, 0]));

  const pts = path.slice(0, Math.min(placed, POLY.length));
  const rubber = !closed && placed > 0 ? [pts[pts.length - 1], cursor] : null;
  const line = (ps: Pt[]) => ps.map((p) => `${p.x},${p.y}`).join(' ');

  const firstOnScreen = toScreen(POLY[0], camMap);

  return (
    <AbsoluteFill>
      <Backdrop />
      <AbsoluteFill style={{opacity: fade}}>
        <Shot src="screens/4-mappa.png" cam={camMap}>
          <svg width={2000} height={1200} style={{position: 'absolute', left: 0, top: 0, opacity: 1 - resultOpacity}}>
            {closed ? (
              <polygon points={line(POLY)} fill={colors.earthPath} fillOpacity={fill} stroke={colors.earthPath} strokeWidth={4} />
            ) : (
              <polyline points={line(pts)} fill="none" stroke={colors.earthPath} strokeWidth={4} />
            )}
            {rubber ? <polyline points={line(rubber)} fill="none" stroke={colors.earthPath} strokeWidth={3} strokeDasharray="8 6" /> : null}
            {pts.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={8} fill="white" stroke={colors.earthPath} strokeWidth={3} />
            ))}
          </svg>
        </Shot>
        <Shot src="screens/5-poligono.png" cam={camResult} opacity={resultOpacity} />

        {!closed ? <Ripple at={toScreen(path[Math.max(0, placed - 1)], camMap)} t={t >= 0 ? (t % 1) / 0.8 : 0} /> : null}
        <Ripple at={firstOnScreen} t={(frame - CLOSE_AT) / 18} />
        <Ripple at={toScreen(saveTarget, camResult)} t={(frame - SAVE_CLICK) / 20} />

        <Spotlight rect={SAVE_BUTTON} cam={camResult} opacity={saveSpot} />

        <Label at={{x: 800, y: 40}} text="Clicca sulla mappa un punto dopo l'altro" opacity={drawLabel} />
        <Label at={{x: 800, y: 40}} text="Chiudi cliccando sul primo punto" opacity={closeLabel} />
        <Label at={toScreen({x: saveTarget.x, y: SAVE_BUTTON.y + SAVE_BUTTON.h}, camResult)} text="Clicca «Salva nel progetto»" opacity={saveSpot} />

        <Cursor at={toScreen(cursorPt, cursorCam)} pressed={afterPan ? savePress : drawPress} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
