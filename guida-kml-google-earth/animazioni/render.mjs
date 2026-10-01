// Renderizza ogni passaggio in ../video/<id>.mp4 (H.264) e ../video/<id>.webm (VP9):
// video muti, in loop nella guida. Il WebM serve ai browser senza H.264 (es. Chromium).
import {bundle} from '@remotion/bundler';
import {renderMedia, selectComposition, getCompositions} from '@remotion/renderer';
import path from 'node:path';

const browserExecutable = process.env.REMOTION_BROWSER || undefined;
const only = process.argv.slice(2);
const serveUrl = await bundle({entryPoint: path.resolve('src/index.ts')});
const comps = await getCompositions(serveUrl, {browserExecutable});
for (const {id} of comps) {
  if (only.length && !only.includes(id)) continue;
  const composition = await selectComposition({serveUrl, id, browserExecutable});
  for (const [codec, ext, crf] of [['h264', 'mp4', 26], ['vp9', 'webm', 40]]) {
    await renderMedia({
      serveUrl, composition, browserExecutable,
      codec, crf, pixelFormat: 'yuv420p', imageFormat: 'jpeg', jpegQuality: 90,
      outputLocation: `../video/${id}.${ext}`,
    });
  }
  console.log('✓', id);
}
