import { useCallback, useEffect, useRef, useState } from 'react'
import { getLang, t } from '../settings'

/** Durata massima di una dettatura: oltre, la registrazione si chiude e viene trascritta. */
const MAX_SECONDI = 120

export type DictationState = 'idle' | 'recording' | 'transcribing'

/** Formato di registrazione supportato dal browser (Opus in WebM su Chrome/Firefox, MP4 su Safari). */
function pickMime() {
  const opts = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']
  return opts.find((m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) ?? ''
}

/**
 * Dettatura vocale: registra dal microfono e trascrive sul server (api/transcribe), che restituisce testo
 * con punteggiatura. Espone anche il livello audio (0–1) per l'indicatore durante la registrazione.
 */
export function useDictation(onText: (text: string) => void) {
  const [state, setState] = useState<DictationState>('idle')
  const [seconds, setSeconds] = useState(0)
  const [level, setLevel] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const rec = useRef<{ recorder: MediaRecorder; stream: MediaStream; ctx: AudioContext; raf: number; timer: number; cancel: boolean } | null>(null)
  const onTextRef = useRef(onText)
  onTextRef.current = onText

  const supported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined'

  const cleanup = () => {
    const r = rec.current
    if (!r) return
    cancelAnimationFrame(r.raf)
    clearInterval(r.timer)
    r.stream.getTracks().forEach((t) => t.stop())
    r.ctx.close().catch(() => undefined)
    rec.current = null
    setLevel(0)
  }

  const transcribe = async (blob: Blob) => {
    setState('transcribing')
    try {
      const res = await fetch(`api/transcribe?lang=${getLang()}`, { method: 'POST', headers: { 'Content-Type': blob.type.split(';')[0] }, body: blob })
      const data = await res.json().catch(() => ({ error: `${t('Risposta non valida', 'Invalid response')} (${res.status})` }))
      if (!res.ok || data.error) throw new Error(data.error || `${t('Errore', 'Error')} ${res.status}`)
      if (data.text) onTextRef.current(data.text)
      else setError(t('Non ho sentito nulla: riprova parlando più vicino al microfono.', 'I didn’t hear anything: try again speaking closer to the microphone.'))
    } catch (e) {
      setError(`${t('Trascrizione non riuscita', 'Transcription failed')}: ${(e as Error).message}`)
    } finally {
      setState('idle')
    }
  }

  const start = useCallback(async () => {
    if (state !== 'idle') return
    setError(null)
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
    } catch (e) {
      const name = (e as DOMException).name
      setError(
        name === 'NotAllowedError'
          ? t('Accesso al microfono negato: consentilo dalle impostazioni del browser per usare la dettatura.', 'Microphone access denied: allow it in the browser settings to use dictation.')
          : name === 'NotFoundError'
            ? t('Nessun microfono trovato.', 'No microphone found.')
            : t('Microfono non disponibile.', 'Microphone not available.'),
      )
      return
    }
    const mime = pickMime()
    const recorder = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 32000 } : undefined)
    const chunks: Blob[] = []
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data)

    // livello del segnale per l'indicatore visivo
    const ctx = new AudioContext()
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 512
    ctx.createMediaStreamSource(stream).connect(analyser)
    const buf = new Uint8Array(analyser.fftSize)
    const tick = () => {
      analyser.getByteTimeDomainData(buf)
      let sum = 0
      for (const v of buf) sum += ((v - 128) / 128) ** 2
      setLevel(Math.min(1, Math.sqrt(sum / buf.length) * 4))
      if (rec.current) rec.current.raf = requestAnimationFrame(tick)
    }

    const t0 = Date.now()
    const timer = window.setInterval(() => {
      const s = Math.floor((Date.now() - t0) / 1000)
      setSeconds(s)
      if (s >= MAX_SECONDI && recorder.state === 'recording') recorder.stop()
    }, 250)

    recorder.onstop = () => {
      const cancelled = rec.current?.cancel
      cleanup()
      if (cancelled) {
        setState('idle')
        return
      }
      transcribe(new Blob(chunks, { type: recorder.mimeType || mime || 'audio/webm' }))
    }

    rec.current = { recorder, stream, ctx, raf: requestAnimationFrame(tick), timer, cancel: false }
    setSeconds(0)
    setState('recording')
    recorder.start(250)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  /** Chiude la registrazione e avvia la trascrizione. */
  const stop = useCallback(() => {
    if (rec.current?.recorder.state === 'recording') rec.current.recorder.stop()
  }, [])

  /** Annulla senza trascrivere. */
  const cancel = useCallback(() => {
    if (!rec.current) return
    rec.current.cancel = true
    if (rec.current.recorder.state === 'recording') rec.current.recorder.stop()
    else cleanup()
  }, [])

  useEffect(() => () => cancel(), [cancel])

  return { supported, state, seconds, level, error, clearError: () => setError(null), start, stop, cancel }
}
