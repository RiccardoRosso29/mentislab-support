import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {Caption} from '../components/Caption';
import {colors, fonts} from '../theme';

// Animated reconstruction of an SDP Agent conversation. Figures come from the
// platform screenshots (Finale Ligure, June 2026).
const Q1 = 'Quanti pernottamenti ci sono stati a giugno rispetto a maggio?';
const Q2 = 'E da quali paesi arrivano i visitatori stranieri?';
const A1_TEXT = 'Ho confrontato i pernottamenti a Finale Ligure tra giugno e maggio 2026.';
const A2_TEXT = 'Ecco i primi 3 paesi di provenienza dei visitatori internazionali (2–29 giugno):';

// Local frames of each beat, shared with the sound design.
export const AGENT_CHAT = {
  type1: [14, 54] as [number, number],
  send1: 57,
  act1: 64,
  answer1: 102,
  type2: [168, 200] as [number, number],
  send2: 203,
  act2: 210,
  answer2: 236,
};
const T = AGENT_CHAT;

const fmt = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

const typed = (frame: number, text: string, [a, b]: [number, number]) =>
  text.slice(0, Math.floor(interpolate(frame, [a, b], [0, text.length], clamp)));

// Wrapper that grows from 0 to its full height so earlier messages scroll up smoothly.
const Grow: React.FC<{from: number; height: number; children: React.ReactNode}> = ({from, height, children}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  if (frame < from) return null;
  const p = spring({frame: frame - from, fps, config: {damping: 20, stiffness: 140}});
  return (
    <div style={{height: height * p, flexShrink: 0, overflow: 'hidden', opacity: Math.min(1, p * 1.5)}}>
      <div style={{transform: `translateY(${(1 - p) * 24}px)`}}>{children}</div>
    </div>
  );
};

const UserBubble: React.FC<{text: string}> = ({text}) => (
  <div style={{display: 'flex', justifyContent: 'flex-end'}}>
    <div
      style={{
        background: '#FBD2B4',
        color: '#2b2b2b',
        padding: '14px 22px',
        borderRadius: '14px 14px 4px 14px',
        fontSize: 19,
        fontWeight: 500,
        maxWidth: 820,
      }}
    >
      {text}
    </div>
  </div>
);

const Spinner: React.FC<{frame: number}> = ({frame}) => (
  <div
    style={{
      width: 16,
      height: 16,
      borderRadius: 8,
      border: '2.5px solid rgba(255,106,0,0.25)',
      borderTopColor: colors.orange,
      transform: `rotate(${frame * 18}deg)`,
    }}
  />
);

// "Attività" block: reasoning steps with spinners that turn into checks, then collapses.
const Activity: React.FC<{from: number; steps: string[]; collapseAt: number}> = ({from, steps, collapseAt}) => {
  const frame = useCurrentFrame();
  const collapsed = frame >= collapseAt;
  const height = interpolate(frame, [collapseAt, collapseAt + 8], [34 + steps.length * 32, 30], clamp);
  return (
    <Grow from={from} height={height}>
      <div style={{fontSize: 16, color: '#555', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8}}>
        <span style={{fontSize: 12, transform: collapsed ? 'none' : 'rotate(90deg)', display: 'inline-block'}}>▶</span>
        Attività{collapsed ? ` · ${steps.length} ${steps.length === 1 ? 'passaggio completato' : 'passaggi completati'}` : ''}
      </div>
      {collapsed
        ? null
        : steps.map((s, i) => {
            const start = from + 4 + i * 12;
            if (frame < start) return null;
            const done = frame >= start + 10;
            return (
              <div key={s} style={{display: 'flex', alignItems: 'center', gap: 12, height: 32, paddingLeft: 22, fontSize: 16, color: '#444'}}>
                {done ? <span style={{color: '#1EA84B', fontWeight: 800, width: 16}}>✓</span> : <Spinner frame={frame} />}
                {s}
              </div>
            );
          })}
    </Grow>
  );
};

const Bar: React.FC<{label: string; value: number; max: number; from: number; suffix?: string; color?: string}> = ({
  label,
  value,
  max,
  from,
  suffix,
  color = colors.orange,
}) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [from, from + 26], [0, 1], {...clamp, easing: (t) => 1 - Math.pow(1 - t, 3)});
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 16, height: 40}}>
      <div style={{width: 150, fontSize: 17, fontWeight: 600, color: '#333'}}>{label}</div>
      <div style={{flex: 1, height: 26, background: '#e6e6e6', borderRadius: 6, overflow: 'hidden'}}>
        <div style={{width: `${(value / max) * 100 * p}%`, height: '100%', background: color, borderRadius: 6}} />
      </div>
      <div style={{width: 210, fontSize: 18, fontWeight: 700, color: '#222', textAlign: 'right'}}>
        {fmt(value * p)}
        {suffix ? <span style={{fontWeight: 500, color: '#777'}}> {suffix}</span> : null}
      </div>
    </div>
  );
};

