# CiSta — MVP

Planner di casa gratuito: disegni la pianta (o parti da un modello), la vedi in 3D, e per ogni mobile il sito
ti dice **quali prodotti reali ci stanno davvero**, con il motivo quando non ci stanno. Le uscite verso i negozi
usano link di affiliazione dove esiste un programma.

Niente intelligenza artificiale generativa nel flusso gratuito: la compatibilità è calcolata da un motore
deterministico (`src/model/compat.ts`) su misure, muri, aperture, ostacoli in alto e zone d'uso.

## Avvio locale

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # test unitari (motore, parser misure, geometria, importazione)
npm run build && npm run e2e   # test end-to-end con Playwright
```

## Catalogo prodotti

Il catalogo è `data/seed-products.json`, generato da `npm run seed` a partire da:

- `data/sources/*.json` — prodotti raccolti a mano nella sessione di progettazione (IKEA, Leroy Merlin, Amazon);
- `data/imported/*.json` — prodotti dai feed ufficiali (non versionati).

Non si fa scraping: i dati arrivano da feed di affiliazione o da file curati a mano.

| Comando | Cosa fa | Serve |
|---|---|---|
| `npm run import:awin` | scarica i feed Awin dei negozi a cui sei iscritto (Leroy Merlin ES/IT, Conforama, ManoMano…) | `AWIN_FEED_API_KEY`, `AWIN_ADVERTISER_IDS` |
| `npm run import:awin -- --fixture data/fixtures/awin-sample.csv` | prova offline con dati finti | — |
| `npm run import:csv -- file.csv` | importa un CSV generico (retailer, sku, title, url, price, w, d, h, dims) | — |
| `npm run import:amazon -- --asins file.csv` | elenco ASIN curato a mano (la Creators API richiede un account approvato) | — |
| `npm run dims:llm -- --enable` | **opzionale**: misure via LLM per i prodotti «da rivedere», con limite di spesa | `ANTHROPIC_API_KEY` |
| `npm run seed` | unisce tutto nel catalogo del sito | — |

Le misure con fiducia < 0,8 compaiono nella pagina `#revisione`, dove si correggono a mano.

## Variabili d'ambiente

Copia `.env.example` in `.env`. Le variabili `VITE_*` finiscono nel sito (sono pubbliche: ID di affiliazione,
non segreti); le altre restano negli script. Nessuna credenziale va nel repository.

## Pubblicazione

`npm run build` produce un sito statico in `dist/` (qualsiasi hosting statico). `npm run build:artifact` produce
un unico file HTML in `dist-artifact/` per l'anteprima.

## Limiti noti

- Le schede importate dalla sessione non hanno foto; arriveranno con i feed.
- IKEA non ha un programma di affiliazione pubblico: i link IKEA sono normali.
- Leroy Merlin (Awin) e Amazon richiedono l'iscrizione ai rispettivi programmi prima che i link siano tracciati.
- L'integrazione con la Creators API di Amazon è predisposta ma non implementata finché l'account non ha accesso.
- Le analisi sono salvate nel browser e, se configurato, inviate a `VITE_ANALYTICS_URL` (nessun servizio di terze parti).

Documenti di progetto in `docs/` (matrice concorrenti, checklist di parità, differenziatori, ADR).
