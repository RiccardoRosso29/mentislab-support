# Train Analytics – English version, CKDelta branding

`Train_Analytics_2_EN_CKDelta.pdf` is the English, CKDelta-branded version of the *Train Analytics* dashboard
(Milan ⇄ Rome, high-speed, 1–30 June 2024, Italo vs Trenitalia). Same 4 pages as the source:

1. Passenger overview: KPIs, daily passengers, trips by weekday/time slot, Italo market share, trip duration, time in station, travel frequency
2. Traveller home location: Italian provinces and foreign countries
3. Origins & destinations: where travellers come from before departure and where they go after arrival
4. Socio-demographic profile: residence, gender, market segment, nationality, age, spending bracket

## Branding
Colours, fonts and logo come from ckdelta.ie: black/grey neutrals (`#0A0A0A`, `#F7F7F7`, `#E6E6E6`, `#969696`),
accents CKDelta blue `#4682F5` (Trenitalia), CKDelta magenta `#D24682` (Italo) and teal `#007887`; fonts Mozilla Text + Fragment Mono.

## Data
Every number is transcribed from the source PDF. The line charts (daily passengers, trip duration, time in station) were
rebuilt from the vector paths of the original charts. The recomputed medians match the ones printed in the original.
The original Google Maps basemaps were replaced with Natural Earth maps that show English labels and only the provinces/countries listed in the tables.

## Rebuild
`src/` holds the HTML/D3 sources. Put `d3.min.js` (d3@7.9.0), `topojson-client.min.js` (3.1.0), `maps.js`
(`window.WORLD50=` + world-atlas@2.0.2 `countries-50m.json`) and the two woff2 fonts in `lib/`, then run `node src/render.js`.
