import { createContext, useContext } from 'react'
import { setLabelsLang, setPalette } from './labels'

export type Lang = 'it' | 'en'
export type Theme = 'windtre' | 'three'
export interface Settings {
  lang: Lang
  theme: Theme
}

const KEY = 'ta-settings'

function load(): Settings {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    return { lang: s.lang === 'en' ? 'en' : 'it', theme: s.theme === 'three' ? 'three' : 'windtre' }
  } catch {
    return { lang: 'it', theme: 'windtre' }
  }
}

let current: Settings = load()

export const getLang = () => current.lang
export const getTheme = () => current.theme

/** Testo nella lingua corrente: la traduzione inglese sta accanto all'originale italiano. */
export const t = (it: string, en: string) => (current.lang === 'en' ? en : it)

/**
 * Applica lingua e template: aggiorna etichette, formati e palette condivisi, gli attributi del documento
 * (le variabili CSS del template dipendono da data-theme) e salva la scelta. Va chiamata prima del render.
 */
export function applySettings(s: Settings) {
  current = s
  setLabelsLang(s.lang)
  setPalette(s.theme)
  document.documentElement.lang = s.lang
  document.documentElement.dataset.theme = s.theme
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* archiviazione non disponibile: la scelta vale solo per la sessione */
  }
}
applySettings(current)

/** Loghi del template: il partner cambia, CKDelta resta. */
export const BRAND: Record<Theme, { src: string; alt: string; className: string }> = {
  windtre: { src: 'logo-windtre-business.png', alt: 'WINDTRE Business', className: 'logo-w3' },
  three: { src: 'logo-three.svg', alt: 'Three', className: 'logo-three' },
}

export const SettingsContext = createContext<Settings & { set: (s: Partial<Settings>) => void }>({ ...current, set: () => undefined })
/** I componenti che mostrano testi o colori lo usano per ridisegnarsi al cambio di lingua o template. */
export const useSettings = () => useContext(SettingsContext)
