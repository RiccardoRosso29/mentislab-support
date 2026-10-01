import React from 'react';
import {Composition} from 'remotion';
import {CLICK_FRAMES, ClickStep, ClickStepProps, DRAW_FRAMES, DrawStep} from './steps';
import {FPS, H, W} from './theme';

// Coordinate dei bersagli lette dagli screenshot (larghezza 2000 px).
const CLICK_STEPS: Record<string, ClickStepProps> = {
  'passo-1': {
    src: 'screens/1-avvio.png',
    next: 'screens/2-progetti.png',
    target: {x: 1794, y: 5, w: 136, h: 45},
    zoom: 1.9,
    label: 'Clicca «Avvia Earth»',
  },
  'passo-2': {
    src: 'screens/2-progetti.png',
    next: 'screens/3-nuovo.png',
    target: {x: 12, y: 68, w: 108, h: 54},
    zoom: 2.1,
    label: 'Clicca «+ Nuovo»',
  },
  'passo-3': {
    src: 'screens/3-nuovo.png',
    next: 'screens/4-mappa.png',
    target: {x: 12, y: 141, w: 320, h: 29},
    zoom: 2,
    label: 'Scegli «Nuovo progetto di mappa»',
  },
  'passo-4': {
    src: 'screens/4-mappa.png',
    target: {x: 546, y: 4, w: 42, h: 38},
    zoom: 2.3,
    label: 'Clicca l’icona «Percorso o poligono»',
  },
};

export const Root: React.FC = () => (
  <>
    {Object.entries(CLICK_STEPS).map(([id, props]) => (
      <Composition key={id} id={id} component={ClickStep} defaultProps={props} durationInFrames={CLICK_FRAMES} fps={FPS} width={W} height={H} />
    ))}
    <Composition id="passo-5" component={DrawStep} durationInFrames={DRAW_FRAMES} fps={FPS} width={W} height={H} />
  </>
);
