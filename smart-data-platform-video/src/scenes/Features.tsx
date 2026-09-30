import {AbsoluteFill, interpolate, Sequence, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {AppShot} from '../components/AppShot';
import {Caption} from '../components/Caption';
import {Chip, Cursor, Highlight, Pulse} from '../components/Overlays';
import {SceneName, SCENES} from '../timing';
import {colors, fonts} from '../theme';

// Cursor click frames (relative to each scene), shared with the sound design.
export const SCENE_CLICKS: Partial<Record<SceneName, number[]>> = {
  statistiche: [80, 160, 240],
  sociodemografico: [80, 160],
  esportazioni: [95],
};

export const Panoramica: React.FC = () => (
  <AbsoluteFill>
    <Caption index={1} kicker="Panoramica" title="Il territorio, in tempo reale" highlight="tempo reale" />
    <AppShot
      duration={SCENES.panoramica}
      shots={[{src: 'screens/panoramica.png', from: 0}]}
      cams={[
        {f: 0, s: 1, x: 0.5, y: 0.5},
        {f: 75, s: 1, x: 0.5, y: 0.5},
        {f: 145, s: 1.75, x: 0.79, y: 0.38},
      ]}
      overlays={(ctx) => (
        <>
          <Highlight ctx={ctx} x={0.181} y={0.16} w={0.393} h={0.388} from={20} to={72} label="Area di interesse" />
          <Highlight ctx={ctx} x={0.592} y={0.207} w={0.396} h={0.345} from={148} label="Presenze · Arrivi · Pernottamenti · Visitatori" />
        </>
      )}
    />
  </AbsoluteFill>
);

// Chart regions shared by the Statistiche/Sociodemografico layouts (fractions of the image)
const LEFT = {x: 0.188, y: 0.25, w: 0.382, h: 0.33};
const RIGHT = {x: 0.585, y: 0.25, w: 0.39, h: 0.33};
const BOTTOM = {x: 0.188, y: 0.615, w: 0.787, h: 0.34};

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
          <>
            {/* Orario di arrivo */}
            <Highlight ctx={ctx} {...LEFT} from={18} to={46} label="Arrivi per fascia oraria" />
            <Highlight ctx={ctx} {...BOTTOM} from={48} to={c1 - 4} label="Giorno della settimana × fascia oraria" />
            {/* Frequenza */}
            <Highlight ctx={ctx} {...LEFT} from={c1 + 12} to={c1 + 44} label="Quante volte tornano" />
            <Highlight ctx={ctx} {...RIGHT} from={c1 + 46} to={c2 - 4} label="Frequenza media per origine" />
            {/* Durata visita */}
            <Highlight ctx={ctx} {...LEFT} from={c2 + 12} to={c2 + 44} label="Durata della visita (ore)" />
            <Highlight ctx={ctx} {...RIGHT} from={c2 + 46} to={c3 - 4} label="Durata media per origine" />
            {/* Durata pernottamento */}
            <Highlight ctx={ctx} {...LEFT} from={c3 + 12} to={c3 + 46} label="Notti di pernottamento dei turisti" />
            <Highlight ctx={ctx} {...BOTTOM} from={c3 + 48} label="Andamento giornaliero" />
            <Cursor
            ctx={ctx}
            from={30}
            path={[
              {f: 30, x: 0.62, y: 0.55},
              {f: c1 - 28, x: 0.5, y: 0.45},
              {f: c1 - 3, x: 0.306, y: STAT_TAB_Y},
              {f: c2 - 28, x: 0.306, y: STAT_TAB_Y},
              {f: c2 - 3, x: 0.386, y: STAT_TAB_Y},
              {f: c3 - 28, x: 0.386, y: STAT_TAB_Y},
              {f: c3 - 3, x: 0.467, y: STAT_TAB_Y},
              {f: c3 + 30, x: 0.62, y: 0.5},
            ]}
            clicks={[c1, c2, c3]}
          />
          </>
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
          <>
            {/* Origini nazionali */}
            <Highlight ctx={ctx} x={0.192} y={0.3} w={0.46} h={0.645} from={16} to={46} label="Province e regioni di origine" />
            <Highlight ctx={ctx} x={0.72} y={0.3} w={0.25} h={0.645} from={48} to={c1 - 4} label="Visitatori per provincia" />
            {/* Età & Genere */}
            <Highlight ctx={ctx} {...LEFT} from={c1 + 12} to={c1 + 44} label="Distribuzione per genere" />
            <Highlight ctx={ctx} {...RIGHT} from={c1 + 46} to={c2 - 4} label="Fasce d'età" />
            {/* Origini internazionali */}
            <Highlight ctx={ctx} x={0.192} y={0.36} w={0.47} h={0.46} from={c2 + 12} to={c2 + 48} label="Paesi di provenienza" />
            <Highlight ctx={ctx} x={0.72} y={0.225} w={0.25} h={0.72} from={c2 + 50} label="Top 20 paesi" />
            <Cursor
            ctx={ctx}
            from={30}
            path={[
              {f: 30, x: 0.55, y: 0.6},
              {f: c1 - 28, x: 0.45, y: 0.4},
              {f: c1 - 3, x: 0.304, y: SOCIO_TAB_Y},
              {f: c2 - 28, x: 0.304, y: SOCIO_TAB_Y},
              {f: c2 - 3, x: 0.385, y: SOCIO_TAB_Y},
              {f: c2 + 30, x: 0.55, y: 0.5},
            ]}
            clicks={[c1, c2]}
          />
          </>
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
        {f: 62, s: 1, x: 0.5, y: 0.5},
        {f: 150, s: 1.9, x: 0.56, y: 0.66},
      ]}
      overlays={(ctx) => (
        <>
          <Highlight ctx={ctx} x={0.173} y={0.132} w={0.817} h={0.14} from={16} to={64} label="Viaggi totali, tappe, primo e ultimo stop" />
          <Pulse ctx={ctx} x={0.563} y={0.729} from={66} />
          <Highlight ctx={ctx} x={0.2} y={0.435} w={0.775} h={0.5} from={96} to={150} label="Flussi in arrivo e in partenza" />
        </>
      )}
    />
  </AbsoluteFill>
);

