import {loadFont} from '@remotion/fonts';
import {staticFile} from 'remotion';

// Fonts are bundled in public/fonts (Barlow, SIL Open Font License) so rendering works offline.
const faces: [string, string, string][] = [
  ['Barlow', '400', 'barlow-400'],
  ['Barlow', '500', 'barlow-500'],
  ['Barlow', '600', 'barlow-600'],
  ['Barlow Condensed', '500', 'barlow-condensed-500'],
  ['Barlow Condensed', '700', 'barlow-condensed-700'],
  ['Barlow Condensed', '800', 'barlow-condensed-800'],
];
for (const [family, weight, file] of faces) {
  loadFont({family, weight, url: staticFile(`fonts/${file}.woff2`), format: 'woff2'});
}

export const fonts = {
  body: '"Barlow", sans-serif',
  display: '"Barlow Condensed", sans-serif',
};

export const colors = {
  orange: '#FF6A00',
  orangeSoft: '#FF8A3D',
  bg: '#0B0B0D',
  panel: '#17171B',
  text: '#FFFFFF',
  muted: 'rgba(255,255,255,0.62)',
};
