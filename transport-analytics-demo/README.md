# Mobility Analytics — demo matrice Origine/Destinazione

Demo funzionante di un prodotto di *transport analytics* costruito sull'estrazione OD del Piemonte
(15–28 giugno 2026, ~14,8 M righe, ~74 M spostamenti). Interfaccia coerente con la Smart Data Platform:

- **in alto**: filtri su giorno della settimana, fascia oraria, origine, destinazione (province o comuni),
  motivo dello spostamento (Casa/Lavoro/Altro in origine → destinazione), genere, età, nazionalità, tipologia;
- **a sinistra**: pannello scorrevole con KPI, andamento giornaliero, media per giorno della settimana,
  fasce orarie, matrice dei motivi, genere, età × genere, profilo dei viaggiatori, principali relazioni OD;
- **a destra**: mappa dei flussi.
  - clic su una **zona** → solo i flussi in uscita (arancio) e in ingresso (viola) da quella zona, con il bilancio uscita/ingresso/interni;
  - clic su un **flusso** → solo la relazione tra le due zone, nelle due direzioni;
  - `Esc` o ✕ per tornare alla vista completa; zonizzazione Comuni / Province; numero di flussi mostrati configurabile.

Tutto lo stato (filtri, selezione, livello) è nell'URL: ogni vista è condivisibile.

## Architettura

```
GCS gs://transport_analytics            openpolis/geojson-italy
  estrazione_*.csv (2 GB)                 confini comuni / province
        │                                          │
        ▼  pipeline/fetch_data.py                  ▼
  data/raw/  ───────────────►  pipeline/build_warehouse.py
                                  │  tipizzazione (ENUM), ACE → comune, aggregazione
                                  ▼
                 data/warehouse.duckdb (61 MB)  +  data/geo/*.geojson (semplificati)
                                  │
                                  ▼
          backend/  FastAPI + DuckDB (read-only, cache LRU)      ~20–250 ms / query
            GET /api/meta    anagrafiche zone, periodo, fasce
            GET /api/stats   tutti i grafici del pannello (una scansione, GROUPING SETS)
            GET /api/flows   nodi + top-N relazioni OD per la mappa
                                  │
                                  ▼
          frontend/ React + TypeScript + deck.gl/MapLibre + ECharts
```

Scelte pensate per avvicinarsi a un prodotto reale:

- **Pipeline separata dal serving**: la stessa estrazione BigQuery → GCS alimenta un warehouse ricostruibile
  in ~10 s. Per passare a BigQuery/ClickHouse in produzione si sostituisce solo `backend/app/queries.py`;
  API e frontend non cambiano.
- **Metriche definite una volta sola** (lato API): medie giornaliere calcolate sui giorni di calendario
  coerenti con il filtro sul giorno della settimana.
- **Filtri validati e query parametriche** (nessuna concatenazione di input utente nell'SQL).
- **Container unico** che serve API e frontend statico; dati montati come volume read-only.

## Avvio rapido

Prerequisiti: Python 3.11+, Node 20+, una chiave di service account con ruolo *Storage Object Viewer*
sul bucket (non va mai committata nel repository).

```bash
make install
export GOOGLE_APPLICATION_CREDENTIALS=/percorso/chiave.json
make data warehouse      # scarica ~2 GB e costruisce data/warehouse.duckdb
make run                 # http://localhost:8000
```

Sviluppo con hot reload: `make dev-api` e, in un altro terminale, `make dev-web` (http://localhost:5173).

Con Docker:

```bash
GCP_KEY_FILE=/percorso/chiave.json make docker-data
make docker-up           # http://localhost:8000
```

## Versione statica (senza server)

`make static` produce in `frontend/dist-static/` una versione che non richiede backend: il dataset completo
è esportato in colonne binarie compresse (~21 MB, `pipeline/export_static.py`) e un Web Worker
(`frontend/src/local/engine.worker.ts`) riproduce nel browser le stesse risposte di `/api/stats` e `/api/flows`
(caricamento ~4 s, aggiornamento < 1 s). È la versione pubblicata come Artifact; si può ospitare su qualunque
hosting statico. Senza server la mappa di base Carto non viene caricata: restano i confini di comuni e province.

## Note sui dati

- **Zone**: in Piemonte le zone sono ACE (aree subcomunali per ~40 comuni maggiori, es. Torino ha 57 ACE),
  fuori regione sono province. Non avendo le geometrie ACE, la mappa lavora a livello **comune** (le ACE sono
  ricondotte al comune) e **provincia**. Gli spostamenti tra ACE dello stesso comune risultano "interni" al comune.
  Aggiungendo le geometrie ACE all'estrazione (opzione `wkt` del job) si può abilitare un terzo livello.
- **Motivo**: `motivo_visita_origine/destinazione` indica il rapporto del viaggiatore con il luogo
  (residente → *Casa*, lavoratore → *Lavoro*, visitatore → *Altro*). Es. *Casa → Lavoro* = residente in origine
  e lavoratore in destinazione.
- **Genere/età N/D** corrispondono ai viaggiatori con nazionalità internazionale (nessun profilo sociodemografico).
- Cinque codici di province sarde soppresse (090, 091, 092, 095, 111) sono ricondotti alle province attuali.
- I valori `n_spostamenti` sono stime con decimali: in interfaccia sono arrotondati.

## Struttura

```
pipeline/   fetch_data.py, build_warehouse.py
backend/    app/main.py (API), app/filters.py (validazione filtri), app/queries.py (SQL)
frontend/   src/App.tsx, src/components/{FilterBar,Sidebar,FlowMap,Charts,MultiSelect}.tsx
data/       (ignorata da git) raw/, geo_src/, geo/, warehouse.duckdb
```
