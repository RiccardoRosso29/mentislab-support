import React from 'react';
import {
  Easing,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {colors, fonts} from '../theme';

export const SHOT_W = 1500;
export const SHOT_H = Math.round((SHOT_W * 930) / 1900);
const BAR_H = 38;

// Camera keyframe: at frame `f`, zoom `s` centred on the image point (x, y) in 0..1.
export type Cam = {f: number; s: number; x: number; y: number};

export type Shot = {src: string; from: number};

export type OverlayCtx = {frame: number; scale: number};

const ease = Easing.bezier(0.65, 0, 0.35, 1);

const camAt = (frame: number, cams: Cam[]) => {
  if (cams.length === 1) return cams[0];
  const frames = cams.map((c) => c.f);
  const opts = {easing: ease, extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
  return {
    s: interpolate(frame, frames, cams.map((c) => c.s), opts),
    x: interpolate(frame, frames, cams.map((c) => c.x), opts),
    y: interpolate(frame, frames, cams.map((c) => c.y), opts),
  };
};

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

// A screenshot of the platform inside a floating 3D "app window", with an animated
// camera (zoom/pan) and overlays drawn in image space so they follow the camera.
export const AppShot: React.FC<{
  shots: Shot[];
  cams: Cam[];
  duration: number;
  top?: number;
  overlays?: (ctx: OverlayCtx) => React.ReactNode;
}> = ({shots, cams, duration, top = 250, overlays}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const enter = spring({frame, fps, config: {damping: 16, mass: 0.9, stiffness: 90}});
  const rotX = (1 - enter) * 30;
  const transY = (1 - enter) * 220;
  const drift = interpolate(frame, [0, duration], [-4, 3]);
  const scaleIn = 0.86 + 0.14 * enter;

  const cam = camAt(frame, cams);
  const half = 0.5 / cam.s;
  const cx = clamp(cam.x, half, 1 - half);
  const cy = clamp(cam.y, half, 1 - half);

  return (
    <div
      style={{
        position: 'absolute',
        left: (1920 - SHOT_W) / 2,
        top,
        width: SHOT_W,
        height: SHOT_H + BAR_H,
        perspective: 2200,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: -80,
          background: 'radial-gradient(closest-side, rgba(255,106,0,0.35), transparent)',
          filter: 'blur(40px)',
          opacity: enter,
        }}
      />
      <div
        style={{
          width: '100%',
          height: '100%',
          transform: `translateY(${transY}px) rotateX(${rotX}deg) rotateY(${drift}deg) scale(${scaleIn})`,
          transformOrigin: '50% 100%',
          opacity: Math.min(1, enter * 1.6),
          borderRadius: 18,
          overflow: 'hidden',
          background: '#f4f4f4',
          boxShadow: '0 40px 120px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.12)',
        }}
      >
        <div
          style={{
            height: BAR_H,
            background: colors.panel,
            display: 'flex',
            alignItems: 'center',
            padding: '0 18px',
            gap: 9,
          }}
        >
          {['#FF5F57', '#FEBC2E', '#28C840'].map((c) => (
            <div key={c} style={{width: 12, height: 12, borderRadius: 6, background: c}} />
          ))}
          <div
            style={{
              marginLeft: 20,
              padding: '4px 18px',
              borderRadius: 8,
              background: 'rgba(255,255,255,0.08)',
              color: colors.muted,
              fontFamily: fonts.body,
              fontSize: 15,
            }}
          >
            Smart Data Platform
          </div>
        </div>
        <div style={{position: 'relative', width: SHOT_W, height: SHOT_H, overflow: 'hidden'}}>
          <div
            style={{
              position: 'absolute',
              width: SHOT_W,
              height: SHOT_H,
              transformOrigin: '0 0',
              transform: `translate(${SHOT_W / 2}px, ${SHOT_H / 2}px) scale(${cam.s}) translate(${-cx * SHOT_W}px, ${-cy * SHOT_H}px)`,
            }}
          >
            {shots.map((shot, i) => {
              const next = shots[i + 1];
              const opacity =
                i === 0
                  ? 1
                  : interpolate(frame, [shot.from, shot.from + 6], [0, 1], {
                      extrapolateLeft: 'clamp',
                      extrapolateRight: 'clamp',
                    });
              if (next && frame > next.from + 6) return null;
              return (
                <Img
                  key={shot.src}
                  src={staticFile(shot.src)}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: SHOT_W,
                    height: SHOT_H,
                    objectFit: 'cover',
                    objectPosition: 'top left',
                    opacity,
                  }}
                />
              );
            })}
            {overlays?.({frame, scale: cam.s})}
          </div>
        </div>
      </div>
    </div>
  );
};
