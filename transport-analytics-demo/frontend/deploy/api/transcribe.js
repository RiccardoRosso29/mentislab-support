// Vercel Function: dettatura vocale per Mobility Agent.
// Riceve l'audio registrato nel browser e lo trascrive con OpenAI (punteggiatura inclusa), senza conservarlo.

const MODELS = ['gpt-4o-transcribe', 'whisper-1'] // il secondo solo se il primo non è disponibile
const MAX_BYTES = 4_000_000 // ~4 minuti di audio Opus; il limite di Vercel per il corpo della richiesta è 4,5 MB
const TIPI = ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/x-m4a']

// contesto per il modello: lingua, stile e vocabolario del dominio
const PROMPT_EN =
  'Question in English to a mobility analytics assistant for Piedmont, Italy, with correct punctuation. ' +
  'Frequent terms: trips, origin, destination, OD matrix, flows, ACE, ISTAT, municipalities, provinces, ' +
  'Torino, Novara, Cuneo, Alessandria, Asti, Biella, Vercelli, Verbania, time slot, commuters, home-to-work, weekend.'
const PROMPT =
  'Domanda in italiano a un assistente di analisi della mobilità in Piemonte, con punteggiatura corretta. ' +
  'Termini frequenti: spostamenti, origine, destinazione, matrice OD, flussi, ACE, ISTAT, comuni, province, ' +
  'Torino, Novara, Cuneo, Alessandria, Asti, Biella, Vercelli, Verbania, fascia oraria, pendolari, casa-lavoro, weekend.'

export const config = { api: { bodyParser: false } }

function originAllowed(req) {
  const origin = req.headers.origin || ''
  const host = req.headers['x-forwarded-host'] || req.headers.host || ''
  if (!origin) return true
  try {
    const o = new URL(origin)
    return o.host === host || (o.hostname.endsWith('.vercel.app') && /^(transport|trip)-analytics/.test(o.hostname))
  } catch {
    return false
  }
}

async function readBody(req) {
  const chunks = []
  let size = 0
  for await (const c of req) {
    size += c.length
    if (size > MAX_BYTES) throw Object.assign(new Error('Registrazione troppo lunga'), { status: 413 })
    chunks.push(c)
  }
  return Buffer.concat(chunks)
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo non consentito' })
  if (!originAllowed(req)) return res.status(403).json({ error: 'Origine non consentita' })
  const key = process.env.OPENAI_API_KEY_TRIP
  if (!key) return res.status(500).json({ error: 'Chiave OpenAI non configurata sul server' })

  const type = String(req.headers['content-type'] || '').split(';')[0].trim()
  if (!TIPI.includes(type)) return res.status(415).json({ error: `Formato audio non supportato (${type || 'sconosciuto'})` })

  let audio
  try {
    audio = await readBody(req)
  } catch (e) {
    return res.status(e.status || 400).json({ error: e.message })
  }
  if (audio.length < 1000) return res.status(400).json({ error: 'Registrazione vuota o troppo breve' })

  const en = new URL(req.url, 'http://x').searchParams.get('lang') === 'en'
  const ext = type.split('/')[1].replace('x-', '').replace('mpeg', 'mp3')
  let last = 'Trascrizione non riuscita'
  for (const model of MODELS) {
    const form = new FormData()
    form.append('file', new Blob([audio], { type }), `dettatura.${ext}`)
    form.append('model', model)
    form.append('language', en ? 'en' : 'it')
    form.append('prompt', en ? PROMPT_EN : PROMPT)
    form.append('response_format', 'json')
    try {
      const r = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}` },
        body: form,
      })
      const data = await r.json()
      if (r.ok) return res.status(200).json({ text: (data.text || '').trim(), model })
      last = data?.error?.message || `Errore OpenAI (${r.status})`
      // modello non disponibile per questo account: si prova il successivo; altri errori si restituiscono subito
      if (r.status !== 404 && r.status !== 400) break
    } catch (e) {
      last = `Servizio di trascrizione non raggiungibile: ${e.message}`
    }
  }
  return res.status(502).json({ error: last })
}
