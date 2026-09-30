import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {AppShot} from '../components/AppShot';
import {Caption} from '../components/Caption';
import {Chip, Cursor, Highlight, Pulse} from '../components/Overlays';
import {SceneName, SCENES} from '../timing';
import {colors, fonts} from '../theme';

// Cursor click frames (relative to each scene), shared with the sound design.
export const SCENE_CLICKS: Partial<Record<SceneName, number[]>> = {
  statistiche: [56, 95, 133],
  sociodemografico: [57, 95],
  esportazioni: [76],
};

export const Panoramica: React.FC = () => (
  <AbsoluteFill>
    <Caption index={1} kicker="Panoramica" title="Il territorio, in tempo reale" highlight="tempo reale" />
    <AppShot
      duration={SCENES.panoramica}
      shots={[{src: 'screens/panoramica.png', from: 0}]}
      cams={[
        {f: 0, s: 1, x: 0.5, y: 0.5},
        {f: 48, s: 1, x: 0.5, y: 0.5},
        {f: 100, s: 1.75, x: 0.79, y: 0.38},
      ]}
      overlays={(ctx) => (
        <>
          <Highlight ctx={ctx} x={0.181} y={0.16} w={0.393} h={0.388} from={16} to={46} label="Area di interesse" />
          <Highlight ctx={ctx} x={0.592} y={0.207} w={0.396} h={0.345} from={102} label="Presenze · Arrivi · Pernottamenti · Visitatori" />
        </>
      )}
    />
  </AbsoluteFill>
);

// Tab positions inside the screenshots (fractions of the image)
const STAT_TAB_Y = 0.205;
export const StatisticheVisite: React.FC = () => {
  const [c1, c2, c3] = SCENE_CLICKS.statistiche!;
  return (
    <AbsoluteFill>
      <Caption index={2} kicker="Statistiche visite" title="Quando arrivano, quanto restano" highlight="restano" />
      <AppShot
        duration={SCENES.statistiche}
        shots={[
          {src: 'screens/orario-arrivo.png', from: 0},
          {src: 'screens/frequenza.png', from: c1 + 4},
          {src: 'screens/durata-visita.png', from: c2 + 4},
          {src: 'screens/durata-pernottamento.png', from: c3 + 4},
        ]}
        cams={[
          {f: 0, s: 1, x: 0.5, y: 0.5},
          {f: SCENES.statistiche, s: 1.1, x: 0.5, y: 0.45},
        ]}
        overlays={(ctx) => (
          <Cursor
            ctx={ctx}
            from={25}
            path={[
              {f: 25, x: 0.62, y: 0.55},
              {f: c1 - 3, x: 0.306, y: STAT_TAB_Y},
              {f: c2 - 3, x: 0.386, y: STAT_TAB_Y},
              {f: c3 - 3, x: 0.467, y: STAT_TAB_Y},
              {f: SCENES.statistiche, x: 0.6, y: 0.45},
            ]}
            clicks={[c1, c2, c3]}
          />
        )}
      />
    </AbsoluteFill>
  );
};

// Order: Origini nazionali -> Età & Genere -> Origini internazionali
const SOCIO_TAB_Y = 0.178;
export const Sociodemografico: React.FC = () => {
  const [c1, c2] = SCENE_CLICKS.sociodemografico!;
  return (
    <AbsoluteFill>
      <Caption index={3} kicker="Sociodemografico" title="Chi sono i tuoi visitatori" highlight="visitatori" />
      <AppShot
        duration={SCENES.sociodemografico}
        shots={[
          {src: 'screens/origini-nazionali.png', from: 0},
          {src: 'screens/eta-genere.png', from: c1 + 4},
          {src: 'screens/origini-internazionali.png', from: c2 + 4},
        ]}
        cams={[
          {f: 0, s: 1, x: 0.5, y: 0.5},
          {f: SCENES.sociodemografico, s: 1.08, x: 0.5, y: 0.48},
        ]}
        overlays={(ctx) => (
          <Cursor
            ctx={ctx}
            from={22}
            path={[
              {f: 22, x: 0.55, y: 0.6},
              {f: c1 - 3, x: 0.304, y: SOCIO_TAB_Y},
              {f: c2 - 3, x: 0.385, y: SOCIO_TAB_Y},
              {f: SCENES.sociodemografico, x: 0.5, y: 0.5},
            ]}
            clicks={[c1, c2]}
          />
        )}
      />
    </AbsoluteFill>
  );
};

