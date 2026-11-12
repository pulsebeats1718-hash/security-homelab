import { h, icon, clear } from '../dom.js';
import { shots } from '../../game/shots.js';
import { CHARACTERS } from '../../characters/index.js';
import { STAGES } from '../../data/stages.js';
import { TOTAL_EXPRESSIONS } from '../../data/expressions/index.js';
import { formatScore } from '../../core/utils.js';

/** Personal Best: lifetime records at a glance. */
export function createRecords(app) {
  const { save, ui } = app;
  const body = h('div.records.scroll');
  const el = h(
    'section.sheet.sheet--narrow',
    h('div.panel.sheet__panel', h('header.bar', h('button.iconbtn', { 'aria-label': 'Back', 'data-sound': 'back', onclick: () => ui.go('menu') }, icon('back')), h('div.bar__title', 'Personal Best')), body)
  );
  const stat = (num, label) => h('div.stat', h('div.stat__num', num), h('div.stat__label', label));

  return {
    el,
    shade: true,
    show() {
      app.stage.setShot(shots.backdrop(app.stage), 1.2);
      const d = save.data;
      const answered = d.totals.correct + d.totals.wrong;
      const stage = STAGES[Math.min(STAGES.length, d.best.stage) - 1];
      clear(body).append(
        h('div.records__hero', h('div.eyebrow', 'Highest score'), h('div.records__num', formatScore(d.best.score)), d.totals.games ? h('span.chip', icon('layers'), `Furthest: Stage ${stage.n} · ${stage.short}`) : h('span.chip', 'Play a game to set a record')),
        h(
          'div.records__grid',
          stat(`×${d.best.streak}`, 'Best streak'),
          stat(String(d.totals.games), 'Games played'),
          stat(formatScore(d.totals.score), 'Total points'),
          stat(answered ? `${Math.round((d.totals.correct / answered) * 100)}%` : '–', 'Accuracy'),
          stat(`${save.masteredCount}/${TOTAL_EXPRESSIONS}`, 'Mastered'),
          stat(`${d.unlocked.length}/${CHARACTERS.length}`, 'Characters')
        ),
        save.persistent ? null : h('p.about', 'Your browser is blocking saved data here, so progress will last only until this page is closed.')
      );
    },
    key(e) {
      if (e.key === 'Escape') ui.go('menu');
    },
  };
}
