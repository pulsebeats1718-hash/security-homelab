import { h, icon, clear, retrigger } from '../dom.js';
import { shots } from '../../game/shots.js';
import { getExpression, TYPE_LABELS } from '../../data/expressions/index.js';

const FILTERS = [
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

/** Flashcards: review every expression met in play. Tap to flip, swipe to move on. */
export function createFlashcards(app) {
  const { save, ui, audio } = app;
  let filter = 'all';
  let custom = null; // { ids, label } from the results screen
  let deck = [];
  let pos = 0;
  let from = 'menu';

  const tabs = h('div.tabs');
  const type = h('span.fc__type');
  const lvl = h('span.fc__lvl', { title: 'Difficulty' });
  const expr = h('h3.fc__expr');
  const back = h('div.fc__face.fc__back');
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
  const stageEl = h('div.fc__stage', card);
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

  function idsFor(f) {
    if (f === 'custom') return custom?.ids ?? [];
    const def = FILTERS.find((x) => x.id === f);
    return save.seenIds.filter((id) => getExpression(id) && def.test(save.stat(id), id, save)).sort((a, b) => (save.stat(b).t ?? 0) - (save.stat(a).t ?? 0));
  }

  function buildTabs() {
    clear(tabs);
    const list = custom ? [{ id: 'custom', label: custom.label }, ...FILTERS] : FILTERS;
    for (const f of list) {
      const n = idsFor(f.id).length;
      tabs.append(h(`button.tab${f.id === filter ? '.is-on' : ''}`, { onclick: () => setFilter(f.id) }, f.label, h('span.tab__n', n)));
    }
  }

  function setFilter(f, startId = null) {
    filter = f;
    deck = idsFor(f);
    pos = Math.max(0, startId ? deck.indexOf(startId) : 0);
    buildTabs();
    render();
  }

  function render(dir = 0) {
    const has = deck.length > 0;
    stageEl.hidden = controls.hidden = !has;
    empty.hidden = has;
    if (!has) {
      const none = save.seenIds.length === 0;
      clear(empty).append(
        h('div.empty__ico', icon(none ? 'cards' : 'check')),
        h('div', h('b', none ? 'No flashcards yet' : 'Nothing here right now'), none ? 'Every expression you meet in a game lands here, ready to revise.' : 'Try another filter, or play a round to collect more.'),
        none ? h('button.btn.btn--gold', { 'data-quiet': '1', onclick: () => app.startGame() }, icon('play'), 'Play a game') : null
      );
      count.textContent = '';
      content.style.gridTemplateRows = 'auto';
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
      h('div.fc__row', h('span.fc__label', 'Common mistake'), h('div.fc__warn', icon('alert'), h('span', e.mistake)))
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

  return {
    el,
    shade: true,
    show(p = {}) {
      from = p.from ?? 'menu';
      custom = p.ids?.length ? { ids: p.ids.filter((id) => getExpression(id)), label: p.label ?? 'This game' } : null;
      app.stage.setShot(shots.backdrop(app.stage), 1.2);
      setFilter(custom ? 'custom' : p.filter ?? 'all', p.startId ?? null);
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
      else if (e.key === 'Escape') leave();
    },
  };
}
