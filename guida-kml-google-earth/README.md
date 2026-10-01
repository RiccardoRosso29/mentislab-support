# Guida rapida: poligono KML in Google Earth

Pagina HTML (WindTre Business × CKDelta) che spiega in 7 passaggi come disegnare un
poligono in Google Earth ed esportarlo in KML. Ogni passaggio ha un'animazione
realizzata con Remotion a partire da screenshot reali dell'interfaccia.

`index.html` è un file unico e autonomo: loghi, font e video sono incorporati,
quindi si può inviare o aprire da solo.

## Struttura

- `template.html` — testo e layout della pagina
- `build.py` — genera `index.html` incorporando `assets/`, `video/` e `screenshots/`
- `animazioni/` — progetto Remotion dei passaggi 1–5 (`src/Root.tsx` contiene le coordinate dei pulsanti)
- `animazioni/public/screens/` — screenshot di Google Earth (elenco dei file personali sfocato)
- `video/` — animazioni renderizzate (WebM + MP4)
- `screenshots/` — immagini statiche per i passaggi senza animazione (`passo-6.png`, `passo-7.png`)

## Rigenerare

```bash
cd animazioni && npm install
npm run dev                      # anteprima in Remotion Studio
npm run render                   # scrive ../video/passo-N.webm e .mp4
# senza Chrome scaricabile: REMOTION_BROWSER=/percorso/headless_shell npm run render
cd .. && python3 build.py        # rigenera index.html
```
