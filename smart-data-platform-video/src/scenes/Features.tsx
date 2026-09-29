import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {AppShot} from '../components/AppShot';
import {Caption} from '../components/Caption';
import {Chip, Cursor, Highlight, Pulse} from '../components/Overlays';
import {SCENES} from '../timing';
import {colors, fonts} from '../theme';

export const Panoramica: React.FC = () => (
  <AbsoluteFill>
    <Caption index={1} kicker="Panoramica" title="Il territorio, in tempo reale" highlight="tempo reale" />
    <AppShot
      duration={SCENES.panoramica}
      shots={[{src: 'screens/panoramica.png', from: 0}]}
      cams={[
        {f: 0, s: 1, x: 0.5, y: 0.5},
        {f: 38, s: 1, x: 0.5, y: 0.5},
        {f: 82, s: 1.75, x: 0.79, y: 0.38},
      ]}
      overlays={(ctx) => (
        <>
          <Highlight ctx={ctx} x={0.181} y={0.16} w={0.393} h={0.388} from={14} to={36} label="Area di interesse" />
          <Highlight ctx={ctx} x={0.592} y={0.207} w={0.396} h={0.345} from={84} label="Presenze · Arrivi · Pernottamenti · Visitatori" />
        </>
      )}
    />
  </AbsoluteFill>
);

// Tab x-positions inside the screenshots (fractions of the image width)
const STAT_TAB_Y = 0.205;
export const StatisticheVisite: React.FC = () => (
  <AbsoluteFill>
    <Caption index={2} kicker="Statistiche visite" title="Quando arrivano, quanto restano" highlight="restano" />
    <AppShot
      duration={SCENES.statistiche}
      shots={[
        {src: 'screens/orario-arrivo.png', from: 0},
        {src: 'screens/frequenza.png', from: 56},
        {src: 'screens/durata-visita.png', from: 90},
        {src: 'screens/durata-pernottamento.png', from: 122},
      ]}
      cams={[
        {f: 0, s: 1, x: 0.5, y: 0.5},
        {f: 150, s: 1.1, x: 0.5, y: 0.45},
      ]}
      overlays={(ctx) => (
        <Cursor
          ctx={ctx}
          from={22}
          path={[
            {f: 22, x: 0.62, y: 0.55},
            {f: 48, x: 0.306, y: STAT_TAB_Y},
            {f: 82, x: 0.386, y: STAT_TAB_Y},
            {f: 114, x: 0.467, y: STAT_TAB_Y},
            {f: 150, x: 0.6, y: 0.45},
          ]}
          clicks={[51, 85, 117]}
        />
      )}
    />
  </AbsoluteFill>
);

const SOCIO_TAB_Y = 0.178;
export const Sociodemografico: React.FC = () => (
  <AbsoluteFill>
    <Caption index={3} kicker="Sociodemografico" title="Chi sono i tuoi visitatori" highlight="visitatori" />
    <AppShot
      duration={SCENES.sociodemografico}
      shots={[
        {src: 'screens/origini-nazionali.png', from: 0},
        {src: 'screens/origini-internazionali.png', from: 50},
        {src: 'screens/eta-genere.png', from: 88},
      ]}
      cams={[
        {f: 0, s: 1, x: 0.5, y: 0.5},
        {f: 120, s: 1.08, x: 0.5, y: 0.48},
      ]}
      overlays={(ctx) => (
        <Cursor
          ctx={ctx}
          from={18}
          path={[
            {f: 18, x: 0.55, y: 0.6},
            {f: 42, x: 0.385, y: SOCIO_TAB_Y},
            {f: 80, x: 0.304, y: SOCIO_TAB_Y},
            {f: 120, x: 0.42, y: 0.5},
          ]}
          clicks={[45, 83]}
        />
      )}
    />
  </AbsoluteFill>
);

export const Viaggi: React.FC = () => (
  <AbsoluteFill>
    <Caption index={4} kicker="Viaggi dei visitatori" title="Da dove arrivano, dove vanno" highlight="dove vanno" />
    <AppShot
      duration={SCENES.viaggi}
      shots={[{src: 'screens/viaggi.png', from: 0}]}
      cams={[
        {f: 0, s: 1, x: 0.5, y: 0.5},
        {f: 36, s: 1, x: 0.5, y: 0.5},
        {f: 100, s: 1.9, x: 0.56, y: 0.66},
      ]}
      overlays={(ctx) => (
        <>
          <Highlight ctx={ctx} x={0.173} y={0.132} w={0.817} h={0.14} from={10} to={40} label="Flussi e tappe del viaggio" />
          <Pulse ctx={ctx} x={0.563} y={0.729} from={40} />
        </>
      )}
    />
  </AbsoluteFill>
);

