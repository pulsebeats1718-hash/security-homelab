import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Installable, offline-capable build (normal build only — never dev or the single file):
 *  - index.html gets the web app manifest, the Apple touch icon and sw-register.js;
 *  - dist/sw.js gets this build's file list and a version (a hash of the hashed file
 *    names), so a new deploy installs a new service worker with a fresh cache.
 *
 * Icons live in public/icons/, rendered from icon.svg with ImageMagick (needs rsvg-convert):
 *   cd public/icons
 *   sed 's/width="512" height="512"/width="1024" height="1024"/' icon.svg > /tmp/big.svg
 *   sed 's/width="512" height="512" viewBox="0 0 512 512"/width="1024" height="1024" viewBox="26 26 460 460"/' icon.svg > /tmp/zoom.svg
 *   convert -background none /tmp/big.svg -resize 512x512 -strip icon-maskable-512.png
 *   convert -background none /tmp/big.svg -resize 192x192 -strip icon-maskable-192.png
 *   convert -background '#17123f' /tmp/big.svg -flatten -alpha off -resize 180x180 -strip apple-touch-icon.png
 *   convert -background none /tmp/zoom.svg -alpha set \( -size 1024x1024 xc:none -fill white \
 *     -draw "roundrectangle 0,0,1023,1023,226,226" \) -compose DstIn -composite -resize 512x512 -strip PNG32:icon-512.png
 *   convert icon-512.png -resize 192x192 PNG32:icon-192.png
 */
function pwa() {
  return {
    name: 'phrasefall-pwa',
    apply: 'build',
    transformIndexHtml() {
      return [
        { tag: 'link', attrs: { rel: 'manifest', href: './manifest.webmanifest' }, injectTo: 'head' },
        { tag: 'link', attrs: { rel: 'apple-touch-icon', href: './icons/apple-touch-icon.png' }, injectTo: 'head' },
        { tag: 'script', attrs: { src: './sw-register.js', defer: true }, injectTo: 'body' },
      ];
    },
    writeBundle(options, bundle) {
      const sw = resolve(options.dir, 'sw.js');
      if (!existsSync(sw)) return;
      // Firebase and the sign-in code are skipped: guests never need them, and they are
      // cached on first use (cache-first for /assets/) when a player signs in.
      const isOnlineChunk = (f) => {
        const c = bundle[f];
        if (!c || c.type !== 'chunk') return false;
        const ids = [c.facadeModuleId, ...(c.moduleIds ?? Object.keys(c.modules ?? {}))];
        return ids.some((id) => id && (/[\\/]node_modules[\\/]@?firebase[\\/]/.test(id) || /[\\/]src[\\/]online[\\/](service|firestore)\.js$/.test(id)));
      };
      const all = Object.keys(bundle).filter((f) => f !== 'index.html' && !f.endsWith('.map'));
      const files = all.filter((f) => !isOnlineChunk(f)).sort();
      this.info?.(`service worker precaches ${files.length} files (skipped ${all.length - files.length} online-only chunks)`);
      const html = bundle['index.html']?.source ?? '';
      const src = readFileSync(sw, 'utf8');
      const version = createHash('sha256').update(files.join('\n')).update(String(html)).update(src).digest('hex').slice(0, 12);
      writeFileSync(sw, src.replace(/const BUILD = \{[^\n]*\};/, `const BUILD = ${JSON.stringify({ version, files })};`));
    },
  };
}

// `npm run build`         → dist/         (normal static build, hashed assets, installable + offline)
// `npm run build:single`  → dist-single/  (one self-contained index.html, fonts and expressions inlined)
export default defineConfig(({ mode }) => ({
  base: './',
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
  plugins: mode === 'single' ? [viteSingleFile()] : [pwa()],
  // the single file must not reference anything else (no manifest, icons or service worker)
  publicDir: mode === 'single' ? false : 'public',
  build: {
    outDir: mode === 'single' ? 'dist-single' : 'dist',
    target: 'es2020',
    chunkSizeWarningLimit: 1500,
    assetsInlineLimit: mode === 'single' ? 100_000_000 : 4096,
  },
}));
