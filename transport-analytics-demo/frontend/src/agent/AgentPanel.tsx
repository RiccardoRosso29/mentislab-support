import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Filters, Livello, Meta, Selection } from '../api'
import AgentVisual from './AgentVisual'
import { TOOL_LABEL, describeFilters, runTool, type ToolContext, type Visual } from './tools'

const MAX_TURNI = 10 // chiamate al modello per una singola domanda

type Part = { type: 'text'; text: string } | { type: 'visual'; v: Visual } | { type: 'step'; label: string; done: boolean }
type Msg = { role: 'user'; text: string } | { role: 'assistant'; parts: Part[]; error?: string }
// elementi della conversazione nel formato della Responses API (inclusi i ragionamenti cifrati)
type Item = Record<string, unknown>

const SUGGERIMENTI = [
  'Quali sono le relazioni principali e come cambiano nel fine settimana?',
  'Confronta il profilo orario di Torino con la media dell’area',
  'Quali comuni attraggono più spostamenti casa → lavoro?',
  'Mostrami sulla mappa i flussi serali in partenza da Novara',
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
          body: JSON.stringify({ input: conv }),
          signal: ctrl.signal,
        })
        const data = await res.json().catch(() => ({ error: `Risposta non valida dal server (${res.status})` }))
        if (!res.ok || data.error) throw new Error(data.error || `Errore ${res.status}`)
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
          const label = TOOL_LABEL[name] ?? name
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
      const err = (e as Error).name === 'AbortError' ? 'Risposta interrotta.' : (e as Error).message
      updateLast((m) => {
        m.error = err
      })
      setItems(conv.filter((it) => it.type !== 'function_call' || conv.some((o) => o.type === 'function_call_output' && o.call_id === it.call_id)))
    } finally {
      setBusy(false)
      abort.current = null
    }
  }

  const reset = () => {
    abort.current?.abort()
    setMsgs([])
    setItems([])
    inputRef.current?.focus()
  }

  return (
    <aside className="ag" aria-label="Assistente analitico">
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
            <h2>Assistente analitico</h2>
            <span>Domande sui dati della dashboard</span>
          </div>
        </div>
        <div className="ag-actions">
          <button onClick={reset} disabled={!msgs.length} title="Nuova conversazione" aria-label="Nuova conversazione">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
          <button onClick={onClose} title="Chiudi" aria-label="Chiudi assistente">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
      </header>

      <div className="ag-body" ref={scroller}>
        {msgs.length === 0 ? (
          <div className="ag-empty">
            <p>
              Chiedimi analisi sui flussi, confronti tra zone, profili dei viaggiatori o andamenti nel tempo. Posso creare grafici e tabelle e
              aggiornare la mappa. Uso i filtri attivi, se non mi chiedi diversamente.
            </p>
            <div className="ag-sugg">
              {SUGGERIMENTI.map((s) => (
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
                  <div className="ag-thinking" aria-label="L’assistente sta elaborando">
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
        <textarea
          id="ag-question"
          ref={inputRef}
          rows={2}
          placeholder="Fai una domanda sui dati…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              ask(text)
            }
          }}
        />
        {busy ? (
          <button type="button" className="ag-send stop" onClick={() => abort.current?.abort()} aria-label="Interrompi">
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden>
              <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
            </svg>
          </button>
        ) : (
          <button type="submit" className="ag-send" disabled={!text.trim()} aria-label="Invia">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </button>
        )}
      </form>
      <p className="ag-foot">Risposte generate da un modello di IA (gpt-6.1-terra) sui dati aggregati e anonimizzati: verifica i risultati importanti.</p>
    </aside>
  )
}
