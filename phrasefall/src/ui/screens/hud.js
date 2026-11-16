import { h, icon, clear, retrigger, phrase } from '../dom.js';
import { formatScore } from '../../core/utils.js';
import { SCORING, STAGES } from '../../data/stages.js';
import { TWIST_INFO, mainText } from '../../game/twists.js';
import { speak, stopSpeaking } from '../../audio/speech.js';

const HEART = 'M12 21s-8-4.900-9.800-10C.900 7.300 3.200 3.800 6.800 3.800c2.100 0 3.800 1.100 5.200 3 1.400-1.900 3.100-3 5.200-3 3.600 0 5.900 3.500 4.600 7.200C20 16.100 12 21 12 21z';
const KEYS = ['A', 'B', 'C', 'D'];
/** Twist kinds the player has been introduced to on this device (a "New" badge the first time). */
const SEEN_KEY = 'phrasefall:twists-seen';

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

function readSeen() {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'));
  } catch {
    return new Set();
  }
}

/**
 * In-game interface: lives, score, streak, stage, the answers and the pause menu.
 * Modes (see game.js): relax and second chance have no lives (a mode chip shows
 * instead) and count right answers rather than points; twist cards swap the four
 * answers for their own layouts (word tiles for Build it, short buttons for Fill
 * the gap); the bar floating above the answers carries golden / twist labels,
 * the Listen replay button, examples and the Relax "Example" button.
 */
