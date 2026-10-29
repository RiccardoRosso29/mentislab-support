import { useEffect, useState } from 'react'
import { getJSON } from './api'

/** Fetch con annullamento delle richieste superate e debounce leggero sui cambi di filtro. */
export function useApi<T>(url: string | null, debounceMs = 120) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!url) return
    const ctrl = new AbortController()
    setLoading(true)
    const timer = setTimeout(() => {
      getJSON<T>(url, ctrl.signal)
        .then((d) => {
          setData(d)
          setError(null)
          setLoading(false)
        })
        .catch((e: Error) => {
          if (e.name === 'AbortError') return
          setError(e.message)
          setLoading(false)
        })
    }, debounceMs)
    return () => {
      clearTimeout(timer)
      ctrl.abort()
    }
  }, [url, debounceMs])

  return { data, loading, error }
}

export function useClickOutside(ref: React.RefObject<HTMLElement>, onOutside: () => void, active: boolean) {
  useEffect(() => {
    if (!active) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [ref, onOutside, active])
}
