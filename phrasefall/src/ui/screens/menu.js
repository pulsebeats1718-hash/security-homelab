import { h, icon, clear, wordmark } from '../dom.js';
import { shots } from '../../game/shots.js';
import { CHARACTERS, getCharacter } from '../../characters/index.js';
import { TOTAL_EXPRESSIONS, expressionsReady, whenExpressionsReady, getExpression } from '../../data/expressions/index.js';
import { utcDateId, dailyNumber, msToNextDaily, formatCountdown, DAILY_CARDS } from '../../game/daily.js';
import { formatScore } from '../../core/utils.js';

/**
 * Main menu: Play, the daily challenge and four tiles. The header keeps a slot
 * next to the settings button (`accountSlot`, `.menu__account`) for the account chip.
 */
export function createMenu(app) {
  const { save, ui, events } = app;
  const sub = { chars: h('span.tile__sub'), cards: h('span.tile__sub'), coll: h('span.tile__sub'), boards: h('span.tile__sub') };
  const dueBadge = h('span.tile__badge', { hidden: true });
  const heroName = h('div.menu__hero-name');
  const heroTitle = h('span.chip');
  const bestChip = h('span');
  const foundChip = h('span');
  const foot = h('div.menu__foot', h('span.chip.chip--gold', icon('trophy'), bestChip), h('span.chip', icon('book'), foundChip));

  const tile = (ico, label, subEl, color, go, extra = null) =>
    h('button.tile', { style: { '--tile': color }, onclick: go }, h('span.tile__ico', icon(ico), extra), h('span.tile__label', label), subEl);

  // ── play + daily challenge ──────────────────────────────────────────────
  const playLabel = h('span', 'Play');
  const playBtn = h('button.btn.btn--gold.btn--xl.menu__play', { 'data-quiet': '1', onclick: () => start('play') }, icon('play'), playLabel);
  const dailyTitle = h('span.daily__title');
  const dailySub = h('span.daily__sub');
  const dailyTag = h('span.daily__tag');
  const dailyBtn = h('button.daily', { 'data-quiet': '1', onclick: () => start('daily') }, h('span.daily__ico', icon('calendar')), h('span.daily__text', dailyTitle, dailySub), dailyTag);
  const status = h('div.menu__status', { hidden: true, role: 'status' });

  const openBoards = () => ui.go(ui.screens.has('leaderboard') ? 'leaderboard' : 'records', { from: 'menu' });

  // header: the account chip (added by the online module) sits next to the settings button
  const accountSlot = h('div.menu__account');
  const settingsBtn = h('button.iconbtn.menu__settings', { 'aria-label': 'Settings', onclick: () => ui.go('settings', { from: 'menu' }) }, icon('cog'));

  const el = h(
    'section.menu',
    h('div.menu__logo', wordmark(), h('div.menu__tag', 'Catch the meaning before it lands')),
    h('div.menu__top', accountSlot, settingsBtn),
    h(
      'nav.menu__nav',
      status,
      playBtn,
      dailyBtn,
      h(
        'div.menu__grid',
        tile('user', 'Characters', sub.chars, 'var(--violet)', () => ui.go('characters')),
        tile('cards', 'Flashcards', sub.cards, 'var(--coral)', () => ui.go('flashcards', { from: 'menu' }), dueBadge),
        tile('star', 'My Collection', sub.coll, 'var(--mint-2)', () => ui.go('collection')),
        tile('podium', 'Leaderboards', sub.boards, 'var(--gold-2)', openBoards)
      )
    ),
    foot,
    h('div.menu__hero', heroName, heroTitle)
  );
  // a wide account chip needs the logo to step down on narrow portrait screens
  new MutationObserver(() => el.classList.toggle('has-account', accountSlot.childElementCount > 0)).observe(accountSlot, { childList: true });

  // ── starting a game before the expressions have arrived ─────────────────
  let pressed = 'play';
  let pending = null;
  function start(which) {
    pressed = which;
    app.startGame(which === 'daily' ? { mode: 'daily' } : {});
  }
  function setLoading(on) {
    playBtn.classList.toggle('is-loading', on && pressed === 'play');
    dailyBtn.classList.toggle('is-loading', on && pressed === 'daily');
    clear(playLabel).append(on && pressed === 'play' ? 'Loading…' : 'Play');
    if (on) showStatus('Loading the expressions…', true);
    else status.hidden = true;
  }
  function showStatus(text, spinner = false, error = false) {
    clear(status).append(spinner ? h('span.spinner') : icon('alert'), h('span', text));
    status.classList.toggle('is-error', error);
    status.hidden = false;
  }
  // app.startGame asks the menu to wait, passing the call to repeat once the data is in
  events.on('data:wait', (resume) => {
    const waiting = !!pending;
    pending = resume;
    if (ui.name === 'menu') setLoading(true);
    if (waiting) return;
    whenExpressionsReady().then(
      () => {
        const go = pending;
        pending = null;
        setLoading(false);
        if (go && ui.name === 'menu') go();
      },
      () => {
        pending = null;
        setLoading(false);
        if (ui.name === 'menu') showStatus('The expressions could not be loaded. Check your connection and try again.', false, true);
      }
    );
  });

  // ── status ──────────────────────────────────────────────────────────────
  function refreshDaily() {
    const today = utcDateId();
    const rec = save.dailyRecord(today);
    dailyTitle.textContent = `Daily challenge #${dailyNumber(today)}`;
    clear(dailyTag);
    if (rec) {
      dailySub.textContent = `Next in ${formatCountdown(msToNextDaily())} · replay to practise`;
      dailyTag.append(h('span.daily__score', formatScore(rec.score)), h('span.daily__score-label', 'Your score'));
      dailyBtn.classList.add('is-done');
    } else {
      dailySub.textContent = `Not played yet · ${DAILY_CARDS} cards, same for everyone`;
      dailyTag.append(h('span.daily__new', 'New'));
      dailyBtn.classList.remove('is-done');
    }
  }

  function refresh() {
    const d = save.data;
    const loaded = expressionsReady();
    const known = loaded ? (id) => !!getExpression(id) : null;
    const seen = loaded ? save.seenIds.filter(known).length : save.seenIds.length;
    const due = save.dueIds(Date.now(), known).length;
    const total = loaded ? TOTAL_EXPRESSIONS.toLocaleString('en-GB') : '…';
    sub.chars.textContent = `${d.unlocked.length} of ${CHARACTERS.length} unlocked`;
    sub.cards.textContent = due ? `${due} due today` : seen ? `${seen} to review` : 'Play to collect';
    dueBadge.textContent = due > 99 ? '99+' : String(due);
    dueBadge.hidden = !due;
    sub.coll.textContent = `${save.masteredCount.toLocaleString('en-GB')} of ${total} mastered`;
    sub.boards.textContent = d.best.score ? `Best ${formatScore(d.best.score)}` : 'No games yet';
    bestChip.textContent = d.best.score ? `Best ${formatScore(d.best.score)}` : 'Set your first record';
    foundChip.textContent = `${seen.toLocaleString('en-GB')} / ${total} expressions`;
    const def = getCharacter(d.character);
    heroName.textContent = def.name;
    heroTitle.textContent = def.title;
    heroName.style.color = `#${def.accent.toString(16).padStart(6, '0')}`;
    refreshDaily();
    if (!loaded) whenExpressionsReady().then(() => ui.name === 'menu' && refresh(), () => {});
  }

  let ticker = 0;
  return {
    el,
    /** The header slot next to the settings button, for the account chip. */
    accountSlot,
    show() {
      app.game.settleInterruptedDaily?.();
      setLoading(false);
      refresh();
      clearInterval(ticker);
      ticker = setInterval(refreshDaily, 20000); // the countdown, and a new challenge at midnight UTC
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
      clearInterval(ticker);
      pending = null; // leaving the menu cancels a game waiting for the data
      setLoading(false);
      app.hero.waves = false;
    },
    relayout() {
      app.stage.setShot(shots.menu(app.stage), 0.3);
    },
  };
}
