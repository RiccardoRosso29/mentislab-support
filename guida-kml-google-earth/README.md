# Guida rapida: poligono KML in Google Earth

Pagina HTML (WindTre Business × CKDelta) che spiega in 7 slide come disegnare un
poligono in Google Earth ed esportarlo in KML. Si scorre con le frecce (anche da
tastiera o con uno swipe). Su ogni screenshot reale un'animazione mostra dove cliccare:
zoom sul pulsante, cursore, clic, riquadro arancione ed etichetta con l'istruzione.

`index.html` è un file unico e autonomo (circa 1,6 MB): screenshot, loghi e font sono
incorporati e le animazioni sono disegnate dalla pagina stessa, senza video.

## Struttura

- `template.html` — testo, layout e animazioni (coordinate dei pulsanti nello spazio 2000×960 degli screenshot)
- `slides/` — screenshot compressi usati dalla pagina (elenco dei file personali sfocato)
- `assets/` — loghi e font Montserrat
- `build.py` — genera `index.html` incorporando immagini e font
- `animazioni/` — progetto Remotion con le stesse animazioni in versione video MP4/WebM (passaggi 1–5)

## Rigenerare

```bash
python3 build.py        # rigenera index.html da template.html

# video Remotion (facoltativi)
cd animazioni && npm install && npm run render   # scrive ../video/passo-N.mp4 e .webm
```
