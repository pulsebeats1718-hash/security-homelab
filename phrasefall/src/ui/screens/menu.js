import { h, icon, clear, wordmark } from '../dom.js';
import { shots } from '../../game/shots.js';
import { CHARACTERS, getCharacter } from '../../characters/index.js';
import { TOTAL_EXPRESSIONS, expressionsReady, whenExpressionsReady, getExpression } from '../../data/expressions/index.js';
import { utcDateId, dailyNumber, msToNextDaily, formatCountdown, DAILY_CARDS } from '../../game/daily.js';
import { formatScore } from '../../core/utils.js';
import { ring } from './today.js';
import { getPlace } from '../../data/places.js';
import { loadSituations } from '../../data/situations/index.js';

/**
 * Main menu: today's strip (level, streak, daily goal, quests), Play (with Relax
 * and Challenge a friend beside it), the daily challenge (with Situations beside
 * it) and four tiles. The header keeps a slot next to the settings button
 * (`accountSlot`, `.menu__account`) for the account chip.
 */
export function createMenu(app) {
  const { save, ui, events, progress, audio } = app;
  const sub = { chars: h('span.tile__sub'), cards: h('span.tile__sub'), coll: h('span.tile__sub'), boards: h('span.tile__sub') };
  const dueBadge = h('span.tile__badge', { hidden: true });
  const heroName = h('div.menu__hero-name');
  const heroTitle = h('span.chip');
  // the memory garden: how many flowers, and a tap to water the thirsty ones
  const gardenIco = h('span.garden-chip__ico');
  const gardenText = h('span');
  const gardenChip = h('button.chip.garden-chip', { 'data-quiet': '1', onclick: () => onGarden() }, gardenIco, gardenText);
  const bestChip = h('span');
  const foundChip = h('span');
  const foot = h('div.menu__foot', h('span.chip.chip--gold', icon('trophy'), bestChip), h('span.chip', icon('book'), foundChip));

  const tile = (ico, label, subEl, color, go, extra = null) =>
    h('button.tile', { style: { '--tile': color }, onclick: go }, h('span.tile__ico', icon(ico), extra), h('span.tile__label', label), subEl);

  // ── play + daily challenge ──────────────────────────────────────────────
  const playLabel = h('span', 'Play');
  const playBtn = h('button.btn.btn--gold.btn--xl.menu__play', { 'data-quiet': '1', onclick: () => start('play') }, icon('play'), playLabel);
  // two more ways to play, beside Play so the menu stays the same height
  const relaxBtn = h('button.mode-btn.mode-btn--relax', { 'data-quiet': '1', title: 'Relax: no lives, no rush', onclick: () => start('relax') }, h('span.mode-btn__ico', icon('leaf')), h('span.mode-btn__label', 'Relax'));
  const duelBtn = h('button.mode-btn.mode-btn--duel', { 'data-quiet': '1', title: 'Friends: challenge a friend by link, or play a party game on this phone', onclick: () => (audio.play('select'), ui.go('duel', { from: 'menu', challenge: null })) }, h('span.mode-btn__ico', icon('friends')), h('span.mode-btn__label', 'Friends'));
  const playRow = h('div.menu__playrow', playBtn, relaxBtn, duelBtn);
  const dailyTitle = h('span.daily__title');
  const dailySub = h('span.daily__sub');
  const dailyTag = h('span.daily__tag');
  const dailyBtn = h('button.daily', { 'data-quiet': '1', title: 'The same cards for everyone today', onclick: () => start('daily') }, h('span.daily__ico', icon('calendar')), h('span.daily__text', dailyTitle, dailySub), dailyTag);
  // Situations sit beside the daily challenge, as Relax and Challenge sit beside Play
  const talkBadge = h('span.tile__badge.mode-btn__badge', { hidden: true });
  const talkBtn = h('button.mode-btn.mode-btn--talk', { 'data-quiet': '1', title: 'Situations: chat with the characters', onclick: () => (audio.play('select'), ui.go('talk', { from: 'menu' })) }, h('span.mode-btn__ico', icon('chat'), talkBadge), h('span.mode-btn__label', 'Situations'));
  const dailyRow = h('div.menu__dailyrow', dailyBtn, talkBtn);
  const status = h('div.menu__status', { hidden: true, role: 'status' });

  // ── today strip: level, streak, daily goal, quests ──────────────────────
  const openToday = () => ui.go('today', { from: 'menu' });
  const lvlNum = h('b');
  const lvlFill = h('i');
  const lvlPill = h('button.pill.pill--level', { 'aria-label': 'Your level and places', onclick: () => ui.go('journey', { from: 'menu' }) }, h('span.pill__badge', lvlNum), h('span.pill__text', h('span.pill__label', 'Level'), h('span.pill__bar', lvlFill)));
  const streakNum = h('b');
  const streakSub = h('span.pill__label');
  const streakPill = h('button.pill.pill--streak', { 'aria-label': 'Daily streak', onclick: openToday }, h('span.pill__ico', icon('flame')), h('span.pill__text', streakNum, streakSub));
  const goalRing = h('span.pill__ring');
  const goalNum = h('b');
  const goalPill = h('button.pill.pill--goal', { 'aria-label': 'Daily goal', onclick: openToday }, goalRing, h('span.pill__text', goalNum, h('span.pill__label', 'Goal')));
  const questNum = h('b');
  const questSub = h('span.pill__label');
  const questPill = h('button.pill.pill--quests', { 'aria-label': 'Daily quests', onclick: openToday }, h('span.pill__ico', icon('chest')), h('span.pill__text', questNum, questSub));
  const strip = h('div.today-strip', lvlPill, streakPill, goalPill, questPill);
  const notice = h('div.menu__notice', { hidden: true, role: 'status' });

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
      notice,
      strip,
      playRow,
      dailyRow,
      h(
        'div.menu__grid',
        tile('user', 'Characters', sub.chars, 'var(--violet)', () => ui.go('characters')),
        tile('cards', 'Flashcards', sub.cards, 'var(--coral)', () => ui.go('flashcards', { from: 'menu' }), dueBadge),
        tile('star', 'My Collection', sub.coll, 'var(--mint-2)', () => ui.go('collection')),
        tile('podium', 'Leaderboards', sub.boards, 'var(--gold-2)', openBoards)
      )
    ),
    foot,
    h('div.menu__hero', heroName, heroTitle, gardenChip)
  );
  // a wide account chip needs the logo to step down on narrow portrait screens
  new MutationObserver(() => el.classList.toggle('has-account', accountSlot.childElementCount > 0)).observe(accountSlot, { childList: true });

  // ── starting a game before the expressions have arrived ─────────────────
  let pressed = 'play';
  let pending = null;
  function start(which) {
    pressed = which;
    app.startGame(which === 'daily' ? { mode: 'daily' } : which === 'relax' ? { mode: 'relax' } : {});
  }
  function setLoading(on) {
    playBtn.classList.toggle('is-loading', on && pressed === 'play');
    dailyBtn.classList.toggle('is-loading', on && pressed === 'daily');
    relaxBtn.classList.toggle('is-loading', on && pressed === 'relax');
    clear(playLabel).append(on && pressed === 'play' ? 'Loading…' : 'Play');
    if (on) showStatus('Loading the expressions…', true);
    else status.hidden = true;
  }
  function showStatus(text, spinner = false, error = false) {
    clear(status).append(spinner ? h('span.spinner') : icon('alert'), h('span', text));
    // a failed module download is not fetched again in the same page: a reload retries it
    if (error) status.append(h('button.chip.menu__reload', { onclick: () => location.reload() }, icon('refresh'), 'Reload'));
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
        if (ui.name === 'menu') showStatus('The expressions could not be loaded. Check your connection.', false, true);
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
      dailySub.textContent = `Next in ${formatCountdown(msToNextDaily())} · practise`;
      dailyTag.append(h('span.daily__score', formatScore(rec.score)), h('span.daily__score-label', 'Your score'));
      dailyBtn.classList.add('is-done');
    } else {
      dailySub.textContent = `Not played yet · ${DAILY_CARDS} cards`;
      dailyTag.append(h('span.daily__new', 'New'));
      dailyBtn.classList.remove('is-done');
    }
  }

  function refreshToday() {
    const info = progress.info;
    lvlNum.textContent = String(info.level);
    lvlFill.style.width = `${Math.round((info.into / info.need) * 100)}%`;
    const s = progress.streak;
    const g = progress.goal();
    streakNum.textContent = String(s.count);
    streakSub.textContent = s.count === 1 ? 'day' : 'days';
    streakPill.classList.toggle('is-lit', g.met);
    streakPill.classList.toggle('is-risk', !g.met && s.count > 0);
    clear(goalRing).append(ring(g.met ? 1 : g.have / g.need, 'ring--goal'));
    clear(goalNum).append(g.met ? icon('check') : `${g.have}/${g.need}`);
    goalPill.classList.toggle('is-done', g.met);
    const done = progress.quests().filter((q) => q.done).length;
    const chest = progress.chestState();
    questNum.textContent = `${done}/3`;
    questSub.textContent = chest === 'ready' ? 'Open!' : 'Quests';
    questPill.classList.toggle('is-ready', chest === 'ready');
    questPill.classList.toggle('is-done', chest === 'opened');

    // a brolly that kept the streak going, or a streak that ended
    const n = progress.notice();
    notice.hidden = !n;
    if (n) {
      const text = n.kind === 'brolly' ? `${n.n === 1 ? 'A brolly' : `${n.n} brollies`} kept your ${n.count}-day streak dry while you were away.` : `Your ${n.count}-day streak ended. Start a new one today!`;
      clear(notice).append(
        h('span.menu__notice-ico', icon(n.kind === 'brolly' ? 'brolly' : 'flame')),
        h('span', text),
        h('button.menu__notice-x', { 'aria-label': 'Dismiss', onclick: () => (progress.dismissNotice(), refreshToday()) }, icon('x'))
      );
      notice.classList.toggle('is-lost', n.kind === 'lost');
    }
  }

  // ── the memory garden ───────────────────────────────────────────────────
  let gardenSeen = null; // the garden as last shown here, to celebrate what changed since
  function refreshGarden() {
    const garden = app.garden;
    if (!garden || !expressionsReady()) {
      gardenChip.hidden = true;
      return;
    }
    const st = garden.refresh();
    const n = st.thirsty.length;
    gardenChip.hidden = false;
    gardenChip.classList.toggle('is-thirsty', n > 0);
    clear(gardenIco).append(icon(n ? 'drop' : st.count ? 'flower' : 'leaf'));
    gardenText.textContent = n ? `${n} ${n === 1 ? 'flower needs' : 'flowers need'} water` : st.count ? `${st.count.toLocaleString('en-GB')} ${st.count === 1 ? 'flower' : 'flowers'} in your garden` : 'Grow your garden';
    // sparkles for flowers that are new, or standing up again, since the menu was last here
    if (gardenSeen) {
      const had = new Set(gardenSeen.plants.map((p) => p.id));
      const wasThirsty = new Set(gardenSeen.thirsty);
      const now = new Set(st.thirsty);
      const cheer = st.plants.filter((p) => !had.has(p.id) || (wasThirsty.has(p.id) && !now.has(p.id))).slice(0, 14);
      if (cheer.length) {
        setTimeout(() => {
          if (ui.name !== 'menu') return;
          audio.play('quest');
          for (const p of cheer) {
            const pos = garden.world.positionOf(p.id);
            if (pos) app.fx.burst(pos, { count: 10, color: 0xfff6c8, color2: 0x7ef0c8, speed: 1.6, size: 0.34, life: 0.8, gravity: -0.6, up: 0.9 });
          }
        }, 1100);
      }
    }
    gardenSeen = st;
  }
  function onGarden() {
    const st = app.garden?.state;
    if (!st) return;
    if (st.thirsty.length) {
      audio.play('select');
      app.garden.water();
      return;
    }
    audio.play('tap');
    ui.toast({
      icon: 'flower',
      title: 'Your memory garden',
      sub: st.count ? 'Every expression you master grows a flower. When one is due for review it droops: tap here to water it.' : 'Get an expression right three times in a row and its flower grows here.',
      tone: 'sky',
      ms: 5600,
    });
  }

  /** Places unlocked away from the results screen (a chest, flashcards): travel there with a hello. */
  function welcomeNewPlaces() {
    const fresh = progress.unseenPlaces().filter((p) => p.id !== 'home');
    if (!fresh.length) return;
    const place = fresh[fresh.length - 1];
    for (const p of fresh) progress.markPlaceSeen(p.id);
    // never move a player back to an older place than the one they chose
    if (place.level <= getPlace(progress.place).level) return;
    setTimeout(() => {
      if (ui.name !== 'menu' || !app.travel(place.id)) return;
      audio.play('travel');
      ui.toast({ icon: 'map', title: `Welcome to ${place.name}!`, sub: 'Change places any time: tap your level', tone: 'sky', ms: 4200 });
    }, 900);
  }

  function refresh() {
    const d = save.data;
    refreshToday();
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
    refreshGarden();
    // situations still to play in the places that are open (loaded in the background)
    loadSituations().then(
      (all) => {
        const level = progress.level;
        const n = all.filter((x) => level >= getPlace(x.place).level && !save.data.talk?.[x.id]?.done).length;
        talkBadge.textContent = String(n);
        talkBadge.hidden = !n;
      },
      () => {}
    );
    if (!loaded) whenExpressionsReady().then(() => ui.name === 'menu' && refresh(), () => {});
  }

  let ticker = 0;
  return {
    el,
    /** The header slot next to the settings button, for the account chip. */
    accountSlot,
    show() {
      app.game.settleInterruptedDaily?.();
      app.applySeason?.(); // the calendar may have moved into a new season
      progress.touch();
      setLoading(false);
      refresh();
      welcomeNewPlaces();
      clearInterval(ticker);
      // the countdown, a new challenge at midnight UTC, and a new day for the streak and quests at local midnight
      ticker = setInterval(() => {
        progress.touch();
        refreshDaily();
        refreshToday();
      }, 20000);
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
