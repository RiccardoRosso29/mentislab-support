/**
 * Estrazione delle misure con un modello linguistico — OPZIONALE, FUORI LINEA, SPENTA DI DEFAULT.
 *
 * Il sito non chiama mai un LLM: questo script lavora solo sul catalogo, per i prodotti che il parser
 * deterministico ha segnato «da rivedere» (dimsConfidence < 0.8). I risultati finiscono in
 * data/cache/llm-dims.json e vengono comunque mostrati nella pagina «Revisione misure» con dimsSource 'llm':
 * nessuna misura del modello viene trattata come verificata senza un controllo umano.
 *
 *   ANTHROPIC_API_KEY=... npm run dims:llm -- --enable [--limit 20]
 *
 * Costo: limite di spesa in LLM_DIMS_BUDGET_USD (predefinito 2 $); lo script si ferma prima di superarlo.
 */
import fs from 'node:fs';
import Anthropic from '@anthropic-ai/sdk';
import type { Product } from '../src/model/types';

const MODEL = process.env.LLM_DIMS_MODEL || 'claude-opus-5-5';
// $ per milione di token (input, output, lettura cache) — aggiornare se cambia il listino
const PRICE = { in: 4, out: 20, cacheRead: 0.2 };
const BUDGET = Number(process.env.LLM_DIMS_BUDGET_USD || 2);
const CACHE = 'data/cache/llm-dims.json';

const SYSTEM = `Estrai le misure di ingombro di un mobile dal testo di una scheda prodotto (italiano o spagnolo).
Regole:
- w = larghezza, d = profondità, h = altezza, tutte in centimetri (converti mm e m).
- Se il testo dà più configurazioni, usa quella del prodotto venduto, chiuso/ripiegato se applicabile.
- open_depth = profondità da aperto per divani letto e letti estraibili, altrimenti null.
- Non inventare: se una misura non c'è, mettila a null e abbassa confidence.
- confidence tra 0 e 1: quanto il testo sostiene esplicitamente ogni misura.`;

const SCHEMA = {
  type: 'object',
  properties: {
    w: { type: ['number', 'null'] },
    d: { type: ['number', 'null'] },
    h: { type: ['number', 'null'] },
    open_depth: { type: ['number', 'null'] },
    confidence: { type: 'number' },
    evidence: { type: 'string', description: 'la frase del testo da cui vengono le misure' },
  },
  required: ['w', 'd', 'h', 'open_depth', 'confidence', 'evidence'],
  additionalProperties: false,
} as const;

type Result = { w: number | null; d: number | null; h: number | null; open_depth: number | null; confidence: number; evidence: string; model: string; at: string };

async function main() {
  const args = process.argv.slice(2);
  if (!args.includes('--enable')) {
    console.log('Estrazione LLM spenta. Aggiungi --enable (e ANTHROPIC_API_KEY) per usarla. Il sito non ne ha bisogno.');
    return;
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Manca ANTHROPIC_API_KEY.');
    process.exit(1);
  }
  const limit = Number(args[args.indexOf('--limit') + 1]) || Infinity;
  const cache: Record<string, Result> = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, 'utf8')) : {};
  const todo = (JSON.parse(fs.readFileSync('data/seed-products.json', 'utf8')) as Product[])
    .filter((p) => p.dimsConfidence < 0.8 && !cache[p.id])
    .slice(0, limit);
  const client = new Anthropic();
  let spent = 0;
  let done = 0;
  for (const p of todo) {
    if (spent >= BUDGET) {
      console.log(`Limite di spesa raggiunto (${spent.toFixed(3)} $ di ${BUDGET} $).`);
      break;
    }
    const text = [p.title, p.dimsText, p.note].filter(Boolean).join('\n');
    try {
      const msg = await client.beta.messages.create({
        model: MODEL,
        max_tokens: 2000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
        output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
        messages: [{ role: 'user', content: `Scheda prodotto (${p.retailer}):\n${text}` }],
      });
      const u = msg.usage;
      spent += ((u.input_tokens ?? 0) * PRICE.in + (u.output_tokens ?? 0) * PRICE.out + (u.cache_read_input_tokens ?? 0) * PRICE.cacheRead + (u.cache_creation_input_tokens ?? 0) * PRICE.in * 1.25) / 1e6;
      if (msg.stop_reason === 'refusal') {
        console.warn(`${p.id}: il modello ha rifiutato, salto.`);
        continue;
      }
      const block = msg.content.find((b) => b.type === 'text');
      if (!block || block.type !== 'text') continue;
      cache[p.id] = { ...(JSON.parse(block.text) as Omit<Result, 'model' | 'at'>), model: msg.model, at: new Date().toISOString() };
      done++;
      console.log(`${p.id}: ${cache[p.id].w}×${cache[p.id].d}×${cache[p.id].h} (fiducia ${cache[p.id].confidence})`);
    } catch (e) {
      if (e instanceof Anthropic.AuthenticationError) {
        console.error('Chiave API non valida.');
        process.exit(1);
      } else if (e instanceof Anthropic.RateLimitError) {
        console.warn('Limite di frequenza: riprova più tardi.');
        break;
      } else if (e instanceof Anthropic.APIError) {
        console.warn(`${p.id}: errore API ${e.status} ${e.message}`);
      } else throw e;
    }
  }
  fs.mkdirSync('data/cache', { recursive: true });
  fs.writeFileSync(CACHE, JSON.stringify(cache, null, 1) + '\n');
  console.log(`${done} prodotti elaborati, spesa stimata ${spent.toFixed(3)} $. Rivedi i risultati nella pagina «Revisione misure».`);
}

main();
