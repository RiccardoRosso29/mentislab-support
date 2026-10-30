import { useCallback, useRef, useState } from 'react'
import { useClickOutside } from '../hooks'
import { BRAND, t, useSettings, type Lang, type Theme } from '../settings'

const LINGUE: { id: Lang; label: string }[] = [
  { id: 'it', label: 'Italiano' },
  { id: 'en', label: 'English' },
]

const TEMPLATE: { id: Theme; nome: string; colore: string }[] = [
  { id: 'windtre', nome: 'WINDTRE × CKDelta', colore: '#f28c28' },
  { id: 'three', nome: 'Three × CKDelta', colore: '#9966ff' },
]

/** Icona dell'account nell'intestazione: apre le impostazioni di lingua e template. */
export default function AccountMenu() {
  const { lang, theme, set } = useSettings()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setOpen(false), [])
  useClickOutside(ref, close, open)

  return (
    <div className={`acc ${open ? 'open' : ''}`} ref={ref} onKeyDown={(e) => e.key === 'Escape' && close()}>
      <button
        className="acc-btn"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={t('Account e impostazioni', 'Account and settings')}
        aria-label={t('Account e impostazioni', 'Account and settings')}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
          <circle cx="12" cy="8.5" r="3.6" />
          <path d="M4.8 19.5c1.2-3.3 3.9-5.1 7.2-5.1s6 1.8 7.2 5.1" />
        </svg>
      </button>
      {open && (
        <div className="acc-panel" role="dialog" aria-label={t('Impostazioni', 'Settings')}>
          <div className="acc-head">
            <span className="acc-avatar" aria-hidden>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <circle cx="12" cy="8.5" r="3.6" />
                <path d="M4.8 19.5c1.2-3.3 3.9-5.1 7.2-5.1s6 1.8 7.2 5.1" />
              </svg>
            </span>
            <div>
              <b>{t('Utente demo', 'Demo user')}</b>
              <span>Trip Analytics</span>
            </div>
          </div>

          <div className="acc-sec">
            <span className="acc-label" id="acc-lang">
              {t('Lingua', 'Language')}
            </span>
            <div className="acc-seg" role="radiogroup" aria-labelledby="acc-lang">
              {LINGUE.map((l) => (
                <button key={l.id} role="radio" aria-checked={lang === l.id} className={lang === l.id ? 'on' : ''} onClick={() => set({ lang: l.id })}>
                  {l.label}
                </button>
              ))}
            </div>
          </div>

          <div className="acc-sec">
            <span className="acc-label" id="acc-theme">
              Template
            </span>
            <div className="acc-themes" role="radiogroup" aria-labelledby="acc-theme">
              {TEMPLATE.map((tp) => {
                const on = theme === tp.id
                return (
                  <button key={tp.id} role="radio" aria-checked={on} className={`acc-theme ${on ? 'on' : ''}`} onClick={() => set({ theme: tp.id })}>
                    <span className="acc-logos" aria-hidden>
                      <img src={BRAND[tp.id].src} alt="" className={BRAND[tp.id].className} />
                      <i />
                      <img src="logo-ckdelta.png" alt="" className="logo-ck" />
                    </span>
                    <span className="acc-theme-name">
                      <span className="acc-swatch" style={{ background: tp.colore }} />
                      {tp.nome}
                    </span>
                    <span className="acc-radio" aria-hidden />
                  </button>
                )
              })}
            </div>
            <p className="acc-note">{t('Cambiano solo colori e loghi: grafici e impostazioni restano invariati.', 'Only colours and logos change: charts and settings stay the same.')}</p>
          </div>
        </div>
      )}
    </div>
  )
}