const NEW_SPLASH = 58;

// Full-screen "Novità" title card that introduces the forecast feature.
const NewFeatureSplash: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const pill = spring({frame: frame - 2, fps, config: {damping: 12}});
  const title = spring({frame: frame - 8, fps, config: {damping: 14}});
  const sub = spring({frame: frame - 16, fps, config: {damping: 200}});
  const out = interpolate(frame, [NEW_SPLASH - 14, NEW_SPLASH], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  if (frame >= NEW_SPLASH) return null;
  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', opacity: out, transform: `scale(${1 + (1 - out) * 0.08})`}}>
      <div
        style={{
          padding: '12px 30px',
          borderRadius: 999,
          background: colors.orange,
          color: 'white',
          fontFamily: fonts.display,
          fontWeight: 800,
          fontSize: 30,
          letterSpacing: 8,
          boxShadow: `0 0 ${40 + 20 * Math.sin(frame / 4)}px rgba(255,106,0,0.8)`,
          transform: `scale(${pill})`,
        }}
      >
        NOVITÀ
      </div>
      <div
        style={{
          marginTop: 34,
          fontFamily: fonts.display,
          fontWeight: 800,
          fontSize: 96,
          letterSpacing: -2,
          color: 'white',
          opacity: title,
          transform: `translateY(${(1 - title) * 40}px)`,
        }}
      >
        Previsioni <span style={{color: colors.orange}}>dei flussi</span>
      </div>
      <div
        style={{
          marginTop: 18,
          fontFamily: fonts.body,
          fontWeight: 500,
          fontSize: 30,
          color: 'rgba(255,255,255,0.85)',
          opacity: sub,
        }}
      >
        Presenze, arrivi e pernottamenti attesi, con meteo ed eventi
      </div>
    </AbsoluteFill>
  );
};

export const Previsioni: React.FC = () => (
  <AbsoluteFill>
    <NewFeatureSplash />
    <Sequence from={NEW_SPLASH - 10} layout="none">
      <Caption index={5} kicker="Previsioni" badge="Novità" title="Anticipa i flussi di domani" highlight="domani" />
      <AppShot
        duration={SCENES.previsioni - NEW_SPLASH}
        shots={[{src: 'screens/previsioni.png', from: 0}]}
        cams={[
          {f: 0, s: 1, x: 0.5, y: 0.5},
          {f: 118, s: 1, x: 0.5, y: 0.5},
          {f: 165, s: 1.35, x: 0.6, y: 0.63},
          {f: 205, s: 1.35, x: 0.6, y: 0.63},
          {f: 245, s: 1.55, x: 0.8, y: 0.63},
        ]}
        overlays={(ctx) => (
          <>
            <Highlight ctx={ctx} x={0.172} y={0.135} w={0.82} h={0.155} from={16} to={58} label="Totali previsti per il periodo" />
            <Highlight ctx={ctx} x={0.245} y={0.468} w={0.705} h={0.042} from={58} to={88} label="Meteo previsto giorno per giorno" />
            {[0.4676, 0.763, 0.9115, 0.928].map((x, i) => (
              <Highlight
                key={x}
                ctx={ctx}
                x={x - 0.011}
                y={0.505}
                w={0.022}
                h={0.036}
                from={90 + i * 4}
                to={120}
                label={i === 0 ? 'Eventi e festività' : undefined}
              />
            ))}
            <Highlight ctx={ctx} x={0.245} y={0.54} w={0.43} h={0.3} from={168} to={206} label="Dati effettivi" />
            <Highlight ctx={ctx} x={0.672} y={0.54} w={0.268} h={0.25} from={208} label="Previsione" />
          </>
        )}
      />
    </Sequence>
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
        {f: 35, s: 1, x: 0.5, y: 0.5},
        {f: 85, s: 1.6, x: 0.74, y: 0.55},
      ]}
      overlays={(ctx) => (
        <>
          <Highlight ctx={ctx} x={0.487} y={0.26} w={0.51} h={0.73} from={8} to={45} label="SDP Agent" />
          <Highlight ctx={ctx} x={0.643} y={0.385} w={0.218} h={0.056} from={78} label="Domanda dell'utente" />
          <Highlight ctx={ctx} x={0.5} y={0.44} w={0.29} h={0.345} from={98} label="Risposta dell'agente" />
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
          {f: 30, s: 1, x: 0.5, y: 0.5},
          {f: 85, s: 1.6, x: 0.8, y: 0.42},
        ]}
        overlays={(ctx) => (
          <Cursor
            ctx={ctx}
            from={30}
            path={[
              {f: 30, x: 0.6, y: 0.7},
              {f: 55, x: 0.62, y: 0.6},
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
