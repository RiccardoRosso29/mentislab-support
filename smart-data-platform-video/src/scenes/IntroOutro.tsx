import {AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {colors, fonts} from '../theme';

const Logos: React.FC<{frame: number; scale?: number}> = ({frame, scale = 1}) => {
  const {fps} = useVideoConfig();
  const a = spring({frame, fps, config: {damping: 14}});
  const x = spring({frame: frame - 6, fps, config: {damping: 14}});
  const b = spring({frame: frame - 10, fps, config: {damping: 14}});
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 56 * scale}}>
      <Img
        src={staticFile('logos/w3-business-dark.png')}
        style={{height: 150 * scale, opacity: a, transform: `translateX(${(1 - a) * -80}px) scale(${0.8 + 0.2 * a})`}}
      />
      <div
        style={{
          fontFamily: fonts.display,
          fontWeight: 500,
          fontSize: 70 * scale,
          color: 'rgba(255,255,255,0.55)',
          opacity: x,
          transform: `rotate(${(1 - x) * 90}deg)`,
        }}
      >
        ×
      </div>
      <Img
        src={staticFile('logos/ckdelta-dark.png')}
        style={{height: 150 * scale, opacity: b, transform: `translateX(${(1 - b) * 80}px) scale(${0.8 + 0.2 * b})`}}
      />
    </div>
  );
};

const Title: React.FC<{frame: number; size: number}> = ({frame, size}) => {
  const {fps} = useVideoConfig();
  const letters = 'Smart Data Platform'.split('');
  return (
    <div style={{display: 'flex', fontFamily: fonts.display, fontWeight: 800, fontSize: size, color: 'white', lineHeight: 1.1, letterSpacing: -2}}>
      {letters.map((l, i) => {
        const p = spring({frame: frame - i * 1.2, fps, config: {damping: 13, stiffness: 140}});
        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              whiteSpace: 'pre',
              opacity: interpolate(p, [0, 0.5], [0, 1], {extrapolateRight: 'clamp'}),
              transform: `translateY(${(1 - p) * 80}px) rotateX(${(1 - p) * -70}deg)`,
              color: i >= 11 ? colors.orange : 'white',
            }}
          >
            {l}
          </span>
        );
      })}
    </div>
  );
};

export const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const lift = spring({frame: frame - 34, fps, config: {damping: 200}});
  const sub = spring({frame: frame - 62, fps, config: {damping: 200}});
  const line = spring({frame: frame - 56, fps, config: {damping: 200}});
  const claim = spring({frame: frame - 82, fps, config: {damping: 200}});

  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
      <div style={{transform: `translateY(${-lift * 210}px) scale(${1 - lift * 0.42})`}}>
        <Logos frame={frame} />
      </div>
      <div style={{position: 'absolute', top: 400, display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
        {frame >= 38 ? <Title frame={frame - 38} size={116} /> : null}
        <div style={{marginTop: 26, width: 560 * line, height: 5, borderRadius: 3, background: colors.orange, boxShadow: `0 0 24px ${colors.orange}`}} />
        <div
          style={{
            marginTop: 28,
            fontFamily: fonts.body,
            fontWeight: 600,
            fontSize: 30,
            letterSpacing: 14,
            textTransform: 'uppercase',
            color: colors.muted,
            opacity: sub,
            transform: `translateY(${(1 - sub) * 20}px)`,
          }}
        >
          Mobility Analytics
        </div>
        <div
          style={{
            marginTop: 40,
            fontFamily: fonts.body,
            fontWeight: 500,
            fontSize: 28,
            color: 'rgba(255,255,255,0.85)',
            opacity: claim,
            transform: `translateY(${(1 - claim) * 20}px)`,
          }}
        >
          Conoscere il territorio attraverso i dati di mobilità
        </div>
      </div>
    </AbsoluteFill>
  );
};

const FEATURES = ['Panoramica', 'Statistiche visite', 'Sociodemografico', 'Viaggi', 'Previsioni', 'SDP Agent', 'Export'];

export const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const tag = spring({frame: frame - 26, fps, config: {damping: 200}});
  const logos = spring({frame: frame - 50, fps, config: {damping: 200}});

  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: -60}}>
        <div style={{display: 'flex', gap: 14, marginBottom: 48, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 1500}}>
          {FEATURES.map((f, i) => {
            const p = spring({frame: frame - i * 2, fps, config: {damping: 14}});
            return (
              <div
                key={f}
                style={{
                  padding: '10px 22px',
                  borderRadius: 999,
                  border: `1px solid ${f === 'Previsioni' ? colors.orange : 'rgba(255,106,0,0.55)'}`,
                  background: f === 'Previsioni' ? 'rgba(255,106,0,0.3)' : 'rgba(255,106,0,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  color: 'white',
                  fontFamily: fonts.body,
                  fontWeight: 600,
                  fontSize: 20,
                  opacity: p,
                  transform: `translateY(${(1 - p) * 24}px)`,
                }}
              >
                {f}
                {f === 'Previsioni' ? (
                  <span style={{fontSize: 13, fontWeight: 800, letterSpacing: 1.5, padding: '3px 9px', borderRadius: 999, background: colors.orange}}>
                    NOVITÀ
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
        <Title frame={frame - 6} size={108} />
        <div
          style={{
            marginTop: 30,
            fontFamily: fonts.display,
            fontWeight: 600,
            fontSize: 38,
            color: colors.muted,
            opacity: tag,
            transform: `translateY(${(1 - tag) * 20}px)`,
          }}
        >
          Trasforma i movimenti in <span style={{color: colors.orange, fontWeight: 700}}>decisioni</span>.
        </div>
        <div style={{marginTop: 70, opacity: logos, transform: `translateY(${(1 - logos) * 30}px)`}}>
          <Logos frame={frame - 50} scale={0.62} />
        </div>
      </div>
    </AbsoluteFill>
  );
};
