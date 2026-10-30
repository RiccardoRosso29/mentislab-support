import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Filters, Livello, Meta, Selection } from '../api'
import AgentVisual from './AgentVisual'
import { useDictation } from './dictation'
import { deleteChat, loadChats, newChatId, relTime, saveChat, type SavedChat } from './history'
import { TOOL_LABEL, describeFilters, runTool, type ToolContext, type Visual } from './tools'
import { getLang, t as tr } from '../settings'

const MAX_TURNI = 10 // chiamate al modello per una singola domanda
// dimensioni della finestra: minime per restare leggibile; la cronologia si affianca oltre HIST_MIN
const W_MIN = 360
const H_MIN = 420
const HIST_MIN = 700
const SIZE_KEY = 'ma-size'

type Part = { type: 'text'; text: string } | { type: 'visual'; v: Visual } | { type: 'step'; label: string; done: boolean }
type Msg = { role: 'user'; text: string } | { role: 'assistant'; parts: Part[]; error?: string }
// elementi della conversazione nel formato della Responses API (inclusi i ragionamenti cifrati)
type Item = Record<string, unknown>

const suggerimenti = () => [
  tr('Quali sono le relazioni principali e come cambiano nel fine settimana?', 'What are the main relations and how do they change at the weekend?'),
  tr('Confronta il profilo orario di Torino con la media dell’area', 'Compare the time-of-day profile of Torino with the area average'),
  tr('Quali comuni attraggono più spostamenti casa → lavoro?', 'Which municipalities attract the most home → work trips?'),
  tr('Mostrami sulla mappa i flussi serali in partenza da Novara', 'Show me on the map the evening flows departing from Novara'),
]

