import {interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {colors, fonts} from '../theme';

// Scene header: numbered kicker + headline with word-by-word reveal.
export const Caption: React.FC<{index: number; kicker: string; title: string; highlight?: string; badge?: string}> = ({
  index,
  kicker,
  title,
  highlight,
  badge,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const bar = spring({frame: frame - 2, fps, config: {damping: 200}});
  const kick = spring({frame, fps, config: {damping: 200}});
  const words = title.split(' ');

  return (
    <div style={{position: 'absolute', left: 110, top: 58, right: 110}}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          fontFamily: fonts.display,
          fontWeight: 700,
          fontSize: 21,
          letterSpacing: 4,
          textTransform: 'uppercase',
          color: colors.orange,
          opacity: kick,
          transform: `translateX(${(1 - kick) * -40}px)`,
        }}
      >
        <span style={{color: 'white', opacity: 0.5}}>{String(index).padStart(2, '0')}</span>
        <div style={{width: 60 * bar, height: 3, background: colors.orange, borderRadius: 2}} />
        {kicker}
        {badge ? (
          <span
            style={{
              marginLeft: 6,
              padding: '5px 14px',
              borderRadius: 999,
              background: colors.orange,
              color: 'white',
              fontSize: 16,
              letterSpacing: 2,
              boxShadow: `0 0 ${14 + 8 * Math.sin(frame / 5)}px rgba(255,106,0,0.8)`,
            }}
          >
            {badge}
          </span>
        ) : null}
      </div>
      <div
        style={{
          marginTop: 14,
          fontFamily: fonts.display,
          fontWeight: 800,
          fontSize: 58,
          lineHeight: 1.1,
          letterSpacing: -1,
          color: 'white',
          display: 'flex',
          flexWrap: 'wrap',
          columnGap: 16,
        }}
      >
        {words.map((w, i) => {
          const p = spring({frame: frame - 5 - i * 3, fps, config: {damping: 15, stiffness: 120}});
          const isAccent = highlight !== undefined && highlight.split(' ').includes(w);
          return (
            <span
              key={i}
              style={{
                display: 'inline-block',
                transform: `translateY(${(1 - p) * 50}px)`,
                opacity: interpolate(p, [0, 0.6], [0, 1], {extrapolateRight: 'clamp'}),
                color: isAccent ? colors.orange : 'white',
              }}
            >
              {w}
            </span>
          );
        })}
      </div>
    </div>
  );
};
