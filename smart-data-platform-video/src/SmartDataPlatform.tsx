import {AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame} from 'remotion';
import {linearTiming, springTiming, TransitionSeries} from '@remotion/transitions';
import {fade} from '@remotion/transitions/fade';
import {slide} from '@remotion/transitions/slide';
import {wipe} from '@remotion/transitions/wipe';
import {Background} from './components/Background';
import {AgentChat} from './scenes/AgentChat';
import {Agent, Esportazioni, Panoramica, Previsioni, Sociodemografico, StatisticheVisite, Viaggi} from './scenes/Features';
import {Intro, Outro} from './scenes/IntroOutro';
import {INTRO_END, OUTRO_START, SCENES, TOTAL_FRAMES, TRANSITION} from './timing';
import {Soundtrack} from './Soundtrack';
import {colors, fonts} from './theme';

const spr = springTiming({config: {damping: 200}, durationInFrames: TRANSITION});
const lin = linearTiming({durationInFrames: TRANSITION});

// Small co-branding mark and progress bar shown during the feature tour.
const Chrome: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [INTRO_END, INTRO_END + 15, OUTRO_START, OUTRO_START + 10], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div style={{position: 'absolute', right: 110, top: 64, display: 'flex', alignItems: 'center', gap: 18, opacity: opacity * 0.9}}>
        <Img src={staticFile('logos/w3-business-dark.png')} style={{height: 52}} />
        <span style={{color: 'rgba(255,255,255,0.5)', fontSize: 24, fontFamily: fonts.body}}>×</span>
        <Img src={staticFile('logos/ckdelta-dark.png')} style={{height: 52}} />
      </div>
      <div
        style={{
          position: 'absolute',
          left: 0,
          bottom: 0,
          height: 5,
          width: `${(frame / (TOTAL_FRAMES - 1)) * 100}%`,
          background: colors.orange,
          boxShadow: `0 0 14px ${colors.orange}`,
          opacity,
        }}
      />
    </AbsoluteFill>
  );
};

export const SmartDataPlatform: React.FC = () => (
  <AbsoluteFill>
    <Background />
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={SCENES.intro}>
        <Intro />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={lin} />
      <TransitionSeries.Sequence durationInFrames={SCENES.panoramica}>
        <Panoramica />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={slide({direction: 'from-right'})} timing={spr} />
      <TransitionSeries.Sequence durationInFrames={SCENES.statistiche}>
        <StatisticheVisite />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={slide({direction: 'from-bottom'})} timing={spr} />
      <TransitionSeries.Sequence durationInFrames={SCENES.sociodemografico}>
        <Sociodemografico />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={slide({direction: 'from-right'})} timing={spr} />
      <TransitionSeries.Sequence durationInFrames={SCENES.viaggi}>
        <Viaggi />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={wipe({direction: 'from-left'})} timing={spr} />
      <TransitionSeries.Sequence durationInFrames={SCENES.previsioni}>
        <Previsioni />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={slide({direction: 'from-right'})} timing={spr} />
      <TransitionSeries.Sequence durationInFrames={SCENES.agent}>
        <Agent />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={lin} />
      <TransitionSeries.Sequence durationInFrames={SCENES.agentChat}>
        <AgentChat />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={slide({direction: 'from-bottom'})} timing={spr} />
      <TransitionSeries.Sequence durationInFrames={SCENES.esportazioni}>
        <Esportazioni />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={lin} />
      <TransitionSeries.Sequence durationInFrames={SCENES.outro}>
        <Outro />
      </TransitionSeries.Sequence>
    </TransitionSeries>
    <Chrome />
    <Soundtrack />
  </AbsoluteFill>
);
