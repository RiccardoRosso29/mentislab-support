/**
 * Eventi anonimi per misurare il funnel (nessun dato personale, nessun cookie di terze parti).
 * Restano nel browser (pagina «Metriche») e, se configurato VITE_ANALYTICS_URL, vengono inviati a un endpoint.
 */
export type EventName =
  | 'project_created'
  | 'wall_drawn'
  | 'room_closed'
  | 'item_placed'
  | 'slot_search_opened'
  | 'product_viewed'
  | 'product_tried_in_3d'
  | 'product_chosen'
  | 'outbound_click'
  | 'list_viewed';

export type Event = { name: EventName; at: string; props?: Record<string, string | number | boolean | null> };

const KEY = 'cista:events';
const MAX = 5000;

function read(): Event[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as Event[];
  } catch {
    return [];
  }
}

export function track(name: EventName, props?: Event['props']) {
  const ev: Event = { name, at: new Date().toISOString(), props };
  try {
    const all = read();
    all.push(ev);
    localStorage.setItem(KEY, JSON.stringify(all.slice(-MAX)));
  } catch {
    /* archiviazione non disponibile */
  }
  const url = import.meta.env?.VITE_ANALYTICS_URL as string | undefined;
  if (url && typeof navigator !== 'undefined' && navigator.sendBeacon) {
    try {
      navigator.sendBeacon(url, JSON.stringify(ev));
    } catch {
      /* invio fallito: resta l'evento locale */
    }
  }
}

export const events = read;

export function clearEvents() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* niente da fare */
  }
}
