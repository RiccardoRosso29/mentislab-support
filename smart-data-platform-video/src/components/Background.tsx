import {AbsoluteFill, Img, interpolate, random, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {colors} from '../theme';

const PARTICLES = new Array(28).fill(0).map((_, i) => ({
  x: random(`x${i}`) * 1920,
  y: random(`y${i}`) * 1080,
  r: 1.2 + random(`r${i}`) * 2,
  speed: 0.15 + random(`s${i}`) * 0.4,
  phase: random(`p${i}`) * Math.PI * 2,
}));

// Continuous backdrop shared by every scene: the black/gold artwork with a slow
// camera drift, a soft brand glow and a few floating light particles.
export const Background: React.FC = () => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const t = frame / 30;

  const scale = interpolate(frame, [0, durationInFrames], [1.06, 1.18]);
  const x = interpolate(frame, [0, durationInFrames], [-20, 20]);
  const y = interpolate(frame, [0, durationInFrames], [10, -10]);
  const glowX = 25 + Math.sin(t * 0.3) * 10;
  const glowY = 30 + Math.cos(t * 0.25) * 8;

  return (
    <AbsoluteFill style={{backgroundColor: colors.bg, overflow: 'hidden'}}>
      <Img
        src={staticFile('background.jpg')}
        style={{
          position: 'absolute',
          width: 1920,
          height: 1080,
          transform: `translate(${x}px, ${y}px) scale(${scale})`,
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(900px 650px at ${glowX}% ${glowY}%, rgba(255,106,0,0.16), transparent 70%),
            radial-gradient(1200px 700px at 80% 110%, rgba(255,106,0,0.10), transparent 70%)`,
        }}
      />
      {PARTICLES.map((p, i) => {
        const py = (((p.y - frame * p.speed * 2) % 1080) + 1080) % 1080;
        const opacity = interpolate(Math.sin(t * 1.2 + p.phase), [-1, 1], [0.1, 0.6]);
        const warm = i % 2 === 0;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: p.x + Math.sin(t * 0.5 + p.phase) * 12,
              top: py,
              width: p.r * 2,
              height: p.r * 2,
              borderRadius: '50%',
              background: warm ? colors.gold : colors.orange,
              opacity,
              boxShadow: `0 0 10px ${warm ? colors.gold : colors.orange}`,
            }}
          />
        );
      })}
      <AbsoluteFill
        style={{background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.05) 45%, rgba(0,0,0,0.55) 100%)'}}
      />
    </AbsoluteFill>
  );
};
