/**
 * Firebase web config, read from VITE_FIREBASE_* at build time (see .env.example).
 * Online play exists only when the four required values are present, and never in the
 * single-file preview build (`--mode single`, which would otherwise also read .env.local).
 * Each value is read with a literal `import.meta.env.…` so Vite replaces it at build time:
 * without a config the condition is a constant and the Firebase chunks are left out entirely.
 */
export const ONLINE = !!(import.meta.env.MODE !== 'single' && import.meta.env.VITE_FIREBASE_API_KEY && import.meta.env.VITE_FIREBASE_AUTH_DOMAIN && import.meta.env.VITE_FIREBASE_PROJECT_ID && import.meta.env.VITE_FIREBASE_APP_ID);

export const FIREBASE_CONFIG = ONLINE
  ? {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || undefined,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || undefined,
      measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || undefined,
    }
  : null;

/** The Firebase side, fetched on demand; null in builds without a config (nothing to fetch). */
export const loadService = import.meta.env.MODE !== 'single' && import.meta.env.VITE_FIREBASE_API_KEY && import.meta.env.VITE_FIREBASE_AUTH_DOMAIN && import.meta.env.VITE_FIREBASE_PROJECT_ID && import.meta.env.VITE_FIREBASE_APP_ID ? () => import('./service.js') : null;

/** Local development against the Firebase Emulator Suite: set to a host (e.g. 127.0.0.1). */
export const EMULATOR_HOST = ONLINE ? import.meta.env.VITE_FIREBASE_EMULATOR_HOST || '' : '';
