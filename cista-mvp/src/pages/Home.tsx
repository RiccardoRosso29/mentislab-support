import { useMemo } from 'react';
import { demoProject } from '../data/demo-project';
import { evaluateFit } from '../model/compat';
import { productById } from '../model/catalog';
import { ProductCard } from '../editor/ProductPanel';

/** pagina iniziale: un esempio vero (lo stendino della demo) calcolato al momento */
export default function Home() {
  const example = useMemo(() => {
    const p = demoProject();
    const slot = p.items.find((i) => i.type === 'drying-rack')!;
    return ['az-gimi-modular3', 'lm-leifheit-420', 'lm-torre-70']
      .map((id) => productById(id)!)
      .filter(Boolean)
      .map((prod) => ({ prod, fit: evaluateFit(p, slot, prod) }));
  }, []);
  return (
    <div className="page-in">
      <section className="hero">
        <div style={{ display: 'grid', gap: 14 }}>
          <span className="eyebrow">Planimetria · 3D · prodotti reali</span>
          <h1>Arreda casa solo con mobili che ci stanno davvero</h1>
          <p className="lead">
            Disegni la casa con le misure vere, la vedi in 3D, e per ogni mobile CiSta ti propone solo prodotti reali di più negozi che entrano in quello spazio. Controlla anche passaggi, ante che si aprono, termosifoni e ostacoli in alto, e ti dice il motivo in centimetri.
          </p>
          <div className="cta">
            <a className="btn primary" href="#demo" data-testid="cta-demo">
              Prova la demo arredata
            </a>
            <a className="btn" href="#editor">
              Disegna la tua casa
            </a>
          </div>
          <p className="note">Gratis, senza registrazione. Il progetto resta nel tuo browser.</p>
        </div>
        <div className="hero-sheet" aria-label="Esempio reale">
          <span className="eyebrow">Esempio dalla demo · stendino in lavanderia, spazio 99 × 80 cm sotto un motore del condizionatore a 144 cm</span>
          {example.map(({ prod, fit }) => (
            <ProductCard key={prod.id} p={prod} fit={fit} />
          ))}
        </div>
      </section>
      <section className="steps" aria-label="Come funziona">
        <div className="step">
          <span className="n">1</span>
          <h3>Disegna con le misure vere</h3>
          <p className="note">Muri con lo spessore, porte, finestre, pilastri, termosifoni, prese, armadi a muro con gli interni. Oppure ricalca la planimetria dell’annuncio.</p>
        </div>
        <div className="step">
          <span className="n">2</span>
          <h3>Metti i mobili e guarda in 3D</h3>
          <p className="note">32 mobili parametrici che si agganciano ai muri. Vista dall’alto, panoramica o camminando dentro casa.</p>
        </div>
        <div className="step">
          <span className="n">3</span>
          <h3>Scegli prodotti che ci stanno</h3>
          <p className="note">Per ogni mobile: prodotti IKEA, Leroy Merlin e Amazon ordinati per compatibilità, «Prova nel 3D» e lista della spesa.</p>
        </div>
      </section>
      <section style={{ display: 'grid', gap: 10 }}>
        <h2>Cosa controlla, oltre all’ingombro a terra</h2>
        <div className="cards">
          {[
            ['Fine della parete', 'Un divano non può andare oltre la parete che ha dietro, verso una porta o un passaggio.'],
            ['Passaggi', 'Minimo e comodo davanti a letti, comò, armadi e scarpiere: sotto i 40 cm non si passa.'],
            ['Aperture', 'Porte che si aprono, ante degli armadi, cassetti, divani letto aperti, sportello del frigo.'],
            ['Ostacoli in alto', 'Motore del condizionatore, pensili e mensole decidono l’altezza massima dei mobili sotto.'],
            ['Mobili spostabili', 'Se basta spostare un comodino o una sedia, te lo dice invece di scartare il prodotto.'],
            ['Misure da verificare', 'Se il negozio non indica una misura, il prodotto è «con riserva» e lo vedi subito.'],
          ].map(([t, d]) => (
            <div key={t} className="step">
              <h3>{t}</h3>
              <p className="note">{d}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
