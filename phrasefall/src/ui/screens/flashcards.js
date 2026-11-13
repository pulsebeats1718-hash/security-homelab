import { h, icon, clear, retrigger } from '../dom.js';
import { shots } from '../../game/shots.js';
import { getExpression, TYPE_LABELS, expressionsReady, whenExpressionsReady } from '../../data/expressions/index.js';
import { SR_INTERVALS } from '../../core/storage.js';

const FILTERS = [
  { id: 'due', label: 'Due today' },
  { id: 'all', label: 'All', test: () => true },
  { id: 'practise', label: 'Practise again', test: (s) => s.practise },
  { id: 'mistakes', label: 'Mistakes', test: (s, id, save) => save.needsWork(id) },
  { id: 'favourites', label: 'Favourites', test: (s) => s.fav },
  { id: 'mastered', label: 'Mastered', test: (s, id, save) => save.isMastered(id) },
];

/** Speak an expression with a British voice where the browser offers one. */
function speak(text) {
  try {
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-GB';
    const voice = synth.getVoices().find((v) => v.lang === 'en-GB') ?? synth.getVoices().find((v) => v.lang?.startsWith('en'));
    if (voice) u.voice = voice;
    u.rate = 0.92;
    synth.speak(u);
  } catch {
    /* speech is a bonus; ignore where unsupported */
  }
}

/** "tomorrow", "in 3 days" for a Leitner box. */
const whenAgain = (box) => {
  const days = SR_INTERVALS[box] ?? 0;
  return days === 0 ? 'later today' : days === 1 ? 'tomorrow' : `in ${days} days`;
};

/**
 * Flashcards: review every expression met in play. Tap to flip, swipe to move on.
 * "Due today" holds the spaced-repetition reviews; after flipping a card,
 * "Not yet" / "I knew it" move it between Leitner boxes.
 */
