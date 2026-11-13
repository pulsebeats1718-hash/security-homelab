/**
 * UI — screen manager plus the overlays every screen shares
 * (score popups, damage vignette, scene shade).
 *
 * Back button: while an inner screen is open, one browser-history entry stands
 * for it, so Android's Back button (and the browser's) steps back inside the
 * game — exactly like Escape — instead of closing the installed app. On the
 * menu, Back leaves the app as usual.
 */
import { h, icon, retrigger } from './dom.js';

/** Screens where Back should leave the app (no history entry of their own). */
const BASE = new Set(['menu', 'splash']);

export class UI {
  constructor(app) {
    this.app = app;
    this.root = document.getElementById('ui');
    this.screens = new Map();
    this.current = null;
    this.shade = h('div.shade');
    this.fxLayer = h('div.fxlayer');
    this.vignette = h('div.vignette');
    this.toasts = h('div.notes', { role: 'status', 'aria-live': 'polite' });
    this.root.append(this.shade);
    this.popGuard = 0;
    window.addEventListener('popstate', () => this._onBack());

    // one tap sound for every button unless it opts out
    this.root.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (btn && !btn.dataset.quiet && !btn.disabled) app.audio.play(btn.dataset.sound ?? 'tap');
    });
  }

  add(name, screen) {
    screen.el.classList.add('screen');
    screen.el.dataset.screen = name;
    this.screens.set(name, screen);
    this.root.append(screen.el);
    return screen;
  }

  /** Call once all screens are registered so overlays sit on top. */
  finish() {
    this.root.append(this.fxLayer, this.vignette, this.toasts);
  }

  /**
   * A short note that slides in at the top and leaves by itself (quest done,
   * level up, streak…). tone: '' | 'gold' | 'mint' | 'fire' | 'sky'.
   */
  toast({ icon: ico = 'sparkle', title, sub = '', tone = '', ms = 2900 }) {
    const el = h(`div.note${tone ? `.note--${tone}` : ''}`, h('span.note__ico', icon(ico)), h('span.note__text', h('b', title), sub ? h('span', sub) : null));
    this.toasts.append(el);
    while (this.toasts.childElementCount > 3) this.toasts.firstChild.remove();
    setTimeout(() => {
      el.classList.add('is-out');
      setTimeout(() => el.remove(), 450);
    }, ms);
    return el;
  }

  get name() {
    return this.current?.name ?? null;
  }

  go(name, params = {}) {
    const prev = this.current;
    const screen = this.screens.get(name);
    if (!screen) return;
    if (prev) {
      prev.screen.el.classList.remove('is-on');
      prev.screen.hide?.(name);
    }
    this.current = { name, screen, params };
    this.root.dataset.screen = name;
    screen.el.classList.add('is-on');
    screen.show?.(params, prev?.name);
    this._syncHistory();
    this.shade.classList.toggle('is-on', !!screen.shade);
    this.app.events.emit('ui:screen', name);
  }

  /** Keep one history entry while an inner screen is open (see the note at the top). */
  _syncHistory() {
    try {
      const inner = !!this.current && !BASE.has(this.current.name);
      const marked = history.state?.phrasefall === true;
      if (inner && !marked) history.pushState({ phrasefall: true }, '');
      else if (!inner && marked) {
        this.popGuard++; // the popstate this causes is ours, not the player's
        history.back();
      }
    } catch {
      /* no history (some embedded frames): Back simply behaves as before */
    }
  }

  /** The player pressed Back: the open screen handles it like Escape. */
  _onBack() {
    if (this.popGuard > 0) {
      this.popGuard--;
      this._syncHistory(); // a screen opened while our own step back was under way
      return;
    }
    const cur = this.current;
    if (!cur || BASE.has(cur.name)) return;
    cur.screen.key?.({ key: 'Escape', preventDefault() {}, stopPropagation() {} });
    this._syncHistory(); // still inside (a paused game, a closed overlay): ready for the next Back
  }

  /** Floating text at a screen position (score gains). */
  popup(text, x, y, cls = '') {
    const el = h(`div.pop${cls ? '.' + cls : ''}`, { style: { left: `${x}px`, top: `${y}px` } }, text);
    this.fxLayer.append(el);
    el.addEventListener('animationend', () => el.remove());
    setTimeout(() => el.remove(), 2200);
  }

  damage() {
    retrigger(this.vignette, 'is-hit');
  }
}
