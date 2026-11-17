import '../../styles/theatre.css';
import { h, icon, clear, phrase, retrigger } from '../dom.js';
import { getExpression, whenExpressionsReady } from '../../data/expressions/index.js';
import { speak, speechAvailable } from '../../audio/speech.js';
import { mainText } from '../../game/twists.js';
import { shuffle } from '../../core/utils.js';

/** Scenes in a round. */
const ROUND = 6;
/** How long the player watches before the options appear (ms). */
const WATCH_MS = 2000;
/** Wrong picks before the answer is shown. */
const MISSES = 2;

/**
 * Literal Theatre: the island's characters act out idioms literally — a dog barking up the wrong
 * tree, a cat let out of a bag — and the player guesses which idiom it is.
 *
 * A round is six scenes, chosen at random with the ones the player has seen least first
 * (save.data.theatre = { seen: { [sceneId]: count } }). Each scene loops on the island while a
 * compact panel at the bottom asks the question; after a moment four idioms appear: the right one
 * and three others (other theatre idioms or well-known idioms from the database, never close in
 * meaning to the answer). A wrong pick shakes and the player tries again; after two misses the
 * answer is shown. Every scene ends on a card with the idiom, its meaning and an example.
 *
 * Learning: right first time is a right answer for the expression (spaced repetition, mastery, the
 * garden, the daily goal); otherwise one miss is recorded. Events: 'theatre:answered'
 * { id, correct, type } once per scene and 'theatre:done' { n, right } at the end of a round.
 *
 * show(params): { from = 'menu' } — where Back goes; { scene: id } starts the round with that scene.
 * Keys: 1–4 (or A–D) pick, Enter / Space next, Enter on the curtain call for another round, Escape
 * back. The scenes and their director live in src/world/theatre/ and load on the first visit.
 */
