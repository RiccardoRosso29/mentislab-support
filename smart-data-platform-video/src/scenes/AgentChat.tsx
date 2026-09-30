import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {Caption} from '../components/Caption';
import {colors, fonts} from '../theme';

// Animated reconstruction of an SDP Agent conversation. Figures come from the
// platform screenshots (Finale Ligure, June 2026).
const Q1 = 'Quanti pernottamenti ci sono stati a giugno rispetto a maggio?';
const Q2 = 'E da quali paesi arrivano i visitatori stranieri?';

// Local frames of each beat, shared with the sound design.
export const AGENT_CHAT = {
  type1: [20, 75] as [number, number],
  send1: 78,
  act1: 85,
  answer1: 133,
  type2: [292, 325] as [number, number],
  send2: 328,
  act2: 334,
  answer2: 368,
};
const T = AGENT_CHAT;

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

// Streamed answers have a natural height: they only fade in and grow as text arrives.
const Appear: React.FC<{from: number; children: React.ReactNode}> = ({from, children}) => {
  const frame = useCurrentFrame();
  if (frame < from) return null;
  return <div style={{flexShrink: 0, opacity: interpolate(frame, [from, from + 6], [0, 1], clamp)}}>{children}</div>;
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
            const start = from + 4 + i * 14;
            if (frame < start) return null;
            const done = frame >= start + 12;
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

const AnswerBox: React.FC<{children: React.ReactNode}> = ({children}) => (
  <div
    style={{
      background: '#F3F3F4',
      borderRadius: 10,
      padding: '18px 26px',
      color: '#333',
      fontSize: 17,
      lineHeight: 1.5,
      maxWidth: 980,
    }}
  >
    {children}
  </div>
);

// Streams `text` between frames [a, b] like tokens arriving from the model.
const Stream: React.FC<{text: string; at: [number, number]; style?: React.CSSProperties}> = ({text, at, style}) => {
  const frame = useCurrentFrame();
  if (frame < at[0]) return null;
  return <div style={style}>{typed(frame, text, at)}</div>;
};

const Bullet: React.FC<{text: string; at: [number, number]}> = ({text, at}) => {
  const frame = useCurrentFrame();
  if (frame < at[0]) return null;
  return (
    <div style={{display: 'flex', gap: 12, paddingLeft: 6}}>
      <span style={{color: colors.orange, fontWeight: 800}}>•</span>
      <span>{typed(frame, text, at)}</span>
    </div>
  );
};

// Text report: title, bullet list, commentary and a suggested follow-up (no charts).
const Answer1: React.FC = () => {
  const A = T.answer1;
  return (
    <AnswerBox>
      <Stream text="Confronto Pernottamenti: Giugno 2026 vs Maggio 2026" at={[A, A + 10]} style={{fontSize: 21, fontWeight: 800, color: '#1b1b1b'}} />
      <Stream text="Finale Ligure" at={[A + 10, A + 14]} style={{color: '#666', marginBottom: 6}} />
      <Bullet text="Giugno 2026: 453.698 pernottamenti" at={[A + 16, A + 26]} />
      <Bullet text="Maggio 2026: 366.012 pernottamenti" at={[A + 26, A + 36]} />
      <Bullet text="Variazione: +87.686 pernottamenti (+24% rispetto a maggio)" at={[A + 36, A + 48]} />
      <Stream
        text="Nel mese di giugno si è registrato un aumento significativo dei pernottamenti rispetto al mese precedente, con quasi 88.000 notti aggiuntive. Questo incremento del 24% indica una crescita dell'attività turistica con soggiorno a Finale Ligure nel periodo estivo."
        at={[A + 52, A + 102]}
        style={{marginTop: 8}}
      />
      <Stream
        text="Domanda utile: vuoi vedere come si distribuiscono questi pernottamenti per tipologia di visitatore (turisti, residenti, ecc.)?"
        at={[A + 108, A + 134]}
        style={{marginTop: 10, paddingTop: 10, borderTop: '1px solid #d9d9d9', color: '#555', fontStyle: 'italic'}}
      />
    </AnswerBox>
  );
};

const COUNTRIES: [string, string, string][] = [
  ['Germania', '3.174', '23,5%'],
  ['Svizzera', '2.565', '19,0%'],
  ['Francia', '2.004', '14,9%'],
  ['Stati Uniti', '929', '6,9%'],
  ['Paesi Bassi', '810', '6,0%'],
];

// Tabular report: rows arrive one by one, followed by a short text summary.
const Answer2: React.FC = () => {
  const frame = useCurrentFrame();
  const B = T.answer2;
  const cell: React.CSSProperties = {padding: '7px 16px', borderBottom: '1px solid #e0e0e0'};
  const rowIn = (i: number) => interpolate(frame, [B + 30 + i * 6, B + 36 + i * 6], [0, 1], clamp);
  return (
    <AnswerBox>
      <Stream text="Top 5 paesi di provenienza" at={[B, B + 8]} style={{fontSize: 21, fontWeight: 800, color: '#1b1b1b'}} />
      <Stream text="Visitatori internazionali a Finale Ligure, 2–29 giugno 2026:" at={[B + 8, B + 24]} style={{marginBottom: 10}} />
      {frame >= B + 26 ? (
        <table style={{borderCollapse: 'collapse', width: 620, fontSize: 17, background: 'white', borderRadius: 8, overflow: 'hidden'}}>
          <thead>
            <tr style={{background: '#5f5f63', color: 'white', textAlign: 'left'}}>
              <th style={{...cell, width: 40}}>#</th>
              <th style={cell}>Paese</th>
              <th style={{...cell, textAlign: 'right'}}>Visitatori</th>
              <th style={{...cell, textAlign: 'right'}}>%</th>
            </tr>
          </thead>
          <tbody>
            {COUNTRIES.map(([name, visitors, pct], i) =>
              frame >= B + 30 + i * 6 ? (
                <tr key={name} style={{opacity: rowIn(i), background: i === 0 ? 'rgba(255,106,0,0.12)' : 'transparent'}}>
                  <td style={{...cell, fontWeight: 700}}>{i + 1}</td>
                  <td style={cell}>{name}</td>
                  <td style={{...cell, textAlign: 'right', fontWeight: 600}}>{visitors}</td>
                  <td style={{...cell, textAlign: 'right'}}>{pct}</td>
                </tr>
              ) : null,
            )}
          </tbody>
        </table>
      ) : null}
      <Stream
        text="Germania, Svizzera e Francia insieme rappresentano il 57,4% dei visitatori internazionali."
        at={[B + 62, B + 84]}
        style={{marginTop: 12}}
      />
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
                <Appear from={T.answer1}>
                  <Answer1 />
                </Appear>
                <Grow from={T.answer1 + 140} height={22}>
                  <Feedback />
                </Grow>
                <Grow from={T.send2 + 2} height={62}>
                  <UserBubble text={Q2} />
                </Grow>
                <Activity from={T.act2} collapseAt={T.answer2} steps={['Analizzo le origini internazionali', 'Ordino i paesi per numero di visitatori']} />
                <Typing from={T.act2 + 14} to={T.answer2} />
                <Appear from={T.answer2}>
                  <Answer2 />
                </Appear>
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