export function createHud(app) {
  const { game, save, ui, events, audio } = app;
  let locked = true;
  let shownScore = 0;
  let hintTimer = 0;
  let speakTimer = 0;
  let question = null;
  let build = null; // Build it: { words, placed, tiles: [{ el, word, used }], line }
  const twistsSeen = readSeen();

  // ── top row ─────────────────────────────────────────────────────────────
  const hearts = Array.from({ length: SCORING.lives }, heart);
  const lives = h('div.lives', { 'aria-label': 'Lives' }, hearts);
  const modeIco = h('span.hud__mode-ico');
  const modeText = h('span');
  const modeChip = h('div.hud__mode', modeIco, modeText);
  const left = h('div.hud__left', lives, modeChip);
  const streakN = h('span');
  const feverTag = h('b.hud__fever', { hidden: true }, 'Fever ×2');
  const streak = h('div.chip.hud__streak.is-off', icon('flame'), streakN, feverTag);
  const scoreNum = h('div.hud__score-num', '0');
  const best = h('div.hud__best');
  const stageName = h('span');
  const pips = h('span.pips');
  const stageChip = h('div.chip.hud__stage', stageName, pips);
  const pauseBtn = h('button.iconbtn', { 'aria-label': 'Pause', onclick: () => game.pause() }, icon('pause'));
  const top = h('div.hud__head', h('div.hud__top', left, h('div.hud__score', scoreNum, best), pauseBtn), h('div.hud__sub', streak, stageChip));

  // ── middle: banners ─────────────────────────────────────────────────────
  const bannerEyebrow = h('div.banner__eyebrow');
  const bannerTitle = h('div.banner__title');
  const bannerSub = h('div.banner__sub');
  const banner = h('div.banner', bannerEyebrow, bannerTitle, bannerSub);
  const hint = h('div.hint', { hidden: true }); // first-game tutorial line (takes up room)
  const mid = h('div.hud__mid', banner);

  // ── floating bar above the answers (never moves the camera) ─────────────
  const floatBar = h('div.hud__float');

  // ── answers ─────────────────────────────────────────────────────────────
  const answers = h('div.answers.is-empty');
  let buttons = [];

  // ── pause menu ──────────────────────────────────────────────────────────
  const soundBtn = h('button.toggle', { 'data-quiet': '1', onclick: () => flip('sfxOn') });
  const musicBtn = h('button.toggle', { 'data-quiet': '1', onclick: () => flip('musicOn') });
  const rankedNote = h('p', { hidden: true }, 'This is your ranked daily run. If you leave now, the score so far counts.');
  const relaxNote = h('p', { hidden: true }, 'Finish to see how you did. Every answer so far is already saved.');
  const finishBtn = h('button.btn.btn--mint', { hidden: true, onclick: () => game.finishRelax() }, icon('check'), 'Finish');
  const restartBtn = h('button.btn', { onclick: () => app.startGame({ mode: game.mode }) }, icon('refresh'), 'Restart');
  const pause = h(
    'div.modal',
    h(
      'div.panel.hud__pause',
      h('h2', 'Paused'),
      rankedNote,
      relaxNote,
      h('button.btn.btn--gold', { onclick: () => game.resume() }, icon('play'), 'Resume'),
      finishBtn,
      h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' } }, soundBtn, musicBtn),
      restartBtn,
      h('button.btn.btn--ink', { 'data-sound': 'back', onclick: () => app.toMenu() }, icon('home'), 'Quit to menu')
    )
  );

  const bottom = h('div.hud__bottom', floatBar, hint, answers);
  const el = h('section.hud', top, mid, bottom, pause);

  /** The tutorial line above the answers (it takes up room, so the camera reframes). */
  function showHint(text) {
    hint.textContent = text;
    hint.hidden = false;
    measure();
  }
  function hideHint() {
    if (hint.hidden) return;
    hint.hidden = true;
    clearTimeout(hintTimer);
    measure();
  }

  /** Pills and buttons floating above the answers. */
  function float(...items) {
    clear(floatBar).append(...items.filter(Boolean));
  }
  const pill = (cls, ...kids) => h(`div.fpill${cls}`, kids);

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

  /** The number in the middle: points, or (relax) right answers, or (second chance) how many are put right. */
  function setScore(value, bump = true) {
    shownScore = value;
    if (bump) retrigger(scoreNum, 'is-bump');
    best.classList.remove('is-beaten');
    if (game.mode === 'relax') {
      scoreNum.textContent = String(game.correct);
      best.textContent = game.correct === 1 ? 'Right answer' : 'Right answers';
      return;
    }
    if (game.mode === 'retry' || game.mode === 'water') {
      const f = game.fixedInfo;
      scoreNum.textContent = `${f?.fixed ?? 0}/${f?.unique ?? 0}`;
      best.textContent = game.mode === 'water' ? 'Watered' : 'Put right';
      return;
    }
    scoreNum.textContent = formatScore(value);
    const daily = game.dailyInfo;
    if (daily) {
      // daily runs compare with the day's ranked score instead of the classic best
      const ranked = save.dailyRecord(daily.dateId);
      best.textContent = daily.ranked ? 'Ranked run' : ranked ? `Ranked ${formatScore(ranked.score)}` : 'Practice';
      best.classList.toggle('is-beaten', !daily.ranked && !!ranked && value > ranked.score);
      return;
    }
    if (game.mode === 'duel') {
      const opp = game.duel?.opponent;
      best.textContent = opp ? `${opp.name || 'Friend'} ${formatScore(opp.score)}` : 'Challenge';
      best.classList.toggle('is-beaten', !!opp && value > opp.score);
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

  /** Friend challenges and second chances: how far through the cards. */
  function setFixed(f) {
    stageName.textContent = game.mode === 'retry' ? 'Second chance' : game.mode === 'water' ? 'Watering' : 'Challenge';
    clear(pips).append(h('b.hud__count', `${f.index}/${f.total}`));
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
    if (!buttons.length && !build) {
      clear(answers);
      for (let i = 0; i < 4; i++) answers.append(h('div.answer', { style: { visibility: 'hidden' } }, h('span.answer__key', KEYS[i]), h('span.answer__text', 'placeholder meaning')));
      // twist layouts keep at least the height of four answers, so the camera never jumps
      answers.style.setProperty('--answers-min', `${Math.round(answers.getBoundingClientRect().height)}px`);
    }
    const view = el.getBoundingClientRect();
    const a = bottom.getBoundingClientRect();
    const t = top.getBoundingClientRect();
    const panelH = Math.round(view.bottom - a.top);
    game.setLayout(panelH, Math.round(t.bottom - view.top));
    // in-game notes (quest done, level up) sit just above the answers, clear of the falling card
    ui.root.style.setProperty('--answers-h', `${panelH}px`);
  }

  function lock(on) {
    locked = on;
    answers.classList.toggle('is-locked', on);
  }

  /** The first time a twist kind turns up on this device, its label says "New". */
  function isNewTwist(kind) {
    if (twistsSeen.has(kind)) return false;
    twistsSeen.add(kind);
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify([...twistsSeen]));
    } catch {
      /* the badge just shows again next time */
    }
    return true;
  }

  // ── Build it ────────────────────────────────────────────────────────────
  function renderBuild(tw) {
    const line = h('div.build__line');
    const tiles = tw.tiles.map((word, i) => {
      const tile = { word, used: false, el: null };
      tile.el = h('button.tile-word', { 'data-quiet': '1', style: { '--i': i }, onclick: () => tapTile(tile) }, h('span.tile-word__n', String(i + 1)), word);
      return tile;
    });
    build = { words: tw.words, full: tw.full, placed: 0, tiles, line };
    drawLine();
    answers.append(line, h('div.build__tiles', tiles.map((t) => t.el)));
  }

  function drawLine(reveal = false) {
    if (!build) return;
    clear(build.line).append(
      ...build.words.map((w, i) => {
        if (i < build.placed) return h('span.build__word.is-in', w);
        if (reveal) return h('span.build__word.is-missed', w);
        return h('span.build__slot', ' ');
      })
    );
  }

  function tapTile(tile) {
    if (locked || game.paused || !build || tile.used) return;
    const want = build.words[build.placed];
    if (tile.word.toLowerCase() === want.toLowerCase()) {
      tile.used = true;
      tile.el.classList.add('is-used');
      build.placed++;
      drawLine();
      audio.play('tap');
      if (build.placed >= build.words.length) game.answerBuilt();
    } else {
      retrigger(tile.el, 'is-nope');
      audio.play('wrong');
      game.nudge(0.06);
    }
  }

  // ── game events ─────────────────────────────────────────────────────────
  events.on('game:intro', ({ stage, daily, mode, fixed, duel }) => {
    const safe = mode === 'relax' || mode === 'retry' || mode === 'water';
    el.classList.toggle('is-safe', safe);
    el.dataset.mode = mode;
    clear(modeIco).append(icon(mode === 'relax' ? 'leaf' : mode === 'water' ? 'drop' : 'refresh'));
    modeText.textContent = mode === 'relax' ? 'Relax' : mode === 'water' ? 'Watering' : '2nd chance';
    setScore(0, false);
    setStreak(0);
    setLives(SCORING.lives, false);
    hearts.forEach((x, i) => {
      x.style.animationDelay = `${i * 90}ms`;
      retrigger(x, 'is-in');
    });
    if (daily) setDaily(daily);
    else if (fixed) setFixed(fixed);
    else setStage(stage, 0);
    rankedNote.hidden = !daily?.ranked;
    relaxNote.hidden = finishBtn.hidden = mode !== 'relax';
    restartBtn.hidden = mode !== 'classic' && mode !== 'daily';
    buttons = [];
    build = null;
    question = null;
    clear(answers);
    answers.className = 'answers is-empty';
    setFever(false);
    pause.classList.remove('is-on');
    hint.hidden = true;
    float();
    measure();
    if (daily) showBanner(`Daily challenge #${daily.n}`, 'Ready?', daily.ranked ? `${daily.total} expressions · one ranked go` : 'Practice run');
    else if (mode === 'duel') showBanner('Challenge', 'Ready?', duel?.opponent ? `Beat ${duel.opponent.name || 'your friend'}'s ${formatScore(duel.opponent.score)}` : `${fixed.total} cards · then send them to a friend`);
    else if (mode === 'relax') showBanner('Relax mode', 'Take your time', 'No lives, no rush. Finish whenever you like.');
    else if (mode === 'retry') showBanner('Second chance', 'Fix them!', `${fixed.unique} ${fixed.unique === 1 ? 'expression' : 'expressions'} to put right`);
    else if (mode === 'water') showBanner('Memory garden', 'Watering time', `${fixed.unique} thirsty ${fixed.unique === 1 ? 'flower' : 'flowers'}: get each one right`);
    else showBanner(`Stage ${stage.n}`, 'Ready?', stage.name);
  });

  events.on('game:go', () => showBanner('', 'Go!'));

  events.on('game:question', (q) => {
    question = q;
    clearTimeout(speakTimer);
    clear(answers);
    buttons = [];
    build = null;
    const tw = q.twist;
    answers.className = `answers${tw ? ` is-twist is-${tw.kind}` : ' is-std'}${q.golden ? ' is-golden' : ''}`;
    if (tw?.kind === 'build') renderBuild(tw);
    else {
      buttons = q.options.map((opt, i) =>
        h(
          'button.answer',
          { 'data-quiet': '1', style: { '--i': i }, onclick: () => !locked && game.answer(i) },
          h('span.answer__key', KEYS[i]),
          h('span.answer__text', tw?.kind === 'flip' ? phrase(opt.text) : opt.text)
        )
      );
      answers.append(...buttons);
    }
    lock(false);
    if (q.daily) setDaily(q.daily);
    else if (q.fixed) setFixed(q.fixed);
    else setStage(q.stage, game.correctInStage);

    // what floats above the answers
    const items = [];
    if (tw) {
      const info = TWIST_INFO[tw.kind];
      const isNew = isNewTwist(tw.kind);
      items.push(pill('.fpill--twist', isNew ? h('b.fpill__new', 'New') : null, h('b.fpill__tag', info.label), h('span', tw.kind === 'gap' ? `means “${tw.meaning}”` : info.ask)));
      if (tw.kind === 'listen') {
        items.push(h('button.fbtn', { 'data-quiet': '1', 'aria-label': 'Hear it again', onclick: () => sayIt(q) }, icon('sound'), 'Again'));
        speakTimer = setTimeout(() => sayIt(q), 380);
      }
    } else if (q.golden) {
      items.push(pill('.fpill--gold', 'Golden expression · triple points!'));
    }
    if ((q.mode === 'retry' || q.mode === 'water') && q.expr.example) items.push(pill('.fpill--example', h('b.fpill__tag', 'Example'), h('span', q.expr.example)));
    if (q.mode === 'relax' && !tw && q.expr.example) items.push(h('button.fbtn', { 'data-quiet': '1', onclick: (e) => showExample(q, e.currentTarget) }, icon('book'), 'Example'));
    float(...items);
    if (!save.data.tutorialDone && q.number === 1) showHint('Tap the meaning before the expression lands!');
  });

  function sayIt(q) {
    if (!speak(mainText(q.expr.text))) float(pill('.fpill--twist', h('b.fpill__tag', 'Listen'), h('span', 'Sound is not available here')));
  }

  /** Relax: show the card's example sentence and hold the card while the player reads it. */
  function showExample(q, btn) {
    if (locked) return;
    audio.play('tap');
    btn.remove();
    floatBar.append(pill('.fpill--example', h('b.fpill__tag', 'Example'), h('span', q.expr.example)));
    game.hold(true);
  }

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

  events.on('game:answered', ({ choice, correct, correctIndex, twist, safe }) => {
    lock(true);
    hideHint();
    clearTimeout(speakTimer);
    if (!save.data.tutorialDone) {
      save.data.tutorialDone = true;
      save.write();
    }
    const q = question;
    if (build) {
      if (correct) build.line.classList.add('is-done');
      else drawLine(true);
    } else {
      buttons[correctIndex]?.classList.add('is-right');
      if (!correct && choice != null) buttons[choice]?.classList.add('is-wrong');
    }
    // after a Listen card, show what was said; after a miss with no lives at stake, the example
    if (q && twist === 'listen') float(pill('.fpill--twist', h('b.fpill__tag', 'It was'), h('span', phrase(q.expr.text))));
    else if (q && !correct && safe && q.expr.example && q.mode === 'relax') float(pill('.fpill--example', h('b.fpill__tag', 'Example'), h('span', q.expr.example)));
    if (correct && !game.daily && !game.fixed) setStage(game.stageDef, game.correctInStage);
    if (game.safe) setScore(0, correct);
  });

  events.on('game:score', ({ score, gained, bonus, speed, twist, golden, fever, safe, mode, streak: n, x, y }) => {
    setScore(score);
    setStreak(n);
    let dy = 46;
    const tag = (text, cls) => {
      ui.popup(text, x, y + dy, cls);
      dy += 44;
    };
    if (safe) {
      ui.popup(mode === 'retry' ? 'Fixed!' : mode === 'water' ? 'Watered!' : 'Right!', x, y, 'pop--calm');
      if (question?.twist) tag(TWIST_INFO[question.twist.kind].label, 'pop--twist');
      return;
    }
    ui.popup(`+${gained}`, x, y, golden ? 'pop--big' : '');
    // extra labels stack underneath the points
    if (golden) tag('Golden ×3', 'pop--gold');
    if (fever) tag('Fever ×2', 'pop--fever');
    if (twist) tag(`${TWIST_INFO[question?.twist?.kind]?.label ?? 'Twist'} +${twist}`, 'pop--twist');
    if (bonus) tag(`Streak ×${n}  +${bonus}`, 'pop--bonus');
    if (speed) tag(`Quick +${speed}`, 'pop--speed');
  });

  events.on('game:lives', ({ lives: n }) => {
    setLives(n);
    setStreak(0);
  });
  events.on('game:damage', () => ui.damage());
  events.on('game:missed', () => setStreak(0));

  events.on('game:stage', ({ stage, mode }) => {
    clear(answers);
    buttons = [];
    build = null;
    answers.className = 'answers is-empty';
    float();
    setStage(stage, 0);
    const sub = mode === 'relax' ? 'Trickier expressions, same easy pace' : stage.n === STAGES.length ? 'The final stage — how far can you go?' : 'Faster and trickier';
    showBanner(`Stage ${stage.n} of ${STAGES.length}`, stage.name, sub, true);
  });

  events.on('game:ending', () => {
    lock(true);
    answers.classList.add('is-empty');
    hideHint();
    float();
    clearTimeout(speakTimer);
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
      clearTimeout(speakTimer);
      stopSpeaking();
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
      if (build) {
        const n = Number(k);
        const tile = n >= 1 ? build.tiles[n - 1] : null;
        if (tile) tapTile(tile);
        return;
      }
      if (k === 'r' && question?.twist?.kind === 'listen') return sayIt(question);
      const i = '1234'.indexOf(k) >= 0 ? '1234'.indexOf(k) : 'abcd'.indexOf(k);
      if (i >= 0 && buttons[i]) {
        buttons[i].classList.add('is-down');
        setTimeout(() => buttons[i]?.classList.remove('is-down'), 120);
        game.answer(i);
      }
    },
  };
}
