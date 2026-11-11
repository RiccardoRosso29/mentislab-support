import { useStore } from '../model/store';
import { TEMPLATES } from '../data/templates';
import { emptyProject } from '../model/project';

/** primo ingresso in «La mia casa»: da zero, da immagine o da un modello */
export default function StartDialog({ onClose }: { onClose: () => void }) {
  const { load, set, setTool } = useStore.getState();
  const start = (fn: () => void) => {
    fn();
    onClose();
  };
  return (
    <div className="modal-back">
      <div className="modal" role="dialog" aria-labelledby="start-t">
        <h3 id="start-t">Come vuoi iniziare?</h3>
        <p className="note">Puoi sempre cambiare idea: il progetto si salva da solo in questo browser.</p>
        <div style={{ display: 'grid', gap: 8 }}>
          <button
            className="btn"
            onClick={() =>
              start(() => {
                load(emptyProject('La mia casa'));
                set({ view: '2d', panel: 'library' });
                setTool('room');
              })
            }
          >
            Disegna da zero: trascina le stanze o i muri con le misure
          </button>
          <button
            className="btn"
            onClick={() =>
              start(() => {
                load(emptyProject('La mia casa'));
                set({ view: '2d', panel: 'library' });
              })
            }
          >
            Parti dall’immagine della planimetria (la carichi dal pannello Mobili)
          </button>
          {TEMPLATES.map((t) => (
            <button key={t.id} className="btn" onClick={() => start(() => load(t.build()))}>
              Parti da un modello: {t.label} ({t.area})
            </button>
          ))}
          <a className="btn primary" href="#demo" onClick={onClose}>
            Guarda prima la demo arredata
          </a>
        </div>
      </div>
    </div>
  );
}
