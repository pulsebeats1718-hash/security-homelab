import { h, icon, clear, retrigger } from '../dom.js';
import { shots } from '../../game/shots.js';
import { GOAL, BROLLY_MAX, BROLLY_EVERY, msToMidnight } from '../../game/progress.js';
import { formatSpan } from '../../online/dates.js';
import { ROSTER } from '../../data/roster.js';
import { getCharacter } from '../../characters/index.js';

const SVG = 'http://www.w3.org/2000/svg';

/** A progress ring (0…1) as inline SVG. */
export function ring(frac, cls = '') {
  const r = 15;
  const c = 2 * Math.PI * r;
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 36 36');
  svg.setAttribute('class', `ring ${cls}`);
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = `<circle cx="18" cy="18" r="${r}" class="ring__bg"/><circle cx="18" cy="18" r="${r}" class="ring__fg" stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${(c * (1 - Math.max(0, Math.min(1, frac)))).toFixed(2)}"/>`;
  return svg;
}

/** The reward chest, drawn in SVG so the lid can open. */
export function chestArt() {
  const wrap = h('div.chest');
  wrap.innerHTML = `
    <svg viewBox="0 0 120 104" aria-hidden="true">
      <defs><radialGradient id="chest-glow"><stop offset="0" stop-color="#ffe9a3" stop-opacity="0.95"/><stop offset="1" stop-color="#ffc83d" stop-opacity="0"/></radialGradient></defs>
      <circle class="chest__glow" cx="60" cy="56" r="52" fill="url(#chest-glow)"/>
      <g class="chest__rays" stroke="#ffe08a" stroke-width="4" stroke-linecap="round">
        <path d="M60 6v12M24 20l8 9M96 20l-8 9M10 50h12M98 50h12"/>
      </g>
      <rect x="16" y="50" width="88" height="46" rx="9" fill="#a5642f"/>
      <rect x="16" y="50" width="88" height="11" fill="#7d4620"/>
      <rect x="16" y="63" width="88" height="7" fill="#ffc83d"/>
      <rect x="28" y="50" width="7" height="46" fill="#ffc83d" opacity="0.9"/>
      <rect x="85" y="50" width="7" height="46" fill="#ffc83d" opacity="0.9"/>
      <rect x="53" y="58" width="14" height="18" rx="4" fill="#ffd866" stroke="#c27a08" stroke-width="2.5"/>
      <circle cx="60" cy="65" r="2.4" fill="#7d4620"/>
      <g class="chest__lid">
        <path d="M16 52V40c0-12 19-20 44-20s44 8 44 20v12z" fill="#bb7740"/>
        <path d="M16 46h88v6H16z" fill="#ffc83d"/>
        <path d="M28 52V24.500M92 52V24.500" stroke="#ffc83d" stroke-width="7" opacity="0.9"/>
      </g>
    </svg>`;
  return wrap;
}

/**
 * Today: the daily streak (with brollies and this week's days), the daily goal,
 * three quests and the reward chest.
 */
