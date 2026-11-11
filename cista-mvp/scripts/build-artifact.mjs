// Versione del sito pubblicabile come anteprima Artifact: un solo file HTML con JS e CSS in linea.
import fs from 'node:fs';
import path from 'node:path';

const dist = 'dist-artifact-src';
let html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
const css = [...html.matchAll(/<link rel="stylesheet"[^>]*href="\.\/([^"]+)"[^>]*>/g)];
for (const m of css) html = html.replace(m[0], () => `<style>${fs.readFileSync(path.join(dist, m[1]), 'utf8')}</style>`);
const js = [...html.matchAll(/<script type="module"[^>]*src="\.\/([^"]+)"[^>]*><\/script>/g)];
const body = [];
for (const m of js) {
  html = html.replace(m[0], '');
  body.push(`<script type="module">${fs.readFileSync(path.join(dist, m[1]), 'utf8').replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--')}</script>`);
}
html = html.replace(/<link rel="modulepreload"[^>]*>/g, '').replace('</body>', () => `${body.join('\n')}\n</body>`); // funzione: niente sostituzioni $& nel codice
fs.mkdirSync('dist-artifact', { recursive: true });
fs.writeFileSync('dist-artifact/index.html', html);
console.log(`dist-artifact/index.html: ${(html.length / 1024).toFixed(0)} KB`);
