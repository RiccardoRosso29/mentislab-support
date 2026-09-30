export const FPS = 30;
export const TRANSITION = 15;

export const SCENES = {
  intro: 135,
  panoramica: 135,
  statistiche: 165,
  sociodemografico: 140,
  viaggi: 120,
  previsioni: 110,
  agent: 105,
  agentChat: 340,
  esportazioni: 110,
  outro: 125,
} as const;

export type SceneName = keyof typeof SCENES;

const names = Object.keys(SCENES) as SceneName[];

// Absolute frame at which each scene starts (scenes overlap by TRANSITION frames)
export const SCENE_START = names.reduce(
  (acc, name, i) => {
    acc[name] = i === 0 ? 0 : acc[names[i - 1]] + SCENES[names[i - 1]] - TRANSITION;
    return acc;
  },
  {} as Record<SceneName, number>,
);

export const TOTAL_FRAMES = SCENE_START.outro + SCENES.outro;
export const OUTRO_START = SCENE_START.outro;
export const INTRO_END = SCENES.intro - TRANSITION;