export function createToday(app) {
  const { ui, progress, audio, events } = app;
  const body = h('div.today.scroll');
  let from = 'menu';
  let ticker = 0;
  const back = () => ui.go(from, from === 'menu' ? {} : { from: 'menu' });
  const resetIn = h('span');
  const el = h(
    'section.sheet.sheet--narrow',
    h(
      'div.panel.sheet__panel',
      h('header.bar', h('button.iconbtn', { 'aria-label': 'Back', 'data-sound': 'back', onclick: back }, icon('back')), h('div.bar__title', 'Today'), h('span.chip', icon('refresh'), resetIn)),
      body
    )
  );

  // ── streak ──────────────────────────────────────────────────────────────
  function streakCard() {
    const s = progress.streak;
    const goal = progress.goal();
    const count = s.count;
    const week = progress.week();
    const title = count ? `${count}-day streak` : 'No streak yet';
    const sub = goal.met
      ? count > 1
        ? 'Today counts. See you tomorrow!'
        : 'Day one done. Come back tomorrow to keep it going.'
      : count
        ? `Reach today's goal to make it ${count + 1}.`
        : "Reach today's goal to start one.";
    const days = week.days.map((d) => {
      const state = d.goal ? 'is-goal' : d.brolly ? 'is-brolly' : d.today ? 'is-today' : 'is-miss';
      return h(`div.week__day.${state}`, h('span.week__dot', d.goal ? icon('flame') : d.brolly ? icon('brolly') : null), h('span.week__label', d.today ? 'Today' : d.label));
    });
    const brollies = Array.from({ length: BROLLY_MAX }, (_, i) => h(`span.brolly${i < s.brollies ? '.is-on' : ''}`, icon('brolly')));
    const next = ROSTER.find((r) => r.rule.type === 'streakDays' && r.rule.n > s.best);
    let reward = null;
    if (next) {
      const def = getCharacter(next.id);
      const img = h('img', { alt: '' });
      const thumb = app.thumbs.get(next.id);
      // the reward is shown in full, not as a silhouette: something to look forward to
      if (thumb) img.src = thumb.normal;
      else pendingThumb = { id: next.id, img };
      const have = Math.min(count, next.rule.n);
      reward = h(
        'div.today__reward',
        h('div.today__portrait', img),
        h('div.today__reward-text', h('b', def.id === next.id ? `${def.name} the ${def.title.replace(/^The /, '')}` : 'A new character'), h('span', `Keep a ${next.rule.n}-day streak · ${have}/${next.rule.n}`), h('div.meter', h('i', { style: { width: `${(have / next.rule.n) * 100}%` } })))
      );
    }
    return h(
      'div.card.today__streak',
      h('div.today__flame', { class: goal.met ? 'is-lit' : count ? 'is-waiting' : '' }, icon('flame'), h('b', String(count))),
      h('div.today__head', h('h3', title), h('p', sub), s.best > count ? h('span.chip', icon('trophy'), `Best ${s.best} days`) : null),
      h('div.week', days),
      h('div.today__brollies', h('div.brollies', brollies), h('p', h('b', `${s.brollies} of ${BROLLY_MAX} brollies. `), `A brolly keeps your streak dry if you miss a day. You earn one every ${BROLLY_EVERY} days.`)),
      reward
    );
  }

  // ── goal ────────────────────────────────────────────────────────────────
  function goalCard() {
    const g = progress.goal();
    return h(
      `div.card.today__goal${g.met ? '.is-done' : ''}`,
      h('div.today__ring', ring(g.met ? 1 : g.have / GOAL, 'ring--goal'), h('b', g.met ? icon('check') : `${g.have}`)),
      h('div', h('h3', g.met ? 'Daily goal done!' : `Daily goal: ${GOAL} right answers`), h('p', g.met ? 'Your streak is safe for today.' : `${GOAL - g.have} to go. Right answers in any game count, and so do flashcards you knew. Finishing the daily challenge counts too.`))
    );
  }

  // ── quests ──────────────────────────────────────────────────────────────
  function questsCard() {
    const quests = progress.quests();
    return h(
      'div.card.today__quests',
      h('div.today__title', h('h3', 'Daily quests'), h('span.eyebrow', `${quests.filter((q) => q.done).length}/3 done`)),
      quests.map((q) =>
        h(
          `div.quest${q.done ? '.is-done' : ''}`,
          h('span.quest__ico', icon(q.done ? 'check' : q.icon)),
          h('div.quest__body', h('div.quest__text', q.text), h('div.meter', h('i', { style: { width: `${(q.have / q.n) * 100}%` } }))),
          h('div.quest__side', h('span.quest__tier', q.tier), h('b', q.done ? 'Done' : `${q.have.toLocaleString('en-GB')}/${q.n.toLocaleString('en-GB')}`), h('span.quest__xp', `+${q.xp} XP`))
        )
      )
    );
  }

  // ── chest ───────────────────────────────────────────────────────────────
  function chestCard() {
    const state = progress.chestState();
    const art = chestArt();
    art.classList.add(`is-${state}`);
    const prize = h('div.chest__prize');
    const btn = h('button.btn.btn--gold', { 'data-quiet': '1', hidden: state !== 'ready', onclick: () => open() }, icon('chest'), 'Open chest');
    const text = h('p', state === 'opened' ? 'Opened. New quests and a new chest at midnight.' : state === 'ready' ? 'All three quests done. Your reward is waiting!' : 'Finish all three quests to open it: XP, and sometimes a brolly.');
    const card = h(`div.card.today__chest.is-${state}`, art, h('div.today__chest-text', h('h3', 'Reward chest'), text, prize, btn));
    function open() {
      const reward = progress.openChest();
      if (!reward) return;
      btn.hidden = true;
      audio.play('chest');
      art.classList.remove('is-ready');
      retrigger(art, 'is-opening');
      setTimeout(() => {
        art.classList.add('is-opened');
        clear(prize).append(h('span.chip.chip--gold', icon('star'), `+${reward.xp} XP`), reward.brolly ? h('span.chip.chip--sky', icon('brolly'), '+1 brolly') : null);
        retrigger(prize, 'is-show');
        text.textContent = reward.brolly ? 'Nice! A brolly for a rainy day, too.' : 'Nice! New quests and a new chest at midnight.';
        if (reward.brolly) setTimeout(() => audio.play('brolly'), 400);
      }, 650);
    }
    return card;
  }

  function render() {
    clear(body).append(streakCard(), goalCard(), questsCard(), chestCard());
  }
  const tick = () => (resetIn.textContent = `New day in ${formatSpan(msToMidnight())}`);

  // portraits render in the background and may arrive while the page is open
  let pendingThumb = null;
  events.on('thumb', (id) => {
    if (pendingThumb?.id !== id) return;
    const t = app.thumbs.get(id);
    if (t) pendingThumb.img.src = t.normal;
    pendingThumb = null;
  });

  return {
    el,
    shade: true,
    show(params = {}) {
      from = params.from ?? 'menu';
      progress.touch();
      app.stage.setShot(shots.backdrop(app.stage), 1.2);
      render();
      tick();
      clearInterval(ticker);
      ticker = setInterval(tick, 30000);
    },
    hide() {
      clearInterval(ticker);
    },
    key(e) {
      if (e.key === 'Escape') back();
    },
  };
}
