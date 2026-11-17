/** Literal Theatre — placeholder while it is being built (see src/world/theatre/). */
import { h, icon } from '../dom.js';

export function createTheatre(app) {
  const back = () => app.ui.go('menu');
  const el = h('section.sheet.sheet--narrow', h('div.panel.sheet__panel', h('header.bar', h('button.iconbtn', { 'aria-label': 'Back', 'data-sound': 'back', onclick: back }, icon('back')), h('div.bar__title', 'Literal Theatre')), h('p', 'Coming soon.')));
  return { el, shade: true, show() {}, key(e) { if (e.key === 'Escape') back(); } };
}
