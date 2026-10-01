import {loadFont} from '@remotion/fonts';
import {staticFile} from 'remotion';

// Montserrat (SIL Open Font License) è incluso in public/fonts per il render offline.
loadFont({family: 'Montserrat', weight: '600', url: staticFile('fonts/montserrat-600.woff2'), format: 'woff2'});
loadFont({family: 'Montserrat', weight: '800', url: staticFile('fonts/montserrat-800.woff2'), format: 'woff2'});

export const colors = {
  orange: '#FF6A00',
  dark: '#0B0B0D',
  // Colore del tracciato usato da Google Earth per percorsi e poligoni.
  earthPath: '#F2B33D',
};

export const font = '"Montserrat", sans-serif';

// Gli screenshot sono larghi 2000 px: tutte le coordinate sono in questo spazio.
export const SRC_W = 2000;
export const SRC_H = 960;
export const W = 1600;
export const H = 768;
export const K = W / SRC_W;
export const FPS = 30;
