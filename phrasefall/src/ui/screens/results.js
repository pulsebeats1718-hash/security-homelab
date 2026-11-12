import { h, icon, clear, countUp } from '../dom.js';
import { getCharacter } from '../../characters/index.js';
import { getExpression } from '../../data/expressions/index.js';
import { formatScore } from '../../core/utils.js';

/** Game-over results: score, records, unlocks and what to revise. */
export function createResults(app) {
  const { ui, audio, save } = app;
  const eyebrow = h('div.eyebrow');
  const score = h('div.results__score', '0');
  const best = h('div.results__best');
  const badge = h('div');
  const stats = h('div.stats');
  const body = h('div.results__body.scroll');
  const reviewBtn = h('button.btn');
  const el = h(
    'section.results',
    h(
      'div.panel.results__panel',
      h('div.results__head', eyebrow, h('h2.results__title', 'Game over'), score, badge, best),
      stats,
      body,
      h(
        'div.results__actions',
        h('button.btn.btn--gold', { 'data-quiet': '1', onclick: () => app.startGame() }, icon('refresh'), 'Play again'),
        reviewBtn,
        h('button.btn.btn--ink', { 'data-sound': 'back', onclick: () => app.toMenu() }, icon('home'), 'Menu')
      )
    )
  );

  const stat = (num, label) => h('div.stat', h('div.stat__num', num), h('div.stat__label', label));
  // portraits render in the background and may arrive after the results appear
  const pendingThumbs = new Map();
  app.events.on('thumb', (id) => {
    const img = pendingThumbs.get(id);
    const t = app.thumbs.get(id);
    if (img && t) {
      img.src = t.normal;
      pendingThumbs.delete(id);
    }
  });
  let timers = [];
  const later = (ms, fn) => timers.push(setTimeout(fn, ms));

  return {
    el,
    show(r) {
      timers.forEach(clearTimeout);
      timers = [];
      eyebrow.textContent = `Reached stage ${r.stage.n} · ${r.stage.short}`;
      clear(badge);
      best.textContent = r.newBest ? 'A new personal best' : `Personal best ${formatScore(r.best)}`;
      clear(stats).append(stat(`×${r.streak}`, 'Best streak'), stat(`${r.accuracy}%`, 'Accuracy'), stat(`${r.correct}/${r.answered}`, 'Correct'));

      score.textContent = '0';
      later(350, () => countUp(score, r.score, { ms: Math.min(1400, 500 + r.score / 4), onTick: () => audio.play('count') }));
      if (r.newBest) {
        later(1500, () => {
          badge.append(h('div.ribbon', 'NEW BEST'));
          audio.play('newBest');
          app.fx.confetti({ x: 0.3, y: 2.2, z: 0 }, { count: 80, spread: 4.5 });
        });
      }

      clear(body);
      r.unlocked.forEach((id, i) => {
        const def = getCharacter(id);
        later(1100 + i * 650 + (r.newBest ? 900 : 0), () => {
          const img = h('img', { alt: '' });
          const thumb = app.thumbs.get(id);
          if (thumb) img.src = thumb.normal;
          else pendingThumbs.set(id, img);
          body.prepend(h('div.unlock', img, h('div', h('div.unlock__eyebrow', 'NEW CHARACTER'), h('div.unlock__name', `${def.name} — ${def.title}`))));
          audio.play('unlock');
        });
      });

      if (r.wrong.length) {
        body.append(
          h('div.eyebrow', 'Worth another look'),
          h(
            'div.review',
            r.wrong.map((id) => {
              const e = getExpression(id);
              return h('div.review__item', h('div.review__expr', e.text), h('div.review__mean', e.meaning));
            })
          )
        );
      } else if (r.answered > 0) {
        body.append(h('div.review__item', { style: { borderLeftColor: 'var(--mint)' } }, h('div.review__expr', 'Flawless'), h('div.review__mean', 'Not a single expression got past you.')));
      }

      const ids = r.wrong.length ? r.wrong : r.seen;
      clear(reviewBtn).append(icon('cards'), r.wrong.length ? 'Review' : 'Flashcards');
      reviewBtn.disabled = !ids.length && !save.seenIds.length;
      reviewBtn.onclick = () => ui.go('flashcards', { from: 'results', ids: ids.length ? ids : null, label: r.wrong.length ? 'Missed this game' : 'This game' });
      this.last = r;
    },
    hide(next) {
      timers.forEach(clearTimeout);
      timers = [];
      // leaving for anywhere but a review of this game puts the character back on its feet
      if (next !== 'flashcards' && next !== 'play') app.game.quit();
    },
    key(e) {
      if (e.key === 'Enter' || e.key === ' ') app.startGame();
      else if (e.key === 'Escape') app.toMenu();
    },
  };
}
