import { h, icon, clear } from '../dom.js';
import { shots } from '../../game/shots.js';
import { PLACES } from '../../data/places.js';
import { XP } from '../../data/levels.js';

/**
 * Little skyline vignettes for the postcards (original, stylised shapes — no
 * real logos or copies of trademarked buildings).
 */
const SKYLINES = {
  home: `<ellipse cx="60" cy="58" rx="40" ry="9" fill="#5bbf55"/><path d="M24 58l10 16h52l10-16z" fill="#9b6a52"/><rect x="40" y="36" width="4" height="22" fill="#7a4e33"/><circle cx="42" cy="30" r="12" fill="#ff9ec4"/><circle cx="51" cy="35" r="8" fill="#ffb3cf"/><rect x="74" y="42" width="3" height="16" fill="#7a4e33"/><circle cx="75.500" cy="38" r="9" fill="#4fb857"/><ellipse cx="18" cy="26" rx="12" ry="4" fill="#ffffff" opacity="0.8"/><ellipse cx="100" cy="18" rx="14" ry="4" fill="#ffffff" opacity="0.8"/>`,
  london: `<rect x="0" y="62" width="120" height="18" fill="#3b6fb0" opacity="0.65"/><circle cx="34" cy="36" r="20" fill="none" stroke="#2a2550" stroke-width="2.500"/><path d="M34 16v40M14 36h40M20 22l28 28M48 22L20 50" stroke="#2a2550" stroke-width="1.200"/><path d="M28 62l6-6 6 6" fill="#2a2550"/><rect x="74" y="20" width="10" height="42" fill="#2a2550"/><path d="M72 20l7-14 7 14z" fill="#2a2550"/><circle cx="79" cy="28" r="3.200" fill="#ffd866"/><rect x="90" y="44" width="26" height="18" fill="#2a2550"/><rect x="94" y="38" width="3" height="6" fill="#2a2550"/><rect x="104" y="40" width="3" height="4" fill="#2a2550"/><rect x="2" y="48" width="18" height="14" rx="3" fill="#e5484d"/><rect x="4" y="51" width="14" height="4" fill="#ffe7e7"/>`,
  newyork: `<rect x="6" y="34" width="14" height="40" fill="#2a2550"/><rect x="22" y="22" width="12" height="52" fill="#2a2550"/><path d="M28 6l4 16h-8z" fill="#2a2550"/><rect x="36" y="40" width="16" height="34" fill="#2a2550"/><rect x="54" y="14" width="14" height="60" fill="#2a2550"/><path d="M56 14h10v-6h-10z" fill="#2a2550"/><rect x="60" y="0" width="2" height="8" fill="#2a2550"/><rect x="70" y="30" width="12" height="44" fill="#2a2550"/><rect x="84" y="44" width="10" height="30" fill="#2a2550"/><rect x="96" y="28" width="16" height="46" fill="#2a2550"/><path d="M100 28v-8h8v8" fill="#2a2550"/><g fill="#ffd866"><rect x="25" y="30" width="2" height="2"/><rect x="29" y="40" width="2" height="2"/><rect x="58" y="24" width="2" height="2"/><rect x="62" y="36" width="2" height="2"/><rect x="100" y="38" width="2" height="2"/><rect x="40" y="50" width="2" height="2"/></g><rect x="14" y="64" width="16" height="8" rx="3" fill="#f5b400"/>`,
  sydney: `<rect x="0" y="56" width="120" height="24" fill="#1f9fd0" opacity="0.7"/><path d="M8 56a52 40 0 0 1 104 0" fill="none" stroke="#2a2550" stroke-width="3"/><path d="M8 56a52 34 0 0 1 104 0" fill="none" stroke="#2a2550" stroke-width="1.400"/><path d="M20 56V44M100 56V44M34 56V36M86 56V36M48 56V31M72 56V31M60 56V30" stroke="#2a2550" stroke-width="1"/><rect x="2" y="40" width="10" height="16" fill="#2a2550"/><rect x="108" y="40" width="10" height="16" fill="#2a2550"/><path d="M40 70l10-18v18z" fill="#ffffff"/><path d="M52 70l7-12v12z" fill="#ffffff"/><path d="M36 71h28l-4 4H40z" fill="#2a2550"/><circle cx="96" cy="16" r="7" fill="#ffd866"/>`,
};

/** Your journey: the player level, how XP is earned, and the places the island can travel to. */
export function createJourney(app) {
  const { ui, progress, audio } = app;
  const body = h('div.journey.scroll');
  let from = 'menu';
  const back = () => ui.go(from);
  const el = h(
    'section.sheet.sheet--narrow',
    h('div.panel.sheet__panel', h('header.bar', h('button.iconbtn', { 'aria-label': 'Back', 'data-sound': 'back', onclick: back }, icon('back')), h('div.bar__title', 'Your journey')), body)
  );

  function levelCard() {
    const { level, into, need } = progress.info;
    const next = PLACES.find((p) => p.level > level);
    return h(
      'div.card.journey__level',
      h('div.lvl', h('span', 'Level'), h('b', String(level))),
      h(
        'div.journey__level-text',
        h('h3', `${(need - into).toLocaleString('en-GB')} XP to level ${level + 1}`),
        h('div.meter.meter--gold', h('i', { style: { width: `${(into / need) * 100}%` } })),
        h('p', next ? `${next.name} opens at level ${next.level}.` : 'You have visited every place — more are on the way.')
      ),
      h(
        'details.journey__how',
        h('summary', 'How to earn XP'),
        h(
          'ul',
          h('li', h('b', `${XP.right} XP`), ' each right answer (×3 for a golden card, ×2 in fever mode)'),
          h('li', h('b', `${XP.game} XP`), ' every game you finish'),
          h('li', h('b', `${XP.goal} XP`), ' reaching your daily goal, and ', h('b', `${XP.daily} XP`), ' for the daily challenge'),
          h('li', h('b', '40–90 XP'), ' each daily quest, plus the reward chest'),
          h('li', h('b', `${XP.review} XP`), ' each flashcard you review')
        )
      )
    );
  }

  function postcard(place) {
    const level = progress.level;
    const open = level >= place.level;
    const here = progress.place === place.id;
    const art = h('div.postcard__art', { style: { '--place': place.color } });
    art.innerHTML = `<svg viewBox="0 0 120 80" aria-hidden="true">${SKYLINES[place.id] ?? ''}</svg>`;
    let action;
    if (here) action = h('span.chip.chip--gold', icon('pin'), 'You are here');
    else if (open) action = h('button.btn.postcard__go', { 'data-quiet': '1', onclick: () => travel(place) }, icon('map'), 'Travel here');
    else action = h('span.chip', icon('lock'), `Level ${place.level}`);
    return h(
      `div.postcard${here ? '.is-here' : ''}${open ? '' : '.is-locked'}`,
      art,
      h('div.postcard__text', h('div.postcard__name', place.name), h('div.postcard__where', place.where), h('p', open ? place.blurb : `Reach level ${place.level} to visit. You're level ${level}.`)),
      h('div.postcard__action', action)
    );
  }

  function travel(place) {
    if (!app.travel(place.id)) return;
    audio.play('travel');
    render();
  }

  function render() {
    clear(body).append(levelCard(), h('div.eyebrow.journey__eyebrow', 'Places to visit'), ...PLACES.map(postcard));
  }

  return {
    el,
    shade: true,
    show(params = {}) {
      from = params.from ?? 'menu';
      app.stage.setShot(shots.backdrop(app.stage), 1.2);
      render();
    },
    key(e) {
      if (e.key === 'Escape') back();
    },
  };
}
