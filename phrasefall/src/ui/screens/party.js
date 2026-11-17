import { h, icon, clear } from '../dom.js';
import { shots } from '../../game/shots.js';
import { CHARACTERS, getCharacter } from '../../characters/index.js';
import { expressionsReady, whenExpressionsReady } from '../../data/expressions/index.js';
import { formatScore } from '../../core/utils.js';
import { cleanName, newDuelSeed, NAME_MAX } from '../../game/duel.js';
import { PARTY_CARDS } from '../../game/game.js';

const STORE = 'phrasefall:party';
const MAX_PLAYERS = 4;
const MEDALS = ['gold', 'silver', 'bronze'];

/**
 * Party: pass-and-play for 2–4 people on one phone. Everyone gets the same cards (a seed,
 * like a friend challenge) one after another; the phone is passed between turns; a
 * scoreboard at the end. Party games are save-neutral (see game.js): nothing is recorded
 * to the phone owner's learning, XP or records. The last line-up is remembered on this
 * device (localStorage), so a rematch is one tap.
 *
 * Views: setup → pass (before each turn, and the score so far) → [the game] → … → final.
 */
export function createParty(app) {
  const { ui, save, audio, events } = app;
  const body = h('div.party.scroll');
  const titleEl = h('div.bar__title', 'Party');
  let from = 'duel';
  let round = null; // { seed, cards, players: [{ name, character, score, correct, done }], turn }
  let setup = loadSetup();
  const back = () => {
    if (round && !round.over) {
      round = null;
      return showSetup();
    }
    ui.go(from);
  };
  const el = h(
    'section.sheet.sheet--narrow',
    h('div.panel.sheet__panel', h('header.bar', h('button.iconbtn', { 'aria-label': 'Back', 'data-sound': 'back', onclick: back }, icon('back')), titleEl), body)
  );

  // ── portraits (they render in the background after start-up) ──────────
  const waiting = new Map();
  events.on('thumb', (id) => {
    const imgs = waiting.get(id);
    const t = app.thumbs.get(id);
    if (!imgs || !t) return;
    for (const img of imgs) img.src = t.normal;
    waiting.delete(id);
  });
  function face(id, cls = '') {
    const img = h('img', { alt: '' });
    const t = app.thumbs.get(id);
    if (t) img.src = t.normal;
    else {
      if (!waiting.has(id)) waiting.set(id, new Set());
      waiting.get(id).add(img);
    }
    return h(`div.party__face${cls}`, img);
  }

  // ── the line-up, remembered on this device ─────────────────────────────
  function unlocked() {
    const ids = CHARACTERS.map((c) => c.id).filter((id) => save.isUnlocked(id));
    return ids.length ? ids : ['fox'];
  }
  function loadSetup() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORE) || 'null');
      if (raw && Array.isArray(raw.players) && raw.players.length >= 2) {
        return { cards: PARTY_CARDS.includes(raw.cards) ? raw.cards : PARTY_CARDS[1], players: raw.players.slice(0, MAX_PLAYERS).map((p, i) => ({ name: cleanName(p.name) || `Player ${i + 1}`, character: typeof p.character === 'string' ? p.character : 'fox' })) };
      }
    } catch {
      /* a fresh line-up */
    }
    return null;
  }
  function saveSetup() {
    try {
      localStorage.setItem(STORE, JSON.stringify(setup));
    } catch {
      /* not remembered */
    }
  }
  function defaultSetup() {
    const chars = unlocked();
    const mine = save.data.character;
    const other = chars.find((c) => c !== mine) ?? mine;
    return { cards: PARTY_CARDS[1], players: [{ name: 'Player 1', character: mine }, { name: 'Player 2', character: other }] };
  }

  // ── setup ───────────────────────────────────────────────────────────────
  function showSetup() {
    titleEl.textContent = 'Party';
    setup ??= defaultSetup();
    const chars = unlocked();
    // keep characters to ones this device has unlocked
    for (const p of setup.players) if (!chars.includes(p.character)) p.character = chars[0];
    const rows = setup.players.map((p, i) => {
      const input = h('input.party__name', { type: 'text', maxlength: String(NAME_MAX), value: p.name, 'aria-label': `Player ${i + 1}'s name`, placeholder: `Player ${i + 1}` });
      input.addEventListener('keydown', (e) => e.stopPropagation());
      input.addEventListener('input', () => (p.name = input.value));
      const pick = h('button.party__pick', { 'data-quiet': '1', 'aria-label': 'Change character', title: 'Tap to change character' }, face(p.character), h('span.party__pick-hint', icon('refresh')));
      pick.onclick = () => {
        audio.play('tap');
        // the next character, skipping ones the other players have (when there are enough)
        const taken = new Set(setup.players.filter((x) => x !== p).map((x) => x.character));
        const at = chars.indexOf(p.character);
        for (let k = 1; k <= chars.length; k++) {
          const next = chars[(at + k) % chars.length];
          if (!taken.has(next) || k === chars.length) {
            p.character = next;
            break;
          }
        }
        pick.firstChild.replaceWith(face(p.character));
      };
      const remove = setup.players.length > 2 ? h('button.iconbtn.party__remove', { 'aria-label': `Remove player ${i + 1}`, onclick: () => (setup.players.splice(i, 1), showSetup()) }, icon('x')) : null;
      return h('div.party__row', pick, input, remove);
    });
    const add =
      setup.players.length < MAX_PLAYERS
        ? h(
            'button.btn.party__add',
            {
              onclick: () => {
                const used = new Set(setup.players.map((p) => p.character));
                setup.players.push({ name: `Player ${setup.players.length + 1}`, character: chars.find((c) => !used.has(c)) ?? chars[0] });
                showSetup();
              },
            },
            icon('friends'),
            'Add a player'
          )
        : null;
    const seg = h(
      'div.seg.party__cards',
      PARTY_CARDS.map((n) => h(`button${setup.cards === n ? '.is-on' : ''}`, { 'data-quiet': '1', onclick: () => (audio.play('tap'), (setup.cards = n), showSetup()) }, `${n} cards`))
    );
    const start = h('button.btn.btn--gold.btn--wide', { 'data-quiet': '1', onclick: () => startRound(start) }, icon('play'), h('span', 'Start the party'));
    clear(body).append(
      h('p.party__intro', 'Two to four players take turns on this phone. Everyone gets the same cards; the best score wins. Party games don’t count towards your own progress.'),
      h('div.party__players', rows, add),
      h('div.party__label', 'Cards each'),
      seg,
      start
    );
  }

  function startRound(btn) {
    setup.players.forEach((p, i) => (p.name = cleanName(p.name) || `Player ${i + 1}`));
    saveSetup();
    const go = () => {
      round = { seed: newDuelSeed(), cards: setup.cards, players: setup.players.map((p) => ({ ...p, score: 0, correct: 0, done: false })), turn: 0, over: false };
      showPass();
    };
    if (expressionsReady()) return go();
    btn.classList.add('is-loading');
    btn.lastChild.textContent = 'Loading…';
    whenExpressionsReady().then(() => ui.name === 'party' && go(), () => (btn.lastChild.textContent = 'Could not load: try again'));
  }

  // ── between turns ───────────────────────────────────────────────────────
  function standings() {
    return round.players
      .filter((p) => p.done)
      .slice()
      .sort((a, b) => b.score - a.score || b.correct - a.correct)
      .map((p, i) => h('div.party__score', face(p.character, '.party__face--sm'), h('span.party__score-name', p.name), h('b', formatScore(p.score)), h('span.party__score-sub', `${p.correct}/${round.cards}`), i === 0 ? icon('trophy') : null));
  }

  function showPass(last = null) {
    titleEl.textContent = 'Party';
    const p = round.players[round.turn];
    const char = getCharacter(p.character);
    const ready = h('button.btn.btn--gold.btn--wide', { 'data-quiet': '1', onclick: () => play() }, icon('play'), h('span', `I'm ${p.name}: go!`));
    clear(body).append(
      last ? h('div.party__last', h('b', `${last.name} scored ${formatScore(last.score)}`), h('span', `${last.correct}/${round.cards} right`)) : null,
      h(
        'div.card.party__pass',
        face(p.character, '.party__face--big'),
        h('div.eyebrow', `Player ${round.turn + 1} of ${round.players.length}`),
        h('h3', `Pass the phone to ${p.name}`),
        h('p', `${round.cards} cards, playing as ${char?.name ?? 'Maple'}. No peeking, everyone else!`)
      ),
      ready,
      round.players.some((x) => x.done) ? h('div.party__table', h('div.eyebrow', 'So far'), standings()) : null
    );
  }

  function play() {
    const p = round.players[round.turn];
    audio.play('select');
    app.startGame({ mode: 'party', seed: round.seed, cards: round.cards, party: { player: { name: p.name, character: p.character }, turn: round.turn, of: round.players.length } });
  }

  // ── the end ─────────────────────────────────────────────────────────────
  function showFinal() {
    round.over = true;
    titleEl.textContent = 'Scoreboard';
    const ranked = round.players.slice().sort((a, b) => b.score - a.score || b.correct - a.correct);
    const top = ranked[0];
    const tie = ranked.length > 1 && ranked[1].score === top.score && ranked[1].correct === top.correct;
    events.emit('party:done', { players: ranked.map((p) => ({ name: p.name, score: p.score })), cards: round.cards });
    audio.play('newBest');
    app.fx.confetti({ x: 0, y: 2.4, z: 0 }, { count: 90, spread: 4.5 });
    clear(body).append(
      h('div.party__winner', face(top.character, '.party__face--big'), h('div.eyebrow', tie ? 'It’s a tie!' : 'The winner is'), h('h3', tie ? `${top.name} and ${ranked[1].name}` : top.name), h('p', `${formatScore(top.score)} points · ${top.correct}/${round.cards} right`)),
      h(
        'div.party__podium',
        ranked.map((p, i) =>
          h(`div.party__place.party__place--${MEDALS[i] ?? 'none'}`, h('span.party__rank', String(i + 1)), face(p.character, '.party__face--sm'), h('span.party__score-name', p.name), h('b', formatScore(p.score)), h('span.party__score-sub', `${p.correct}/${round.cards}`))
        )
      ),
      h('button.btn.btn--gold.btn--wide', { 'data-quiet': '1', onclick: () => startRound(body.querySelector('.btn--gold')) }, icon('refresh'), h('span', 'Rematch: new cards')),
      h('button.btn.btn--wide', { onclick: () => ((round = null), showSetup()) }, icon('friends'), 'Change players'),
      h('button.btn.btn--ink.btn--wide', { 'data-sound': 'back', onclick: () => app.toMenu() }, icon('home'), 'Menu')
    );
  }

  return {
    el,
    shade: true,
    show(params = {}) {
      if (params.from) from = params.from;
      app.stage.setShot(shots.backdrop(app.stage), 1.2);
      app.hero.set(save.data.character, { effect: false, clip: null });
      if (params.result && round && !round.over) {
        // a turn has just finished
        const r = params.result;
        const p = round.players[round.turn];
        p.score = r.score;
        p.correct = r.correct;
        p.done = true;
        round.turn++;
        app.game.quit();
        if (round.turn < round.players.length) showPass(p);
        else showFinal();
        return;
      }
      if (params.fresh || !round) {
        round = null;
        showSetup();
      } else if (round.over) showFinal();
      else showPass();
    },
    key(e) {
      if (e.key === 'Escape') back();
    },
  };
}
