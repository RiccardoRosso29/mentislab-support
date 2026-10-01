import React from 'react';
import {AbsoluteFill, Easing, Img, interpolate, staticFile} from 'remotion';
import {colors, font, H, K, W} from './theme';

export type Pt = {x: number; y: number};
export type Rect = {x: number; y: number; w: number; h: number};

export const ease = Easing.bezier(0.45, 0, 0.2, 1);

export const tween = (frame: number, [f0, f1]: [number, number], [v0, v1]: [number, number]) =>
  interpolate(frame, [f0, f1], [v0, v1], {easing: ease, extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

/** Camera: zoom `z` attorno al punto `f` (coordinate dello screenshot). */
export type Camera = {z: number; f: Pt; dx?: number; dy?: number};

/** Converte un punto dello screenshot in pixel del video, tenendo conto della camera. */
export const toScreen = (p: Pt, cam: Camera): Pt => ({
  x: K * (cam.f.x + cam.z * (p.x + (cam.dx ?? 0) - cam.f.x)),
  y: K * (cam.f.y + cam.z * (p.y + (cam.dy ?? 0) - cam.f.y)),
});

export const center = (r: Rect): Pt => ({x: r.x + r.w / 2, y: r.y + r.h / 2});

export const Shot: React.FC<{src: string; cam: Camera; opacity?: number; children?: React.ReactNode}> = ({
  src,
  cam,
  opacity = 1,
  children,
}) => (
  <AbsoluteFill style={{opacity, overflow: 'hidden'}}>
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: 2000,
        height: 1200,
        transformOrigin: '0 0',
        transform: `scale(${K}) translate(${cam.f.x}px, ${cam.f.y}px) scale(${cam.z}) translate(${-cam.f.x + (cam.dx ?? 0)}px, ${-cam.f.y + (cam.dy ?? 0)}px)`,
      }}
    >
      <Img src={staticFile(src)} style={{width: 2000, display: 'block'}} />
      {children}
    </div>
  </AbsoluteFill>
);

/** Riquadro arancione sul punto da cliccare, con il resto dello schermo attenuato. */
export const Spotlight: React.FC<{rect: Rect; cam: Camera; opacity: number}> = ({rect, cam, opacity}) => {
  const pad = 8;
  const a = toScreen({x: rect.x - pad, y: rect.y - pad}, cam);
  const b = toScreen({x: rect.x + rect.w + pad, y: rect.y + rect.h + pad}, cam);
  return (
    <div
      style={{
        position: 'absolute',
        left: a.x,
        top: a.y,
        width: b.x - a.x,
        height: b.y - a.y,
        borderRadius: 14,
        border: `4px solid ${colors.orange}`,
        boxShadow: `0 0 28px ${colors.orange}, 0 0 0 4000px rgba(0,0,0,${0.5 * opacity})`,
        opacity,
      }}
    />
  );
};

/** Etichetta con l'istruzione, posizionata sotto (o sopra) il punto indicato e sempre dentro il video. */
export const Label: React.FC<{at: Pt; text: string; opacity: number; above?: boolean}> = ({at, text, opacity, above}) => {
  // Larghezza stimata del testo (Montserrat 800, 30 px) per tenere l'etichetta nel video.
  const half = (text.length * 18 + 44) / 2;
  const x = Math.min(Math.max(at.x, half + 16), W - half - 16);
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: above ? at.y - 30 : at.y + 30,
        transform: `translate(-50%, ${above ? '-100%' : '0'}) translateY(${(1 - opacity) * 12}px)`,
        opacity,
        background: colors.orange,
        color: 'white',
        fontFamily: font,
        fontWeight: 800,
        fontSize: 30,
        padding: '12px 22px',
        borderRadius: 999,
        whiteSpace: 'nowrap',
        boxShadow: '0 8px 30px rgba(0,0,0,.45)',
      }}
    >
      {text}
    </div>
  );
};

export const Cursor: React.FC<{at: Pt; pressed?: number}> = ({at, pressed = 0}) => (
  <svg
    width={44}
    height={44}
    viewBox="0 0 24 24"
    style={{
      position: 'absolute',
      left: at.x - 5,
      top: at.y - 3,
      transform: `scale(${1 - 0.18 * pressed})`,
      transformOrigin: '5px 3px',
      filter: 'drop-shadow(0 3px 6px rgba(0,0,0,.55))',
    }}
  >
    <path d="M3 1.5 L3 19.5 L8 15 L11.2 22.2 L14.4 20.8 L11.3 13.8 L18 13.6 Z" fill="white" stroke="black" strokeWidth={1.4} strokeLinejoin="round" />
  </svg>
);

/** Onda che si espande dal punto del click. */
export const Ripple: React.FC<{at: Pt; t: number}> = ({at, t}) => {
  if (t <= 0 || t >= 1) return null;
  const r = 14 + 60 * t;
  return (
    <div
      style={{
        position: 'absolute',
        left: at.x - r,
        top: at.y - r,
        width: r * 2,
        height: r * 2,
        borderRadius: '50%',
        border: `5px solid ${colors.orange}`,
        background: 'rgba(255,106,0,.18)',
        opacity: 1 - t,
      }}
    />
  );
};

export const Backdrop: React.FC = () => <AbsoluteFill style={{background: colors.dark}} />;

export const clampSize = {width: W, height: H};
