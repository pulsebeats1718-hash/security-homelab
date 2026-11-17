import { h, icon, clear, phrase } from '../dom.js';
import { shots } from '../../game/shots.js';
import { getCharacter } from '../../characters/index.js';
import { getExpression, whenExpressionsReady } from '../../data/expressions/index.js';
import { loadSituations, PLACE_ORDER } from '../../data/situations/index.js';
import { getPlace } from '../../data/places.js';
import { XP } from '../../data/levels.js';
import { speak, speechAvailable } from '../../audio/speech.js';
import { mainText } from '../../game/twists.js';
import { shuffle } from '../../core/utils.js';

/**
 * Situations: comic-strip conversations with the island's characters (data in
 * src/data/situations/). The other character's lines appear one by one; at each "your turn"
 * the player picks the most natural of three expressions. A wrong pick explains itself and
 * the player tries again; the right one goes in the player's bubble with a note on why it fits.
 *
 * Learning: a reply right first time counts as a right answer for that expression (spaced
 * repetition, mastery, the garden, the daily goal); a wrong first pick counts as a miss.
 * Places open with the journey (src/data/places.js). Progress: save.data.talk[id] =
 * { done, best (replies right first time), of (replies), t }.
 */
export function createTalk(app) {
  const { ui, save, audio, events, progress } = app;
  const body = h('div.talk.scroll');
  const titleEl = h('div.bar__title', 'Situations');
  let from = 'menu';
  let view = 'list';
  let list = [];
  let current = null; // { s, step, first, replies, attempts, learned, strip, opts, ended }
  let timers = [];
  const later = (ms, fn) => timers.push(setTimeout(fn, ms));
  const back = () => (view === 'episode' ? showList() : ui.go(from));
  const el = h(
    'section.sheet.sheet--narrow.sheet--talk',
    h('div.panel.sheet__panel', h('header.bar', h('button.iconbtn', { 'aria-label': 'Back', 'data-sound': 'back', onclick: back }, icon('back')), titleEl), body)
  );

  const record = () => (save.data.talk ??= {});

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
    return h(`div.talk__face${cls}`, img);
  }

  // ── the list ────────────────────────────────────────────────────────────
  function showList() {
    timers.forEach(clearTimeout);
    timers = [];
    view = 'list';
    current = null;
    titleEl.textContent = 'Situations';
    const level = progress.level;
    const done = list.filter((s) => record()[s.id]?.done).length;
    const groups = PLACE_ORDER.map((id) => ({ place: getPlace(id), items: list.filter((s) => s.place === id) })).filter((g) => g.items.length);
    clear(body).append(
      h('p.talk__intro', 'Chat with the island’s characters. At each turn, pick the most natural thing to say, and find out when each expression fits.'),
      h('div.talk__count', icon('chat'), `${done} of ${list.length} situations done`),
      // Literal Theatre lives here too: the characters act out idioms word for word
      h(
        'button.talk__theatre',
        { 'data-quiet': '1', onclick: () => (audio.play('select'), ui.go('theatre', { from: 'talk' })) },
        h('span.talk__theatre-ico', icon('masks')),
        h('span.talk__theatre-text', h('b', 'Literal Theatre'), h('span', 'The characters act out idioms word for word. Can you guess which one?')),
        h('span.talk__theatre-go', icon('play'))
      ),
      ...groups.map((g) => {
        const open = level >= g.place.level;
        return h(
          'div.talk__group',
          h('div.eyebrow', g.place.name),
          open ? h('div.talk__list', g.items.map(row)) : h('div.talk__locked', icon('lock'), h('span', `Reach level ${g.place.level} to visit ${g.place.name}: ${g.items.length} situations wait there.`))
        );
      })
    );
    body.scrollTop = 0;
  }

  function row(s) {
    const rec = record()[s.id];
    const state = rec?.done ? h(`span.talk__state${rec.best >= rec.of ? '.is-star' : ''}`, icon(rec.best >= rec.of ? 'star' : 'check')) : h('span.talk__lvl', ['Easy', 'Medium', 'Harder'][s.level - 1] ?? '');
    return h(
      `button.talk__row${rec?.done ? '.is-done' : ''}`,
      { 'data-quiet': '1', onclick: () => (audio.play('select'), open(s)) },
      face(s.with),
      h('div.talk__row-text', h('b', s.title), h('span', s.scene)),
      state
    );
  }

  // ── a situation ─────────────────────────────────────────────────────────
  function open(s) {
    timers.forEach(clearTimeout);
    timers = [];
    view = 'episode';
    titleEl.textContent = s.title;
    const strip = h('div.strip');
    const opts = h('div.talk__options');
    current = { s, step: 0, first: 0, replies: 0, attempts: 0, learned: [], strip, opts, ended: false };
    clear(body).append(h('p.strip__scene', s.scene), strip, opts);
    body.scrollTop = 0;
    later(350, step);
  }

  const scrollDown = () => requestAnimationFrame(() => body.scrollTo({ top: body.scrollHeight, behavior: 'smooth' }));

  function bubble(mine, content, text = null) {
    const c = current;
    const who = mine ? save.data.character : c.s.with;
    const name = mine ? 'You' : getCharacter(who)?.name ?? '';
    const say = text && speechAvailable() ? h('button.bubble__say', { 'data-quiet': '1', 'aria-label': 'Listen', onclick: () => speak(text) }, icon('sound')) : null;
    return h(`div.bubble${mine ? '.bubble--me' : ''}`, face(who, '.bubble__face'), h('div.bubble__body', h('div.bubble__name', name), h('div.bubble__text', content), say));
  }

  /** The player's line with the expression in bold (matched word by word, so "picked up" finds "pick up"). */
  function highlight(line, exprText) {
    const words = mainText(exprText)
      .toLowerCase()
      .replace(/[^a-z' ]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 1);
    const stems = words.map((w) => w.slice(0, Math.max(2, w.length - 2)));
    const parts = line.split(/(\s+)/);
    // bold the longest run of neighbouring words that belong to the expression
    let best = [0, 0];
    for (let i = 0; i < parts.length; i += 2) {
      let j = i;
      let hits = 0;
      while (j < parts.length) {
        const w = parts[j].toLowerCase().replace(/[^a-z']/g, '');
        if (!w || !stems.some((st) => w.startsWith(st))) break;
        hits++;
        j += 2;
      }
      if (hits > best[1] - best[0]) best = [i, i + hits];
    }
    if (best[1] - best[0] < 1) return line;
    const startIdx = best[0];
    const endIdx = startIdx + (best[1] - best[0]) * 2 - 1;
    return [parts.slice(0, startIdx).join(''), h('b.bubble__expr', parts.slice(startIdx, endIdx).join('')), parts.slice(endIdx).join('')];
  }

  function step() {
    const c = current;
    if (!c || c.ended) return;
    const line = c.s.lines[c.step];
    if (!line) return finish();
    if (line.say !== undefined || line.you !== undefined) {
      const mine = line.you !== undefined;
      const text = mine ? line.you : line.say;
      const typing = bubble(mine, h('span.typing', h('i'), h('i'), h('i')));
      c.strip.append(typing);
      scrollDown();
      later(350 + Math.min(1100, text.length * 16), () => {
        typing.replaceWith(bubble(mine, text, text));
        audio.play('tap');
        scrollDown();
        c.step++;
        later(500, step);
      });
      return;
    }
    // your turn: three expressions to choose from
    c.replies++;
    c.attempts = 0;
    c.strip.append(h('div.strip__ask', h('b', 'Your turn'), line.ask ? h('span', line.ask) : null));
    const options = shuffle(line.options.slice());
    clear(c.opts).append(
      ...options.map((o, i) => {
        const e = getExpression(o.id);
        const btn = h('button.talk__opt', { 'data-quiet': '1', style: { '--i': i } }, h('span.talk__opt-n', String(i + 1)), h('span', e ? phrase(e.text) : o.id));
        btn.onclick = () => pick(line, o, btn);
        return btn;
      })
    );
    scrollDown();
  }

  function note(right, text) {
    return h(`div.talk__note${right ? '.is-right' : ''}`, icon(right ? 'check' : 'x'), h('span', text));
  }

  function pick(line, o, btn) {
    const c = current;
    if (!c || btn.disabled) return;
    c.attempts++;
    const right = line.options.find((x) => x.right);
    const e = getExpression(right.id);
    if (!o.right) {
      btn.disabled = true;
      btn.classList.add('is-wrong');
      audio.play('wrong');
      c.opts.querySelector('.talk__note')?.remove();
      c.opts.append(note(false, o.note));
      if (c.attempts === 1 && e) {
        // missed first time: a miss for the expression that fitted
        save.recordAnswer(right.id, false);
        events.emit('talk:answered', { id: right.id, correct: false, type: e.type });
      }
      scrollDown();
      return;
    }
    const first = c.attempts === 1;
    if (first) {
      c.first++;
      if (e) {
        save.recordAnswer(right.id, true);
        events.emit('talk:answered', { id: right.id, correct: true, type: e.type });
      }
    }
    save.write();
    c.learned.push(right.id);
    clear(c.opts);
    audio.play('correct', { streak: c.first });
    c.strip.append(bubble(true, highlight(o.line, e?.text ?? ''), o.line), note(true, o.note));
    scrollDown();
    c.step++;
    later(1400, step);
  }

  function finish() {
    const c = current;
    c.ended = true;
    const rec = record();
    const prev = rec[c.s.id];
    rec[c.s.id] = { done: true, best: Math.max(prev?.best ?? 0, c.first), of: c.replies, t: Date.now() };
    save.write();
    events.emit('talk:done', { id: c.s.id, first: c.first, of: c.replies });
    audio.play(c.first === c.replies ? 'newBest' : 'stage');
    const xp = XP.situation + c.first * XP.right;
    const nextOne = nextSituation(c.s);
    c.strip.append(
      h(
        'div.talk__done',
        h('div.talk__done-title', c.first === c.replies ? 'Perfect conversation!' : 'Situation complete!'),
        h('div.talk__done-sub', `${c.first}/${c.replies} replies right first time · +${xp} XP`),
        h(
          'div.talk__learned',
          c.learned.map((id) => {
            const e = getExpression(id);
            return e ? h('div.review__item', h('div.review__expr', phrase(e.text)), h('div.review__mean', e.meaning)) : null;
          })
        ),
        h(
          'div.talk__done-actions',
          nextOne ? h('button.btn.btn--gold', { 'data-quiet': '1', onclick: () => (audio.play('select'), open(nextOne)) }, icon('next'), 'Next situation') : null,
          h('button.btn', { onclick: () => (audio.play('tap'), showList()) }, icon('grid'), 'All situations')
        )
      )
    );
    scrollDown();
  }

  /** The next situation not yet done in an open place (after this one, then from the start). */
  function nextSituation(s) {
    const level = progress.level;
    const openList = list.filter((x) => level >= getPlace(x.place).level);
    const i = openList.indexOf(s);
    const order = [...openList.slice(i + 1), ...openList.slice(0, Math.max(0, i))];
    return order.find((x) => !record()[x.id]?.done) ?? openList[i + 1] ?? null;
  }

  return {
    el,
    shade: true,
    show(params = {}) {
      from = params.from ?? 'menu';
      app.stage.setShot(shots.backdrop(app.stage), 1.2);
      clear(body).append(h('div.talk__loading', h('span.spinner'), 'Loading…'));
      titleEl.textContent = 'Situations';
      view = 'list';
      Promise.all([loadSituations(), whenExpressionsReady()]).then(
        ([all]) => {
          list = all.filter((s) => s.lines?.every((l) => !l.options || l.options.every((o) => getExpression(o.id))));
          if (ui.name !== 'talk') return;
          if (params.id) {
            const s = list.find((x) => x.id === params.id);
            if (s) return open(s);
          }
          showList();
        },
        () => clear(body).append(h('p.talk__intro', 'The situations could not be loaded. Check your connection and try again.'))
      );
    },
    hide() {
      timers.forEach(clearTimeout);
      timers = [];
    },
    key(e) {
      if (e.key === 'Escape') return back();
      if (view !== 'episode') return;
      const n = Number(e.key);
      const btns = current?.opts.querySelectorAll('.talk__opt');
      if (n >= 1 && btns?.[n - 1]) btns[n - 1].click();
    },
  };
}
