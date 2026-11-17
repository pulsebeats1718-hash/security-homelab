import { h, icon, clear, phrase } from '../dom.js';
import { shots } from '../../game/shots.js';
import { getExpression, TOTAL_EXPRESSIONS, BY_STAGE, expressionsReady, whenExpressionsReady } from '../../data/expressions/index.js';
import { STAGES } from '../../data/stages.js';
import { HATS, canWearHat } from '../../characters/kit/hats.js';
import { getCharacter } from '../../characters/index.js';
import { renderAchievements } from '../achievements.js';

/** The three sections at the top: every expression, the sticker album, achievements. */
const SECTIONS = [
  { id: 'expr', label: 'Expressions', icon: 'book' },
  { id: 'album', label: 'Stickers', icon: 'sticker' },
  { id: 'badges', label: 'Badges', icon: 'medal' },
];

const TABS = [
  { id: 'mastered', label: 'Mastered', color: 'var(--mint)', test: (s, id, save) => save.isMastered(id), empty: ['Nothing mastered yet', 'Answer an expression correctly three times in a row and it moves here.'] },
  { id: 'mistakes', label: 'To review', color: 'var(--coral)', test: (s, id, save) => save.needsWork(id), empty: ['No mistakes to review', 'Expressions you get wrong wait here until you have mastered them.'] },
  { id: 'practise', label: 'Practise again', color: 'var(--sky)', test: (s) => s.practise, empty: ['Your practice list is empty', 'Flag any flashcard with “Practise again” and it will come up more often in games.'] },
  { id: 'favourites', label: 'Favourites', color: 'var(--gold)', test: (s) => s.fav, empty: ['No favourites yet', 'Tap the star on any expression you love and want to keep close.'] },
];

/**
 * My Collection: every expression the player has met, sorted into four shelves; the sticker
 * album (themed sets, see src/game/album.js); and achievements (src/ui/achievements.js).
 */
