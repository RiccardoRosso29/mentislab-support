export const FPS = 30;
export const TRANSITION = 30;

export const SCENES = {
  intro: 180,
  panoramica: 230,
  statistiche: 345,
  sociodemografico: 275,
  viaggi: 230,
  previsioni: 220,
  agent: 175,
  agentChat: 520,
  esportazioni: 180,
  outro: 165,
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
