import {AbsoluteFill, interpolate, random, useCurrentFrame} from 'remotion';
import {colors} from '../theme';

const PARTICLES = new Array(46).fill(0).map((_, i) => ({
  x: random(`x${i}`) * 1920,
  y: random(`y${i}`) * 1080,
  r: 1.5 + random(`r${i}`) * 2.5,
  speed: 0.2 + random(`s${i}`) * 0.6,
  phase: random(`p${i}`) * Math.PI * 2,
}));

// Continuous backdrop shared by every scene: dark canvas, drifting orange glows,
// a perspective grid and slowly rising "data points".
export const Background: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / 30;

  const glow1X = 20 + Math.sin(t * 0.35) * 12;
  const glow1Y = 25 + Math.cos(t * 0.3) * 10;
  const glow2X = 80 + Math.cos(t * 0.28) * 10;
  const glow2Y = 80 + Math.sin(t * 0.33) * 8;

  return (
    <AbsoluteFill style={{backgroundColor: colors.bg, overflow: 'hidden'}}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(900px 700px at ${glow1X}% ${glow1Y}%, rgba(255,106,0,0.28), transparent 70%),
            radial-gradient(1000px 800px at ${glow2X}% ${glow2Y}%, rgba(255,138,61,0.18), transparent 70%),
            radial-gradient(1400px 900px at 50% 120%, rgba(255,106,0,0.12), transparent 70%)`,
        }}
      />
      <AbsoluteFill style={{perspective: 900, perspectiveOrigin: '50% 30%'}}>
        <div
          style={{
            position: 'absolute',
            left: -960,
            right: -960,
            top: 560,
            height: 1400,
            transform: 'rotateX(72deg)',
            transformOrigin: '50% 0%',
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.07) 1px, transparent 1px)',
            backgroundSize: '80px 80px',
            backgroundPosition: `0px ${(frame * 1.6) % 80}px`,
            maskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.9), transparent 70%)',
            WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.9), transparent 70%)',
          }}
        />
      </AbsoluteFill>
      {PARTICLES.map((p, i) => {
        const y = (((p.y - frame * p.speed * 2) % 1080) + 1080) % 1080;
        const opacity = interpolate(Math.sin(t * 1.3 + p.phase), [-1, 1], [0.15, 0.7]);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: p.x + Math.sin(t * 0.6 + p.phase) * 14,
              top: y,
              width: p.r * 2,
              height: p.r * 2,
              borderRadius: '50%',
              background: i % 3 === 0 ? colors.orange : '#ffffff',
              opacity: i % 3 === 0 ? opacity : opacity * 0.45,
              boxShadow: i % 3 === 0 ? `0 0 12px ${colors.orange}` : undefined,
            }}
          />
        );
      })}
      <AbsoluteFill
        style={{background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.55) 100%)'}}
      />
    </AbsoluteFill>
  );
};
