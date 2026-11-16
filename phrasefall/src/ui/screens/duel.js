import { h, icon, clear } from '../dom.js';
import { shots } from '../../game/shots.js';
import { getCharacter } from '../../characters/index.js';
import { expressionsReady, whenExpressionsReady } from '../../data/expressions/index.js';
import { formatScore } from '../../core/utils.js';
import { DUEL_CARDS, NAME_MAX, cleanName, duelOutcome, myDuel, savedDuelName, saveDuelName } from '../../game/duel.js';

/**
 * Challenge a friend. Three ways in:
 *   • from the menu: how it works, your name, and Start (a new set of 20 cards);
 *   • from a friend's link (params.challenge): their score, and Accept to play the same cards;
 *   • from a link to a challenge you have already played (a friend's reply, say):
 *     both results side by side, and a rematch.
 * Results and sharing are on the results screen once the cards are played.
 */
export function createDuel(app) {
  const { ui, audio, save } = app;
  const body = h('div.duel.scroll');
  let from = 'menu';
  let challenge = null;
  let waiting = false;
  const back = () => ui.go(from === 'results' ? 'menu' : from);
  const el = h(
    'section.sheet.sheet--narrow',
    h('div.panel.sheet__panel', h('header.bar', h('button.iconbtn', { 'aria-label': 'Back', 'data-sound': 'back', onclick: back }, icon('back')), h('div.bar__title', 'Challenge a friend')), body)
  );

  /** The name your friend sees: what you typed last time, or your nickname if you are signed in. */
  function defaultName() {
    return savedDuelName() || cleanName(app.online?.user?.name ?? ''); // online: user.name is the public nickname
  }

  function nameField() {
    const input = h('input.duel__name', {
      type: 'text',
      maxlength: String(NAME_MAX),
      autocomplete: 'nickname',
      enterkeyhint: 'go',
      placeholder: 'Your first name or nickname',
      'aria-label': 'Your name, shown to your friend',
      value: defaultName(),
    });
    input.addEventListener('keydown', (e) => e.stopPropagation()); // typing must not trigger game keys
    return { input, el: h('label.duel__field', h('span.duel__label', 'Your name (your friend sees this)'), input) };
  }

  // portraits render in the background after start-up: a link can open this screen first
  const waitingFaces = new Map(); // id → Set of <img>
  app.events.on('thumb', (id) => {
    const imgs = waitingFaces.get(id);
    const t = app.thumbs.get(id);
    if (!imgs || !t) return;
    for (const img of imgs) img.src = t.normal;
    waitingFaces.delete(id);
  });
  function portrait(id) {
    const img = h('img', { alt: '' });
    const t = id && app.thumbs.get(id);
    if (t) img.src = t.normal;
    else if (id) {
      if (!waitingFaces.has(id)) waitingFaces.set(id, new Set());
      waitingFaces.get(id).add(img);
    }
    return h('div.duel__face', img);
  }

  /** Start the cards — waiting for the expressions first if they are still downloading. */
  function play(btn, opts, name) {
    if (waiting) return;
    saveDuelName(name);
    audio.unlock();
    if (expressionsReady()) return app.startGame(opts);
    waiting = true;
    btn.classList.add('is-loading');
    btn.lastChild.textContent = 'Loading…';
    whenExpressionsReady().then(
      () => {
        waiting = false;
        if (ui.name === 'duel') app.startGame(opts);
      },
      () => {
        waiting = false;
        btn.classList.remove('is-loading');
        btn.lastChild.textContent = 'Could not load: try again';
      }
    );
  }

  function intro() {
    const field = nameField();
    const startBtn = h('button.btn.btn--gold.btn--wide', { 'data-quiet': '1', onclick: () => play(startBtn, { mode: 'duel' }, field.input.value) }, icon('play'), h('span', 'Start a challenge'));
    return [
      h(
        'div.card.duel__how',
        h('div.duel__steps', step('1', 'Play', `${DUEL_CARDS} cards, mixed from every stage`), step('2', 'Send', 'Share the link with a friend'), step('3', 'Compare', 'They get the same cards. Who wins?'))
      ),
      field.el,
      startBtn,
      h('p.duel__note', 'No account needed. Your score travels in the link; nothing is stored online.'),
    ];
  }
  const step = (n, title, text) => h('div.duel__step', h('b.duel__n', n), h('div', h('b', title), h('span', text)));

  function incoming(c) {
    const who = c.name || 'A friend';
    const field = nameField();
    const acceptBtn = h(
      'button.btn.btn--gold.btn--wide',
      { 'data-quiet': '1', onclick: () => play(acceptBtn, { mode: 'duel', seed: c.seed, opponent: { name: c.name, character: c.character, score: c.score, correct: c.correct, total: c.total } }, field.input.value) },
      icon('play'),
      h('span', 'Accept the challenge')
    );
    const char = c.character ? getCharacter(c.character) : null;
    return [
      h(
        'div.card.duel__invite',
        portrait(c.character),
        h('div.duel__invite-text', h('div.eyebrow', 'You have been challenged'), h('h3', `${who} challenges you!`), h('p', `${formatScore(c.score)} points · ${c.correct}/${c.total} right${char ? ` · playing as ${char.name}` : ''}`))
      ),
      h('p.duel__lead', `Same ${c.total} cards, same answers in the same places. Beat ${formatScore(c.score)} to win.`),
      field.el,
      acceptBtn,
    ];
  }

  /** A challenge you have already played: both results, and what next. */
  function compare(c, mine) {
    const them = { name: c.name || 'Your friend', score: c.score, correct: c.correct, character: c.character };
    const outcome = duelOutcome(mine, them);
    const head = outcome === 'win' ? 'You win!' : outcome === 'draw' ? 'It’s a draw!' : `${them.name} wins this one`;
    const col = (label, r, char, cls) => h(`div.versus__side${cls}`, portrait(char), h('div.versus__name', label), h('div.versus__score', formatScore(r.score)), h('div.versus__sub', `${r.correct}/${c.total} right`));
    const again = h('button.btn.btn--gold.btn--wide', { 'data-quiet': '1', onclick: () => play(again, { mode: 'duel' }, defaultName()) }, icon('refresh'), h('span', 'Rematch: new cards'));
    return [
      h('div.card.versus', h('div.versus__head', head), h('div.versus__row', col('You', mine, save.data.character, outcome === 'win' ? '.is-win' : ''), h('div.versus__vs', 'vs'), col(them.name, them, them.character, outcome === 'lose' ? '.is-win' : ''))),
      again,
      h('p.duel__note', 'A rematch deals 20 new cards. Send them to your friend from the results.'),
    ];
  }

  function render() {
    if (!challenge) return clear(body).append(...intro());
    const mine = myDuel(challenge.seed);
    clear(body).append(...(mine ? compare(challenge, mine) : incoming(challenge)));
  }

  return {
    el,
    shade: true,
    show(params = {}) {
      from = params.from ?? 'menu';
      if (params.challenge !== undefined) challenge = params.challenge;
      waiting = false;
      app.stage.setShot(shots.backdrop(app.stage), 1.2);
      render();
    },
    hide(next) {
      // a challenge from a link is dealt with once the player moves on (it stays if they go to play it)
      if (next !== 'play') challenge = null;
    },
    key(e) {
      if (e.key === 'Escape') back();
    },
  };
}
