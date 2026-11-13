/**
 * The Firebase side of app.online (see ./index.js for the public API). Loaded with a dynamic
 * import() only when the build has a Firebase config, so an unconfigured build never contains
 * any of it; Firestore itself (./firestore.js) is fetched only once someone signs in.
 *
 *   profiles/{uid}                    { name, at }                       public nickname
 *   saves/{uid}                       { v, data, rows, t, at }           cloud save (./pack.js)
 *   boards/daily-YYYY-MM-DD/scores/{uid}   first ranked daily attempt (create-only)
 *   boards/week-YYYY-Www/scores/{uid}      best classic score this ISO week
 *   boards/all/scores/{uid}                best classic score ever
 *     score docs: { name, character, score, stage, correct, answered, uid, at }
 *
 * Cloud save: on sign-in (and when the tab comes back after a long break) the cloud copy is
 * fetched, merged with this device's save (./merge.js), applied with save.replaceAll() and
 * written back; after that every save.onChange() schedules a debounced write, and leaving the
 * page writes straight away. Every write is a transaction that merges with what is in the cloud,
 * so two devices never overwrite each other's progress.
 */
import { initializeApp } from 'firebase/app';
import {
  initializeAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  inMemoryPersistence,
  browserPopupRedirectResolver,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  signInWithCredential,
  getRedirectResult,
  onAuthStateChanged,
  signOut as authSignOut,
  deleteUser,
  connectAuthEmulator,
} from 'firebase/auth';
import { mergeSaves, countersOf } from './merge.js';
import { encodeSave, decodeSave } from './pack.js';
import { checkName, defaultName } from './names.js';
import { dayId, isDayId, boardId } from './dates.js';