/** Formattazione minima del testo del modello: paragrafi, elenchi puntati e grassetto. */
function RichText({ text }: { text: string }) {
  const bold = (s: string): ReactNode[] => s.split(/(\*\*[^*]+\*\*)/g).map((t, i) => (t.startsWith('**') && t.endsWith('**') ? <b key={i}>{t.slice(2, -2)}</b> : <Fragment key={i}>{t}</Fragment>))
  const blocks: ReactNode[] = []
  let list: string[] = []
  const flush = () => {
    if (list.length) blocks.push(<ul key={blocks.length}>{list.map((l, i) => <li key={i}>{bold(l)}</li>)}</ul>)
    list = []
  }
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (/^[-*•]\s+/.test(line)) list.push(line.replace(/^[-*•]\s+/, ''))
    else {
      flush()
      if (line) blocks.push(<p key={blocks.length}>{bold(line.replace(/^#+\s*/, ''))}</p>)
    }
  }
  flush()
  return <div className="ag-text">{blocks}</div>
}

interface Props {
  meta: Meta
  livello: Livello
  filters: Filters
  selection: Selection
  nameOf: (id: number) => string
  apply: ToolContext['apply']
  onClose: () => void
}

export default function AgentPanel({ meta, livello, filters, selection, nameOf, apply, onClose }: Props) {
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [chatId, setChatId] = useState(newChatId)
  const [chats, setChats] = useState<SavedChat[]>(loadChats)
  const [histOpen, setHistOpen] = useState(false)
  const [size, setSize] = useState<{ w: number; h: number }>(() => {
    try {
      const v = JSON.parse(localStorage.getItem(SIZE_KEY) ?? 'null')
      if (v && v.w >= W_MIN && v.h >= H_MIN) return v
    } catch {
      /* dimensioni predefinite */
    }
    return { w: 460, h: 640 }
  })
  const panel = useRef<HTMLElement>(null)

  // dettatura: il testo trascritto si aggiunge alla domanda, che l'utente può rivedere prima di inviare
  const dict = useDictation((t) => {
    setText((cur) => (cur.trim() ? `${cur.trimEnd()} ${t}` : t))
    requestAnimationFrame(() => {
      const el = inputRef.current
      if (el) {
        el.focus()
        el.setSelectionRange(el.value.length, el.value.length)
      }
    })
  })
  useEffect(() => {
    if (dict.state !== 'recording') return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        dict.cancel()
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        dict.stop()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [dict.state, dict.cancel, dict.stop])
  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  // ultima versione di messaggi e conversazione, per salvarle a fine risposta
  const latest = useRef<{ msgs: Msg[]; items: Item[] }>({ msgs: [], items: [] })
  latest.current = { msgs, items }
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const abort = useRef<AbortController | null>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // stato corrente della dashboard sempre disponibile agli strumenti, anche dopo che l'agente lo ha cambiato
  const state = useRef({ livello, filters, selection })
  state.current = { livello, filters, selection }

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' })
  }, [msgs])
  useEffect(() => inputRef.current?.focus(), [])

  // il campo di testo parte da una riga e cresce con il contenuto fino a circa 7 righe, poi scorre
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(160, el.scrollHeight + 2)}px`
  }, [text, dict.state])

  const contesto = () => {
    const s = state.current
    const sel =
      s.selection?.type === 'nodo'
        ? `zona selezionata ${nameOf(s.selection.id)} (id ${s.selection.id})`
        : s.selection?.type === 'link'
          ? `relazione selezionata ${nameOf(s.selection.a)} ⇄ ${nameOf(s.selection.b)} (id ${s.selection.a}, ${s.selection.b})`
          : 'nessuna selezione sulla mappa'
    return `[Stato della dashboard: zonizzazione ${s.livello}; filtri: ${describeFilters(s.filters, meta)}; ${sel}]`
  }

  const updateLast = (fn: (m: Extract<Msg, { role: 'assistant' }>) => void) =>
    setMsgs((cur) => {
      const next = [...cur]
      const last = { ...(next[next.length - 1] as Extract<Msg, { role: 'assistant' }>) }
      last.parts = [...last.parts]
      fn(last)
      next[next.length - 1] = last
      return next
    })

  const ask = async (question: string) => {
    const q = question.trim()
    if (!q || busy) return
    setText('')
    setBusy(true)
    setMsgs((m) => [...m, { role: 'user', text: q }, { role: 'assistant', parts: [] }])
    const ctrl = new AbortController()
    abort.current = ctrl
    let conv: Item[] = [...items, { role: 'user', content: `${contesto()}\n\n${q}` }]

    const ctx: ToolContext = {
      meta,
      get livello() {
        return state.current.livello
      },
      get filters() {
        return state.current.filters
      },
      get selection() {
        return state.current.selection
      },
      apply: (s) => {
        apply(s)
        state.current = { ...state.current, ...(s.filters ? { filters: s.filters } : {}), ...(s.livello ? { livello: s.livello } : {}), ...('selection' in s ? { selection: s.selection ?? null } : {}) }
      },
      show: (v) => updateLast((m) => m.parts.push({ type: 'visual', v })),
    }

    try {
      for (let turno = 0; turno < MAX_TURNI; turno++) {
        const res = await fetch('api/agent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ input: conv, lang: getLang() }),
          signal: ctrl.signal,
        })
        const data = await res.json().catch(() => ({ error: `${tr('Risposta non valida dal server', 'Invalid response from the server')} (${res.status})` }))
        if (!res.ok || data.error) throw new Error(data.error || `${tr('Errore', 'Error')} ${res.status}`)
        const output = (data.output ?? []) as Item[]
        conv = [...conv, ...output]

        for (const it of output)
          if (it.type === 'message') {
            const t = ((it.content as { type: string; text?: string }[]) ?? []).filter((c) => c.type === 'output_text').map((c) => c.text).join('\n')
            if (t.trim()) updateLast((m) => m.parts.push({ type: 'text', text: t }))
          }

        const calls = output.filter((it) => it.type === 'function_call')
        if (!calls.length) break
        for (const c of calls) {
          const name = String(c.name)
          const label = TOOL_LABEL[name] ? tr(...TOOL_LABEL[name]) : name
          updateLast((m) => m.parts.push({ type: 'step', label, done: false }))
          let result: unknown
          try {
            result = await runTool(name, JSON.parse(String(c.arguments || '{}')), ctx)
          } catch (e) {
            result = { errore: (e as Error).message }
          }
          updateLast((m) => {
            const i = m.parts.findIndex((p) => p.type === 'step' && p.label === label && !p.done)
            if (i >= 0) m.parts[i] = { type: 'step', label, done: true }
          })
          conv = [...conv, { type: 'function_call_output', call_id: c.call_id, output: JSON.stringify(result) }]
        }
      }
      setItems(conv)
    } catch (e) {
      const err = (e as Error).name === 'AbortError' ? tr('Risposta interrotta.', 'Response interrupted.') : (e as Error).message
      updateLast((m) => {
        m.error = err
      })
      setItems(conv.filter((it) => it.type !== 'function_call' || conv.some((o) => o.type === 'function_call_output' && o.call_id === it.call_id)))
    } finally {
      setBusy(false)
      abort.current = null
    }
  }

  // a fine risposta la conversazione entra in cronologia (titolo = prima domanda)
  const wasBusy = useRef(false)
  useEffect(() => {
    const finished = wasBusy.current && !busy
    wasBusy.current = busy
    if (!finished || !latest.current.msgs.length) return
    const first = latest.current.msgs.find((m) => m.role === 'user') as { text: string } | undefined
    setChats(saveChat({ id: chatId, title: (first?.text ?? tr('Conversazione', 'Conversation')).slice(0, 80), updated: Date.now(), msgs: latest.current.msgs, items: latest.current.items }))
  }, [busy, chatId])

  const reset = () => {
    abort.current?.abort()
    setMsgs([])
    setItems([])
    setChatId(newChatId())
    setHistOpen(false)
    inputRef.current?.focus()
  }

  const openChat = (c: SavedChat) => {
    if (busy) return
    setMsgs(c.msgs as Msg[])
    setItems(c.items as Item[])
    setChatId(c.id)
    setHistOpen(false)
  }

  // ridimensionamento dal bordo sinistro (larghezza), superiore (altezza) o dall'angolo
  const startResize = (dir: 'w' | 'h' | 'wh') => (e: React.PointerEvent) => {
    e.preventDefault()
    const parent = panel.current?.parentElement?.getBoundingClientRect()
    const maxW = (parent?.width ?? 1200) - 32
    const maxH = (parent?.height ?? 900) - 32
    const x0 = e.clientX
    const y0 = e.clientY
    const s0 = size
    const move = (ev: PointerEvent) =>
      setSize({
        w: dir === 'h' ? s0.w : Math.min(maxW, Math.max(W_MIN, s0.w + x0 - ev.clientX)),
        h: dir === 'w' ? s0.h : Math.min(maxH, Math.max(H_MIN, s0.h + y0 - ev.clientY)),
      })
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      document.body.classList.remove('resizing-any')
    }
    document.body.classList.add('resizing-any')
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }
  useEffect(() => {
    try {
      localStorage.setItem(SIZE_KEY, JSON.stringify(size))
    } catch {
      /* solo per la sessione */
    }
  }, [size])

  const wide = size.w >= HIST_MIN
  const history = (
    <nav className={`ag-hist ${wide ? 'side' : 'overlay'}`} aria-label={tr('Cronologia delle conversazioni', 'Conversation history')}>
      <button className="ag-hist-new" onClick={reset}>
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <path d="M12 5v14M5 12h14" />
        </svg>
        {tr('Nuova conversazione', 'New conversation')}
      </button>
      <span className="ag-hist-label">{tr('Cronologia', 'History')}</span>
      {chats.length === 0 && <p className="ag-hist-empty">{tr('Le conversazioni compariranno qui.', 'Conversations will appear here.')}</p>}
      <ul>
        {chats.map((c) => (
          <li key={c.id} className={c.id === chatId ? 'on' : ''}>
            <button className="ag-hist-item" onClick={() => openChat(c)} title={c.title}>
              <span>{c.title}</span>
              <small>{relTime(c.updated)}</small>
            </button>
            <button
              className="ag-hist-del"
              onClick={() => {
                setChats(deleteChat(c.id))
                if (c.id === chatId) reset()
              }}
              aria-label={tr('Elimina conversazione', 'Delete conversation')}
              title={tr('Elimina', 'Delete')}
            >
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )

  return (
    <aside className={`ag ${wide ? 'wide' : ''}`} aria-label="Mobility Agent" ref={panel} style={{ width: size.w, height: size.h }}>
      <div className="ag-rz w" onPointerDown={startResize('w')} aria-hidden />
      <div className="ag-rz h" onPointerDown={startResize('h')} aria-hidden />
      <div className="ag-rz wh" onPointerDown={startResize('wh')} aria-hidden />
      <header className="ag-head">
        <div className="ag-title">
          <span className="ag-avatar" aria-hidden>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v3M5 10a7 7 0 0 1 14 0v5a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3z" />
              <circle cx="9.5" cy="12.5" r="1" fill="currentColor" />
              <circle cx="14.5" cy="12.5" r="1" fill="currentColor" />
            </svg>
          </span>
          <div>
            <h2>Mobility Agent</h2>
            <span>{tr('Analisi sui dati della dashboard', 'Analysis of the dashboard data')}</span>
          </div>
        </div>
        <div className="ag-actions">
          {!wide && (
            <button onClick={() => setHistOpen((o) => !o)} className={histOpen ? 'on' : ''} title={tr('Cronologia', 'History')} aria-label={tr('Cronologia delle conversazioni', 'Conversation history')} aria-expanded={histOpen}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5M12 8v4l3 2" />
              </svg>
            </button>
          )}
          <button onClick={reset} disabled={!msgs.length} title={tr('Nuova conversazione', 'New conversation')} aria-label={tr('Nuova conversazione', 'New conversation')}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
          <button onClick={onClose} title={tr('Chiudi', 'Close')} aria-label={tr('Chiudi assistente', 'Close assistant')}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
      </header>

      <div className="ag-main">
      {(wide || histOpen) && history}
      <div className="ag-chat">
      <div className="ag-body" ref={scroller}>
        {msgs.length === 0 ? (
          <div className="ag-empty">
            <p>
              {tr(
                'Chiedimi analisi sui flussi, confronti tra zone, profili dei viaggiatori o andamenti nel tempo. Posso creare grafici e tabelle e aggiornare la mappa. Uso i filtri attivi, se non mi chiedi diversamente.',
                'Ask me for flow analyses, comparisons between zones, traveller profiles or trends over time. I can create charts and tables and update the map. I use the active filters unless you ask otherwise.',
              )}
            </p>
            <div className="ag-sugg">
              {suggerimenti().map((s) => (
                <button key={s} onClick={() => ask(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          msgs.map((m, i) =>
            m.role === 'user' ? (
              <div key={i} className="ag-msg user">
                {m.text}
              </div>
            ) : (
              <div key={i} className="ag-msg bot">
                {m.parts.map((p, j) =>
                  p.type === 'text' ? (
                    <RichText key={j} text={p.text} />
                  ) : p.type === 'visual' ? (
                    <AgentVisual key={j} v={p.v} />
                  ) : (
                    <div key={j} className={`ag-step ${p.done ? 'done' : ''}`}>
                      {p.done ? (
                        <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden>
                          <path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      ) : (
                        <span className="xp-spin" />
                      )}
                      {p.label}
                    </div>
                  ),
                )}
                {busy && i === msgs.length - 1 && !m.parts.some((p) => p.type === 'step' && !p.done) && (
                  <div className="ag-thinking" aria-label={tr('L’assistente sta elaborando', 'The assistant is working')}>
                    <i />
                    <i />
                    <i />
                  </div>
                )}
                {m.error && <p className="ag-error">{m.error}</p>}
              </div>
            ),
          )
        )}
      </div>

      <form
        className="ag-input"
        onSubmit={(e) => {
          e.preventDefault()
          ask(text)
        }}
      >
        {dict.state === 'recording' ? (
          <div className="ag-rec" role="status" aria-live="polite">
            <span className="ag-rec-dot" aria-hidden />
            <span className="ag-rec-label">{tr('In ascolto', 'Listening')}</span>
            <span className="ag-rec-wave" aria-hidden>
              {[0.55, 0.8, 1, 0.7, 0.9, 0.6, 0.85].map((k, i) => (
                <i key={i} style={{ transform: `scaleY(${0.15 + Math.min(1, dict.level * k * 1.6)})` }} />
              ))}
            </span>
            <span className="ag-rec-time">{mmss(dict.seconds)}</span>
            <button type="button" className="ag-rec-btn" onClick={dict.cancel} title={tr('Annulla (Esc)', 'Cancel (Esc)')} aria-label={tr('Annulla la dettatura', 'Cancel dictation')}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
            <button type="button" className="ag-rec-btn ok" onClick={dict.stop} title={tr('Termina e trascrivi (Invio)', 'Stop and transcribe (Enter)')} aria-label={tr('Termina e trascrivi', 'Stop and transcribe')}>
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="m5 12.5 4.5 4.5L19 7.5" />
              </svg>
            </button>
          </div>
        ) : (
          <div className="ag-field">
            <textarea
              id="ag-question"
              ref={inputRef}
              rows={1}
              placeholder={dict.state === 'transcribing' ? tr('Trascrizione in corso…', 'Transcribing…') : tr('Fai una domanda sui dati…', 'Ask a question about the data…')}
              value={text}
              disabled={dict.state === 'transcribing'}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  ask(text)
                }
              }}
            />
            {dict.supported && (
              <button
                type="button"
                className={`ag-mic ${dict.state === 'transcribing' ? 'busy' : ''}`}
                onClick={dict.start}
                disabled={busy || dict.state !== 'idle'}
                title={tr('Detta la domanda', 'Dictate your question')}
                aria-label={tr('Detta la domanda', 'Dictate your question')}
              >
                {dict.state === 'transcribing' ? (
                  <span className="xp-spin" />
                ) : (
                  <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <rect x="9" y="3" width="6" height="11" rx="3" />
                    <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
                  </svg>
                )}
              </button>
            )}
          </div>
        )}
        {busy ? (
          <button type="button" className="ag-send stop" onClick={() => abort.current?.abort()} aria-label={tr('Interrompi', 'Stop')}>
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden>
              <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
            </svg>
          </button>
        ) : (
          <button type="submit" className="ag-send" disabled={!text.trim()} aria-label={tr('Invia', 'Send')}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </button>
        )}
      </form>
      {dict.error && (
        <p className="ag-dict-error" role="alert">
          {dict.error}
          <button type="button" onClick={dict.clearError} aria-label={tr('Chiudi', 'Close')}>
            ✕
          </button>
        </p>
      )}
      </div>
      </div>
    </aside>
  )
}