const AnswerBox: React.FC<{children: React.ReactNode}> = ({children}) => (
  <div
    style={{
      background: '#F3F3F4',
      borderRadius: 10,
      borderLeft: `4px solid ${colors.orange}`,
      padding: '18px 26px',
      color: '#333',
      fontSize: 17,
      maxWidth: 900,
    }}
  >
    {children}
  </div>
);

const Answer1: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const pill = spring({frame: frame - (T.answer1 + 58), fps, config: {damping: 12}});
  return (
    <AnswerBox>
      <div style={{fontSize: 21, fontWeight: 800, color: '#1b1b1b', marginBottom: 6}}>Pernottamenti: giugno vs maggio 2026</div>
      <div style={{marginBottom: 12, minHeight: 24}}>{typed(frame, A1_TEXT, [T.answer1 + 6, T.answer1 + 30])}</div>
      <Bar label="Giugno 2026" value={453698} max={453698} from={T.answer1 + 26} />
      <Bar label="Maggio 2026" value={366012} max={453698} from={T.answer1 + 34} color="#F6A56B" />
      <div
        style={{
          marginTop: 10,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 16px',
          borderRadius: 999,
          background: 'rgba(30,168,75,0.12)',
          color: '#138a3c',
          fontWeight: 700,
          fontSize: 17,
          opacity: pill,
          transform: `scale(${0.7 + 0.3 * pill})`,
          transformOrigin: 'left center',
        }}
      >
        ▲ +87.686 pernottamenti (+24%)
      </div>
    </AnswerBox>
  );
};

const Answer2: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AnswerBox>
      <div style={{fontSize: 21, fontWeight: 800, color: '#1b1b1b', marginBottom: 6}}>Top paesi di provenienza</div>
      <div style={{marginBottom: 12, minHeight: 24}}>{typed(frame, A2_TEXT, [T.answer2 + 6, T.answer2 + 28])}</div>
      <Bar label="Germania" value={3174} max={3174} from={T.answer2 + 24} suffix="· 23,5%" />
      <Bar label="Svizzera" value={2565} max={3174} from={T.answer2 + 30} suffix="· 19,0%" color="#F6A56B" />
      <Bar label="Francia" value={2004} max={3174} from={T.answer2 + 36} suffix="· 14,9%" color="#F9C49B" />
    </AnswerBox>
  );
};

const Feedback: React.FC = () => (
  <div style={{display: 'flex', gap: 18, fontSize: 15, color: '#888', paddingLeft: 4}}>
    {['Utile', 'Non utile', 'Copia'].map((l) => (
      <span key={l} style={{padding: '2px 12px', borderRadius: 999, border: '1px solid #ddd'}}>
        {l}
      </span>
    ))}
  </div>
);

const Typing: React.FC<{from: number; to: number}> = ({from, to}) => {
  const frame = useCurrentFrame();
  if (frame < from || frame >= to) return null;
  return (
    <div style={{display: 'flex', gap: 7, padding: '6px 4px'}}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            width: 10,
            height: 10,
            borderRadius: 5,
            background: colors.orange,
            opacity: 0.35 + 0.65 * Math.max(0, Math.sin((frame - i * 4) / 4)),
          }}
        />
      ))}
    </div>
  );
};

const PANEL_W = 1560;
const PANEL_H = 790;

