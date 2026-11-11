# ADR-002 — Sito statico (Vite + React) invece di Next.js

**Stato:** accettato · novembre 2026

## Contesto
Il prompt consigliava Next.js con route handler per catalogo, redirect di affiliazione e metriche, ammettendo alternative motivate.

## Decisione
**Vite + React + TypeScript, sito statico** con routing nell'hash (`#demo`, `#editor`, `#lista`, …).
- Planimetria, 3D, catalogo e compatibilità girano nel browser: nessun server da pagare per utente.
- Il catalogo è un JSON generato da script (`npm run seed`, `npm run import:awin`, …) eseguiti a parte, anche in un cron di CI.
- I clic verso i negozi sono tracciati lato client (evento `outbound_click`) e il link porta direttamente al negozio con i parametri di affiliazione; per un redirect lato server basta aggiungere una funzione serverless `/go/:id` che legga lo stesso JSON.
- Le metriche sono salvate in locale e, se configurato `VITE_ANALYTICS_URL`, inviate a un endpoint (Plausible/PostHog self-hosted).

## Conseguenze
- Il sito si pubblica su qualsiasi hosting statico (Netlify, Vercel, GitHub Pages, S3) e come anteprima.
- Condivisione dei progetti: link con il progetto compresso nell'hash; il salvataggio su account richiederà un backend (fase 2).
- La pagina di revisione delle misure salva le correzioni in locale ed esporta un JSON da reimportare nel catalogo.
