/**
 * Test end-to-end dei flussi principali (Playwright, Chromium).
 *   npm run build && npm run e2e
 * Avvia `vite preview`, percorre demo → stendino → prodotto → prova nel 3D → scegli → lista → uscita verso il negozio,
 * poi disegna una stanza, ne cambia una quota, esporta la planimetria e controlla il layout su telefono.
 */
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');

const PORT = 4179;
const BASE = `http://localhost:${PORT}/`;
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
};

(async () => {
  const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 2500));
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const errors = [];
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
    // niente traffico verso i negozi durante il test
    await ctx.route(/amazon\.es|leroymerlin\.es|ikea\.com|awin1\.com/, (r) => r.fulfill({ status: 200, body: 'negozio (test)' }));
    const page = await ctx.newPage();
    page.setDefaultTimeout(10000);
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && !/favicon|fonts\.g/.test(m.text()) && errors.push(m.text()));

    // 1. home → demo
    await page.goto(BASE);
    await page.click('[data-testid="cta-demo"]');
    await page.waitForSelector('[data-testid="plan"]');
    await page.waitForTimeout(2500);
    check('La demo si apre con pianta e 3D', (await page.locator('[data-testid="view3d"] canvas').count()) === 1);

    // 2. stendino → prodotti compatibili
    await page.locator('[data-testid="item-drying-rack"]').first().click({ force: true });
    await page.click('[data-testid="find-products"]');
    const okCards = page.locator('[data-testid="product-card"][data-status="ok"]');
    const nOk = await okCards.count();
    check('Il pannello mostra stendini compatibili', nOk >= 4, `${nOk} compatibili`);
    const first = okCards.first();
    const title = await first.locator('h4').innerText();

    // 3. prova nel 3D e scegli
    await first.locator('[data-testid="try-3d"]').click();
    await first.locator('[data-testid="choose"]').click();
    const chosen = await page.evaluate(() => JSON.parse(localStorage.getItem('cista:events') || '[]').filter((e) => e.name === 'product_chosen').length);
    check('«Scegli» registra la scelta', chosen >= 1, title);

    // 4. lista acquisti
    await page.goto(BASE + '#lista');
    await page.waitForSelector('[data-testid="list-row"]');
    const total = await page.locator('[data-testid="list-total"]').innerText();
    check('La lista acquisti contiene il prodotto con il totale', (await page.locator('[data-testid="list-row"]').count()) === 1 && /€/.test(total), total);

    // 5. uscita verso il negozio tracciata
    const [popup] = await Promise.all([ctx.waitForEvent('page'), page.locator('[data-testid="list-row"] a').first().click()]);
    await popup.close();
    const outs = await page.evaluate(() => JSON.parse(localStorage.getItem('cista:events') || '[]').filter((e) => e.name === 'outbound_click'));
    check('Il clic verso il negozio è tracciato', outs.length >= 1, outs[0] ? `${outs[0].props.retailer}` : '');

    // 6. editor: nuova stanza trascinando, area calcolata, quota modificata
    await page.evaluate(() => localStorage.removeItem('cista:project'));
    await page.goto(BASE + '#editor');
    await page.getByText('Disegna da zero').click();
    const plan = page.locator('[data-testid="plan"]');
    const box = await plan.boundingBox();
    await page.mouse.move(box.x + 200, box.y + 150);
    await page.mouse.down();
    await page.mouse.move(box.x + 420, box.y + 300, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(300);
    const st1 = await page.evaluate(() => JSON.parse(localStorage.getItem('cista:project') || 'null'));
    await page.waitForTimeout(600);
    const st = await page.evaluate(() => JSON.parse(localStorage.getItem('cista:project') || 'null'));
    check('Trascinando si crea una stanza chiusa con 4 muri', !!st && st.rooms.length === 1 && st.walls.length === 4, st ? `${st.walls.length} muri` : String(st1));
    const roomLabel = await page.locator('svg text').filter({ hasText: 'm²' }).first().textContent();
    check('La stanza ha la superficie calcolata', /\d+,\d m²/.test(roomLabel), roomLabel);
    // seleziona la stanza e modifica il lato superiore a 350 cm
    await page.mouse.click(box.x + 310, box.y + 225);
    const q = page.locator('[data-k="quote"]').first();
    await q.click({ force: true });
    await page.fill('#quote-input', '350');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(600);
    const st2 = await page.evaluate(() => JSON.parse(localStorage.getItem('cista:project') || 'null'));
    const xs = st2.nodes.map((n) => n.x);
    const ys = st2.nodes.map((n) => n.y);
    const spans = [Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)].map((n) => Math.round(n - 10));
    check('Cambiando la quota il muro si sposta e la stanza resta rettangolare', spans.includes(350), `interno ${spans.join(' × ')} cm`);

    // 7. esportazione della planimetria quotata
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Planimetria SVG' }).click()]);
    check('Esporta la planimetria quotata in SVG', /planimetria\.svg$/.test(dl.suggestedFilename()), dl.suggestedFilename());

    // 8. pagina «per misura»
    await page.goto(BASE + '#stendini-sotto-140');
    const seoCards = await page.locator('[data-testid="product-card"]').count();
    check('La pagina «stendini sotto i 140 cm» elenca prodotti', seoCards >= 5, `${seoCards} prodotti`);

    // 9. telefono: niente scorrimento orizzontale della pagina
    const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
    for (const r of ['', '#lista', '#come-funziona', '#demo']) {
      await phone.goto(BASE + r);
      await phone.waitForTimeout(r === '#demo' ? 2500 : 500);
      const over = await phone.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      check(`Telefono ${r || 'home'}: nessuno scorrimento orizzontale`, over <= 1, `${over}px`);
    }
    await phone.close();
    check('Nessun errore JavaScript', errors.length === 0, errors.slice(0, 3).join(' | '));
  } catch (e) {
    check('Esecuzione', false, e.message);
  } finally {
    await browser.close();
    server.kill();
  }
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} controlli superati`);
  process.exit(failed ? 1 : 0);
})();