export const Viaggi: React.FC = () => (
  <AbsoluteFill>
    <Caption index={4} kicker="Viaggi dei visitatori" title="Da dove arrivano, dove vanno" highlight="dove vanno" />
    <AppShot
      duration={SCENES.viaggi}
      shots={[{src: 'screens/viaggi.png', from: 0}]}
      cams={[
        {f: 0, s: 1, x: 0.5, y: 0.5},
        {f: 40, s: 1, x: 0.5, y: 0.5},
        {f: 106, s: 1.9, x: 0.56, y: 0.66},
      ]}
      overlays={(ctx) => (
        <>
          <Highlight ctx={ctx} x={0.173} y={0.132} w={0.817} h={0.14} from={12} to={46} label="Flussi e tappe del viaggio" />
          <Pulse ctx={ctx} x={0.563} y={0.729} from={46} />
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
        {f: 36, s: 1, x: 0.5, y: 0.5},
        {f: 90, s: 1.45, x: 0.7, y: 0.6},
      ]}
      overlays={(ctx) => (
        <>
          <Highlight ctx={ctx} x={0.245} y={0.46} w={0.705} h={0.07} from={12} to={44} label="Meteo ed eventi" />
          <Highlight ctx={ctx} x={0.672} y={0.54} w={0.265} h={0.23} from={64} label="Previsione" />
        </>
      )}
    />
  </AbsoluteFill>
);

// The real SDP Agent panel: zoom from the dashboard into the conversation.
export const Agent: React.FC = () => (
  <AbsoluteFill>
    <Caption index={6} kicker="SDP Agent · AI" title="Chiedi ai tuoi dati. Risponde l'AI." highlight="l'AI." />
    <AppShot
      duration={SCENES.agent}
      shots={[{src: 'screens/sdp-agent.png', from: 0}]}
      cams={[
        {f: 0, s: 1, x: 0.5, y: 0.5},
        {f: 20, s: 1, x: 0.5, y: 0.5},
        {f: 56, s: 1.6, x: 0.74, y: 0.55},
      ]}
      overlays={(ctx) => (
        <>
          <Highlight ctx={ctx} x={0.487} y={0.26} w={0.51} h={0.73} from={4} to={28} label="SDP Agent" />
          <Highlight ctx={ctx} x={0.643} y={0.385} w={0.218} h={0.056} from={50} label="Domanda dell'utente" />
          <Highlight ctx={ctx} x={0.5} y={0.44} w={0.29} h={0.345} from={68} label="Risposta dell'agente" />
        </>
      )}
    />
  </AbsoluteFill>
);

export const Esportazioni: React.FC = () => {
  const [click] = SCENE_CLICKS.esportazioni!;
  return (
    <AbsoluteFill>
      <Caption index={7} kicker="Esportazioni dati" title="Porta i dati dove vuoi" highlight="dove vuoi" />
      <AppShot
        duration={SCENES.esportazioni}
        shots={[{src: 'screens/esportazioni.png', from: 0}]}
        cams={[
          {f: 0, s: 1, x: 0.5, y: 0.5},
          {f: 25, s: 1, x: 0.5, y: 0.5},
          {f: 68, s: 1.6, x: 0.8, y: 0.42},
        ]}
        overlays={(ctx) => (
          <Cursor
            ctx={ctx}
            from={22}
            path={[
              {f: 22, x: 0.6, y: 0.7},
              {f: click - 4, x: 0.955, y: 0.435},
            ]}
            clicks={[click]}
          />
        )}
      />
      <ChipCsv from={click + 4} />
    </AbsoluteFill>
  );
};

const ChipCsv: React.FC<{from: number}> = ({from}) => (
  <ChipAtFrame from={from}>
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
        fontSize: 14,
      }}
    >
      CSV
    </div>
    presenze_arrivi.csv
    <span style={{color: '#28C840', fontSize: 28}}>✓</span>
  </ChipAtFrame>
);

const ChipAtFrame: React.FC<{from: number; children: React.ReactNode}> = ({from, children}) => {
  const frame = useCurrentFrame();
  return (
    <Chip frame={frame} from={from} left={1150} top={745}>
      {children}
    </Chip>
  );
};