export function createTheatre(app) {
  const { ui, save, audio, events } = app;
  let T = null; // the theatre module: { Director, SCENES, related, EXTRA }
  let director = null;
  let from = 'menu';
  let state = 'idle'; // idle | loading | scene | reveal | summary | error
  let token = 0; // bumped on every show / hide so late promises know they are stale
  let round = null; // { list: [scene defs], i, right, results: [{ id, first }] }
  let cur = null; // the scene on stage: { def, e, options, btns, optsEl, open, answered, first, misses, done }
  let timers = [];
  let prevTheme = null;

  const later = (ms, fn) => timers.push(setTimeout(fn, ms));
  const clearTimers = () => {
    timers.forEach(clearTimeout);
    timers = [];
  };
  const back = () => ui.go(from);

  // ── layout ──────────────────────────────────────────────────────────────
  const pips = h('div.theatre__pips', { 'aria-hidden': 'true' });
  const top = h(
    'header.theatre__top',
    h('button.iconbtn', { 'aria-label': 'Back', 'data-sound': 'back', onclick: back }, icon('back')),
    h('div.theatre__title', icon('masks'), h('span', 'Literal Theatre')),
    pips
  );
  const panel = h('div.panel.theatre__panel', { role: 'region', 'aria-live': 'polite' });
  const el = h('section.theatre', top, panel);

  /** Tell the director which band of the screen is free for the scene (between header and panel). */
  function measure(seconds = 0.6) {
    if (!director) return;
    const bottom = panel.offsetTop - 8;
    director.setArea({ top: top.offsetTop + top.offsetHeight + 6, bottom }, seconds);
  }
  const measureSoon = (seconds) => requestAnimationFrame(() => measure(seconds));

  function setPanel(cls, ...kids) {
    panel.className = `panel theatre__panel theatre__panel--${cls}`;
    clear(panel).append(...kids);
    retrigger(panel, 'is-in');
  }

  function renderPips() {
    clear(pips);
    if (!round) return;
    round.list.forEach((d, i) => {
      const r = round.results[i];
      const cls = r ? (r.first ? '.is-right' : '.is-miss') : i === round.i && state !== 'summary' ? '.is-now' : '';
      pips.append(h(`i${cls}`));
    });
  }

  // ── states ──────────────────────────────────────────────────────────────
  function renderLoading() {
    state = 'loading';
    setPanel('loading', h('div.theatre__loading', h('span.spinner'), 'Setting the stage…'));
  }

  function renderError() {
    state = 'error';
    setPanel(
      'error',
      h('p.theatre__error', 'The theatre could not open just now. Check your connection and try again.'),
      h('button.btn.btn--ink', { 'data-sound': 'back', onclick: back }, icon('back'), 'Back')
    );
  }

  function seenMap() {
    let th = save.data.theatre;
    if (!th || typeof th !== 'object') th = save.data.theatre = {};
    if (!th.seen || typeof th.seen !== 'object') th.seen = {};
    return th.seen;
  }

  /** Six scenes: the least seen first (random among equals), in a shuffled order. */
  function startRound(firstId = null) {
    const seen = seenMap();
    const pool = T.SCENES.filter((d) => getExpression(d.id));
    if (!pool.length) return renderError();
    const ranked = shuffle(pool).sort((a, b) => (seen[a.id] ?? 0) - (seen[b.id] ?? 0));
    let list = shuffle(ranked.slice(0, Math.min(ROUND, ranked.length)));
    const first = firstId && pool.find((d) => d.id === firstId);
    if (first) list = [first, ...list.filter((d) => d !== first)].slice(0, Math.min(ROUND, pool.length));
    round = { list, i: 0, right: 0, results: [] };
    startScene();
  }

  /** The right idiom and three others, none close in meaning to it (or to each other). */
  function optionsFor(def) {
    const answer = def.id;
    const near = new Set([answer, ...T.related(answer)]);
    const usable = (id) => !near.has(id) && !!getExpression(id);
    const fromTheatre = shuffle(T.SCENES.map((d) => d.id).filter(usable));
    const extra = shuffle(T.EXTRA.filter(usable));
    const picked = [];
    const clash = (id) => picked.includes(id) || picked.some((p) => T.related(p).includes(id));
    const take = (list, n) => {
      for (const id of list) {
        if (picked.length >= 3 || n <= 0) return;
        if (!clash(id)) {
          picked.push(id);
          n--;
        }
      }
    };
    take(extra, Math.random() < 0.55 ? 1 : 0); // now and then a well-known idiom from outside the theatre
    take(fromTheatre, 3);
    take(extra, 3); // only if the theatre ran short
    return shuffle([answer, ...picked]);
  }

  function startScene() {
    clearTimers();
    const def = round.list[round.i];
    const e = getExpression(def.id);
    const seen = seenMap();
    seen[def.id] = (seen[def.id] ?? 0) + 1;
    save.write();
    cur = { def, e, options: optionsFor(def), btns: [], optsEl: null, open: false, answered: false, first: false, misses: 0, done: false };
    if (!director.play(def)) {
      // a scene that cannot be staged is skipped quietly (it never counts against the player)
      round.list.splice(round.i, 1);
      if (round.i >= round.list.length) return round.list.length ? finishRound() : renderError();
      return startScene();
    }
    app.env.setTheme(def.theme ?? 'midday', 1.1); // most scenes play in bright daylight
    renderScene();
    later(WATCH_MS, openOptions);
  }

  function renderScene() {
    state = 'scene';
    const c = cur;
    c.btns = c.options.map((id, i) => {
      const e = getExpression(id);
      const btn = h('button.theatre__opt', { 'data-quiet': '1', disabled: true, style: { '--i': i } }, h('span.theatre__key', String(i + 1)), h('span.theatre__text', phrase(e.text)));
      btn.onclick = () => pick(id, btn);
      return btn;
    });
    c.optsEl = h('div.theatre__options.is-waiting', c.btns);
    setPanel(
      'scene',
      h('div.theatre__ask', h('span.theatre__count', `Scene ${round.i + 1} of ${round.list.length}`), h('b', 'Which idiom is the island acting out?')),
      h('div.theatre__stage', c.optsEl, h('div.theatre__watch', h('span', 'Watch closely'), h('span.theatre__dots', h('i'), h('i'), h('i'))))
    );
    renderPips();
    measureSoon(0.9);
  }

  function openOptions() {
    const c = cur;
    if (!c || c.open || state !== 'scene') return;
    c.open = true;
    c.optsEl.classList.remove('is-waiting');
    for (const b of c.btns) b.disabled = false;
    audio.play('flip');
  }

  function lock() {
    cur.optsEl.classList.add('is-locked');
    for (const b of cur.btns) b.disabled = true;
  }

  function pick(id, btn) {
    const c = cur;
    if (!c || !c.open || c.done || btn.disabled) return;
    const right = id === c.def.id;
    if (!c.answered) {
      // the first pick decides how the scene counts: right first time, or one miss
      c.answered = true;
      c.first = right;
      save.recordAnswer(c.def.id, right);
      save.write();
      events.emit('theatre:answered', { id: c.def.id, correct: right, type: c.e.type });
      round.results[round.i] = { id: c.def.id, first: right };
      if (right) round.right++;
      renderPips();
    }
    if (right) {
      c.done = true;
      lock();
      btn.classList.add('is-right');
      audio.play('correct', { streak: Math.max(1, round.right) });
      director.celebrate();
      later(1500, renderReveal);
      return;
    }
    c.misses++;
    btn.disabled = true;
    retrigger(btn, 'is-wrong');
    audio.play('wrong');
    if (c.misses >= MISSES) {
      c.done = true;
      lock();
      later(700, () => {
        c.btns[c.options.indexOf(c.def.id)]?.classList.add('is-right');
        audio.play('flip');
      });
      later(2000, renderReveal);
    }
  }

  /** The example sentence with the idiom's words in bold (matched loosely: "spilled" finds "spill"). */
  function highlight(line, text) {
    const words = mainText(text)
      .toLowerCase()
      .replace(/[^a-z' ]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 1 && !['a', 'an', 'the', 'your', 'someone', "someone's"].includes(w));
    const stems = words.map((w) => w.slice(0, Math.max(3, w.length - 2)));
    const parts = line.split(/(\s+)/);
    const bare = (s) => s.toLowerCase().replace(/[^a-z']/g, '');
    const hit = (w) => !!w && stems.some((st) => w.startsWith(st));
    const GLUE = ['a', 'an', 'the', 'of', 'on', 'in', 'up', 'out', 'my', 'your', 'his', 'her', 'their', 'our', 'over', 'than', 'you', 'can', 'as', 'to', 'all', 'one'];
    let best = [0, 0];
    for (let i = parts[0] === '' ? 2 : 0; i < parts.length; i += 2) {
      if (!hit(bare(parts[i]))) continue; // a run starts on one of the idiom's own words
      let run = 0;
      for (let j = i; j < parts.length; j += 2) {
        const w = bare(parts[j]);
        if (hit(w)) run = (j - i) / 2 + 1;
        else if (!GLUE.includes(w)) break;
      }
      if (run > best[1] - best[0]) best = [i, i + run];
    }
    if (best[1] - best[0] < 1) return line;
    const end = best[0] + (best[1] - best[0]) * 2 - 1;
    return [parts.slice(0, best[0]).join(''), h('b', parts.slice(best[0], end).join('')), parts.slice(end).join('')];
  }

  function renderReveal() {
    const c = cur;
    if (!c || state !== 'scene') return;
    state = 'reveal';
    const e = c.e;
    const last = round.i >= round.list.length - 1;
    const [ico, text, cls] = c.first ? ['check', 'Right first time!', '.is-right'] : c.misses >= MISSES ? ['sparkle', 'This one was…', ''] : ['check', 'Got it!', '.is-ok'];
    const listen = speechAvailable() ? h('button.theatre__say', { 'data-quiet': '1', 'aria-label': 'Listen', onclick: () => speak(mainText(e.text)) }, icon('sound')) : null;
    setPanel(
      'reveal',
      h(`div.theatre__verdict${cls}`, icon(ico), h('span', text)),
      h('div.theatre__idiom', h('span', phrase(e.text)), listen),
      h('div.theatre__meaning', e.meaning),
      h('div.theatre__example', highlight(e.example, e.text)),
      h('button.btn.btn--gold.theatre__next', { onclick: next }, h('span', last ? 'See how you did' : 'Next scene'), icon('next'))
    );
    renderPips();
    measureSoon(0.6);
  }

  function next() {
    if (!round || state !== 'reveal') return;
    round.i++;
    if (round.i >= round.list.length) return finishRound();
    startScene();
  }

  function finishRound() {
    clearTimers();
    state = 'summary';
    cur = null;
    const n = round.list.length;
    const right = round.right;
    events.emit('theatre:done', { n, right });
    director.bow(right >= n - 1);
    app.env.setTheme('midday', 1.1);
    audio.play(right === n ? 'newBest' : 'stage');
    const head = right === n ? 'A standing ovation!' : right >= n - 2 ? 'Bravo!' : right >= 2 ? 'Well played!' : 'Every show gets better';
    setPanel(
      'summary',
      h('div.theatre__curtain', h('div.eyebrow', 'Curtain call'), h('div.theatre__head', head)),
      h('div.theatre__score', h('b', `${right}/${n}`), h('span', 'right first time')),
      h(
        'div.theatre__list.scroll',
        round.list.map((d, i) => {
          const e = getExpression(d.id);
          const ok = round.results[i]?.first;
          return h(`div.theatre__item${ok ? '.is-right' : ''}`, icon(ok ? 'check' : 'refresh'), h('div', h('b', phrase(e?.text ?? d.id)), h('span', e?.meaning ?? '')));
        })
      ),
      h(
        'div.theatre__actions',
        h('button.btn.btn--gold', { onclick: () => (audio.play('select'), startRound()), 'data-quiet': '1' }, icon('refresh'), 'Another round'),
        h('button.btn.btn--ink', { 'data-sound': 'back', onclick: back }, icon('back'), 'Back')
      )
    );
    renderPips();
    measureSoon(1);
  }

  return {
    el,
    shade: false,
    /** For previews and tests: the director that runs the scenes (null until the first visit). */
    get director() {
      return director;
    },
    show(params = {}) {
      const my = ++token;
      from = params.from ?? 'menu';
      clearTimers();
      round = null;
      cur = null;
      prevTheme = app.env.themeName;
      app.env.setTheme('midday', 1.2);
      app.env.setDim(0);
      app.fx.setDizzy(false);
      app.hero.set(save.data.character, { effect: false, clip: null });
      app.hero.waves = false;
      app.hero.face();
      clear(pips);
      renderLoading();
      Promise.all([import('../../world/theatre/index.js'), whenExpressionsReady()]).then(
        ([mod]) => {
          if (my !== token || ui.name !== 'theatre') return;
          T = mod;
          director ??= new T.Director(app);
          startRound(params.scene);
        },
        (err) => {
          console.warn('Phrasefall: the theatre could not load:', err);
          if (my === token) renderError();
        }
      );
    },
    hide() {
      token++;
      clearTimers();
      state = 'idle';
      round = null;
      cur = null;
      director?.clear();
      if (prevTheme) app.env.setTheme(prevTheme, 0.9);
    },
    key(e) {
      if (e.key === 'Escape') return back();
      if (state === 'scene') {
        // 1–4, or A–D like the game's answers
        const n = Number(e.key) || ' abcd'.indexOf(String(e.key).toLowerCase());
        if (n >= 1 && n <= 4) cur?.btns[n - 1]?.click();
      } else if (state === 'reveal' && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault?.();
        next();
      } else if (state === 'summary' && e.key === 'Enter') {
        audio.play('select');
        startRound();
      }
    },
    relayout() {
      measure(0.25);
    },
  };
}
