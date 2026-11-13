import { h, icon, clear } from '../dom.js';
import { shots } from '../../game/shots.js';
import { formatScore } from '../../core/utils.js';
import { dailyNumber } from '../../game/daily.js';
import { dayId, weekId, msToNextDay, msToNextWeek, formatSpan, formatDay } from '../../online/dates.js';
import { recordsContent } from './records.js';
import { signInButton } from '../account.js';

const TABS = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This week' },
  { id: 'all', label: 'All time' },
  { id: 'me', label: 'Me' },
];
const ERRORS = {
  'permission-denied': 'The leaderboards are not set up on the server yet.',
  unavailable: 'Check your internet connection and try again.',
};

/**
 * Leaderboards: Today (the daily challenge), This week and All time (best classic games), and
 * Me (personal records and daily history, which also works offline and as a guest). The online
 * boards show the top 50 and update live while the screen is open.
 */
export function createLeaderboard(app) {
  const { ui, online } = app;
  let tab = null;
  let stop = null; // live board subscription
  let board = null; // last state from online.watchBoard
  let watching = null; // `${tab}:${uid}:${day}` the subscription is for
  let ticker = 0;

  const tabs = h('div.tabs.lb__tabs', { role: 'tablist' });
  const caption = h('div.lb__caption');
  const body = h('div.lb__body');
  const list = h('div.scroll.lb__list', caption, body);
  const pin = h('div.lb__pin');
  const el = h(
    'section.sheet',
    h(
      'div.panel.sheet__panel.lb',
      h('header.bar', h('button.iconbtn', { 'aria-label': 'Back', 'data-sound': 'back', onclick: () => ui.go('menu') }, icon('back')), h('div.bar__title', 'Leaderboards')),
      tabs,
      list,
      pin
    )
  );

  // portraits render in the background after start-up; fill any that arrive late
  const waitingThumbs = new Map();
  app.events.on('thumb', (id) => {
    const t = app.thumbs.get(id);
    for (const img of waitingThumbs.get(id) ?? []) img.src = t.normal;
    waitingThumbs.delete(id);
  });
  function face(character) {
    const img = h('img', { alt: '', decoding: 'async' });
    const t = app.thumbs.get(character);
    if (t) img.src = t.normal;
    else if (character) waitingThumbs.set(character, [...(waitingThumbs.get(character) ?? []), img]);
    return h('span.lb-row__face', img);
  }

  const row = (r, pinned = false) =>
    h(
      `div.lb-row${r.me ? '.is-me' : ''}${r.rank <= 3 ? `.is-top.is-top${r.rank}` : ''}${pinned ? '.is-pinned' : ''}`,
      h('span.lb-row__rank', { 'aria-label': `Rank ${r.rank}` }, r.rank.toLocaleString('en-GB')),
      face(r.character),
      h('span.lb-row__name', h('span', r.name ?? 'Player'), r.me ? h('span.lb-row__you', 'You') : null),
      h('span.lb-row__score', formatScore(r.score ?? 0))
    );

  const empty = (ico, title, text, ...actions) => h('div.empty.lb__empty', h('div.empty__ico', icon(ico)), h('div', h('b', title), text), ...actions);
  const playDaily = () => h('button.btn.btn--gold', { 'data-quiet': '1', onclick: () => app.startGame({ mode: 'daily' }) }, icon('play'), "Play today's challenge");
  const play = () => h('button.btn.btn--gold', { 'data-quiet': '1', onclick: () => app.startGame() }, icon('play'), 'Play');

  function renderTabs() {
    clear(tabs);
    for (const t of TABS) {
      tabs.append(h(`button.tab${t.id === tab ? '.is-on' : ''}`, { role: 'tab', 'aria-selected': String(t.id === tab), onclick: () => setTab(t.id) }, t.label));
    }
  }

  function renderCaption() {
    clear(caption);
    if (tab === 'me' || !online?.user) return;
    const now = Date.now();
    if (tab === 'today') {
      const day = dayId();
      caption.append(h('div.lb__what', h('b', `Daily challenge #${dailyNumber(day)}`), h('span', formatDay(day))), h('div.lb__when', `First run counts · new challenge in ${formatSpan(msToNextDay(now))}`));
    } else if (tab === 'week') {
      caption.append(h('div.lb__what', h('b', `Week ${Number(weekId().slice(-2))}`), h('span', 'Best classic game, Monday to Sunday (UTC)')), h('div.lb__when', `Resets in ${formatSpan(msToNextWeek(now))}`));
    } else {
      caption.append(h('div.lb__what', h('b', 'All time'), h('span', 'Best classic game ever')));
    }
  }

  function render() {
    renderTabs();
    renderCaption();
    clear(body);
    clear(pin);
    list.classList.toggle('is-records', tab === 'me');
    if (tab === 'me') {
      body.append(h('div.records', ...recordsContent(app)));
      return;
    }
    if (!online?.available) {
      body.append(empty('podium', "Online leaderboards aren't available in this preview", 'Your personal records and daily challenges are under Me.', h('button.btn.btn--ink', { onclick: () => setTab('me') }, icon('user'), 'Show my records')));
      return;
    }
    if (!online.ready) {
      body.append(h('div.lb__loading', h('span.spinner'), 'Connecting…'));
      return;
    }
    if (!online.user) {
      body.append(
        empty(
          'podium',
          'Join the leaderboards',
          'Sign in with Google to post your scores, see how you rank in today’s challenge and keep your progress safe in the cloud. Playing as a guest works too.',
          signInButton(app)
        )
      );
      return;
    }
    if (!board || board.status === 'loading') {
      body.append(h('div.lb__loading', h('span.spinner'), 'Loading the leaderboard…'));
      return;
    }
    if (board.status === 'error') {
      body.append(empty('alert', 'The leaderboard could not be loaded', ERRORS[board.error] ?? 'Please try again in a moment.', h('button.btn.btn--ink', { onclick: () => watch(true) }, icon('refresh'), 'Try again')));
      return;
    }
    if (!board.rows.length) {
      body.append(
        tab === 'today'
          ? empty('calendar', 'No scores yet today', 'Be the first on the board: everyone gets the same 20 expressions.', playDaily())
          : empty('trophy', tab === 'week' ? 'No scores this week yet' : 'No scores yet', 'Finish a classic game to put your name up here.', play())
      );
      return;
    }
    body.append(h('div.lb__rows', board.rows.map((r) => row(r))));
    const me = board.me;
    if (me && !me.inTop) {
      pin.append(row({ rank: me.rank, name: online.user.name, character: app.save.data.character, score: me.score, me: true }, true));
    } else if (!me) {
      pin.append(h('div.lb__invite', h('span', tab === 'today' ? 'Play today’s challenge to join this board.' : 'Finish a classic game to join this board.'), tab === 'today' ? playDaily() : play()));
    }
  }

  // ── live data ───────────────────────────────────────────────────────────
  function unwatch() {
    stop?.();
    stop = null;
    watching = null;
  }
  function watch(force = false) {
    const key = tab !== 'me' && online?.user ? `${tab}:${online.user.uid}:${tab === 'today' ? dayId() : weekId()}` : null;
    if (!force && key === watching) return;
    unwatch();
    board = null;
    if (!key) return;
    watching = key;
    stop = online.watchBoard(tab, (state) => {
      board = state;
      if (ui.name === 'leaderboard') render();
    });
  }

  function setTab(id) {
    if (id === tab) return;
    tab = id;
    watch();
    render();
    list.scrollTop = 0;
  }

  online?.on('user', () => {
    if (ui.name !== 'leaderboard') return;
    watch();
    render();
  });

  return {
    el,
    shade: true,
    show(p = {}) {
      app.stage.setShot(shots.backdrop(app.stage), 1.2);
      tab = TABS.some((t) => t.id === p.tab) ? p.tab : tab ?? (online?.available ? 'today' : 'me');
      watch();
      render();
      list.scrollTop = 0;
      clearInterval(ticker);
      ticker = setInterval(() => {
        watch(); // a new day or week starts a new board
        renderCaption();
      }, 30_000);
    },
    hide() {
      clearInterval(ticker);
      unwatch(); // no live reads while nobody is looking
    },
    key(e) {
      if (e.key === 'Escape') ui.go('menu');
      else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        const i = TABS.findIndex((t) => t.id === tab);
        setTab(TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length].id);
      }
    },
  };
}
