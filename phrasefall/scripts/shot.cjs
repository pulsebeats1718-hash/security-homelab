// Screenshot helper for visual testing: node scripts/shot.cjs <url> <out.png> [width] [height] [waitMs] [dpr]
const { chromium } = require('playwright');
(async () => {
  const [url, out, w = '1280', h = '800', wait = '1500', dpr = '1'] = process.argv.slice(2);
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: +dpr });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(+wait);
  await page.screenshot({ path: out, timeout: 180000 });
  if (errors.length) console.log(errors.slice(0, 12).join('\n'));
  console.log('saved', out);
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