// { uid, base, t, e }: whose save this device holds, its counters at the last sync, the time of the
// last local change, and the account's reset epoch at the last sync
const META_KEY = 'phrasefall.cloud.v1';
const PENDING_KEY = 'phrasefall.scores.pending.v1'; // scores that could not be posted while offline
const REDIRECT_KEY = 'phrasefall.auth.redirect';
const WRITE_DELAY = 12_000; // debounce for cloud-save writes
const RESYNC_AFTER = 10 * 60_000; // re-read the cloud save when the tab returns after this long
const TOP = 50;
const RANK_TTL = 5 * 60_000;
// counting stops here (≤ 10 reads a count); further down a rank reads "#10,000+"
const RANK_CAP = 10_000;
const DAY = 86_400_000;
// keep in step with validScore() in firestore.rules
const MAX = { score: 200_000, stage: 5, answered: 500 };

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const clone = (v) => JSON.parse(JSON.stringify(v));
const fmt = (n) => n.toLocaleString('en-GB');
const place = (rank) => (rank > RANK_CAP ? `#${fmt(RANK_CAP)}+` : `#${fmt(rank)}`);
const store = {
  get(key, fallback) {
    try {
      const v = JSON.parse(localStorage.getItem(key) ?? 'null');
      return v ?? fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      if (value == null) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage blocked: lasts for the session */
    }
  },
};
const session = {
  get: (k) => {
    try {
      return sessionStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k, v) => {
    try {
      if (v == null) sessionStorage.removeItem(k);
      else sessionStorage.setItem(k, v);
    } catch {
      /* ignore */
    }
  },
};

const OFFLINE_CODES = new Set(['unavailable', 'deadline-exceeded', 'auth/network-request-failed']);
const isOffline = (err) => !navigator.onLine || OFFLINE_CODES.has(err?.code) || /offline|network/i.test(err?.message ?? '');

const AUTH_MESSAGES = {
  'auth/network-request-failed': 'No connection. Check your internet and try again.',
  'auth/unauthorized-domain': 'Sign-in is not set up for this web address yet.',
  'auth/operation-not-allowed': 'Google sign-in is not switched on for this game yet.',
  'auth/operation-not-supported-in-this-environment': 'Open Phrasefall in your browser (Safari or Chrome) to sign in.',
  'auth/web-storage-unsupported': 'Your browser is blocking the storage that sign-in needs. Try a normal (not private) window.',
  'auth/too-many-requests': 'Too many attempts. Please wait a minute and try again.',
  'auth/user-disabled': 'This account has been switched off.',
};
const authMessage = (err) => AUTH_MESSAGES[err?.code] ?? 'Sign-in did not work. Please try again.';
const QUIET_AUTH = new Set(['auth/popup-closed-by-user', 'auth/cancelled-popup-request', 'auth/user-cancelled']);

/** Installed iOS web apps can't hand a popup result back, so they sign in with a redirect. */
function iosStandalone() {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return navigator.standalone === true || (ios && matchMedia('(display-mode: standalone)').matches);
}

export function createService(online, app, { config, emulatorHost, hintKey }) {
  const { save, ui, events } = app;
  const fb = initializeApp(config);
  const auth = initializeAuth(fb, {
    persistence: [indexedDBLocalPersistence, browserLocalPersistence, inMemoryPersistence],
    popupRedirectResolver: browserPopupRedirectResolver,
  });
  const emulator = emulatorHost === 'true' || emulatorHost === '1' ? '127.0.0.1' : emulatorHost;
  if (emulator) {
    connectAuthEmulator(auth, `http://${emulator}:9099`, { disableWarnings: true });
    // automated tests sign in a made-up Google user without the popup (the emulator accepts any token)
    online.emulatorSignIn = (name = 'Test Player', email = 'player@example.com') =>
      signInWithCredential(auth, GoogleAuthProvider.credential(JSON.stringify({ sub: email, email, email_verified: true, name })));
  }

  // Firestore is only needed once someone signs in, so guests never download it
  let F = null; // the firebase/firestore module
  let db = null;
  let firestoreP = null;
  const firestore = () =>
    (firestoreP ??= import('./firestore.js').then(
      (mod) => {
        if (!db) {
          db = mod.initializeFirestore(fb, { ignoreUndefinedProperties: true });
          if (emulator) mod.connectFirestoreEmulator(db, emulator, 8080);
        }
        F = mod;
      },
      (err) => {
        firestoreP = null; // e.g. offline: try again next time
        throw err;
      }
    ));

  let user = null; // the Firebase user
  let profileName = null; // nickname from profiles/{uid}
  let meta = { uid: null, base: null, t: 0, e: 0, ...store.get(META_KEY, {}) };
  let dirty = false; // local changes not yet in the cloud
  let applying = false; // inside save.replaceAll(): not a player change
  let readOnly = false; // the cloud save is from a newer build: leave it alone
  let deleting = false;
  let linked = false; // the sign-in sync has completed for the current user
  let timer = 0;
  let hiddenAt = 0;

  const notice = (text, error = false) => online.emit('notice', { text, error });
  const setSync = (state) => {
    online.sync = { state, at: Date.now() };
    online.emit('sync', online.sync);
  };
  const writeMeta = () => store.set(META_KEY, meta);
  const scoreDoc = (board, uid = user?.uid) => F.doc(db, 'boards', board, 'scores', uid);
  const currentName = () => profileName ?? (online.hint?.uid === user?.uid ? online.hint.name : null) ?? defaultName(user?.displayName, user?.uid);
  const whenNotPlaying = () =>
    new Promise((resolve) => {
      if (ui.name !== 'play') return resolve();
      const off = events.on('ui:screen', (name) => {
        if (name !== 'play') {
          off();
          resolve();
        }
      });
    });

  // ── who is signed in ────────────────────────────────────────────────────
  function publish() {
    const u = user ? { uid: user.uid, name: currentName(), photo: user.photoURL || null } : null;
    online.user = u;
    online.hint = u;
    store.set(hintKey, u);
    online.emit('user', u);
  }

  // calls that arrive during boot (a ranked daily settled as the menu first shows) wait for this
  let authKnown = () => {};
  const authReady = new Promise((resolve) => (authKnown = resolve));
  onAuthStateChanged(auth, (u) => {
    authKnown();
    const before = user?.uid;
    user = u;
    if (!u || u.uid !== before) {
      profileName = null;
      linked = false;
    }
    online.ready = true;
    publish();
    if (u && u.uid !== before) afterSignIn(u);
    if (!u) setSync('idle');
  });

  if (session.get(REDIRECT_KEY)) {
    session.set(REDIRECT_KEY, null);
    getRedirectResult(auth).catch((err) => QUIET_AUTH.has(err?.code) || notice(authMessage(err), true));
  }

  /** Profile, cloud save and pending scores for a newly signed-in user; retried when the connection returns. */
  async function afterSignIn(u) {
    if (!profileName) await loadProfile(u);
    if (user?.uid !== u.uid) return;
    if (!linked) linked = (await sync({ apply: true })) === true;
    if (user?.uid !== u.uid || !linked) return;
    await carryOverDaily();
    flushPending();
  }

  async function loadProfile(u) {
    try {
      await firestore();
      const snap = await F.getDoc(F.doc(db, 'profiles', u.uid));
      if (user?.uid !== u.uid) return;
      const name = snap.exists() ? snap.data().name : null;
      if (name && checkName(name).ok) {
        profileName = name;
        publish();
      } else {
        online.emit('name-needed', { suggestion: name && checkName(name).ok ? name : defaultName(u.displayName, u.uid), first: !snap.exists() });
      }
    } catch (err) {
      console.warn('Profile not loaded:', err?.code ?? err);
    }
  }

  async function signIn() {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const redirect = () => {
      session.set(REDIRECT_KEY, '1');
      return signInWithRedirect(auth, provider);
    };
    if (iosStandalone()) return redirect();
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      if (err?.code === 'auth/popup-blocked') return redirect().catch((e) => notice(authMessage(e), true));
      if (QUIET_AUTH.has(err?.code)) return;
      console.warn('Sign-in failed:', err?.code ?? err);
      notice(authMessage(err), true);
    }
  }

  async function signOut() {
    if (!user) return;
    if (dirty) await Promise.race([sync(), wait(6000)]);
    clearTimeout(timer);
    // the save stays on this device; `meta.uid` remembers whose it is, so a different
    // account signing in here later starts from its own progress instead of inheriting it
    await authSignOut(auth);
  }

  async function setName(raw) {
    const check = checkName(raw);
    if (!check.ok) return check;
    const u = user;
    if (!u) return { ok: false, reason: 'Sign in first.' };
    try {
      await firestore();
    } catch {
      return { ok: false, reason: 'You are offline. Please try again when you are connected.' };
    }
    const write = F.setDoc(F.doc(db, 'profiles', u.uid), { name: check.name, at: F.serverTimestamp() });
    try {
      // offline, the write waits in Firestore's queue and goes through when the connection returns
      await Promise.race([write, wait(6000)]);
    } catch (err) {
      return { ok: false, reason: err?.code === 'permission-denied' ? 'That name was not accepted. Please try another.' : 'The name could not be saved. Please try again.' };
    }
    write.catch((err) => console.warn('Nickname not saved:', err?.code ?? err));
    profileName = check.name;
    publish();
    // follow the rename on the boards that are live now (an entry that does not exist just fails)
    for (const b of [boardId.daily(), boardId.week(), boardId.all()]) F.updateDoc(scoreDoc(b, u.uid), { name: check.name }).catch(() => {});
    return { ok: true, name: check.name };
  }

  // ── cloud save ──────────────────────────────────────────────────────────
  save.onChange(() => {
    if (applying || deleting) return;
    meta.t = Date.now();
    writeMeta();
    if (!user) return;
    dirty = true;
    schedule();
  });

  function schedule(ms = WRITE_DELAY) {
    clearTimeout(timer);
    timer = setTimeout(() => {
      // never encode a big save in the middle of a game; it goes as soon as the game ends
      if (ui.name === 'play' && app.game?.active) return schedule(4000);
      sync();
    }, ms);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      hiddenAt = Date.now();
      if (dirty) sync();
    } else if (user && hiddenAt && Date.now() - hiddenAt > RESYNC_AFTER) {
      hiddenAt = 0;
      sync({ apply: true }); // another device may have played meanwhile
    }
  });
  window.addEventListener('pagehide', () => dirty && sync());
  window.addEventListener('online', () => {
    if (user && !linked) return afterSignIn(user); // signed in while offline: finish setting up
    if (dirty) schedule(1500);
    flushPending();
  });

  // one sync at a time; requests made while one runs are folded into a single follow-up
  let chain = Promise.resolve();
  let queued = null;
  function sync({ apply = false } = {}) {
    if (queued) {
      queued.apply ||= apply;
      return queued.promise;
    }
    const job = (queued = { apply });
    job.promise = chain = chain.then(() => {
      queued = null;
      return runSync(job.apply).catch((err) => {
        console.warn('Cloud save failed:', err);
        return false;
      });
    });
    return job.promise;
  }

  function applyLocal(fn) {
    applying = true;
    try {
      return fn();
    } finally {
      applying = false;
    }
  }

  async function runSync(apply) {
    const u = user;
    if (!u || readOnly || deleting) return false;
    if (!apply && !dirty) return true;
    if (apply) await whenNotPlaying();
    await firestore();
    if (user?.uid !== u.uid) return false;

    // a save that belongs to a different account is not mixed into this one: the sign-in
    // sync (apply) starts this account from its own cloud save instead
    if (meta.uid && meta.uid !== u.uid) {
      if (!apply) return false;
      applyLocal(() => save.reset());
      meta = { uid: null, base: null, t: 0, e: 0 };
      writeMeta();
    }
    setSync('syncing');
    const local = clone(save.data);
    const localT = meta.t || 0;
    const base = meta.uid === u.uid ? meta.base : null;
    const wasDirty = dirty;
    dirty = false; // changes made from here on mark it again
    const ref = F.doc(db, 'saves', u.uid);
    let merged = null;
    let t = 0;
    let epoch = 0;
    let wasReset = false;
    try {
      await F.runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        const old = snap.exists() ? snap.data() : null;
        let cloud = null;
        let cloudT = 0;
        if (old) {
          try {
            ({ save: cloud, t: cloudT } = decodeSave(old));
          } catch (err) {
            err.unreadable = true;
            throw err;
          }
        }
        epoch = Number(old?.e) || 0;
        // progress was reset on another device since this one last synced: take the cloud copy as is
        wasReset = !!cloud && base !== null && epoch > (meta.e || 0);
        if (wasReset) {
          merged = { ...cloud, settings: local.settings };
          t = cloudT;
          return;
        }
        merged = mergeSaves(local, cloud, { localNewer: localT >= cloudT, base });
        t = Math.max(localT, cloudT);
        const fields = encodeSave(merged, t);
        if (!old || old.data !== fields.data || old.rows !== fields.rows) tx.set(ref, { ...fields, e: epoch, at: F.serverTimestamp() });
      });
    } catch (err) {
      dirty ||= wasDirty;
      if (err?.unreadable) {
        readOnly = true;
        notice('Your cloud save was made by a newer version of Phrasefall. Reload the page to update.', true);
        setSync('error');
        return false;
      }
      setSync(isOffline(err) ? 'offline' : 'error');
      if (!isOffline(err)) console.warn('Cloud save failed:', err?.code ?? err);
      else if (dirty) schedule(60_000);
      return false;
    }
    if (user?.uid !== u.uid) return false;
    if (wasReset && !apply) {
      dirty = false;
      sync({ apply: true }); // queued behind this run (awaiting it here would wait on ourselves)
      return false;
    }

    // the cloud now holds everything this device had counted
    meta = { uid: u.uid, base: countersOf(wasReset ? merged : local), t: meta.t, e: epoch };
    if (apply) {
      // anything the player did while the request was out goes on top of the merged save
      const next = dirty && !wasReset ? mergeSaves(clone(save.data), merged, { localNewer: true, base: countersOf(local) }) : merged;
      const ok = applyLocal(() => typeof save.replaceAll === 'function' && save.replaceAll(next));
      if (ok) {
        meta.base = countersOf(merged);
        meta.t = Math.max(meta.t, t);
        refreshScreens();
      } else {
        readOnly = true;
        notice('Your cloud save could not be loaded on this version. Reload the page to update.', true);
      }
    }
    writeMeta();
    setSync(dirty ? 'syncing' : 'synced');
    if (dirty) schedule();
    return true;
  }

  function refreshScreens() {
    // the menu shows the character and counts; re-show it so they match the merged save
    if (ui.name === 'menu') ui.go('menu');
    events.emit('save:replaced');
  }

  // ── scores ──────────────────────────────────────────────────────────────
  const int = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number(v) || 0)));
  function entryOf(r) {
    const stage = r.stage && typeof r.stage === 'object' ? r.stage.n : r.stage;
    const answered = int(r.answered, 0, MAX.answered);
    return {
      score: int(r.score, 0, MAX.score),
      stage: int(stage, 1, MAX.stage),
      correct: int(r.correct, 0, answered),
      answered,
      character: typeof r.character === 'string' && /^[a-z0-9-]{1,24}$/.test(r.character) ? r.character : save.data.character,
    };
  }

  // A count() costs one read per 1,000 entries it passes, so a rank deep in a big board is worth
  // reusing for a few minutes rather than recounting after every game or tab switch.
  const ranks = new Map(); // board → { score, rank, at }
  async function rankOn(board, score) {
    const hit = ranks.get(board);
    if (hit && hit.score === score && Date.now() - hit.at < RANK_TTL) return hit.rank;
    const snap = await F.getCountFromServer(F.query(F.collection(db, 'boards', board, 'scores'), F.where('score', '>', score), F.limit(RANK_CAP)));
    const rank = snap.data().count + 1; // RANK_CAP + 1 means "further down than that"
    ranks.set(board, { score, rank, at: Date.now() });
    return rank;
  }

  async function submitScore(r) {
    await authReady; // the restored session may not be known yet; signed out → the score stays local only
    const u = user;
    if (!u || !r) return null;
    const mode = r.mode === 'daily' ? 'daily' : 'classic';
    const job = {
      uid: u.uid,
      mode,
      entry: entryOf(r),
      daily: mode === 'daily' ? boardId.daily(isDayId(r.dateId) ? r.dateId : dayId()) : null,
      week: mode === 'classic' ? boardId.week() : null,
      practice: r.ranked === false || r.practice === true,
      at: Date.now(),
    };
    if (mode === 'classic' && job.entry.score <= 0) return null;
    try {
      await firestore();
      const out = await post(job, true);
      if (out) online.emit('rank', out);
      return out;
    } catch (err) {
      if (isOffline(err)) queue(job);
      else console.warn('Score not posted:', err?.code ?? err);
      return null;
    }
  }

  /** Write one finished game to its boards; with `withRank`, also work out where it placed. */
  async function post(job, withRank) {
    const data = { ...job.entry, name: currentName(), uid: job.uid, at: F.serverTimestamp() };
    if (job.mode === 'daily') {
      // the first ranked attempt of the day is the one that counts (the rules make it create-only)
      const ref = scoreDoc(job.daily, job.uid);
      let snap = await F.getDoc(ref);
      let counted = false;
      if (!snap.exists() && !job.practice) {
        try {
          await F.setDoc(ref, data);
          counted = true;
        } catch (err) {
          if (err?.code !== 'permission-denied') throw err;
          snap = await F.getDoc(ref); // another tab posted first, or the day has closed
        }
      }
      const score = counted ? job.entry.score : snap.exists() ? snap.data().score : null;
      if (!withRank || score == null) return null;
      const pos = await rankOn(job.daily, score);
      return { mode: 'daily', board: 'daily', boardId: job.daily, rank: pos, capped: pos > RANK_CAP, score, counted, improved: counted, text: `${place(pos)} today`, ranks: { daily: pos } };
    }
    // classic: the weekly and all-time boards keep each player's best
    const boards = [job.week, boardId.all()];
    const snaps = await Promise.all(boards.map((b) => F.getDoc(scoreDoc(b, job.uid))));
    const batch = F.writeBatch(db);
    const best = [];
    const improved = [];
    boards.forEach((b, i) => {
      const old = snaps[i].exists() ? snaps[i].data() : null;
      improved[i] = !old || job.entry.score > (old.score ?? 0);
      best[i] = improved[i] ? job.entry.score : old.score;
      if (improved[i]) batch.set(scoreDoc(b, job.uid), data);
    });
    if (improved.some(Boolean)) await batch.commit();
    if (!withRank) return null;
    const [week, all] = await Promise.all([rankOn(boards[0], best[0]), improved[1] ? rankOn(boards[1], best[1]) : null]);
    return { mode: 'classic', board: 'week', boardId: boards[0], rank: week, capped: week > RANK_CAP, score: best[0], counted: true, improved: improved[0], text: `${place(week)} this week`, ranks: { week, all } };
  }

  function queue(job) {
    const list = store.get(PENDING_KEY, []).filter((j) => Date.now() - j.at < 7 * DAY);
    list.push(job);
    store.set(PENDING_KEY, list.slice(-20));
  }

  let flushing = false;
  async function flushPending() {
    if (!user || flushing || !navigator.onLine) return;
    const list = store.get(PENDING_KEY, []).filter((j) => Date.now() - j.at < 7 * DAY);
    if (!list.length) return;
    try {
      await firestore();
    } catch {
      return;
    }
    flushing = true;
    const keep = [];
    for (const job of list) {
      if (job.uid !== user?.uid) {
        keep.push(job); // another account's game: waits for that account
        continue;
      }
      try {
        await post(job, false);
      } catch (err) {
        if (isOffline(err)) keep.push(job); // anything the rules refuse (a closed day) is dropped
      }
    }
    store.set(PENDING_KEY, keep);
    flushing = false;
  }

  /** A daily challenge finished as a guest before signing in today still makes today's board. */
  async function carryOverDaily() {
    const today = dayId();
    const rec = save.data.daily?.[today];
    if (!rec?.done || !user) return;
    const total = Math.max(1, rec.total || rec.answered || 1);
    const stage = Math.min(5, 1 + Math.floor((Math.max(0, (rec.answered || 1) - 1) * 5) / total));
    try {
      await firestore();
      await post({ uid: user.uid, mode: 'daily', entry: entryOf({ ...rec, stage, character: save.data.character }), daily: boardId.daily(today), at: Date.now() }, false);
    } catch {
      /* offline or already there */
    }
  }

  // ── leaderboards ────────────────────────────────────────────────────────
  function watchBoard(kind, fn) {
    let stop = null;
    let dead = false;
    firestore().then(
      () => dead || (stop = watchBoardNow(kind, fn)),
      () => dead || fn({ status: 'error', error: 'unavailable', rows: [], me: null })
    );
    return () => {
      dead = true;
      stop?.();
    };
  }

  function watchBoardNow(kind, fn) {
    const u = user;
    const board = kind === 'today' ? boardId.daily() : kind === 'week' ? boardId.week() : boardId.all();
    const col = F.collection(db, 'boards', board, 'scores');
    const state = { status: 'loading', boardId: board, rows: [], me: null, error: null };
    let alive = true;
    let stopTop = null;
    let mine = null; // this player's entry, if any
    let rankedFor = null;
    const emit = () => alive && fn({ ...state });

    async function updateMe() {
      const row = u && state.rows.find((r) => r.uid === u.uid);
      if (row) state.me = { rank: row.rank, score: row.score, character: row.character, inTop: true };
      else if (!mine) state.me = null;
      else if (rankedFor !== mine.score) {
        rankedFor = mine.score;
        try {
          const rank = await rankOn(board, mine.score);
          if (alive) state.me = { rank, capped: rank > RANK_CAP, score: mine.score, character: mine.character, inTop: false };
        } catch {
          rankedFor = null;
        }
      }
      emit();
    }

    function listen(ordered) {
      stopTop?.();
      const order = ordered ? [F.orderBy('score', 'desc'), F.orderBy('at', 'asc')] : [F.orderBy('score', 'desc')];
      stopTop = F.onSnapshot(
        F.query(col, ...order, F.limit(TOP)),
        (snap) => {
          let rank = 0;
          let prev = null;
          state.rows = snap.docs.map((d, i) => {
            const x = d.data();
            if (x.score !== prev) {
              rank = i + 1; // equal scores share a place
              prev = x.score;
            }
            return { uid: d.id, name: x.name, character: x.character, score: x.score, stage: x.stage, rank, me: !!u && d.id === u.uid };
          });
          state.status = 'ready';
          state.error = null;
          updateMe();
        },
        (err) => {
          // the composite index (firestore.indexes.json) may not be deployed yet
          if (ordered && err?.code === 'failed-precondition') return listen(false);
          state.status = 'error';
          state.error = err?.code ?? 'error';
          emit();
        }
      );
    }
    listen(true);
    emit();
    const stopMe = u
      ? F.onSnapshot(
          F.doc(col, u.uid),
          (snap) => {
            mine = snap.exists() ? snap.data() : null;
            if (state.status === 'ready') updateMe();
          },
          () => {}
        )
      : null;
    return () => {
      alive = false;
      stopTop?.();
      stopMe?.();
    };
  }

  /**
   * After Settings → Reset progress: overwrite the cloud copy with the fresh save (a merge would
   * bring the old progress straight back) and start a new epoch, so other devices adopt the reset
   * instead of uploading their old copy. Leaderboard entries stay; "Delete my data" removes those.
   */
  async function resetCloud() {
    const u = user;
    if (!u) return false;
    clearTimeout(timer);
    dirty = false;
    const fresh = clone(save.data);
    const now = Date.now();
    meta = { uid: u.uid, base: countersOf(fresh), t: now, e: now };
    writeMeta();
    try {
      await firestore();
      await F.setDoc(F.doc(db, 'saves', u.uid), { ...encodeSave(fresh, now), e: now, at: F.serverTimestamp() });
      setSync('synced');
      return true;
    } catch (err) {
      console.warn('Cloud reset failed:', err?.code ?? err);
      setSync(isOffline(err) ? 'offline' : 'error');
      return false;
    }
  }

  // ── delete my data ──────────────────────────────────────────────────────
  async function deleteData() {
    const u = user;
    if (!u) return { ok: false, reason: 'Sign in first.' };
    deleting = true;
    clearTimeout(timer);
    try {
      await firestore();
      const refs = [F.doc(db, 'saves', u.uid), F.doc(db, 'profiles', u.uid)];
      try {
        const snap = await F.getDocs(F.query(F.collectionGroup(db, 'scores'), F.where('uid', '==', u.uid)));
        refs.push(...snap.docs.map((d) => d.ref));
      } catch {
        // without the collection-group index: at least every board that is live now
        const now = new Date();
        for (const b of [boardId.daily(dayId(now)), boardId.daily(dayId(new Date(+now - DAY))), boardId.week(now), boardId.week(new Date(+now - 7 * DAY)), boardId.all()]) refs.push(scoreDoc(b, u.uid));
      }
      for (let i = 0; i < refs.length; i += 400) {
        const batch = F.writeBatch(db);
        for (const ref of refs.slice(i, i + 400)) batch.delete(ref);
        await batch.commit();
      }
    } catch (err) {
      deleting = false;
      return { ok: false, reason: isOffline(err) ? 'You are offline. Connect to the internet and try again.' : 'Something went wrong. Please try again.' };
    }
    // the progress on this device stays, as a guest save that is nobody's yet
    meta = { uid: null, base: null, t: meta.t, e: 0 };
    writeMeta();
    store.set(PENDING_KEY, store.get(PENDING_KEY, []).filter((j) => j.uid !== u.uid));
    dirty = false;
    try {
      await deleteUser(u); // removes the sign-in record too, when the sign-in is recent enough
    } catch {
      await authSignOut(auth).catch(() => {});
    }
    deleting = false;
    return { ok: true };
  }

  return { signIn, signOut, setName, submitScore, watchBoard, deleteData, resetCloud, syncNow: () => sync({ apply: true }) };
}
