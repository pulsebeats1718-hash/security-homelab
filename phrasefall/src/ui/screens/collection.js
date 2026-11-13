import { h, icon, clear } from '../dom.js';
import { shots } from '../../game/shots.js';
import { getExpression, TOTAL_EXPRESSIONS, BY_STAGE, expressionsReady, whenExpressionsReady } from '../../data/expressions/index.js';
import { STAGES } from '../../data/stages.js';

const TABS = [
  { id: 'mastered', label: 'Mastered', color: 'var(--mint)', test: (s, id, save) => save.isMastered(id), empty: ['Nothing mastered yet', 'Answer an expression correctly three times in a row and it moves here.'] },
  { id: 'mistakes', label: 'To review', color: 'var(--coral)', test: (s, id, save) => save.needsWork(id), empty: ['No mistakes to review', 'Expressions you get wrong wait here until you have mastered them.'] },
  { id: 'practise', label: 'Practise again', color: 'var(--sky)', test: (s) => s.practise, empty: ['Your practice list is empty', 'Flag any flashcard with “Practise again” and it will come up more often in games.'] },
  { id: 'favourites', label: 'Favourites', color: 'var(--gold)', test: (s) => s.fav, empty: ['No favourites yet', 'Tap the star on any expression you love and want to keep close.'] },
];

/** My Collection: every expression the player has met, sorted into four shelves. */
export function createCollection(app) {
  const { save, ui, audio } = app;
  let tab = 'mastered';
  const tabs = h('div.tabs');
  const progressText = h('span');
  const meter = h('i');
  const stagesEl = h('div.coll__stages');
  const rows = h('div.rows');
  const list = h('div.scroll', rows);
  const el = h(
    'section.sheet',
    h(
      'div.panel.sheet__panel',
      h('header.bar', h('button.iconbtn', { 'aria-label': 'Back', 'data-sound': 'back', onclick: () => ui.go('menu') }, icon('back')), h('div.bar__title', 'My Collection')),
      h('div.coll', h('div.coll__progress', h('b', 'Expressions discovered'), progressText, h('div.meter', meter), stagesEl), tabs, list)
    )
  );

  const idsFor = (t) => save.seenIds.filter((id) => getExpression(id) && t.test(save.stat(id), id, save)).sort((a, b) => getExpression(a).text.localeCompare(getExpression(b).text));

  function render() {
    const seen = save.seenIds.filter((id) => getExpression(id)).length;
    progressText.textContent = `${seen.toLocaleString('en-GB')} / ${TOTAL_EXPRESSIONS.toLocaleString('en-GB')}`;
    meter.style.width = `${(seen / TOTAL_EXPRESSIONS) * 100}%`;
    clear(stagesEl);
    STAGES.forEach((st, i) => {
      const list = BY_STAGE[i];
      const found = list.reduce((n, e) => n + (save.stat(e.id)?.seen ? 1 : 0), 0);
      stagesEl.append(
        h(
          'div.coll__stage',
          h('span.coll__stage-name', st.short),
          h('span.coll__stage-n', `${found}/${list.length}`),
          h('span.minimeter', h('i', { style: { width: `${list.length ? (found / list.length) * 100 : 0}%` } }))
        )
      );
    });
    clear(tabs);
    for (const t of TABS) tabs.append(h(`button.tab${t.id === tab ? '.is-on' : ''}`, { onclick: () => ((tab = t.id), render()) }, t.label, h('span.tab__n', idsFor(t).length)));
    const def = TABS.find((t) => t.id === tab);
    const ids = idsFor(def);
    clear(rows);
    if (!ids.length) {
      rows.append(
        h('div.empty', h('div.empty__ico', icon(seen ? 'star' : 'book')), h('div', h('b', def.empty[0]), def.empty[1]), seen ? null : h('button.btn.btn--gold', { 'data-quiet': '1', onclick: () => app.startGame() }, icon('play'), 'Play a game'))
      );
      return;
    }
    for (const id of ids) {
      const e = getExpression(id);
      const s = save.stat(id);
      const star = h(
        `button.row__star${s.fav ? '.is-on' : ''}`,
        {
          'aria-label': 'Favourite',
          'data-quiet': '1',
          onclick: (ev) => {
            ev.stopPropagation();
            const on = save.toggle(id, 'fav');
            audio.play('star', { on });
            if (tab === 'favourites') render();
            else star.classList.toggle('is-on', on);
          },
        },
        icon('star')
      );
      rows.append(
        h(
          'div.row.hit',
          { role: 'button', tabindex: '0', style: { '--row': def.color }, onclick: () => (audio.play('tap'), ui.go('flashcards', { from: 'collection', filter: tab === 'mistakes' ? 'mistakes' : tab, startId: id })) },
          h('span.row__expr', e.text),
          h('span.row__stats', h('span.ok', `✓ ${s.correct}`), h('span.no', `✗ ${s.wrong}`)),
          star,
          h('span.row__mean', e.meaning)
        )
      );
    }
    list.scrollTop = 0;
  }

  function open() {
    // open on the first shelf that has something in it
    const first = TABS.find((t) => idsFor(t).length);
    if (first && !idsFor(TABS.find((t) => t.id === tab)).length) tab = first.id;
    render();
  }

  /** The expression files are still on their way: wait here, then open. */
  function waitForData() {
    progressText.textContent = '…';
    meter.style.width = '0%';
    clear(stagesEl);
    clear(tabs);
    clear(rows).append(h('div.empty', h('div.empty__ico', h('span.spinner')), h('div', h('b', 'Loading your collection…'), 'Fetching the expressions.')));
    whenExpressionsReady().then(
      () => ui.name === 'collection' && open(),
      () =>
        ui.name === 'collection' &&
        clear(rows).append(h('div.empty', h('div.empty__ico', icon('alert')), h('div', h('b', 'Could not load the expressions'), 'Check your connection and try again.'), h('button.btn.btn--gold', { 'data-quiet': '1', onclick: () => waitForData() }, icon('refresh'), 'Try again')))
    );
  }

  return {
    el,
    shade: true,
    show() {
      app.stage.setShot(shots.backdrop(app.stage), 1.2);
      if (expressionsReady()) open();
      else waitForData();
    },
    key(e) {
      if (e.key === 'Escape') ui.go('menu');
    },
  };
}
