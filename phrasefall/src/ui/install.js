/**
 * "Get the app": install Phrasefall on the phone's home screen, like any other app.
 *
 *   Android, and Chrome or Edge on a computer: the browser's own install prompt
 *     (beforeinstallprompt), offered by a button on the menu and in Settings.
 *   iPhone and iPad: Safari has no prompt, so Settings shows the Share → Add to Home Screen steps.
 *   Already installed (opened from its icon, or the Android app): nothing is offered.
 *
 * The browser can raise the prompt early in start-up, so it is caught as soon as this module loads.
 * There is also a separate Android app (android/) that opens the same game.
 */
let deferred = null;
let installedNow = false;
const listeners = new Set();
const notify = () => listeners.forEach((fn) => fn());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // shown from our own button instead of the browser's banner
    deferred = e;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    installedNow = true;
    notify();
  });
}

function standalone() {
  try {
    return (
      ['standalone', 'fullscreen', 'minimal-ui'].some((m) => matchMedia(`(display-mode: ${m})`).matches) ||
      navigator.standalone === true ||
      document.referrer.startsWith('android-app://')
    );
  } catch {
    return false;
  }
}

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export const install = {
  /** 'installed' | 'ready' (the browser's prompt can be shown) | 'ios' (Add to Home Screen steps) | 'none' */
  get state() {
    if (installedNow || standalone()) return 'installed';
    if (deferred) return 'ready';
    return isIos() ? 'ios' : 'none';
  },
  /** Show the browser's install prompt. Resolves true if the player installed it. */
  async prompt() {
    const e = deferred;
    if (!e) return false;
    deferred = null; // a prompt can only be shown once
    try {
      await e.prompt();
      const choice = await e.userChoice;
      return choice?.outcome === 'accepted';
    } catch {
      return false;
    } finally {
      notify();
    }
  },
  /** Call fn whenever the state may have changed; returns an unsubscribe function. */
  onChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
