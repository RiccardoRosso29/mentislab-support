# Smart Data Platform — video promozionale

Video animato di ~30 secondi (1920×1080, 30 fps) che presenta la **Smart Data Platform**,
la piattaforma di mobility analytics di **WindTre Business × CKDelta**. Realizzato con [Remotion](https://www.remotion.dev).

Video renderizzato: [`out/smart-data-platform.mp4`](out/smart-data-platform.mp4)

## Scaletta

| # | Scena | Contenuto |
|---|-------|-----------|
| – | Intro | Loghi WindTre Business × CKDelta, titolo "Smart Data Platform – Mobility Analytics" |
| 01 | Panoramica | Mappa del POI, zoom sulle KPI (Presenze, Arrivi, Pernottamenti, Visitatori) |
| 02 | Statistiche visite | Il cursore naviga le tab Orario di arrivo → Frequenza → Durata visita → Durata pernottamento |
| 03 | Sociodemografico | Origini nazionali → Origini internazionali → Età & genere |
| 04 | Viaggi dei visitatori | KPI dei viaggi e zoom sulla mappa dei flussi con impulso su Genova |
| 05 | Previsioni | Meteo/eventi e tratto previsionale evidenziati |
| 06 | SDP Agent | Zoom sulla chat AI e digitazione di una nuova domanda |
| 07 | Esportazioni dati | Click su "Esporta CSV" con conferma del download |
| – | Outro | Riepilogo funzionalità, claim "Trasforma i movimenti in decisioni.", loghi |

## Struttura

- `src/timing.ts` — durata di ogni scena e delle transizioni
- `src/scenes/` — intro/outro e scene delle funzionalità (testi, zoom, evidenziazioni, cursore)
- `src/components/` — sfondo animato, finestra app 3D con camera, didascalie, overlay
- `public/screens/` — screenshot della piattaforma; `public/logos/` — loghi su sfondo trasparente
- `public/fonts/` — font Barlow / Barlow Condensed (SIL OFL) inclusi per il render offline

## Comandi

```bash
npm install
npm run dev      # Remotion Studio per anteprima e modifiche
npm run render   # genera out/smart-data-platform.mp4
```

In ambienti senza Chrome scaricabile si può passare un Chromium locale:
`npx remotion render SmartDataPlatform out/smart-data-platform.mp4 --browser-executable=/percorso/headless_shell`.

Il video non ha audio: per aggiungere una colonna sonora inserire un file in `public/` e un
componente `<Audio src={staticFile('musica.mp3')} />` in `src/SmartDataPlatform.tsx`.