export const AgentChat: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = spring({frame, fps, config: {damping: 18, stiffness: 90}});

  const input =
    frame < T.send1 ? typed(frame, Q1, T.type1) : frame >= T.type2[0] && frame < T.send2 ? typed(frame, Q2, T.type2) : '';
  const typing = (frame >= T.type1[0] && frame < T.send1) || (frame >= T.type2[0] && frame < T.send2);
  const pressed = (frame >= T.send1 && frame < T.send1 + 5) || (frame >= T.send2 && frame < T.send2 + 5);
  const recent = spring({frame: frame - T.send1 - 4, fps, config: {damping: 16}});

  return (
    <AbsoluteFill style={{fontFamily: fonts.body}}>
      <Caption index={6} kicker="SDP Agent · AI" title="Una conversazione con i tuoi dati" highlight="tuoi dati" />
      <div
        style={{
          position: 'absolute',
          left: (1920 - PANEL_W) / 2,
          top: 236,
          width: PANEL_W,
          height: PANEL_H,
          transform: `translateY(${(1 - enter) * 120}px) scale(${0.92 + 0.08 * enter})`,
          opacity: Math.min(1, enter * 1.5),
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: -70,
            background: 'radial-gradient(closest-side, rgba(255,106,0,0.32), transparent)',
            filter: 'blur(40px)',
          }}
        />
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            background: 'white',
            borderRadius: 18,
            overflow: 'hidden',
            boxShadow: '0 40px 120px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.12)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Header */}
          <div
            style={{
              height: 72,
              flexShrink: 0,
              borderBottom: '1px solid #e8e8e8',
              display: 'flex',
              alignItems: 'center',
              padding: '0 30px',
              gap: 16,
              position: 'relative',
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: 0,
                height: 0,
                borderTop: `22px solid ${colors.orange}`,
                borderRight: '22px solid transparent',
              }}
            />
            <div style={{fontSize: 26, fontWeight: 800, color: '#1b1b1b'}}>SDP Agent</div>
            <div style={{display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, color: '#1EA84B', fontWeight: 600}}>
              <div style={{width: 9, height: 9, borderRadius: 5, background: '#1EA84B'}} />
              online
            </div>
            <div style={{marginLeft: 'auto', fontSize: 15, color: '#777'}}>POI: Finale Ligure · 2026-06-01 → 2026-06-30</div>
          </div>
          <div style={{flex: 1, display: 'flex', minHeight: 0}}>
            {/* Chat column */}
            <div style={{flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0}}>
              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'flex-end',
                  gap: 18,
                  padding: '24px 40px',
                  maskImage: 'linear-gradient(to bottom, transparent 0, black 60px)',
                  WebkitMaskImage: 'linear-gradient(to bottom, transparent 0, black 60px)',
                }}
              >
                <Grow from={T.send1 + 2} height={62}>
                  <UserBubble text={Q1} />
                </Grow>
                <Activity
                  from={T.act1}
                  collapseAt={T.answer1}
                  steps={['Interpreto la richiesta', 'Interrogo i dati di Finale Ligure', 'Confronto giugno e maggio 2026']}
                />
                <Grow from={T.answer1} height={248}>
                  <Answer1 />
                </Grow>
                <Grow from={T.answer1 + 66} height={22}>
                  <Feedback />
                </Grow>
                <Grow from={T.send2 + 2} height={62}>
                  <UserBubble text={Q2} />
                </Grow>
                <Activity from={T.act2} collapseAt={T.answer2} steps={['Analizzo le origini internazionali']} />
                <Typing from={T.act2 + 14} to={T.answer2} />
                <Grow from={T.answer2} height={240}>
                  <Answer2 />
                </Grow>
              </div>
              {/* Input */}
              <div
                style={{
                  height: 96,
                  flexShrink: 0,
                  borderTop: '1px solid #e8e8e8',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  padding: '0 30px',
                }}
              >
                <div
                  style={{
                    flex: 1,
                    height: 54,
                    borderRadius: 8,
                    border: `2px solid ${typing ? colors.orange : '#d9d9d9'}`,
                    boxShadow: typing ? '0 0 0 4px rgba(255,106,0,0.12)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 20px',
                    fontSize: 19,
                    color: input ? '#222' : '#9a9a9a',
                  }}
                >
                  {input || 'Scrivi il tuo messaggio...'}
                  {typing ? (
                    <span style={{width: 2, height: 24, background: '#222', marginLeft: 2, opacity: frame % 16 < 8 ? 1 : 0}} />
                  ) : null}
                </div>
                <div
                  style={{
                    height: 54,
                    padding: '0 30px',
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    fontSize: 19,
                    fontWeight: 700,
                    color: 'white',
                    background: pressed ? '#d95a00' : colors.orange,
                    transform: `scale(${pressed ? 0.93 : 1})`,
                  }}
                >
                  Invia
                </div>
              </div>
            </div>
            {/* Sidebar */}
            <div style={{width: 300, flexShrink: 0, borderLeft: '1px solid #e8e8e8', background: '#fafafa'}}>
              <div style={{padding: '20px 22px', fontSize: 17, fontWeight: 700, color: '#333', borderBottom: '1px solid #ececec'}}>
                Chat recenti
              </div>
              {frame >= T.send1 ? (
                <div
                  style={{
                    margin: '12px 12px',
                    padding: '12px 14px',
                    borderRadius: 8,
                    background: '#FBD2B4',
                    fontSize: 15,
                    color: '#333',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    opacity: recent,
                    transform: `translateX(${(1 - recent) * 30}px)`,
                  }}
                >
                  {Q1}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
