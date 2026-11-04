// Renders src/report.html page by page with Playwright and merges into one PDF.
// Requires ../lib/{d3.min.js,topojson-client.min.js,maps.js,mozilla-text.woff2,fragment-mono.woff2} (see README).
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
(async () => {
  const out = path.join(__dirname, '../out');
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1200, height: 1000 } });
  for (let n = 1; n <= 4; n++) {
    await p.goto('file://' + path.resolve(__dirname, 'report.html') + '#' + n);
    await p.reload();
    await p.waitForSelector('body[data-ready="1"]');
    const hgt = await p.evaluate(() => Math.ceil(document.querySelector('.page').getBoundingClientRect().height));
    await p.pdf({ path: path.join(out, `p${n}.pdf`), width: '1200px', height: `${hgt + 2}px`, printBackground: true, pageRanges: '1' });
  }
  await b.close();
  // merge: python3 -c "from pypdf import PdfWriter; w=PdfWriter(); [w.append(f'out/p{i}.pdf') for i in range(1,5)]; w.write('out/report.pdf')"
})();
