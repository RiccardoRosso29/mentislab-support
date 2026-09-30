import {loadFont} from '@remotion/fonts';
import {staticFile} from 'remotion';

// Montserrat (SIL Open Font License) is bundled in public/fonts so rendering works offline.
for (const weight of ['400', '500', '600', '700', '800']) {
  loadFont({family: 'Montserrat', weight, url: staticFile(`fonts/montserrat-${weight}.woff2`), format: 'woff2'});
}

export const fonts = {
  body: '"Montserrat", sans-serif',
  display: '"Montserrat", sans-serif',
};

export const colors = {
  orange: '#FF6A00',
  orangeSoft: '#FF8A3D',
  gold: '#C9A24A',
  bg: '#0B0B0D',
  panel: '#17171B',
  text: '#FFFFFF',
  muted: 'rgba(255,255,255,0.68)',
};
