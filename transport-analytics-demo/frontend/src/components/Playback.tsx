import { FASCE, fmtDate, fmtN } from '../labels'

export interface Frame {
  day: string | null // null = giornata tipo (media sui giorni filtrati)
  fascia: string
}

export type PlaybackMode = 'tipo' | 'periodo'

export interface PlaybackState {
  open: boolean
  playing: boolean
  mode: PlaybackMode
  frame: number
  speed: number
}

export const SPEEDS = [0.5, 1, 2]

/** Fotogrammi del playback: le fasce orarie della giornata tipo, oppure ogni fascia di ogni giorno del periodo. */
export function buildFrames(mode: PlaybackMode, days: string[], fasce: string[]): Frame[] {
  if (mode === 'tipo') return fasce.map((fascia) => ({ day: null, fascia }))
  return days.flatMap((day) => fasce.map((fascia) => ({ day, fascia })))
}

interface Props {
  state: PlaybackState
  frames: Frame[]
  fasceOre: Record<string, string>
  volume: number | null
  onChange: (s: Partial<PlaybackState>) => void
}

export function frameTitle(fr: Frame) {
  return fr.day ? fmtDate(fr.day, { weekday: 'long', day: 'numeric', month: 'long' }) : 'Giornata tipo'
}

/** Barra di riproduzione in fondo alla mappa. */
export default function Playback({ state, frames, fasceOre, volume, onChange }: Props) {
  const fr = frames[state.frame]
  const groups = state.mode === 'periodo' ? [...new Set(frames.map((f) => f.day))] : []

  return (
    <>
      {fr && (
        <div className="pb-clock" aria-live="polite">
          <span className="pb-day">{frameTitle(fr)}</span>
          <span className="pb-slot">
            {FASCE[fr.fascia]} <small>{fasceOre[fr.fascia]}</small>
          </span>
          {volume != null && <span className="pb-vol">{fmtN(volume)} spostamenti tra zone</span>}
        </div>
      )}
      <div className="pb-bar">
        <button
          className="pb-play"
          onClick={() => onChange({ playing: !state.playing })}
          aria-label={state.playing ? 'Pausa' : 'Riproduci'}
          title={state.playing ? 'Pausa (spazio)' : 'Riproduci (spazio)'}
        >
          {state.playing ? (
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
              <rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" />
              <rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
              <path d="M7 4.5v15l13-7.5z" fill="currentColor" />
            </svg>
          )}
        </button>

        <div className="pb-mode" role="radiogroup" aria-label="Modalità">
          {(['tipo', 'periodo'] as const).map((m) => (
            <button
              key={m}
              role="radio"
              aria-checked={state.mode === m}
              className={state.mode === m ? 'on' : ''}
              onClick={() => onChange({ mode: m, frame: 0 })}
            >
              {m === 'tipo' ? 'Giornata tipo' : 'Periodo'}
            </button>
          ))}
        </div>

        <div className="pb-track">
          <div className="pb-cells" style={{ gridTemplateColumns: `repeat(${frames.length}, 1fr)` }}>
            {frames.map((f, i) => (
              <button
                key={i}
                className={`pb-cell ${i === state.frame ? 'on' : ''} ${i < state.frame ? 'past' : ''} ${
                  i > 0 && f.day !== frames[i - 1].day ? 'sep' : ''
                }`}
                onClick={() => onChange({ frame: i })}
                title={`${frameTitle(f)} · ${FASCE[f.fascia]}`}
                aria-label={`${frameTitle(f)}, ${FASCE[f.fascia]}`}
              />
            ))}
          </div>
          <div className="pb-ticks" style={{ gridTemplateColumns: `repeat(${groups.length || frames.length}, 1fr)` }}>
            {state.mode === 'periodo'
              ? groups.map((d) => <span key={d}>{fmtDate(d!, { day: 'numeric' })}</span>)
              : frames.map((f) => <span key={f.fascia}>{FASCE[f.fascia]}</span>)}
          </div>
        </div>

        <button
          className="pb-speed"
          onClick={() => onChange({ speed: SPEEDS[(SPEEDS.indexOf(state.speed) + 1) % SPEEDS.length] })}
          title="Velocità"
        >
          {state.speed}×
        </button>
        <button className="pb-close" onClick={() => onChange({ open: false, playing: false })} aria-label="Chiudi playback" title="Chiudi">
          ✕
        </button>
      </div>
    </>
  )
}
