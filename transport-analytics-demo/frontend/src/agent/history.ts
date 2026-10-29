/**
 * Cronologia delle conversazioni del Mobility Agent, salvata nel browser dell'utente (localStorage).
 * È una comodità per singolo utente: se l'archiviazione non è disponibile la chat funziona comunque.
 */

const KEY = 'ma-chats'
const MAX_CHATS = 25

export interface SavedChat {
  id: string
  title: string
  updated: number
  msgs: unknown[]
  /** conversazione nel formato della Responses API, per proseguire la chat con il suo contesto */
  items: unknown[]
}

export function loadChats(): SavedChat[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

function write(chats: SavedChat[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(chats))
    return true
  } catch {
    return false
  }
}

export function saveChat(chat: SavedChat): SavedChat[] {
  const others = loadChats().filter((c) => c.id !== chat.id)
  let chats = [chat, ...others].slice(0, MAX_CHATS)
  // spazio esaurito: si tengono le conversazioni più recenti, poi si rinuncia al contesto completo delle altre
  while (!write(chats) && chats.length > 1) chats = chats.slice(0, -1)
  if (!write(chats)) write([{ ...chat, items: [] }])
  return loadChats()
}

export function deleteChat(id: string): SavedChat[] {
  const chats = loadChats().filter((c) => c.id !== id)
  write(chats)
  return chats
}

export const newChatId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`

export function relTime(ts: number) {
  const d = (Date.now() - ts) / 1000
  if (d < 60) return 'adesso'
  if (d < 3600) return `${Math.floor(d / 60)} min fa`
  if (d < 86400) return `${Math.floor(d / 3600)} h fa`
  return new Date(ts).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
}
