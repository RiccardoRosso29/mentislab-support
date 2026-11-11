import { useEffect, useState } from 'react';
import { useStore } from '../model/store';

/** rilievo guidato gratuito: cosa misurare in ogni stanza e come (nessuna AI) */
const STEPS: { room: string; items: [string, string][] }[] = [
  {
    room: 'Ogni stanza',
    items: [
      ['Pareti a filo finito', 'Misura da intonaco a intonaco, a circa 1 m da terra, sopra il battiscopa. Due misure per parete se non sei sicuro che sia dritta.'],
      ['Larghezza delle porte', 'Senza coprifilo (la cornice): è lo spazio che passa davvero. Annota da che lato è la cerniera e verso dove si apre.'],
      ['Dove arriva la porta aperta', 'La distanza dalla parete di fronte al punto in cui arriva l’anta aperta: lì non si possono mettere mobili.'],
      ['Finestre', 'Larghezza, altezza del davanzale da terra, se si apre verso l’interno (serve spazio davanti) o è fissa.'],
      ['Pilastri', 'Quanto sono lunghi lungo la parete e quanto sporgono.'],
    ],
  },
  {
    room: 'Ostacoli',
    items: [
      ['Termosifoni', 'Larghezza, profondità e distanza dall’angolo o dal pilastro più vicino.'],
      ['Prese e interruttori', 'Distanza dall’angolo e altezza da terra: decidono dove va la TV o la scrivania.'],
      ['Ostacoli in alto', 'Motore del condizionatore, pensili, mensole: quota inferiore da terra e quanto sporgono. Decidono l’altezza massima dei mobili sotto.'],
    ],
  },
  {
    room: 'Armadi a muro',
    items: [
      ['Interno per ogni anta', 'Larghezza e profondità interne.'],
      ['Ingombro delle cerniere', 'Larghezza e profondità utili senza le cerniere: è lo spazio per cassettiere e scatole.'],
      ['Mensole e aste', 'Altezze e larghezze delle mensole, divisori al centro.'],
    ],
  },
  {
    room: 'Ingresso e passaggi',
    items: [
      ['Corridoi', 'Larghezza libera: sotto 80 cm due persone non si incrociano, sotto 60 si passa di lato.'],
      ['Percorso dei mobili grandi', 'Porta d’ingresso, ascensore, scale: i divani e i letti devono passare.'],
    ],
  },
];

export default function Survey() {
  const project = useStore((s) => s.project);
  const key = `cista:survey:${project.id}`;
  const [done, setDone] = useState<Record<string, boolean>>({});
  useEffect(() => {
    try {
      setDone(JSON.parse(localStorage.getItem(key) ?? '{}'));
    } catch {
      setDone({});
    }
  }, [key]);
  const toggle = (k: string) => {
    const next = { ...done, [k]: !done[k] };
    setDone(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      /* archiviazione non disponibile */
    }
  };
  const total = STEPS.reduce((a, s) => a + s.items.length, 0);
  const n = Object.values(done).filter(Boolean).length;
  const measured = project.dims.filter((d) => d.measured).length;
  return (
    <>
      <div>
        <p className="eyebrow">
          Rilievo guidato · {n} di {total}
        </p>
        <h3>Cosa misurare</h3>
        <p className="note">
          Ogni misura che prendi in casa e inserisci con il metro (spuntando «misura presa in casa») si vede in blu e prevale sul disegno. Ora ne hai {measured}.
        </p>
      </div>
      <button className="btn small" onClick={() => useStore.getState().setTool('measure')}>
        Aggiungi una misura con il metro
      </button>
      {STEPS.map((s) => (
        <div key={s.room} style={{ display: 'grid', gap: 8 }}>
          <p className="eyebrow">{s.room}</p>
          {s.items.map(([t, how]) => {
            const k = `${s.room}:${t}`;
            return (
              <label key={k} className="check" style={{ alignItems: 'flex-start' }}>
                <input type="checkbox" checked={!!done[k]} onChange={() => toggle(k)} style={{ marginTop: 3 }} />
                <span>
                  <b>{t}.</b> <span className="note">{how}</span>
                </span>
              </label>
            );
          })}
        </div>
      ))}
    </>
  );
}
