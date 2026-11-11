import type { Project } from './types';

/**
 * Livello Pro (predisposizione). Nessuna funzione qui fa chiamate di rete: l'MVP mostra solo cosa arriverà.
 * Un provider reale implementerà `AiProvider` lato server (le chiavi non vanno mai nel browser) e scalerà i crediti.
 */
export type AiFeatureId = 'survey-assistant' | 'plan-from-image' | 'custom-object';

export const AI_FEATURES: { id: AiFeatureId; label: string; description: string; credits: number }[] = [
  { id: 'survey-assistant', label: 'Assistente al rilievo', description: 'ti guida a voce o in chat, stanza per stanza, e inserisce le misure', credits: 1 },
  { id: 'plan-from-image', label: 'Planimetria da foto o PDF', description: 'trasforma la planimetria dell’annuncio in una bozza di muri, porte e finestre da controllare', credits: 3 },
  { id: 'custom-object', label: 'Oggetto su misura', description: 'descrivi un mobile o un ingombro particolare e lo crea come mobile parametrico', credits: 1 },
];

export interface AiProvider {
  surveyStep(project: Project, message: string): Promise<{ reply: string; patch?: Partial<Project> }>;
  planFromImage(image: Blob): Promise<Project>;
  customObject(description: string): Promise<{ type: string; w: number; d: number; h: number }>;
}

export const aiEnabled = () => import.meta.env?.VITE_FEATURE_AI === '1';

const KEY = 'cista:credits';
export function credits(): number {
  try {
    return Number(localStorage.getItem(KEY) ?? '0');
  } catch {
    return 0;
  }
}
