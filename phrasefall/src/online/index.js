/**
 * app.online — Google sign-in, cloud save and leaderboards (Firebase).
 *
 * This facade is always present and never imports Firebase itself. When the build has a
 * Firebase config (VITE_FIREBASE_* at build time) `start()` loads ./service.js with a dynamic
 * import(); without one, `available` is false, every call resolves to null, and the Firebase
 * SDK is not even in the bundle (the single-file preview build relies on this).
 *
 *   available            Firebase is configured in this build
 *   ready                the signed-in state is known (true at once when not available)
 *   user                 null | { uid, name, photo }   name = public nickname
 *   on(event, fn)        → unsubscribe. Events:
 *     'user'     user | null
 *     'rank'     after submitScore: { mode, board: 'daily'|'week'|'all', boardId, rank, score,
 *                counted, improved, text: '#12 today', ranks: { daily?, week?, all? } }
 *                (also emitted on app.events as 'online:rank')
 *     'sync'     { state: 'idle'|'syncing'|'synced'|'offline'|'error', at }
 *     'name-needed'  { suggestion, first }  — the account UI asks for a nickname
 *     'notice'   { text, error? }           — short messages for a toast
 *   signIn(), signOut()
 *   submitScore(result)  → Promise<rank payload | null>. result = { mode: 'classic'|'daily',
 *                        score, stage, correct, answered, bestStreak, character, dateId? }
 *   setName(name)        → Promise<{ ok, name, reason? }>
 *   checkName(name)      → { ok, name, reason? } (no network)
 *   watchBoard(kind, fn) → unsubscribe; kind 'today'|'week'|'all'; fn({ status, rows, me, boardId, error })
 *   deleteData()         → deletes the cloud save, profile and scores, then signs out
 *   resetCloud()         → after save.reset(): overwrite the cloud save with the fresh one
 */
import { ONLINE, FIREBASE_CONFIG, EMULATOR_HOST, loadService } from './config.js';
import { checkName } from './names.js';

const HINT_KEY = 'phrasefall.online.user.v1';

function readHint() {
  try {
    const h = JSON.parse(localStorage.getItem(HINT_KEY) || 'null');
    return h && typeof h.uid === 'string' && typeof h.name === 'string' ? h : null;
  } catch {
    return null;
  }
}

export function createOnline(app) {
  const listeners = new Map();
  let impl = null;
  let loading = null;

  const online = {
    available: ONLINE,
    ready: !ONLINE,
    user: null,
    /** Last known signed-in user, shown while Firebase loads so the chip does not flicker. */
    hint: ONLINE ? readHint() : null,
    sync: { state: 'idle', at: 0 },

    on(name, fn) {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(fn);
      return () => listeners.get(name)?.delete(fn);
    },
    emit(name, payload) {
      for (const fn of [...(listeners.get(name) ?? [])]) {
        try {
          fn(payload);
        } catch (err) {
          console.error(err);
        }
      }
      app.events?.emit(`online:${name}`, payload);
    },

    /** Load Firebase (once). Called at the end of boot; safe to call again. */
    start() {
      if (!ONLINE) return Promise.resolve(null);
      loading ??= loadService()
        .then((m) => (impl = m.createService(online, app, { config: FIREBASE_CONFIG, emulatorHost: EMULATOR_HOST, hintKey: HINT_KEY })))
        .catch((err) => {
          console.warn('Phrasefall online features failed to load:', err);
          online.ready = true;
          online.failed = true;
          online.emit('user', null);
          return null;
        });
      return loading;
    },

    checkName,
    signIn: () => call('signIn'),
    signOut: () => call('signOut'),
    submitScore: (result) => call('submitScore', result),
    setName: (name) => call('setName', name, { ok: false, reason: 'Online features are not available.' }),
    deleteData: () => call('deleteData'),
    /** After Settings → Reset progress: make the cloud copy match the fresh save. */
    resetCloud: () => call('resetCloud'),
    syncNow: () => call('syncNow'),
    watchBoard(kind, fn) {
      if (!ONLINE) return () => {};
      let stop = null;
      let dead = false;
      online.start().then(() => {
        if (!dead && impl) stop = impl.watchBoard(kind, fn);
      });
      return () => {
        dead = true;
        stop?.();
      };
    },
  };

  async function call(name, arg, fallback = null) {
    if (!ONLINE) return fallback;
    await online.start();
    return impl ? impl[name](arg) : fallback;
  }

  return online;
}
