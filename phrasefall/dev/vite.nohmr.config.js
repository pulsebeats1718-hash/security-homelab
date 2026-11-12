// Dev server without hot reload — useful for automated screenshots while files are changing.
//   npx vite --config dev/vite.nohmr.config.js
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  root: fileURLToPath(new URL('..', import.meta.url)),
  base: './',
  server: { host: true, port: 5174, strictPort: true, hmr: false },
});
