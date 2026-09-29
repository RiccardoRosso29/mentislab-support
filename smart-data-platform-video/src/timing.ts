export const FPS = 30;
export const TRANSITION = 15;

export const SCENES = {
  intro: 100,
  panoramica: 120,
  statistiche: 150,
  sociodemografico: 120,
  viaggi: 110,
  previsioni: 105,
  agent: 125,
  esportazioni: 100,
  outro: 115,
} as const;

const durations = Object.values(SCENES);
export const TOTAL_FRAMES =
  durations.reduce((a, b) => a + b, 0) - (durations.length - 1) * TRANSITION;

// Absolute frame at which the outro starts (used by global overlays)
export const OUTRO_START = TOTAL_FRAMES - SCENES.outro;
export const INTRO_END = SCENES.intro - TRANSITION;
