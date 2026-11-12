import { h, icon, wordmark } from '../dom.js';
import { shots } from '../../game/shots.js';
import { CHARACTERS, getCharacter } from '../../characters/index.js';
import { TOTAL_EXPRESSIONS } from '../../data/expressions/index.js';
import { formatScore } from '../../core/utils.js';

export function createMenu(app) {
  const { save, ui } = app;
  const sub = { chars: h('span.tile__sub'), cards: h('span.tile__sub'), coll: h('span.tile__sub'), best: h('span.tile__sub') };
  const heroName = h('div.menu__hero-name');
  const heroTitle = h('span.chip');
  const bestChip = h('span');
  const foot = h('div.menu__foot', h('span.chip.chip--gold', icon('trophy'), bestChip));

  const tile = (ico, label, subEl, color, go) =>
    h('button.tile', { style: { '--tile': color }, onclick: go }, h('span.tile__ico', icon(ico)), h('span.tile__label', label), subEl);

  const el = h(
    'section.menu',
    h('div.menu__logo', wordmark(), h('div.menu__tag', 'Catch the meaning before it lands')),
    h('button.iconbtn.menu__settings', { 'aria-label': 'Settings', onclick: () => ui.go('settings', { from: 'menu' }) }, icon('cog')),
    h(
      'nav.menu__nav',
      h('button.btn.btn--gold.btn--xl.menu__play', { 'data-quiet': '1', onclick: () => app.startGame() }, icon('play'), 'Play'),
      h(
        'div.menu__grid',
        tile('user', 'Characters', sub.chars, 'var(--violet)', () => ui.go('characters')),
        tile('cards', 'Flashcards', sub.cards, 'var(--coral)', () => ui.go('flashcards', { from: 'menu' })),
        tile('star', 'My Collection', sub.coll, 'var(--mint-2)', () => ui.go('collection')),
        tile('trophy', 'Personal Best', sub.best, 'var(--gold-2)', () => ui.go('records'))
      )
    ),
    foot,
    h('div.menu__hero', heroName, heroTitle)
  );

  function refresh() {
    const d = save.data;
    const seen = save.seenIds.length;
    sub.chars.textContent = `${d.unlocked.length} of ${CHARACTERS.length} unlocked`;
    sub.cards.textContent = seen ? `${seen} to review` : 'Play to collect';
    sub.coll.textContent = `${save.masteredCount.toLocaleString('en-GB')} of ${TOTAL_EXPRESSIONS.toLocaleString('en-GB')} mastered`;
    sub.best.textContent = d.best.score ? formatScore(d.best.score) : 'No games yet';
    bestChip.textContent = d.best.score ? `Best ${formatScore(d.best.score)}` : 'Set your first record';
    const def = getCharacter(d.character);
    heroName.textContent = def.name;
    heroTitle.textContent = def.title;
    heroName.style.color = `#${def.accent.toString(16).padStart(6, '0')}`;
  }

  return {
    el,
    show() {
      refresh();
      app.hero.set(save.data.character, { effect: false, clip: null });
      app.hero.face();
      app.hero.waves = true;
      app.env.setTheme('sunrise', 1.6);
      app.env.setDim(0);
      app.fx.setDizzy(false);
      app.stage.setShot(shots.menu(app.stage), 1.1);
      app.audio.music?.muffle(false);
      app.audio.music?.set('menu');
    },
    hide() {
      app.hero.waves = false;
    },
    relayout() {
      app.stage.setShot(shots.menu(app.stage), 0.3);
    },
  };
}
