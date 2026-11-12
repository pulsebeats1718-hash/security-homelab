import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build`         → dist/         (normal static build, hashed assets)
// `npm run build:single`  → dist-single/  (one self-contained index.html, fonts inlined)
export default defineConfig(({ mode }) => ({
  base: './',
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
  plugins: mode === 'single' ? [viteSingleFile()] : [],
  build: {
    outDir: mode === 'single' ? 'dist-single' : 'dist',
    target: 'es2020',
    chunkSizeWarningLimit: 1500,
    assetsInlineLimit: mode === 'single' ? 100_000_000 : 4096,
  },
}));
