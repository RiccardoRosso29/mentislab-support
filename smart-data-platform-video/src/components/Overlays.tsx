import React from 'react';
import {Easing, interpolate, spring, useVideoConfig} from 'remotion';
import {colors, fonts} from '../theme';
import {OverlayCtx, SHOT_H, SHOT_W} from './AppShot';

const px = (x: number) => x * SHOT_W;
const py = (y: number) => y * SHOT_H;

// Glowing frame drawn around a region of the screenshot (fractions of the image).
export const Highlight: React.FC<{
  ctx: OverlayCtx;
  x: number;
  y: number;
  w: number;
  h: number;
  from: number;
  to?: number;
  label?: string;
}> = ({ctx, x, y, w, h, from, to, label}) => {
  const {fps} = useVideoConfig();
  const inP = spring({frame: ctx.frame - from, fps, config: {damping: 14}});
  const outP = to === undefined ? 0 : interpolate(ctx.frame, [to, to + 8], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const opacity = inP * (1 - outP);
  if (opacity <= 0.001) return null;
  const border = 3 / ctx.scale;
  const pulse = 0.6 + 0.4 * Math.sin((ctx.frame - from) / 5);
  return (
    <div
      style={{
        position: 'absolute',
        left: px(x),
        top: py(y),
        width: px(w),
        height: py(h),
        borderRadius: 12 / ctx.scale,
        border: `${border}px solid ${colors.orange}`,
        boxShadow: `0 0 ${24 / ctx.scale}px rgba(255,106,0,${0.55 * pulse}), inset 0 0 ${18 / ctx.scale}px rgba(255,106,0,0.25)`,
        opacity,
        transform: `scale(${1.08 - 0.08 * inP})`,
      }}
    >
      {label ? (
        <div
          style={{
            position: 'absolute',
            left: -border,
            top: -34 / ctx.scale,
            padding: `${4 / ctx.scale}px ${12 / ctx.scale}px`,
            borderRadius: 8 / ctx.scale,
            background: colors.orange,
            color: 'white',
            fontFamily: fonts.display,
            fontWeight: 700,
            fontSize: 15 / ctx.scale,
            letterSpacing: 0.5 / ctx.scale,
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </div>
      ) : null}
    </div>
  );
};

export type CursorPoint = {f: number; x: number; y: number};

// Mouse pointer following a path, with a ripple on each click frame.
export const Cursor: React.FC<{ctx: OverlayCtx; path: CursorPoint[]; clicks: number[]; from?: number}> = ({
  ctx,
  path,
  clicks,
  from = 0,
}) => {
  if (ctx.frame < from) return null;
  const frames = path.map((p) => p.f);
  const opts = {easing: Easing.bezier(0.45, 0, 0.2, 1), extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
  const x = interpolate(ctx.frame, frames, path.map((p) => p.x), opts);
  const y = interpolate(ctx.frame, frames, path.map((p) => p.y), opts);
  const appear = interpolate(ctx.frame, [from, from + 8], [0, 1], {extrapolateRight: 'clamp'});
  const size = 34 / ctx.scale;

  const pressed = clicks.some((c) => ctx.frame >= c && ctx.frame < c + 5);

  return (
    <>
      {clicks.map((c) => {
        const t = ctx.frame - c;
        if (t < 0 || t > 18) return null;
        const r = interpolate(t, [0, 18], [6, 46]) / ctx.scale;
        return (
          <div
            key={c}
            style={{
              position: 'absolute',
              left: px(x) - r,
              top: py(y) - r,
              width: r * 2,
              height: r * 2,
              borderRadius: '50%',
              border: `${3 / ctx.scale}px solid ${colors.orange}`,
              opacity: interpolate(t, [0, 18], [0.9, 0]),
            }}
          />
        );
      })}
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        style={{
          position: 'absolute',
          left: px(x) - size * 0.18,
          top: py(y) - size * 0.08,
          opacity: appear,
          transform: `scale(${pressed ? 0.85 : 1})`,
          filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.45))',
        }}
      >
        <path d="M4 2 L4 20 L9 15.5 L12.5 22.5 L15.5 21 L12 14 L19 14 Z" fill="#111" stroke="white" strokeWidth={1.6} strokeLinejoin="round" />
      </svg>
    </>
  );
};

// Expanding radar rings marking a point on a map.
export const Pulse: React.FC<{ctx: OverlayCtx; x: number; y: number; from: number}> = ({ctx, x, y, from}) => {
  const t = ctx.frame - from;
  if (t < 0) return null;
  return (
    <>
      {[0, 12, 24].map((offset) => {
        const local = (t + 36 - offset) % 36;
        const r = interpolate(local, [0, 36], [4, 70]) / ctx.scale;
        return (
          <div
            key={offset}
            style={{
              position: 'absolute',
              left: px(x) - r,
              top: py(y) - r,
              width: r * 2,
              height: r * 2,
              borderRadius: '50%',
              border: `${2.5 / ctx.scale}px solid ${colors.orange}`,
              opacity: interpolate(local, [0, 36], [0.9, 0]) * Math.min(1, t / 8),
            }}
          />
        );
      })}
    </>
  );
};

// Floating pill in screen space (pops in with a spring).
export const Chip: React.FC<{
  frame: number;
  from: number;
  left: number;
  top: number;
  children: React.ReactNode;
}> = ({frame, from, left, top, children}) => {
  const {fps} = useVideoConfig();
  const p = spring({frame: frame - from, fps, config: {damping: 12, stiffness: 140}});
  if (frame < from) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left,
        top,
        transform: `translateY(${(1 - p) * 30}px) scale(${0.7 + 0.3 * p})`,
        opacity: p,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '16px 26px',
        borderRadius: 18,
        background: 'rgba(23,23,27,0.92)',
        border: '1px solid rgba(255,255,255,0.14)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,106,0,0.25)',
        color: 'white',
        fontFamily: fonts.body,
        fontWeight: 600,
        fontSize: 22,
      }}
    >
      {children}
    </div>
  );
};
