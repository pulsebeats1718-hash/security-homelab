import { h, icon, clear, retrigger } from '../dom.js';
import { formatScore } from '../../core/utils.js';
import { SCORING, STAGES } from '../../data/stages.js';

const HEART = 'M12 21s-8-4.900-9.800-10C.900 7.300 3.200 3.800 6.800 3.800c2.100 0 3.800 1.100 5.200 3 1.400-1.900 3.100-3 5.200-3 3.600 0 5.900 3.500 4.600 7.200C20 16.100 12 21 12 21z';
const KEYS = ['A', 'B', 'C', 'D'];

function heart() {
  const el = h('div.heart');
  el.innerHTML = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="${HEART}" fill="rgba(255,255,255,0.16)"/>
      <g class="heart__full"><path d="${HEART}" fill="#ff5d73"/><path d="M6.900 6.300c-1.700.200-2.800 1.700-2.600 3.500" fill="none" stroke="#ffc2cb" stroke-width="1.600" stroke-linecap="round"/></g>
      <path class="heart__half heart__half--l" d="${HEART}" fill="#ff5d73" style="clip-path:inset(0 50% 0 0)"/>
      <path class="heart__half heart__half--r" d="${HEART}" fill="#ff5d73" style="clip-path:inset(0 0 0 50%)"/>
    </svg>`;
  return el;
}

/** In-game interface: lives, score, streak, stage, the four answers and the pause menu. */
export function createHud(app) {
  const { game, save, ui, events, audio } = app;
  let locked = true;
  let shownScore = 0;
  let hintTimer = 0;

  // ── top row ─────────────────────────────────────────────────────────────
  const hearts = Array.from({ length: SCORING.lives }, heart);
  const lives = h('div.lives', { 'aria-label': 'Lives' }, hearts);
  const streakN = h('span');
  const feverTag = h('b.hud__fever', { hidden: true }, 'Fever ×2');
  const streak = h('div.chip.hud__streak.is-off', icon('flame'), streakN, feverTag);
  const scoreNum = h('div.hud__score-num', '0');
  const best = h('div.hud__best');
  const stageName = h('span');
  const pips = h('span.pips');
  const stageChip = h('div.chip.hud__stage', stageName, pips);
  const pauseBtn = h('button.iconbtn', { 'aria-label': 'Pause', onclick: () => game.pause() }, icon('pause'));
  const top = h('div.hud__head', h('div.hud__top', lives, h('div.hud__score', scoreNum, best), pauseBtn), h('div.hud__sub', streak, stageChip));

  // ── middle: banners + first-run hint ───────────────────────────────────
  const bannerEyebrow = h('div.banner__eyebrow');
  const bannerTitle = h('div.banner__title');
  const bannerSub = h('div.banner__sub');
  const banner = h('div.banner', bannerEyebrow, bannerTitle, bannerSub);
  const hint = h('div.hint', { hidden: true });
  const mid = h('div.hud__mid', banner);

  // ── answers ─────────────────────────────────────────────────────────────
  const answers = h('div.answers.is-empty');
  let buttons = [];

  // ── pause menu ──────────────────────────────────────────────────────────
  const soundBtn = h('button.toggle', { 'data-quiet': '1', onclick: () => flip('sfxOn') });
  const musicBtn = h('button.toggle', { 'data-quiet': '1', onclick: () => flip('musicOn') });
  const rankedNote = h('p', { hidden: true }, 'This is your ranked daily run. If you leave now, the score so far counts.');
  const pause = h(
    'div.modal',
    h(
      'div.panel.hud__pause',
      h('h2', 'Paused'),
      rankedNote,
      h('button.btn.btn--gold', { onclick: () => game.resume() }, icon('play'), 'Resume'),
      h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' } }, soundBtn, musicBtn),
      h('button.btn', { onclick: () => app.startGame({ mode: game.mode }) }, icon('refresh'), 'Restart'),
      h('button.btn.btn--ink', { 'data-sound': 'back', onclick: () => app.toMenu() }, icon('home'), 'Quit to menu')
    )
  );

  const bottom = h('div.hud__bottom', hint, answers);
  const el = h('section.hud', top, mid, bottom, pause);

  /** A line above the answers. The golden-card hint floats, so the camera doesn't move for it. */
  function showHint(text, gold = false) {
    hint.textContent = text;
    hint.classList.toggle('is-gold', gold);
    hint.hidden = false;
    if (!gold) measure();
  }
  function hideHint() {
    if (hint.hidden) return;
    hint.hidden = true;
    clearTimeout(hintTimer);
    if (!hint.classList.contains('is-gold')) measure();
  }

  function flip(key) {
    save.setSetting(key, !save.settings[key]);
    audio.applySettings();
    audio.play('toggle', { on: save.settings[key] });
    syncToggles();
  }
  function syncToggles() {
    const s = save.settings;
    clear(soundBtn).append(icon(s.sfxOn ? 'sound' : 'mute'), s.sfxOn ? 'Sound on' : 'Sound off');
    clear(musicBtn).append(icon('music'), s.musicOn ? 'Music on' : 'Music off');
    soundBtn.classList.toggle('is-on', s.sfxOn);
    musicBtn.classList.toggle('is-on', s.musicOn);
  }

  function showBanner(eyebrow, title, sub = '', long = false) {
    bannerEyebrow.textContent = eyebrow;
    bannerTitle.textContent = title;
    bannerSub.textContent = sub;
    banner.classList.toggle('is-long', long);
    retrigger(banner, 'is-show');
  }

  function setScore(value, bump = true) {
    shownScore = value;
    scoreNum.textContent = formatScore(value);
    if (bump) retrigger(scoreNum, 'is-bump');
    const daily = game.dailyInfo;
    if (daily) {
      // daily runs compare with the day's ranked score instead of the classic best
      const ranked = save.dailyRecord(daily.dateId);
      best.textContent = daily.ranked ? 'Ranked run' : ranked ? `Ranked ${formatScore(ranked.score)}` : 'Practice';
      best.classList.toggle('is-beaten', !daily.ranked && !!ranked && value > ranked.score);
      return;
    }
    const record = save.data.best.score;
    const beaten = value > record && record > 0;
    best.textContent = beaten ? 'New best!' : record ? `Best ${formatScore(record)}` : 'First run';
    best.classList.toggle('is-beaten', beaten);
  }

  function setStreak(n) {
    streakN.textContent = `×${n}`;
    streak.classList.toggle('is-off', n < 2);
    if (n >= 2) retrigger(streak, 'is-bump');
  }

  /** Daily runs show the challenge number and how far through its cards the player is. */
  function setDaily(d) {
    stageName.textContent = `Daily #${d.n}${d.ranked ? '' : ' · Practice'}`;
    clear(pips).append(h('b.hud__count', `${d.index}/${d.total}`));
  }

  function setStage(stage, done) {
    stageName.textContent = `Stage ${stage.n} · ${stage.short}`;
    clear(pips);
    if (Number.isFinite(stage.goal)) for (let i = 0; i < stage.goal; i++) pips.append(h(`i${i < done ? '.is-on' : ''}`));
    else pips.append(icon('sparkle'));
  }

  function setLives(n, animate = true) {
    hearts.forEach((hEl, i) => {
      const lost = i >= n;
      if (lost && !hEl.classList.contains('is-lost')) {
        hEl.classList.remove('is-in');
        if (animate) retrigger(hEl, 'is-lost');
        else hEl.classList.add('is-lost');
      } else if (!lost && hEl.classList.contains('is-lost')) {
        hEl.classList.remove('is-lost');
        retrigger(hEl, 'is-in');
      }
    });
  }

  function measure() {
    // placeholder buttons give the true panel height before the first question arrives
    if (!buttons.length) {
      clear(answers);
      for (let i = 0; i < 4; i++) answers.append(h('div.answer', { style: { visibility: 'hidden' } }, h('span.answer__key', KEYS[i]), h('span.answer__text', 'placeholder meaning')));
    }
    const view = el.getBoundingClientRect();
    const a = bottom.getBoundingClientRect();
    const t = top.getBoundingClientRect();
    game.setLayout(Math.round(view.bottom - a.top), Math.round(t.bottom - view.top));
    // in-game notes (quest done, level up) sit just above the answers, clear of the falling card
    ui.root.style.setProperty('--answers-h', `${Math.round(view.bottom - a.top)}px`);
  }

  function lock(on) {
    locked = on;
    answers.classList.toggle('is-locked', on);
  }

  // ── game events ─────────────────────────────────────────────────────────
  events.on('game:intro', ({ stage, daily }) => {
    setScore(0, false);
    setStreak(0);
    setLives(SCORING.lives, false);
    hearts.forEach((x, i) => {
      x.style.animationDelay = `${i * 90}ms`;
      retrigger(x, 'is-in');
    });
    if (daily) setDaily(daily);
    else setStage(stage, 0);
    rankedNote.hidden = !daily?.ranked;
    buttons = [];
    clear(answers);
    answers.classList.add('is-empty');
    answers.classList.remove('is-golden');
    setFever(false);
    pause.classList.remove('is-on');
    hint.hidden = true;
    measure();
    if (daily) showBanner(`Daily challenge #${daily.n}`, 'Ready?', daily.ranked ? `${daily.total} expressions · one ranked go` : 'Practice run');
    else showBanner(`Stage ${stage.n}`, 'Ready?', stage.name);
  });

  events.on('game:go', () => showBanner('', 'Go!'));

  events.on('game:question', (q) => {
    clear(answers);
    answers.classList.remove('is-empty');
    buttons = q.options.map((opt, i) =>
      h('button.answer', { 'data-quiet': '1', style: { '--i': i }, onclick: () => !locked && game.answer(i) }, h('span.answer__key', KEYS[i]), h('span.answer__text', opt.text))
    );
    answers.append(...buttons);
    answers.classList.toggle('is-golden', !!q.golden);
    lock(false);
    if (q.daily) setDaily(q.daily);
    else setStage(q.stage, game.correctInStage);
    if (!save.data.tutorialDone && q.number === 1) showHint('Tap the meaning before the expression lands!');
    else if (q.golden) showHint('Golden expression · triple points!', true);
  });

  /** Fever mode: the streak chip turns to fire and the screen edges glow. */
  function setFever(on) {
    el.classList.toggle('is-fever', on);
    streak.classList.toggle('is-fever', on);
    feverTag.hidden = !on;
  }
  events.on('game:fever', ({ on, quiet }) => {
    setFever(on);
    if (on && !quiet) showBanner('×10 streak', 'Fever!', 'Double points until you miss');
  });

  events.on('game:answered', ({ choice, correct, correctIndex }) => {
    lock(true);
    hideHint();
    if (!save.data.tutorialDone) {
      save.data.tutorialDone = true;
      save.write();
    }
    buttons[correctIndex]?.classList.add('is-right');
    if (!correct && choice != null) buttons[choice]?.classList.add('is-wrong');
    if (correct && !game.daily) setStage(game.stageDef, game.correctInStage);
  });

  events.on('game:score', ({ score, gained, bonus, speed, golden, fever, streak: n, x, y }) => {
    setScore(score);
    setStreak(n);
    ui.popup(`+${gained}`, x, y, golden ? 'pop--big' : '');
    // extra labels stack underneath the points
    let dy = 46;
    const tag = (text, cls) => {
      ui.popup(text, x, y + dy, cls);
      dy += 44;
    };
    if (golden) tag('Golden ×3', 'pop--gold');
    if (fever) tag('Fever ×2', 'pop--fever');
    if (bonus) tag(`Streak ×${n}  +${bonus}`, 'pop--bonus');
    if (speed) tag(`Quick +${speed}`, 'pop--speed');
  });

  events.on('game:lives', ({ lives: n }) => {
    setLives(n);
    setStreak(0);
  });
  events.on('game:damage', () => ui.damage());

  events.on('game:stage', ({ stage }) => {
    clear(answers);
    buttons = [];
    answers.classList.add('is-empty');
    setStage(stage, 0);
    showBanner(`Stage ${stage.n} of ${STAGES.length}`, stage.name, stage.n === STAGES.length ? 'The final stage — how far can you go?' : 'Faster and trickier', true);
  });

  events.on('game:ending', () => {
    lock(true);
    answers.classList.add('is-empty');
    hideHint();
  });

  events.on('game:over', (results) => ui.go('results', results));

  events.on('game:pause', (on) => {
    pause.classList.toggle('is-on', on);
    if (on) syncToggles();
  });

  return {
    el,
    show() {
      syncToggles();
      measure();
    },
    hide() {
      pause.classList.remove('is-on');
      clearTimeout(hintTimer);
    },
    relayout: measure,
    key(e) {
      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
        if (game.paused) game.resume();
        else game.pause();
        return;
      }
      if (game.paused || locked) return;
      const k = e.key.toLowerCase();
      const i = '1234'.indexOf(k) >= 0 ? '1234'.indexOf(k) : 'abcd'.indexOf(k);
      if (i >= 0 && buttons[i]) {
        buttons[i].classList.add('is-down');
        setTimeout(() => buttons[i]?.classList.remove('is-down'), 120);
        game.answer(i);
      }
    },
  };
}