export function createFlashcards(app) {
  const { save, ui, audio } = app;
  let filter = 'all';
  let custom = null; // { ids, label } from the results screen
  let deck = [];
  let pos = 0;
  let from = 'menu';
  let params = {};

  const tabs = h('div.tabs');
  const type = h('span.fc__type');
  const lvl = h('span.fc__lvl', { title: 'Difficulty' });
  const expr = h('h3.fc__expr');
  const back = h('div.fc__face.fc__back');
  const gradeNo = h('button.grade.grade--no', { 'data-quiet': '1', onclick: (e) => (e.stopPropagation(), grade(false)) }, icon('repeat'), 'Not yet');
  const gradeYes = h('button.grade.grade--yes', { 'data-quiet': '1', onclick: (e) => (e.stopPropagation(), grade(true)) }, icon('check'), 'I knew it');
  const gradeBar = h('div.fc__grade', gradeNo, gradeYes);
  const card = h(
    'div.fc__card.hit',
    { tabindex: '0', role: 'button', 'aria-label': 'Flashcard — tap to flip', onclick: flip },
    h(
      'div.fc__face.fc__front',
      h('div.fc__meta', type, lvl),
      expr,
      h('span.fc__tap', icon('hand'), 'Tap to see the meaning'),
      h('button.fc__say', { 'aria-label': 'Listen', 'data-quiet': '1', onclick: (e) => (e.stopPropagation(), deck[pos] && speak(getExpression(deck[pos]).text)) }, icon('sound'))
    ),
    back
  );
  const toast = h('div.fc__toast');
  const stageEl = h('div.fc__stage', card, toast);
  const count = h('span.fc__count');
  const favBtn = h('button.toggle', { 'data-quiet': '1', onclick: () => toggle('fav') });
  const pracBtn = h('button.toggle', { 'data-quiet': '1', onclick: () => toggle('practise') });
  const controls = h(
    'div.fc__controls',
    h('button.iconbtn', { 'aria-label': 'Previous card', 'data-quiet': '1', onclick: () => move(-1) }, icon('back')),
    favBtn,
    pracBtn,
    h('button.iconbtn', { 'aria-label': 'Next card', 'data-quiet': '1', onclick: () => move(1) }, icon('next'))
  );
  const empty = h('div.empty');
  const content = h('div.fc', tabs, stageEl, controls);
  const el = h(
    'section.sheet',
    h(
      'div.panel.sheet__panel',
      h('header.bar', h('button.iconbtn', { 'aria-label': 'Back', 'data-sound': 'back', onclick: () => leave() }, icon('back')), h('div.bar__title', 'Flashcards'), count),
      h('div', { style: { display: 'grid', minHeight: '0' } }, content, empty)
    )
  );

  const leave = () => (from === 'results' && app.screens.results.last ? ui.go('results', app.screens.results.last) : from === 'collection' ? ui.go('collection') : ui.go('menu'));
  const known = (id) => !!getExpression(id);

  function idsFor(f) {
    if (f === 'custom') return custom?.ids ?? [];
    if (f === 'due') return save.dueIds(Date.now(), known);
    const def = FILTERS.find((x) => x.id === f);
    return save.seenIds.filter((id) => known(id) && def.test(save.stat(id), id, save)).sort((a, b) => (save.stat(b).t ?? 0) - (save.stat(a).t ?? 0));
  }

  function buildTabs() {
    clear(tabs);
    const list = custom ? [{ id: 'custom', label: custom.label }, ...FILTERS] : FILTERS;
    for (const f of list) {
      const n = idsFor(f.id).length;
      tabs.append(h(`button.tab${f.id === filter ? '.is-on' : ''}${f.id === 'due' && n ? '.tab--due' : ''}`, { onclick: () => setFilter(f.id) }, f.label, h('span.tab__n', n)));
    }
  }

  function setFilter(f, startId = null) {
    filter = f;
    deck = idsFor(f);
    pos = Math.max(0, startId ? deck.indexOf(startId) : 0);
    buildTabs();
    render();
  }

  function showEmpty(ico, titleText, text, button = null) {
    stageEl.hidden = controls.hidden = true;
    empty.hidden = false;
    clear(empty).append(h('div.empty__ico', ico), h('div', h('b', titleText), text), button);
    count.textContent = '';
    content.style.gridTemplateRows = 'auto';
  }

  function render(dir = 0) {
    const has = deck.length > 0;
    stageEl.hidden = controls.hidden = !has;
    empty.hidden = has;
    if (!has) {
      const none = save.seenIds.length === 0;
      if (none) showEmpty(icon('cards'), 'No flashcards yet', 'Every expression you meet in a game lands here, ready to revise.', h('button.btn.btn--gold', { 'data-quiet': '1', onclick: () => app.startGame() }, icon('play'), 'Play a game'));
      else if (filter === 'due') showEmpty(icon('check'), 'All caught up', 'Nothing else is due today. Cards come back on the day they are due — or review them all now.', h('button.btn', { onclick: () => setFilter('all') }, icon('cards'), 'Review all cards'));
      else showEmpty(icon('check'), 'Nothing here right now', 'Try another filter, or play a round to collect more.');
      return;
    }
    content.style.gridTemplateRows = '';
    const e = getExpression(deck[pos]);
    const s = save.stat(e.id) ?? {};
    card.classList.remove('is-flipped');
    if (dir) retrigger(card, dir > 0 ? 'is-swap-l' : 'is-swap-r');
    type.textContent = `${TYPE_LABELS[e.type] ?? e.type} · Stage ${e.stage}`;
    clear(lvl).append(...[1, 2, 3].map((n) => h(`i${n <= e.level ? '.is-on' : ''}`)));
    lvl.setAttribute('aria-label', ['', 'Core', 'Common', 'Advanced'][e.level] ?? '');
    expr.textContent = e.text;
    clear(back).append(
      h('h3', e.text),
      h('p.fc__meaning', e.meaning),
      h('div.fc__row', h('span.fc__label', 'Example'), h('p.fc__example', e.example)),
      h('div.fc__row', h('span.fc__label', 'Similar'), h('div.fc__chips', e.synonyms.map((x) => h('span', x)))),
      h('div.fc__row', h('span.fc__label', 'Register & context'), h('div.fc__chips', h('span.fc__reg', e.register)), h('p.fc__text', e.context)),
      h('div.fc__row', h('span.fc__label', 'Common mistake'), h('div.fc__warn', icon('alert'), h('span', e.mistake))),
      gradeBar
    );
    back.scrollTop = 0;
    count.textContent = `${pos + 1} / ${deck.length}`;
    clear(favBtn).append(icon('star'), 'Favourite');
    favBtn.classList.toggle('is-on', !!s.fav);
    clear(pracBtn).append(icon('repeat'), 'Practise again');
    pracBtn.classList.toggle('is-on', !!s.practise);
  }

  function flip() {
    if (!deck.length) return;
    card.classList.toggle('is-flipped');
    audio.play('flip');
  }
  function move(d) {
    if (deck.length < 2) return;
    pos = (pos + d + deck.length) % deck.length;
    audio.play('browse');
    render(d);
  }
  function toggle(flag) {
    if (!deck.length) return;
    const on = save.toggle(deck[pos], flag);
    audio.play('star', { on });
    const btn = flag === 'fav' ? favBtn : pracBtn;
    btn.classList.toggle('is-on', on);
    buildTabs();
  }
  /** "I knew it" moves the card up a Leitner box, "Not yet" back to box 0 (due again today). */
  function grade(knew) {
    if (!deck.length || !card.classList.contains('is-flipped')) return;
    const id = deck[pos];
    const box = save.review(id, knew);
    app.events.emit('cards:review', { id, knew }); // daily goal, quests and XP (src/game/progress.js)
    audio.play(knew ? 'select' : 'back');
    toast.textContent = knew ? `Nice — back ${whenAgain(box)}` : 'It will come round again';
    toast.classList.toggle('is-good', knew);
    retrigger(toast, 'is-show');
    if (filter === 'due') {
      // known cards leave today's pile; the rest go to the back of it
      deck.splice(pos, 1);
      if (!knew) deck.push(id);
      if (pos >= deck.length) pos = 0;
    } else if (deck.length > 1) {
      pos = (pos + 1) % deck.length;
    }
    buildTabs();
    render(deck.length ? 1 : 0);
  }

  // swipe left / right to change card
  let sx = null;
  let sy = 0;
  stageEl.addEventListener('pointerdown', (e) => ((sx = e.clientX), (sy = e.clientY)));
  stageEl.addEventListener('pointerup', (e) => {
    if (sx == null) return;
    const dx = e.clientX - sx;
    const dy = e.clientY - sy;
    sx = null;
    if (Math.abs(dx) > 56 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      e.preventDefault();
      suppress = true;
      move(dx < 0 ? 1 : -1);
    }
  });
  let suppress = false;
  card.addEventListener(
    'click',
    (e) => {
      if (suppress) {
        suppress = false;
        e.stopImmediatePropagation();
      }
    },
    true
  );

  function open() {
    custom = params.ids?.length ? { ids: params.ids.filter(known), label: params.label ?? 'This game' } : null;
    const start = custom ? 'custom' : params.filter ?? (save.dueIds(Date.now(), known).length ? 'due' : 'all');
    setFilter(start, params.startId ?? null);
  }

  /** The expression files are still on their way: wait here, then open. */
  function waitForData() {
    clear(tabs);
    showEmpty(h('span.spinner'), 'Loading the flashcards…', 'Fetching the expressions.');
    whenExpressionsReady().then(
      () => ui.name === 'flashcards' && open(),
      () =>
        ui.name === 'flashcards' &&
        // a failed module download is not fetched again in the same page: a reload retries it
        showEmpty(icon('alert'), 'Could not load the expressions', 'Check your connection, then reload the game.', h('button.btn.btn--gold', { 'data-quiet': '1', onclick: () => location.reload() }, icon('refresh'), 'Reload'))
    );
  }

  return {
    el,
    shade: true,
    show(p = {}) {
      from = p.from ?? 'menu';
      params = p;
      app.stage.setShot(shots.backdrop(app.stage), 1.2);
      if (expressionsReady()) open();
      else waitForData();
    },
    hide() {
      try {
        window.speechSynthesis?.cancel();
      } catch {
        /* ignore */
      }
    },
    key(e) {
      if (e.key === 'ArrowLeft') move(-1);
      else if (e.key === 'ArrowRight') move(1);
      else if (e.key === ' ' || e.key === 'Enter') (e.preventDefault(), flip());
      else if (e.key === '1' || e.key === '2') grade(e.key === '2');
      else if (e.key === 'Escape') leave();
    },
  };
}
