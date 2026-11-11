// Versione del sito pubblicabile come anteprima Artifact: un solo file HTML con JS e CSS in linea.
// La piattaforma aggiunge da sé doctype, html, head, body, charset e viewport: qui si tolgono i propri.
import fs from 'node:fs';
import path from 'node:path';

const dist = 'dist-artifact-src';
const read = (f) => fs.readFileSync(path.join(dist, f), 'utf8');
let html = read('index.html')
  .replace(/<!doctype html>\s*/i, '')
  .replace(/<\/?(?:html|head|body)\b[^>]*>\s*/gi, '')
  .replace(/<meta charset[^>]*>\s*/i, '')
  .replace(/<meta name="viewport"[^>]*>\s*/i, '')
  .replace(/<link rel="modulepreload"[^>]*>\s*/g, '');
const scripts = [];
// funzioni come sostituzione: il codice minificato contiene sequenze $& che replace() interpreterebbe
html = html.replace(/<link rel="stylesheet"[^>]*href="\.\/([^"]+)"[^>]*>/g, (_, f) => `<style>${read(f)}</style>`);
html = html.replace(/<script type="module"[^>]*src="\.\/([^"]+)"[^>]*><\/script>\s*/g, (_, f) => {
  scripts.push(`<script type="module">${read(f).replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--')}</script>`);
  return '';
});
html = `${html.trim()}\n${scripts.join('\n')}\n`;
fs.mkdirSync('dist-artifact', { recursive: true });
fs.writeFileSync('dist-artifact/index.html', html);
console.log(`dist-artifact/index.html: ${(html.length / 1024).toFixed(0)} KB`);
