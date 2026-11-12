// Scripted browser session for testing:
//   node scripts/run.cjs <url> <width> <height> '<steps json>' [dpr]
// steps: [{"wait":1000},{"eval":"__pf.startGame()"},{"shot":"/path/a.png"},{"click":"text=Play"},{"key":"a"}]
const { chromium } = require('playwright');
(async () => {
  const [url, w = '1280', h = '760', stepsJson = '[]', dpr = '1'] = process.argv.slice(2);
  const steps = JSON.parse(stepsJson);
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: +dpr, hasTouch: +w < 700, isMobile: +w < 700 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text().slice(0, 300)}`); });
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message} ${(e.stack || '').split('\n').slice(1, 3).join(' | ')}`));
  await page.goto(url, { waitUntil: 'load' });
  for (const s of steps) {
    if (s.waitFor) await page.waitForFunction(s.waitFor, null, { timeout: 60000 }).catch((e) => errors.push(`waitFor failed: ${s.waitFor}`));
    if (s.wait) await page.waitForTimeout(s.wait);
    if (s.eval) { const r = await page.evaluate(s.eval).catch((e) => `EVAL ERROR: ${e.message}`); if (r !== undefined && s.print !== false) console.log('eval →', JSON.stringify(r)); }
    if (s.click) await page.click(s.click, { timeout: 30000, force: true }).catch((e) => errors.push(`click failed: ${s.click}: ${e.message.split('\n')[0]}`));
    if (s.key) await page.keyboard.press(s.key);
    if (s.shot) { await page.screenshot({ path: s.shot, timeout: 180000 }); console.log('saved', s.shot); }
  }
  if (errors.length) console.log([...new Set(errors)].slice(0, 15).join('\n'));
  await browser.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
