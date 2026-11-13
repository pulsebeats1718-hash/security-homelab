// Saves the fox render from render.html as a PNG with transparency.
//   node dev/icon/render-fox.cjs <out.png> ["size=2048&yaw=24&…"]
// Needs the dev server: npx vite --config dev/vite.nohmr.config.js (port 5174; PORT=… to change)
const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const [out, query = ''] = process.argv.slice(2);
  if (!out) throw new Error('usage: node dev/icon/render-fox.cjs <out.png> [query]');
  const port = process.env.PORT || 5174;
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 420, height: 420 } });
  page.on('pageerror', (e) => console.error('pageerror:', e.message));
  page.on('console', (m) => m.type() === 'error' && console.error('console:', m.text()));
  await page.goto(`http://localhost:${port}/dev/icon/render.html?${query}`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 300000 });
  const url = await page.evaluate(() => window.__png());
  fs.writeFileSync(out, Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'));
  console.log('saved', out);
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
