// Debug helper: node scripts/probe.cjs <url> [waitMs] — prints console output and boot state.
const { chromium } = require('playwright');
(async () => {
  const [url, wait = '6000'] = process.argv.slice(2);
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1000, height: 640 } });
  page.on('console', (m) => console.log(`[${m.type()}]`, m.text().slice(0, 400)));
  page.on('pageerror', (e) => console.log('[pageerror]', e.message, (e.stack || '').split('\n').slice(0, 4).join(' | ')));
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(+wait);
  const state = await Promise.race([
    page.evaluate(() => ({ pf: !!window.__pf, screen: window.__pf?.ui?.name, boot: !!document.getElementById('boot'), bar: document.getElementById('boot-bar')?.style.width })),
    new Promise((r) => setTimeout(() => r('evaluate timed out (main thread busy)'), 8000)),
  ]);
  console.log('state:', JSON.stringify(state));
  await browser.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
