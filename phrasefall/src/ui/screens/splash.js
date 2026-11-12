import { h, icon, wordmark } from '../dom.js';
import { shots } from '../../game/shots.js';

/** Title screen. The first tap also unlocks audio (browsers require a gesture). */
export function createSplash(app) {
  const el = h(
    'section.splash.hit',
    { onclick: () => app.enter() },
    h('div.splash__logo', wordmark(), h('div.splash__tag', 'Catch the meaning before it lands')),
    h('div.splash__cta', h('button.btn.btn--gold.btn--xl', { 'data-quiet': '1' }, icon('play'), 'Tap to play'), h('div.splash__note', 'Best with sound on'))
  );
  return {
    el,
    show() {
      app.stage.setShot(shots.title(app.stage), 0);
      app.hero.waves = true;
    },
  };
}
