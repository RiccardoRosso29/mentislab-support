# ADR-001 — Editor della planimetria: scritto da zero, leggero

**Stato:** accettato · novembre 2026

## Contesto
Il prompt chiedeva di valutare editor open source con licenza permissiva prima di partire da zero. Candidati individuati:
- **Pascal Editor** (`pascalorg/editor`, MIT): React 19, Next.js, Three.js, Zustand, monorepo Turborepo; muri, pavimenti, mobili, stanze.
- **Blueprint3D Modern**: riscrittura TypeScript + Three.js r181 di blueprint3d (abbandonato).
- **openplan3d** (SvelteKit + Three.js), **house-planner** (React Three Fiber), **OpenFPC** (archiviato nel 2023).
- **Sweet Home 3D**: escluso per la licenza GPL (studiate solo le funzioni).

Non ho potuto ispezionare a fondo il codice dei repository da questa sessione (accesso a GitHub non disponibile); la valutazione si basa su descrizioni pubbliche.

## Decisione
Editor 2D in SVG e 3D procedurale scritti da zero, sopra un modello dati unico (`src/model`), perché:
1. il cuore del prodotto è il **motore di compatibilità**, che ha bisogno di un modello dati con ostacoli, zone d'uso, quote misurate/stimate e armadi a muro con interni: gli editor esistenti non lo hanno e andrebbero comunque estesi a fondo;
2. **peso e costi**: un sito statico Vite + React + Three.js senza monorepo né server Next.js si pubblica ovunque gratis;
3. **controllo della geometria** (prolungamento dei muri agli angoli, fine parete, quote che traslano il muro collegato) con test unitari.

## Conseguenze
- Mancano per ora piani multipli e muri curvi (in `parity-checklist.md`).
- Se in futuro servisse un editor più ricco, Pascal Editor (MIT) è il primo candidato da integrare, adattando il nostro modello dati come livello sopra il suo.
