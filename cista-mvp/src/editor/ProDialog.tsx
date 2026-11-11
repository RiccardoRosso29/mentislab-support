import { AI_FEATURES, aiEnabled, credits } from '../model/ai';

/** livello a pagamento: solo predisposizione, nessuna chiamata a modelli nel flusso gratuito */
export default function ProDialog({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" role="dialog" aria-labelledby="pro-t" onClick={(e) => e.stopPropagation()}>
        <h3 id="pro-t">Assistente Pro</h3>
        <p className="note">
          La versione gratuita fa tutto senza intelligenza artificiale: planimetria, 3D e verifica della compatibilità girano nel tuo browser. La versione Pro aggiungerà, a crediti:
        </p>
        <ul className="reasons notes">
          {AI_FEATURES.map((f) => (
            <li key={f.id}>
              <b>{f.label}</b> — {f.description} ({f.credits} {f.credits === 1 ? 'credito' : 'crediti'})
            </li>
          ))}
        </ul>
        <p className="note">{aiEnabled() ? `Crediti disponibili: ${credits()}.` : 'Non ancora attiva in questo MVP.'}</p>
        <button className="btn primary" onClick={onClose}>
          Ho capito
        </button>
      </div>
    </div>
  );
}