export function createCollection(app) {
  const { save, ui, audio } = app;
  let tab = 'mastered';
  let section = 'expr';
  let openSet = null;
  const sectionsEl = h('div.seg.coll__sections');
  const albumView = h('div.album.scroll', { hidden: true });
  const badgesView = h('div.badges-view.scroll', { hidden: true });
  const tabs = h('div.tabs');
  const progressText = h('span');
  const meter = h('i');
  const stagesEl = h('div.coll__stages');
  const rows = h('div.rows');
  const list = h('div.scroll', rows);
  const el = h(
    'section.sheet.sheet--coll',
    h(
      'div.panel.sheet__panel',
      h('header.bar', h('button.iconbtn', { 'aria-label': 'Back', 'data-sound': 'back', onclick: () => ui.go('menu') }, icon('back')), h('div.bar__title', 'My Collection')),
      sectionsEl,
      h('div.coll', h('div.coll__progress', h('b', 'Expressions discovered'), progressText, h('div.meter', meter), stagesEl), tabs, list),
      albumView,
      badgesView
    )
  );
  const exprView = el.querySelector('.coll');

  function renderSections() {
    clear(sectionsEl).append(
      ...SECTIONS.map((x) => h(`button${x.id === section ? '.is-on' : ''}`, { 'data-quiet': '1', onclick: () => (audio.play('tap'), showSection(x.id)) }, icon(x.icon), x.label))
    );
  }
  function showSection(id) {
    section = id;
    renderSections();
    exprView.hidden = id !== 'expr';
    albumView.hidden = id !== 'album';
    badgesView.hidden = id !== 'badges';
    if (id === 'expr') open();
    else if (id === 'album') renderAlbum();
    else renderAchievements(badgesView, app);
  }

  // ── the sticker album ───────────────────────────────────────────────────
  function sticker(s, big = false) {
    const p = s.total ? s.have / s.total : 0;
    return h(`div.sticker${s.earned ? '.is-earned' : ''}${big ? '.sticker--big' : ''}`, { style: { '--c': s.set.color, '--p': `${Math.round(p * 360)}deg` } }, h('span.sticker__face', icon(s.set.icon)));
  }
  /** A note when the character on the island keeps its own headgear (a helmet, a wizard's hat …). */
  function hatNote(hatId) {
    const who = save.data.character;
    if (!hatId || canWearHat(who, hatId)) return null;
    return h('p.album__note', icon('hat'), `${getCharacter(who)?.name ?? 'Your character'} keeps their own look, so the hat waits for a character who can wear it.`);
  }
  function hatsRow() {
    const hats = app.album?.hats() ?? [];
    if (!hats.length) return null;
    const cur = app.album.hat;
    return h(
      'div.album__hats',
      h('div.eyebrow', 'Your hats'),
      hatNote(cur),
      h(
        'div.album__hat-list',
        [null, ...hats].map((id) =>
          h(`button.chip${cur === id ? '.is-on' : ''}`, { 'data-quiet': '1', onclick: () => (audio.play('tap'), app.album.wear(id), renderAlbum()) }, icon(id ? 'hat' : 'x'), id ? HATS.find((x) => x.id === id)?.name ?? id : 'No hat')
        )
      )
    );
  }
  function renderAlbum() {
    const all = app.album?.sets() ?? [];
    if (!all.length) {
      clear(albumView).append(h('div.empty', h('div.empty__ico', icon('sticker')), h('div', h('b', 'The sticker album is on its way'), 'Themed sets of expressions to collect.')));
      return;
    }
    const s = openSet && all.find((x) => x.set.id === openSet);
    if (s) return renderSet(s);
    const done = all.filter((x) => x.earned).length;
    clear(albumView).append(
      h('div.album__head', h('div', h('b', `${done} of ${all.length} stickers`), h('span', 'Master every expression in a set to earn its sticker and a reward.')), h('div.meter.meter--gold', h('i', { style: { width: `${(done / all.length) * 100}%` } }))),
      hatsRow(),
      h(
        'div.album__grid',
        all.map((x) =>
          h(
            `button.album__tile${x.earned ? '.is-earned' : ''}`,
            { 'data-quiet': '1', onclick: () => (audio.play('tap'), (openSet = x.set.id), renderAlbum()) },
            sticker(x),
            h('span.album__name', x.set.name),
            h('span.album__n', x.earned ? 'Earned' : `${x.have}/${x.total}`)
          )
        )
      )
    );
    albumView.scrollTop = 0;
  }
  function renderSet(s) {
    const r = s.reward;
    const wearing = r?.kind === 'hat' && app.album.hat === r.id;
    clear(albumView).append(
      h('button.album__back', { 'data-quiet': '1', onclick: () => (audio.play('tap'), (openSet = null), renderAlbum()) }, icon('back'), 'All stickers'),
      h(
        'div.album__detail',
        sticker(s, true),
        h('h3', s.set.name),
        h('p', s.set.blurb),
        h('div.album__prog', s.earned ? 'Sticker earned!' : `${s.have} of ${s.total} mastered`),
        h('div.meter.meter--gold', h('i', { style: { width: `${(s.have / s.total) * 100}%` } })),
        r ? h(`div.album__reward${s.earned ? '.is-earned' : ''}`, icon(r.kind === 'hat' ? 'hat' : 'flower'), h('span', s.earned ? `You earned ${r.text}` : `Reward: ${r.text}`)) : null,
        h(
          'div.album__actions',
          h('button.btn.btn--gold', { 'data-quiet': '1', onclick: () => (audio.play('select'), app.startGame({ mode: 'relax', ids: s.set.ids, label: s.set.name })) }, icon('leaf'), 'Practise this set'),
          s.earned && r?.kind === 'hat' ? h('button.btn', { onclick: () => (app.album.wear(wearing ? null : r.id), renderSet(s)) }, icon('hat'), wearing ? 'Take it off' : 'Wear it') : null
        ),
        wearing ? hatNote(r.id) : null
      ),
      h(
        'div.rows.album__list',
        s.ids.map(({ id, state }) => {
          const e = getExpression(id);
          if (!e) return null;
          return h(
            `div.row.album__row.is-${state}`,
            { role: 'button', tabindex: '0', onclick: () => (audio.play('tap'), ui.go('flashcards', { from: 'collection', ids: s.set.ids, startId: id, label: s.set.name })) },
            h('span.row__expr', phrase(e.text)),
            h('span.album__state', icon(state === 'mastered' ? 'check' : state === 'seen' ? 'repeat' : 'sparkle'), state === 'mastered' ? 'Mastered' : state === 'seen' ? 'Learning' : 'New'),
            h('span.row__mean', e.meaning)
          );
        })
      )
    );
    albumView.scrollTop = 0;
  }

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
          h('span.row__expr', phrase(e.text)),
          h('span.row__stats', h('span.ok', `✓ ${s.correct}`), h('span.no', `✗ ${s.wrong}`)),
          star,
          h('span.row__mean', e.meaning)
        )
      );
    }
    list.scrollTop = 0;
  }

  function open() {
    if (!expressionsReady()) return;
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
        // a failed module download is not fetched again in the same page: a reload retries it
        clear(rows).append(h('div.empty', h('div.empty__ico', icon('alert')), h('div', h('b', 'Could not load the expressions'), 'Check your connection, then reload the game.'), h('button.btn.btn--gold', { 'data-quiet': '1', onclick: () => location.reload() }, icon('refresh'), 'Reload')))
    );
  }

  return {
    el,
    shade: true,
    show(params = {}) {
      app.stage.setShot(shots.backdrop(app.stage), 1.2);
      if (params.section) section = params.section;
      app.album?.check();
      renderSections();
      if (section !== 'expr') {
        exprView.hidden = true;
        if (expressionsReady()) showSection(section);
        else whenExpressionsReady().then(() => ui.name === 'collection' && showSection(section), () => {});
        return;
      }
      showSection('expr');
      if (!expressionsReady()) waitForData();
    },
    key(e) {
      if (e.key === 'Escape') ui.go('menu');
    },
  };
}