export const Previsioni: React.FC = () => (
  <AbsoluteFill>
    <Caption index={5} kicker="Previsioni" title="Anticipa i flussi di domani" highlight="domani" />
    <AppShot
      duration={SCENES.previsioni}
      shots={[{src: 'screens/previsioni.png', from: 0}]}
      cams={[
        {f: 0, s: 1, x: 0.5, y: 0.5},
        {f: 30, s: 1, x: 0.5, y: 0.5},
        {f: 85, s: 1.45, x: 0.7, y: 0.6},
      ]}
      overlays={(ctx) => (
        <>
          <Highlight ctx={ctx} x={0.245} y={0.46} w={0.705} h={0.07} from={12} to={44} label="Meteo ed eventi" />
          <Highlight ctx={ctx} x={0.672} y={0.54} w={0.265} h={0.23} from={62} label="Previsione" />
        </>
      )}
    />
  </AbsoluteFill>
);

const QUESTION = 'Qual è stato il weekend con più presenze?';
export const Agent: React.FC = () => {
  const frame = useCurrentFrame();
  const typed = Math.floor(
    interpolate(frame, [82, 118], [0, QUESTION.length], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
  );
  return (
    <AbsoluteFill>
      <Caption index={6} kicker="SDP Agent · AI" title="Chiedi ai tuoi dati. Risponde l'AI." highlight="l'AI." />
      <AppShot
        duration={SCENES.agent}
        shots={[{src: 'screens/sdp-agent.png', from: 0}]}
        cams={[
          {f: 0, s: 1, x: 0.5, y: 0.5},
          {f: 22, s: 1, x: 0.5, y: 0.5},
          {f: 72, s: 1.55, x: 0.73, y: 0.66},
        ]}
        overlays={(ctx) => (
          <>
            <Highlight ctx={ctx} x={0.5} y={0.44} w={0.29} h={0.345} from={44} to={80} label="Risposta in linguaggio naturale" />
            {ctx.frame >= 78 ? (
              <div
                style={{
                  position: 'absolute',
                  left: 0.496 * 1500,
                  top: 0.936 * 734,
                  width: 0.452 * 1500,
                  height: 0.04 * 734,
                  background: 'white',
                  borderRadius: 3,
                  border: `1.5px solid ${colors.orange}`,
                  display: 'flex',
                  alignItems: 'center',
                  paddingLeft: 12,
                  fontFamily: fonts.body,
                  fontSize: 14,
                  color: '#222',
                }}
              >
                {QUESTION.slice(0, typed)}
                <span style={{width: 1.5, height: 15, background: '#222', marginLeft: 1, opacity: frame % 16 < 8 ? 1 : 0}} />
              </div>
            ) : null}
          </>
        )}
      />
    </AbsoluteFill>
  );
};

export const Esportazioni: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Caption index={7} kicker="Esportazioni dati" title="Porta i dati dove vuoi" highlight="dove vuoi" />
      <AppShot
        duration={SCENES.esportazioni}
        shots={[{src: 'screens/esportazioni.png', from: 0}]}
        cams={[
          {f: 0, s: 1, x: 0.5, y: 0.5},
          {f: 22, s: 1, x: 0.5, y: 0.5},
          {f: 62, s: 1.6, x: 0.8, y: 0.42},
        ]}
        overlays={(ctx) => (
          <Cursor
            ctx={ctx}
            from={20}
            path={[
              {f: 20, x: 0.6, y: 0.7},
              {f: 66, x: 0.955, y: 0.435},
            ]}
            clicks={[70]}
          />
        )}
      />
      <Chip frame={frame} from={74} left={1190} top={745}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: colors.orange,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: fonts.display,
            fontWeight: 800,
            fontSize: 16,
          }}
        >
          CSV
        </div>
        presenze_arrivi.csv
        <span style={{color: '#28C840', fontSize: 30}}>✓</span>
      </Chip>
    </AbsoluteFill>
  );
};
