import { h, icon, clear, countUp } from '../dom.js';
import { getCharacter } from '../../characters/index.js';
import { getExpression } from '../../data/expressions/index.js';
import { formatScore } from '../../core/utils.js';
import { formatCountdown, msToNextDaily, shareText } from '../../game/daily.js';

/** "Fri 13 Nov" for a 'YYYY-MM-DD' (UTC) id. */
const shortDate = (dateId) => new Date(`${dateId}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

/** A result's identity, to match a leaderboard rank that arrives later. */
const keyOf = (r) => `${r.mode}|${r.score}`;

/** Put text on the clipboard; where that is not allowed, select it so the player can copy it themselves. */
async function copyText(text, holder) {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return 'copied';
    } catch {
      /* fall through to selecting the text */
    }
  }
  try {
    const range = document.createRange();
    range.selectNodeContents(holder);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    if (document.execCommand?.('copy')) return 'copied';
  } catch {
    /* selection is the last resort */
  }
  return 'selected';
}

/**
 * Game-over results: score, records, unlocks and what to revise. Daily
 * challenges add the challenge number, a shareable emoji grid with a Copy
 * button and a countdown to the next challenge. Also hands every finished game
 * to the online module (`app.online.submitScore`) and shows a rank if one comes back.
 */
export function createResults(app) {
  const { ui, audio, save, events } = app;
  const eyebrow = h('div.eyebrow');
  const title = h('h2.results__title', 'Game over');
  const score = h('div.results__score', '0');
  const best = h('div.results__best');
  const badge = h('div.results__badges');
  const stats = h('div.stats');
  const body = h('div.results__body.scroll');
  const playBtn = h('button.btn.btn--gold', { 'data-quiet': '1' });
  const reviewBtn = h('button.btn');
  const el = h(
    'section.results',
    h(
      'div.panel.results__panel',
      h('div.results__head', eyebrow, title, score, badge, best),
      stats,
      body,
      h('div.results__actions', playBtn, reviewBtn, h('button.btn.btn--ink', { 'data-sound': 'back', onclick: () => app.toMenu() }, icon('home'), 'Menu'))
    )
  );

  const stat = (num, label) => h('div.stat', h('div.stat__num', num), h('div.stat__label', label));
  // portraits render in the background and may arrive after the results appear
  const pendingThumbs = new Map();
  events.on('thumb', (id) => {
    const img = pendingThumbs.get(id);
    const t = app.thumbs.get(id);
    if (img && t) {
      img.src = t.normal;
      pendingThumbs.delete(id);
    }
  });
  let timers = [];
  const later = (ms, fn) => timers.push(setTimeout(fn, ms));
  let ticker = 0;
  let shownKey = null;

  // ── scores to the online module; a rank may come back ───────────────────
  const ranks = new Map(); // result key → { rank, board }
  let listening = false;
  function showRank(key) {
    const info = ranks.get(key);
    if (!info || key !== shownKey || badge.querySelector('.results__rank')) return;
    const where = info.board === 'week' ? ' this week' : info.board === 'daily' || (!info.board && info.daily) ? ' today' : '';
    badge.append(h('span.chip.chip--gold.results__rank', icon('podium'), info.text ? `Rank ${info.text}` : `Rank #${info.rank.toLocaleString('en-GB')}${where}`));
  }
  /** `value`: a number, or app.online's rank payload { rank, board, text: '#12 today', … }. */
  function noteRank(key, value, daily) {
    const rank = typeof value === 'number' ? value : value?.rank;
    if (!Number.isFinite(rank) || rank < 1) return;
    ranks.set(key, { rank, board: value?.board, text: typeof value?.text === 'string' ? value.text : '', daily });
    showRank(key);
  }
  events.on('game:submit', (result) => {
    const online = app.online;
    if (!online?.submitScore) return;
    const key = keyOf(result);
    if (!listening && typeof online.on === 'function') {
      listening = true;
      // a rank may also be announced as an event: { mode, dateId?, score, rank, board? }
      online.on('rank', (info) => info && noteRank(keyOf(info), info, info.mode === 'daily'));
    }
    try {
      Promise.resolve(online.submitScore(result))
        .then((value) => noteRank(key, value, result.mode === 'daily'))
        .catch(() => {});
    } catch {
      /* online play is optional */
    }
  });

  // ── daily challenge: share card + countdown ─────────────────────────────
  function dailyCard(r) {
    const d = r.daily;
    const rec = d.rankedRecord;
    const countdown = h('b');
    const tick = () => (countdown.textContent = formatCountdown(msToNextDaily(), true));
    tick();
    clearInterval(ticker);
    ticker = setInterval(tick, 1000);
    const parts = [h('div.share__next', icon('calendar'), h('span', 'Next challenge in '), countdown)];
    if (rec) {
      const url = location.protocol === 'https:' ? `${location.origin}${location.pathname}` : '';
      const text = shareText({ n: rec.n || d.n, dateId: d.dateId, marks: rec.marks, total: rec.total || d.total, score: rec.score, correct: rec.correct, bestStreak: rec.bestStreak }, url);
      const pre = h('pre.share__text', text);
      const copyLabel = h('span', 'Copy');
      const copyBtn = h('button.btn.share__copy', {
        'data-quiet': '1',
        onclick: async () => {
          audio.play('tap');
          const how = await copyText(text, pre);
          clear(copyLabel).append(how === 'copied' ? 'Copied!' : 'Selected: copy it now');
          copyBtn.classList.toggle('is-done', how === 'copied');
          later(2200, () => (clear(copyLabel).append('Copy'), copyBtn.classList.remove('is-done')));
        },
      }, icon('copy'), copyLabel);
      parts.unshift(h('div.share__head', h('div.eyebrow', d.ranked ? 'Share your result' : 'Your ranked result today'), copyBtn), pre);
    }
    return h('div.share', parts);
  }

  return {
    el,
    show(r) {
      timers.forEach(clearTimeout);
      timers = [];
      clearInterval(ticker);
      const daily = r.mode === 'daily' ? r.daily : null;
      shownKey = keyOf(r);
      clear(badge);

      if (daily) {
        const ranked = daily.rankedRecord;
        eyebrow.textContent = `Daily challenge #${daily.n} · ${shortDate(daily.dateId)}`;
        title.textContent = r.reason === 'complete' ? 'Challenge complete' : 'Out of lives';
        best.textContent = daily.ranked ? (app.online?.available && app.online?.user ? 'Your ranked score for today' : 'Your score for today') : ranked ? `Practice · your ranked score is ${formatScore(ranked.score)}` : 'Practice run';
        if (!daily.ranked) badge.append(h('span.chip', icon('repeat'), 'Practice'));
        clear(stats).append(stat(`×${r.streak}`, 'Best streak'), stat(`${r.accuracy}%`, 'Accuracy'), stat(`${r.correct}/${daily.total}`, 'Correct'));
        clear(playBtn).append(icon('play'), 'Play classic');
        playBtn.onclick = () => app.startGame();
      } else {
        eyebrow.textContent = `Reached stage ${r.stage.n} · ${r.stage.short}`;
        title.textContent = 'Game over';
        best.textContent = r.newBest ? 'A new personal best' : `Personal best ${formatScore(r.best)}`;
        clear(stats).append(stat(`×${r.streak}`, 'Best streak'), stat(`${r.accuracy}%`, 'Accuracy'), stat(`${r.correct}/${r.answered}`, 'Correct'));
        clear(playBtn).append(icon('refresh'), 'Play again');
        playBtn.onclick = () => app.startGame();
      }
      showRank(shownKey);

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
      if (daily) body.append(dailyCard(r));
      r.unlocked.forEach((id, i) => {
        const def = getCharacter(id);
        later(1100 + i * 650 + (r.newBest ? 900 : 0), () => {
          const img = h('img', { alt: '' });
          const thumb = app.thumbs.get(id);
          if (thumb) img.src = thumb.normal;
          else pendingThumbs.set(id, img);
          const card = h('div.unlock', img, h('div', h('div.unlock__eyebrow', 'NEW CHARACTER'), h('div.unlock__name', `${def.name} — ${def.title}`)));
          // after the share card on daily results, first otherwise
          if (daily) body.firstChild.after(card);
          else body.prepend(card);
          audio.play('unlock');
        });
      });

      const wrong = r.wrong.filter((id) => getExpression(id));
      if (wrong.length) {
        body.append(
          h('div.eyebrow', 'Worth another look'),
          h(
            'div.review',
            wrong.map((id) => {
              const e = getExpression(id);
              return h('div.review__item', h('div.review__expr', e.text), h('div.review__mean', e.meaning));
            })
          )
        );
      } else if (r.answered > 0) {
        body.append(h('div.review__item', { style: { borderLeftColor: 'var(--mint)' } }, h('div.review__expr', 'Flawless'), h('div.review__mean', 'Not a single expression got past you.')));
      }

      const ids = wrong.length ? wrong : r.seen;
      clear(reviewBtn).append(icon('cards'), wrong.length ? 'Review' : 'Flashcards');
      reviewBtn.disabled = !ids.length && !save.seenIds.length;
      reviewBtn.onclick = () => ui.go('flashcards', { from: 'results', ids: ids.length ? ids : null, label: wrong.length ? 'Missed this game' : 'This game' });
      this.last = r;
    },
    hide(next) {
      timers.forEach(clearTimeout);
      timers = [];
      clearInterval(ticker);
      // leaving for anywhere but a review of this game puts the character back on its feet
      if (next !== 'flashcards' && next !== 'play') app.game.quit();
    },
    key(e) {
      if (e.key === 'Enter' || e.key === ' ') app.startGame();
      else if (e.key === 'Escape') app.toMenu();
    },
  };
}
