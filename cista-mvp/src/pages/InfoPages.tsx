export function HowItWorks() {
  return (
    <div className="page-in narrow">
      <h1>Come funziona</h1>
      <p className="lead">CiSta unisce tre cose che di solito sono separate: la planimetria con le misure vere, il 3D e la scelta di prodotti reali che ci stanno.</p>
      <h2>1. La casa, con le misure vere</h2>
      <p>
        Disegni i muri a catena o le stanze trascinando, scrivi le misure esatte toccando le quote, aggiungi porte, finestre, pilastri, termosifoni, prese, ostacoli in alto e armadi a muro con le misure interne. Puoi anche caricare l’immagine della planimetria, calibrarla con una misura che conosci e ricalcarla. Le misure prese in casa si vedono in blu e prevalgono su quelle stimate.
      </p>
      <h2>2. I mobili, in 2D e in 3D</h2>
      <p>32 mobili parametrici con le loro zone d’uso: lo spazio per aprire le ante, per estrarre i cassetti, per aprire il divano letto, per arretrare la sedia. Il 3D si aggiorna mentre lavori; puoi guardare dall’alto o camminare dentro casa.</p>
      <h2>3. Prodotti reali che ci stanno</h2>
      <p>
        Selezioni un mobile e apri «Prodotti»: CiSta calcola lo spazio disponibile lungo la parete, fino alla fine della parete o al prossimo ostacolo, e controlla per ogni prodotto larghezza, profondità, altezza, passaggi, aperture e ostacoli in alto. Ogni prodotto ha un’etichetta (ci sta, con riserva, non entra) e il motivo in centimetri. «Prova nel 3D» lo mette al posto del mobile; «Scegli» lo aggiunge alla lista acquisti.
      </p>
      <h2>Tutto nel tuo browser</h2>
      <p>Planimetria, 3D e verifica della compatibilità girano sul tuo dispositivo, senza intelligenza artificiale: per questo il servizio è gratuito. Il progetto si salva in questo browser; puoi esportarlo o condividerlo con un link.</p>
      <p>
        <a className="btn primary" href="#demo">
          Apri la demo
        </a>
      </p>
    </div>
  );
}

export function HowWeEarn() {
  return (
    <div className="page-in narrow">
      <h1>Come guadagniamo</h1>
      <p className="lead">CiSta è gratuito. Guadagniamo una piccola commissione quando compri un prodotto attraverso alcuni dei nostri link, senza costi in più per te.</p>
      <ul className="reasons notes">
        <li>
          <b>Link di affiliazione.</b> Con Amazon (programma Affiliazione Amazon) e con negozi presenti su reti di affiliazione come Awin (ad esempio Leroy Merlin, quando il programma è attivo). I link di affiliazione sono marcati come «sponsored».
        </li>
        <li>
          <b>IKEA</b> non ha un programma di affiliazione pubblico in Italia: i suoi prodotti compaiono come riferimento, con un link normale.
        </li>
        <li>
          <b>L’ordine dei prodotti</b> dipende solo dalla compatibilità con il tuo spazio e dal prezzo, non dalla commissione.
        </li>
        <li>
          <b>Prezzi e misure</b> vengono dai negozi alla data indicata e possono cambiare: verificali sempre sulla scheda prima di comprare.
        </li>
        <li>
          <b>Versione Pro</b> (in arrivo): funzioni con intelligenza artificiale, come la planimetria dalla foto dell’annuncio, a crediti.
        </li>
      </ul>
    </div>
  );
}

export function Privacy() {
  return (
    <div className="page-in narrow">
      <h1>Privacy</h1>
      <p>Non chiediamo registrazione e non usiamo cookie di profilazione.</p>
      <ul className="reasons notes">
        <li>Il tuo progetto, le spunte del rilievo e le correzioni alle misure restano nel tuo browser (archiviazione locale). Puoi cancellarli dalle impostazioni del browser.</li>
        <li>Registriamo eventi anonimi (ad esempio «prodotto visto», «clic verso il negozio» con negozio, categoria e prezzo) per capire se il servizio funziona. Restano nel browser; se è configurato un servizio di statistiche, vengono inviati senza dati personali.</li>
        <li>Quando apri un link verso un negozio, il negozio può usare i propri cookie, anche per attribuirci la commissione: si applicano le sue condizioni.</li>
        <li>Il link «Condividi» contiene il progetto stesso (muri e mobili), non dati personali: chi lo riceve vede la stessa casa.</li>
      </ul>
    </div>
  );
}
