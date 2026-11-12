/** Tiny DOM helpers — the interface is plain DOM over the 3D canvas, no framework. */
import { ICONS } from './icons.js';

/**
 * h('button.btn.btn--gold', { onclick, 'aria-label': 'Play' }, 'Play')
 * Props: class, style (object, supports --vars), on* listeners, html, text, anything else → attribute.
 */
export function h(tag, props, ...kids) {
  const [name, ...classes] = tag.split('.');
  const el = document.createElement(name || 'div');
  if (classes.length) el.className = classes.join(' ');
  if (props && typeof props === 'object' && !props.nodeType && !Array.isArray(props)) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = `${el.className} ${v}`.trim();
      else if (k === 'style') for (const [sk, sv] of Object.entries(v)) sk.startsWith('--') ? el.style.setProperty(sk, sv) : (el.style[sk] = sv);
      else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'text') el.textContent = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  } else if (props != null) {
    kids.unshift(props);
  }
  for (const kid of kids.flat(3)) {
    if (kid == null || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

/** Inline SVG icon by name (see icons.js). */
export function icon(name, cls = '') {
  const def = ICONS[name] ?? ICONS.star;
  const span = document.createElement('span');
  span.innerHTML = `<svg class="ico ${def.fill ? 'fill' : ''} ${cls}" viewBox="0 0 24 24" aria-hidden="true">${def.d}</svg>`;
  return span.firstChild;
}

export const clear = (el) => {
  while (el.firstChild) el.firstChild.remove();
  return el;
};

/** Restart a CSS animation class. */
export function retrigger(el, cls) {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

/** Animate a number counting up inside an element. */
export function countUp(el, to, { from = 0, ms = 900, format = (n) => Math.round(n).toLocaleString('en-GB'), onTick } = {}) {
  const start = performance.now();
  let last = -1;
  function frame(now) {
    const u = Math.min(1, (now - start) / ms);
    const e = 1 - Math.pow(1 - u, 3);
    const v = from + (to - from) * e;
    el.textContent = format(v);
    const step = Math.floor(e * 14);
    if (step !== last) {
      last = step;
      onTick?.();
    }
    if (u < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

/** The Phrasefall wordmark: PHRASE sits steady, FALL tumbles away. */
export function wordmark() {
  const letters = [
    ['P', 'a', 0, -3],
    ['h', 'a', 0.015, 2],
    ['r', 'a', 0, -2],
    ['a', 'a', 0.02, 3],
    ['s', 'a', 0, -2],
    ['e', 'a', 0.015, 2],
    ['f', 'b', 0.06, 5, 0.2],
    ['a', 'b', 0.17, 9, 0.28],
    ['l', 'b', 0.31, 14, 0.36],
    ['l', 'b', 0.48, 21, 0.46],
  ];
  const layer = (kind) =>
    h(
      `div.wordmark__layer.wordmark__layer--${kind}`,
      { 'aria-hidden': 'true' },
      letters.map(([ch, cls, y, r, s], i) => h('span', { class: cls, style: { '--i': i, '--y': `${y}em`, '--r': `${r}deg`, '--s': `${s ?? 0}em` } }, ch.toUpperCase()))
    );
  return h('div.wordmark', { role: 'img', 'aria-label': 'Phrasefall' }, layer('out'), layer('fill'));
}
