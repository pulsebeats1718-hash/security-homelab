import { h, icon, clear } from '../dom.js';
import { shots } from '../../game/shots.js';
import { CHARACTERS } from '../../characters/index.js';
import { STAGES } from '../../data/stages.js';
import { TOTAL_EXPRESSIONS, expressionsReady } from '../../data/expressions/index.js';
import { dailyNumber } from '../../game/daily.js';
import { formatScore } from '../../core/utils.js';
import { dayId, formatDay } from '../../online/dates.js';

const stat = (num, label) => h('div.stat', h('div.stat__num', num), h('div.stat__label', label));
const HISTORY_DAYS = 14;

/** Days in a row with a daily challenge played, counting back from today (or yesterday). */
function dailyStreak(daily) {
  let t = Date.now();
  if (!daily[dayId(new Date(t))]) t -= 86_400_000;
  let n = 0;
  while (daily[dayId(new Date(t))]) {
    n++;
    t -= 86_400_000;
  }
  return n;
}

/** The ranked daily attempts, newest first, as small result strips (c right, w wrong, - not reached). */
function dailyHistory(save) {
  const daily = save.data.daily ?? {};
  const ids = Object.keys(daily).sort().reverse();
  if (!ids.length) return null;
  const best = ids.reduce((m, id) => Math.max(m, daily[id].score ?? 0), 0);
  const streak = dailyStreak(daily);
  return h(
    'div.history',
    h('div.history__head', h('div.eyebrow', 'Daily challenges'), h('span.chip', icon('calendar'), streak === 1 ? '1 day in a row' : `${streak} days in a row`)),
    h(
      'div.history__list',
      ids.slice(0, HISTORY_DAYS).map((id) => {
        const r = daily[id];
        const marks = [...String(r.marks ?? '')].slice(0, 30);
        return h(
          'div.history__row',
          h('div.history__day', h('b', `#${r.n || dailyNumber(id)}`), h('span', formatDay(id, { weekday: 'short', day: 'numeric', month: 'short' }))),
          h('div.history__marks', { 'aria-label': `${r.correct ?? 0} of ${r.total || marks.length} right` }, marks.map((m) => h(`i.${m === 'c' ? 'ok' : m === 'w' ? 'no' : 'na'}`))),
          h(`div.history__score${r.score === best && best > 0 ? '.is-best' : ''}`, r.done === false ? 'Unfinished' : formatScore(r.score ?? 0))
        );
      })
    )
  );
}

/** The last seven days: XP per day as bars (flame on goal days, brolly on saved ones) and the week's totals. */
function weekReport(app) {
  const p = app.progress;
  if (!p) return null;
  const w = p.week();
  const max = Math.max(60, ...w.days.map((d) => d.xp));
  const s = p.streak;
  return h(
    'div.week-report',
    h('div.history__head', h('div.eyebrow', 'This week'), h('span.chip.chip--fire', icon('flame'), s.count === 1 ? '1-day streak' : `${s.count}-day streak`)),
    h(
      'div.bars',
      w.days.map((d) =>
        h(
          `div.bars__col${d.today ? '.is-today' : ''}${d.goal ? '.is-goal' : ''}`,
          { title: `${d.label}: ${d.xp} XP` },
          h('span.bars__xp', d.xp ? d.xp.toLocaleString('en-GB') : ''),
          h('div.bars__track', h('i', { style: { height: `${d.xp ? Math.max(6, (d.xp / max) * 100) : 0}%` } })),
          h('span.bars__mark', d.goal ? icon('flame') : d.brolly ? icon('brolly') : null),
          h('span.bars__label', d.today ? 'Today' : d.label)
        )
      )
    ),
    h(
      'div.records__grid',
      stat(w.xp.toLocaleString('en-GB'), 'XP this week'),
      stat(`${w.played}/7`, 'Days played'),
      stat(w.right.toLocaleString('en-GB'), 'Right answers'),
      stat(w.fresh.toLocaleString('en-GB'), 'New expressions'),
      stat(w.mastered.toLocaleString('en-GB'), 'Mastered'),
      stat(`Level ${p.level}`, `Best streak ${s.best} ${s.best === 1 ? 'day' : 'days'}`)
    )
  );
}

/** Personal records — the "Me" tab of the leaderboards, and the fallback Personal Best screen. */
export function recordsContent(app) {
  const { save } = app;
  const d = save.data;
  const answered = d.totals.correct + d.totals.wrong;
  const stage = STAGES[Math.min(STAGES.length, Math.max(1, d.best.stage)) - 1];
  const total = expressionsReady() ? TOTAL_EXPRESSIONS.toLocaleString('en-GB') : '…';
  return [
    h('div.records__hero', h('div.eyebrow', 'Highest score'), h('div.records__num', formatScore(d.best.score)), d.best.score ? h('span.chip', icon('layers'), `Furthest: Stage ${stage.n} · ${stage.short}`) : h('span.chip', 'Play a game to set a record')),
    h(
      'div.records__grid',
      stat(`×${d.best.streak}`, 'Best streak'),
      stat(d.totals.games.toLocaleString('en-GB'), 'Games played'),
      stat(formatScore(d.totals.score), 'Total points'),
      stat(answered ? `${Math.round((d.totals.correct / answered) * 100)}%` : '–', 'Accuracy'),
      stat(`${save.masteredCount.toLocaleString('en-GB')}/${total}`, 'Mastered'),
      stat(`${d.unlocked.length}/${CHARACTERS.length}`, 'Characters')
    ),
    weekReport(app),
    dailyHistory(save),
    save.persistent ? null : h('p.about', 'Your browser is blocking saved data here, so progress will last only until this page is closed.'),
  ].filter(Boolean);
}

/** Personal Best: lifetime records at a glance (the leaderboard screen's "Me" tab shows the same). */
export function createRecords(app) {
  const { ui } = app;
  const body = h('div.records.scroll');
  const back = () => ui.go('menu');
  const el = h(
    'section.sheet.sheet--narrow',
    h('div.panel.sheet__panel', h('header.bar', h('button.iconbtn', { 'aria-label': 'Back', 'data-sound': 'back', onclick: back }, icon('back')), h('div.bar__title', 'Personal Best')), body)
  );

  return {
    el,
    shade: true,
    show() {
      app.stage.setShot(shots.backdrop(app.stage), 1.2);
      clear(body).append(...recordsContent(app));
    },
    key(e) {
      if (e.key === 'Escape') back();
    },
  };
}
