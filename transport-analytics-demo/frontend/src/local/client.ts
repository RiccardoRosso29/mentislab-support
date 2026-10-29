/** Client del motore nel browser: stessa interfaccia delle API HTTP, risposte da un Web Worker. */

let worker: Worker | null = null
let seq = 0
const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>()

export const isStatic = import.meta.env.VITE_STATIC === '1'

function getWorker() {
  if (worker) return worker
  worker = new Worker(new URL('./engine.worker.ts', import.meta.url), { type: 'module' })
  worker.onmessage = (e: MessageEvent) => {
    const msg = e.data
    if (msg.type === 'progress') {
      window.dispatchEvent(new CustomEvent('engine-progress', { detail: msg.value }))
      return
    }
    const p = pending.get(msg.id)
    if (!p) return
    pending.delete(msg.id)
    if (msg.ok) p.resolve(msg.body)
    else p.reject(new Error(msg.error))
  }
  worker.postMessage({ type: 'init', base: new URL('data/', window.location.href).href })
  return worker
}

export function localApi<T>(url: string, signal?: AbortSignal): Promise<T> {
  const w = getWorker()
  const id = ++seq
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject })
    signal?.addEventListener('abort', () => {
      pending.delete(id)
      reject(new DOMException('Aborted', 'AbortError'))
    })
    w.postMessage({ id, url })
  })
}
