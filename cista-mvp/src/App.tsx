import { useEffect, useState } from 'react';
import { useStore, loadSaved } from './model/store';
import { demoProject } from './data/demo-project';
import { decodeProject } from './model/share';
import EditorPage from './editor/EditorPage';
import Home from './pages/Home';
import ListPage from './pages/ListPage';
import SeoPage, { SEO_PAGES } from './pages/SeoPage';
import { HowItWorks, HowWeEarn, Privacy } from './pages/InfoPages';
import Metrics from './pages/Metrics';
import Review from './pages/Review';
import StartDialog from './editor/StartDialog';

/** rotte nell'hash, così il sito funziona su qualsiasi hosting statico */
const route = () => decodeURIComponent(location.hash.replace(/^#\/?/, '')) || 'home';

export default function App() {
  const [r, setR] = useState(route());
  const [start, setStart] = useState(false);
  const project = useStore((s) => s.project);
  const chosen = project.items.filter((i) => i.chosen && i.productId).length;

  useEffect(() => {
    const on = () => setR(route());
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);

  useEffect(() => {
    const st = useStore.getState();
    if (r === 'demo') {
      if (st.project.id !== 'demo-majadahonda') st.load(demoProject());
    } else if (r === 'editor') {
      const saved = loadSaved();
      if (saved && st.project.id !== saved.id) st.load(saved);
      else if (!saved) setStart(true);
    } else if (r.startsWith('progetto-')) {
      decodeProject(r.slice('progetto-'.length))
        .then((p) => st.load({ ...p, id: `shared-${p.id}` }))
        .catch(() => alertLater('Il link del progetto non è valido o è incompleto.'));
    }
    window.scrollTo(0, 0);
  }, [r]);

  const isEditor = r === 'demo' || r === 'editor' || r.startsWith('progetto-');
  const seo = SEO_PAGES.find((p) => p.id === r);
  const nav: [string, string][] = [
    ['demo', 'Demo'],
    ['editor', 'La mia casa'],
    ['lista', 'Lista acquisti'],
    ['come-funziona', 'Come funziona'],
  ];
  const current = isEditor ? (r === 'demo' ? 'demo' : 'editor') : r;

  return (
    <div className="app">
      <header className="top">
        <a className="brand" href="#">
          <b>
            Ci<i>Sta</i>
          </b>
          <small>mobili che ci stanno davvero</small>
        </a>
        <nav className="nav" aria-label="Sezioni">
          {nav.map(([id, label]) => (
            <a key={id} href={`#${id}`} aria-current={current === id ? 'page' : undefined}>
              {label}
              {id === 'lista' && chosen > 0 && <span className="count">{chosen}</span>}
            </a>
          ))}
        </nav>
      </header>
      {isEditor ? (
        <EditorPage key={project.id} readOnlyHint={r.startsWith('progetto-')} />
      ) : (
        <div className="page">
          {r === 'home' && <Home />}
          {r === 'lista' && <ListPage />}
          {r === 'come-funziona' && <HowItWorks />}
          {r === 'come-guadagniamo' && <HowWeEarn />}
          {r === 'privacy' && <Privacy />}
          {r === 'metriche' && <Metrics />}
          {r === 'revisione' && <Review />}
          {seo && <SeoPage page={seo} />}
          {!['home', 'lista', 'come-funziona', 'come-guadagniamo', 'privacy', 'metriche', 'revisione'].includes(r) && !seo && (
            <div className="page-in narrow">
              <h1>Pagina non trovata</h1>
              <p>
                Torna alla <a href="#">pagina iniziale</a> o apri la <a href="#demo">demo</a>.
              </p>
            </div>
          )}
          <footer className="footer">
            <span>CiSta · MVP</span>
            <a href="#come-guadagniamo">Come guadagniamo</a>
            <a href="#privacy">Privacy</a>
            {SEO_PAGES.map((p) => (
              <a key={p.id} href={`#${p.id}`}>
                {p.short}
              </a>
            ))}
            <a href="#metriche">Metriche</a>
            <a href="#revisione">Revisione misure</a>
          </footer>
        </div>
      )}
      {start && <StartDialog onClose={() => setStart(false)} />}
    </div>
  );
}

function alertLater(msg: string) {
  setTimeout(() => {
    const el = document.createElement('div');
    el.className = 'modal-back';
    el.innerHTML = `<div class="modal"><h3>Link non valido</h3><p>${msg}</p><button class="btn primary">Chiudi</button></div>`;
    el.querySelector('button')!.addEventListener('click', () => el.remove());
    document.body.appendChild(el);
  }, 0);
}
