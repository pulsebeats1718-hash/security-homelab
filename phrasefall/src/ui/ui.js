/**
 * UI — screen manager plus the overlays every screen shares
 * (score popups, damage vignette, scene shade).
 */
import { h, retrigger } from './dom.js';

export class UI {
  constructor(app) {
    this.app = app;
    this.root = document.getElementById('ui');
    this.screens = new Map();
    this.current = null;
    this.shade = h('div.shade');
    this.fxLayer = h('div.fxlayer');
    this.vignette = h('div.vignette');
    this.root.append(this.shade);

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
    this.root.append(this.fxLayer, this.vignette);
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
    screen.el.classList.add('is-on');
    screen.show?.(params, prev?.name);
    this.shade.classList.toggle('is-on', !!screen.shade);
    this.app.events.emit('ui:screen', name);
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
