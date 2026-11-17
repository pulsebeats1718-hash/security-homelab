import { h, icon, clear, countUp, retrigger, phrase } from '../dom.js';
import { getCharacter } from '../../characters/index.js';
import { getExpression } from '../../data/expressions/index.js';
import { formatScore } from '../../core/utils.js';
import { formatCountdown, msToNextDaily, shareText } from '../../game/daily.js';
import { levelInfo } from '../../data/levels.js';
import { ROSTER } from '../../data/roster.js';
import { GOAL } from '../../game/progress.js';
import { ring } from './today.js';
import { RETRY_MAX } from '../../game/game.js';
import { encodeDuel, duelLink, duelShareText, duelOutcome, rememberDuel, savedDuelName } from '../../game/duel.js';

/** "Fri 13 Nov" for a 'YYYY-MM-DD' (UTC) id. */
const shortDate = (dateId) => new Date(`${dateId}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

/** A result's identity, to match a leaderboard rank that arrives later. */
const keyOf = (r) => `${r.mode}|${r.score}`;

/** Put text on the clipboard; where that is not allowed, select it so the player can copy it themselves. */
async function copyText(text, holder) {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return 'copied';
    } catch {
      /* fall through to selecting the text */
    }
  }
  try {
    const range = document.createRange();
    range.selectNodeContents(holder);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    if (document.execCommand?.('copy')) return 'copied';
  } catch {
    /* selection is the last resort */
  }
  return 'selected';
}

/** The game's own address, for links (empty when it is not served over HTTP(S), e.g. a file). */
const gameUrl = () => (/^https?:$/.test(location.protocol) ? `${location.origin}${location.pathname}` : '');

/** Share with the system sheet where there is one (phones); otherwise copy. Returns 'shared' | 'cancelled' | 'copied' | 'selected'. */
async function shareOrCopy({ title, text, url }, holder) {
  if (navigator.share && window.isSecureContext) {
    try {
      await navigator.share({ title, text, url });
      return 'shared';
    } catch (err) {
      if (err?.name === 'AbortError') return 'cancelled';
    }
  }
  return copyText(url ? `${text}\n${url}` : text, holder);
}

/**
 * Game-over results: score, records, unlocks and what to revise. Daily
 * challenges add the challenge number, a shareable emoji grid with a Copy
 * button and a countdown to the next challenge. Also hands every finished game
 * to the online module (`app.online.submitScore`) and shows a rank if one comes back.
 */
export function createResults(app) {
  const { ui, audio, save, events } = app;
  const eyebrow = h('div.eyebrow');
  const title = h('h2.results__title', 'Game over');
  const score = h('div.results__score', '0');
  const best = h('div.results__best');
  const badge = h('div.results__badges');
  const stats = h('div.stats');
  const body = h('div.results__body.scroll');
  const playBtn = h('button.btn.btn--gold', { 'data-quiet': '1' });
  const reviewBtn = h('button.btn');
  const el = h(
    'section.results',
    h(
      'div.panel.results__panel',
      h('div.results__head', eyebrow, title, score, badge, best),
      stats,
      body,
      h('div.results__actions', playBtn, reviewBtn, h('button.btn.btn--ink', { 'data-sound': 'back', onclick: () => app.toMenu() }, icon('home'), 'Menu'))
    )
  );

  const stat = (num, label) => h('div.stat', h('div.stat__num', num), h('div.stat__label', label));
  // portraits render in the background and may arrive after the results appear
  const pendingThumbs = new Map(); // id → Set of <img> waiting for that portrait
  const whenThumb = (id, img) => {
    if (!pendingThumbs.has(id)) pendingThumbs.set(id, new Set());
    pendingThumbs.get(id).add(img);
  };
  events.on('thumb', (id) => {
    const imgs = pendingThumbs.get(id);
    const t = app.thumbs.get(id);
    if (imgs && t) {
      for (const img of imgs) img.src = t.normal;
      pendingThumbs.delete(id);
    }
  });
  let timers = [];
  const later = (ms, fn) => timers.push(setTimeout(fn, ms));
  let ticker = 0;
  let shownKey = null;

  // ── scores to the online module; a rank may come back ───────────────────
  const ranks = new Map(); // result key → { rank, board }
  let listening = false;
  function showRank(key) {
    const info = ranks.get(key);
    if (!info || key !== shownKey || badge.querySelector('.results__rank')) return;
    const where = info.board === 'week' ? ' this week' : info.board === 'daily' || (!info.board && info.daily) ? ' today' : '';
    badge.append(h('span.chip.chip--gold.results__rank', icon('podium'), info.text ? `Rank ${info.text}` : `Rank #${info.rank.toLocaleString('en-GB')}${where}`));
  }
  /** `value`: a number, or app.online's rank payload { rank, board, text: '#12 today', … }. */
  function noteRank(key, value, daily) {
    const rank = typeof value === 'number' ? value : value?.rank;
    if (!Number.isFinite(rank) || rank < 1) return;
    ranks.set(key, { rank, board: value?.board, text: typeof value?.text === 'string' ? value.text : '', daily });
    showRank(key);
  }
  events.on('game:submit', (result) => {
    const online = app.online;
    if (!online?.submitScore) return;
    const key = keyOf(result);
    if (!listening && typeof online.on === 'function') {
      listening = true;
      // a rank may also be announced as an event: { mode, dateId?, score, rank, board? }
      online.on('rank', (info) => info && noteRank(keyOf(info), info, info.mode === 'daily'));
    }
    try {
      Promise.resolve(online.submitScore(result))
        .then((value) => noteRank(key, value, result.mode === 'daily'))
        .catch(() => {});
    } catch {
      /* online play is optional */
    }
  });

  // ── daily challenge: share card + countdown ─────────────────────────────
  function dailyCard(r) {
    const d = r.daily;
    const rec = d.rankedRecord;
    const countdown = h('b');
    const tick = () => (countdown.textContent = formatCountdown(msToNextDaily(), true));
    tick();
    clearInterval(ticker);
    ticker = setInterval(tick, 1000);
    const parts = [h('div.share__next', icon('calendar'), h('span', 'Next challenge in '), countdown)];
    if (rec) {
      const url = location.protocol === 'https:' ? `${location.origin}${location.pathname}` : '';
      const text = shareText({ n: rec.n || d.n, dateId: d.dateId, marks: rec.marks, total: rec.total || d.total, score: rec.score, correct: rec.correct, bestStreak: rec.bestStreak, days: app.progress?.streak.count ?? 0 }, url);
      const pre = h('pre.share__text', text);
      const copyLabel = h('span', 'Copy');
      const copyBtn = h('button.btn.share__copy', {
        'data-quiet': '1',
        onclick: async () => {
          audio.play('tap');
          const how = await copyText(text, pre);
          clear(copyLabel).append(how === 'copied' ? 'Copied!' : 'Selected: copy it now');
          copyBtn.classList.toggle('is-done', how === 'copied');
          later(2200, () => (clear(copyLabel).append('Copy'), copyBtn.classList.remove('is-done')));
        },
      }, icon('copy'), copyLabel);
      parts.unshift(h('div.share__head', h('div.eyebrow', d.ranked ? 'Share your result' : 'Your ranked result today'), copyBtn), pre);
    }
    return h('div.share', parts);
  }

  // ── second chance: the missed expressions, straight away ────────────────
  function secondChance(ids, { again = false, mode = 'retry' } = {}) {
    const list = ids.filter((id) => getExpression(id)).slice(0, RETRY_MAX);
    if (!list.length) return null;
    const n = list.length;
    return h(
      'div.second',
      h('span.second__ico', icon('refresh')),
      h(
        'div.second__body',
        h('b', again ? `Try ${n === 1 ? 'it' : `these ${n}`} once more` : `Second chance: fix the ${n === 1 ? 'one' : n} you missed`),
        h('span', 'They fall again, slowly, with no lives to lose. XP for each one you put right.')
      ),
      h('button.btn.btn--gold.second__go', { 'data-quiet': '1', onclick: () => (audio.play('select'), app.startGame({ mode, ids: list })) }, icon('play'), again ? 'Go' : 'Fix them')
    );
  }

  // ── friend challenge: who won, and the link to send ─────────────────────
  function duelCard(r) {
    const d = r.duel;
    const opp = d.opponent;
    const me = { score: r.score, correct: r.correct };
    const name = savedDuelName();
    rememberDuel(d.seed, { score: r.score, correct: r.correct, total: d.total, bestStreak: r.streak, marks: d.marks, own: !opp });
    const parts = [];
    if (opp) {
      const outcome = duelOutcome(me, opp);
      const them = opp.name || 'Your friend';
      const face = (id) => {
        const img = h('img', { alt: '' });
        const t = id && app.thumbs.get(id);
        if (t) img.src = t.normal;
        else if (id) whenThumb(id, img);
        return h('div.duel__face', img);
      };
      const col = (label, res, char, win) => h(`div.versus__side${win ? '.is-win' : ''}`, face(char), h('div.versus__name', label), h('div.versus__score', formatScore(res.score)), h('div.versus__sub', `${res.correct}/${d.total} right`));
      parts.push(
        h(
          'div.versus',
          h('div.versus__head', outcome === 'win' ? 'You win!' : outcome === 'draw' ? 'It’s a draw!' : `${them} wins this one`),
          h('div.versus__row', col('You', me, save.data.character, outcome === 'win'), h('div.versus__vs', 'vs'), col(them, opp, opp.character, outcome === 'lose'))
        )
      );
    }
    const payload = encodeDuel({ seed: d.seed, name, character: save.data.character, score: r.score, correct: r.correct, total: d.total, bestStreak: r.streak, marks: d.marks, reply: opp ? { name: opp.name, score: opp.score, correct: opp.correct } : null });
    const base = gameUrl();
    const url = base ? duelLink(base, payload) : '';
    const text = duelShareText({ name, score: r.score, correct: r.correct, total: d.total, marks: d.marks, reply: opp ? { score: opp.score, correct: opp.correct } : null });
    const pre = h('pre.share__text', url ? `${text}\n${url}` : text);
    const label = h('span', opp ? `Send your result to ${opp.name || 'your friend'}` : 'Send these cards to a friend');
    let sent = false;
    const shareBtn = h(
      'button.btn.btn--gold.share__send',
      {
        'data-quiet': '1',
        onclick: async () => {
          audio.play('tap');
          const how = await shareOrCopy({ title: 'Phrasefall challenge', text, url }, pre);
          // counted once per challenge (achievements), however many times it is sent
          if ((how === 'shared' || how === 'copied') && !sent) {
            sent = true;
            app.events.emit('duel:shared', { seed: d.seed, reply: !!opp });
          }
          if (how === 'copied' || how === 'selected') {
            clear(label).append(how === 'copied' ? 'Link copied: paste it to your friend' : 'Selected: copy it now');
            later(2600, () => clear(label).append(opp ? `Send your result to ${opp.name || 'your friend'}` : 'Send these cards to a friend'));
          }
        },
      },
      icon('share'),
      label
    );
    pre.classList.add('share__text--small');
    parts.push(h('div.share', h('div.share__head', h('div.eyebrow', opp ? 'Your reply' : 'Your challenge link')), shareBtn, pre, url ? null : h('p.duel__note', 'Links work once the game is online (https).')));
    return h('div.duel-result', parts);
  }

  // ── progress: what this game earned, and what is close ─────────────────
  /** The next tier of characters still locked: { rule, ids, rp } or null once every tier is open. */
  function nextTier() {
    const locked = ROSTER.filter((r) => r.rule.type === 'tier' && !save.isUnlocked(r.id) && (!save.available || save.available.has(r.id)));
    if (!locked.length) return null;
    const first = Math.min(...locked.map((r) => r.rule.tier));
    const group = locked.filter((r) => r.rule.tier === first);
    return { rule: group[0].rule, ids: group.map((r) => r.id), rp: save.ruleProgress(group[0].rule) };
  }

  /** The XP bar fills up, rolling over once for each level gained. */
  function animateXp(before, after, numEl, fill, row) {
    let t = 650;
    for (let l = before.level; l < after.level; l++) {
      later(t, () => {
        fill.style.transition = '';
        fill.style.width = '100%';
      });
      t += 620;
      later(t, () => {
        numEl.textContent = String(l + 1);
        retrigger(row, 'is-levelup');
        audio.play('quest');
        fill.style.transition = 'none';
        fill.style.width = '0%';
      });
      t += 90;
    }
    later(t, () => {
      fill.style.transition = '';
      fill.style.width = `${(after.into / after.need) * 100}%`;
    });
    return t;
  }

  function progressBlock(r) {
    const p = app.progress;
    const run = p?.run;
    if (!run) return null;
    const rows = [];

    // XP and level
    const before = levelInfo(run.xp0);
    const after = p.info;
    const lvlNum = h('b', String(before.level));
    const fill = h('i', { style: { width: `${(before.into / before.need) * 100}%` } });
    const xpRow = h(
      'div.gain.gain--xp',
      h('div.lvl.lvl--sm', h('span', 'Level'), lvlNum),
      h('div.gain__body', h('div.gain__line', h('b', after.level > before.level ? `Level up! You're level ${after.level}` : `${(after.need - after.into).toLocaleString('en-GB')} XP to level ${after.level + 1}`), h('span.chip.chip--gold', `+${(p.xp - run.xp0).toLocaleString('en-GB')} XP`)), h('div.meter.meter--gold', fill))
    );
    rows.push(xpRow);
    const xpDone = animateXp(before, after, lvlNum, fill, xpRow);

    // places this game unlocked: the island travels to the newest one, behind the results
    run.places.forEach((place, i) => {
      rows.push(
        h(
          'div.gain.gain--place',
          { style: { '--place': place.color } },
          h('span.gain__ico', icon('map')),
          h('div.gain__body', h('div.gain__line', h('b', `New place: ${place.name}`)), h('span.gain__sub', i === run.places.length - 1 ? 'Travelling there now…' : place.blurb))
        )
      );
      p.markPlaceSeen(place.id);
    });
    const dest = run.places[run.places.length - 1];
    if (dest) {
      later(xpDone + 700, () => {
        if (ui.name !== 'results' || !app.travel(dest.id)) return;
        audio.play('travel');
      });
    }

    // new flowers in the memory garden
    const planted = r.planted ?? [];
    if (planted.length) {
      const names = planted.slice(0, 3).map((id) => getExpression(id)?.text).filter(Boolean);
      rows.push(
        h(
          'div.gain.gain--garden',
          h('span.gain__ico', icon('flower')),
          h('div.gain__body', h('div.gain__line', h('b', planted.length === 1 ? 'A new flower in your garden!' : `${planted.length} new flowers in your garden!`)), h('span.gain__sub', `Mastered: ${names.join(', ')}${planted.length > 3 ? '…' : ''}`))
        )
      );
    }

    // daily goal and streak
    const s = p.streak;
    const g = p.goal();
    if (run.goal) {
      rows.push(h('div.gain.gain--fire', h('span.gain__ico', icon('flame')), h('div.gain__body', h('div.gain__line', h('b', s.count === 1 ? 'Streak started!' : `${s.count}-day streak!`)), h('span.gain__sub', 'Daily goal reached. See you tomorrow!'))));
    } else if (g.met) {
      rows.push(h('div.gain.gain--fire.is-calm', h('span.gain__ico', icon('flame')), h('div.gain__body', h('div.gain__line', h('b', `${s.count}-day streak`)), h('span.gain__sub', "Today's goal is already done."))));
    } else {
      const left = GOAL - g.have;
      rows.push(
        h(
          'div.gain.gain--goal',
          h('span.gain__ring', ring(g.have / GOAL, 'ring--goal')),
          h('div.gain__body', h('div.gain__line', h('b', `${left} more right ${left === 1 ? 'answer' : 'answers'} today`)), h('span.gain__sub', s.count ? `to keep your ${s.count}-day streak` : 'to start a daily streak'))
        )
      );
    }

    // quests: progress made this game, and the chest
    const quests = p.quests();
    const chest = p.chestState();
    rows.push(
      h(
        'div.gain.gain--quests',
        h(
          'div.minis',
          quests.map((q) =>
            h(
              `div.mini${q.done ? '.is-done' : ''}${run.quests.includes(q.slot) ? '.is-new' : ''}`,
              h('span.mini__ico', icon(q.done ? 'check' : q.icon)),
              h('span.mini__text', q.text),
              h('div.meter', h('i', { style: { width: `${(q.have / q.n) * 100}%` } }))
            )
          )
        ),
        chest === 'ready' ? h('button.btn.btn--gold.gain__chest', { 'data-quiet': '1', onclick: () => (audio.play('select'), ui.go('today', { from: 'menu' })) }, icon('chest'), 'Open your chest') : null
      )
    );

    // the next characters: progress by points or by mastery, whichever is closer
    const next = nextTier();
    if (next) {
      const fmt = (n) => n.toLocaleString('en-GB');
      const [points, mastered] = next.rp.parts;
      const byMastery = mastered.frac > points.frac;
      const lead = byMastery ? mastered : points;
      const main = byMastery ? `${fmt(mastered.have)}/${fmt(mastered.need)} mastered` : `${fmt(points.have)}/${fmt(points.need)} pts`;
      const alt = byMastery ? `or earn ${fmt(points.need)} points in total (${fmt(points.have)} so far)` : `or master ${fmt(mastered.need)} expressions (${fmt(mastered.have)} so far)`;
      const faces = next.ids.map((id) => {
        const img = h('img', { alt: '' });
        const t = app.thumbs.get(id);
        if (t) img.src = t.locked;
        return h('div.near__portrait', img);
      });
      rows.push(
        h(
          'div.near',
          h(
            'div.near__item.near__item--tier',
            h('div.near__pair', faces),
            h(
              'div.near__body',
              h('div.near__line', h('b', next.ids.length === 1 ? 'Next character' : `Next ${next.ids.length} characters`), h('span', main)),
              h('span.near__rule', alt),
              h('div.meter.meter--violet', h('i', { style: { width: `${lead.frac * 100}%` } }))
            )
          )
        )
      );
    }

    // just short of the best
    if (r.mode !== 'daily' && !r.newBest && r.best > r.score && r.score >= r.best * 0.5) {
      rows.push(h('div.gain.gain--best', h('span.gain__ico', icon('trophy')), h('div.gain__body', h('div.gain__line', h('b', `${formatScore(r.best - r.score)} points short of your best`)), h('span.gain__sub', 'One more go?'))));
    }
    return h('div.gains', rows);
  }

  return {
    el,
    show(r) {
      timers.forEach(clearTimeout);
      timers = [];
      clearInterval(ticker);
      const mode = r.mode;
      const daily = mode === 'daily' ? r.daily : null;
      shownKey = keyOf(r);
      clear(badge);
      el.dataset.mode = mode;

      if (daily) {
        const ranked = daily.rankedRecord;
        eyebrow.textContent = `Daily challenge #${daily.n} · ${shortDate(daily.dateId)}`;
        title.textContent = r.reason === 'complete' ? 'Challenge complete' : 'Out of lives';
        best.textContent = daily.ranked ? (app.online?.available && app.online?.user ? 'Your ranked score for today' : 'Your score for today') : ranked ? `Practice · your ranked score is ${formatScore(ranked.score)}` : 'Practice run';
        if (!daily.ranked) badge.append(h('span.chip', icon('repeat'), 'Practice'));
        clear(stats).append(stat(`×${r.streak}`, 'Best streak'), stat(`${r.accuracy}%`, 'Accuracy'), stat(`${r.correct}/${daily.total}`, 'Correct'));
        clear(playBtn).append(icon('play'), 'Play classic');
        playBtn.onclick = () => app.startGame();
      } else if (mode === 'duel') {
        const opp = r.duel.opponent;
        eyebrow.textContent = opp ? `Challenge from ${opp.name || 'a friend'}` : 'Challenge a friend';
        title.textContent = r.reason === 'complete' ? 'Challenge complete' : 'Out of lives';
        best.textContent = opp ? `${opp.name || 'Your friend'} scored ${formatScore(opp.score)}` : 'Now send the same cards to a friend';
        clear(stats).append(stat(`×${r.streak}`, 'Best streak'), stat(`${r.accuracy}%`, 'Accuracy'), stat(`${r.correct}/${r.duel.total}`, 'Correct'));
        clear(playBtn).append(icon('friends'), 'New challenge');
        playBtn.onclick = () => ui.go('duel', { from: 'menu', challenge: null });
      } else if (mode === 'relax') {
        eyebrow.textContent = 'Relax mode';
        title.textContent = r.answered ? 'Nice and relaxed' : 'See you soon';
        best.textContent = r.answered ? `${r.answered} ${r.answered === 1 ? 'card' : 'cards'} · ${r.accuracy}% right` : 'No cards answered this time';
        clear(stats).append(stat(String(r.correct), 'Right'), stat(`${r.accuracy}%`, 'Accuracy'), r.twists.shown ? stat(`${r.twists.right}/${r.twists.shown}`, 'Twists') : stat(String(r.seen.length), 'Cards'));
        clear(playBtn).append(icon('leaf'), 'Relax again');
        playBtn.onclick = () => app.startGame({ mode: 'relax' });
      } else if (mode === 'retry' || mode === 'water') {
        const t = r.retry;
        const all = t.missed.length === 0;
        const water = mode === 'water';
        eyebrow.textContent = water ? 'Memory garden' : 'Second chance';
        title.textContent = all ? (water ? 'Garden watered!' : 'All put right!') : water ? 'Nearly there' : 'Good work';
        const fixedN = t.fixed.length;
        best.textContent = all
          ? water
            ? `${fixedN === 1 ? 'Your flower is' : `All ${fixedN} flowers are`} standing tall again`
            : 'Every one you missed, fixed'
          : `${t.missed.length} still ${water ? 'droopy' : 'to learn'}: ${t.missed.length === 1 ? 'it comes' : 'they come'} round again soon`;
        clear(stats).append(stat(`${t.fixed.length}/${t.total}`, water ? 'Watered' : 'Put right'), stat(`${r.accuracy}%`, 'Accuracy'), stat(`×${r.streak}`, 'Best streak'));
        if (water) {
          clear(playBtn).append(icon('flower'), 'See your garden');
          playBtn.onclick = () => app.toMenu();
        } else {
          clear(playBtn).append(icon('refresh'), 'Play again');
          playBtn.onclick = () => app.startGame();
        }
      } else {
        eyebrow.textContent = `Reached stage ${r.stage.n} · ${r.stage.short}`;
        title.textContent = 'Game over';
        best.textContent = r.newBest ? 'A new personal best' : `Personal best ${formatScore(r.best)}`;
        clear(stats).append(stat(`×${r.streak}`, 'Best streak'), stat(`${r.accuracy}%`, 'Accuracy'), stat(`${r.correct}/${r.answered}`, 'Correct'));
        clear(playBtn).append(icon('refresh'), 'Play again');
        playBtn.onclick = () => app.startGame();
      }
      showRank(shownKey);

      score.textContent = '0';
      if (mode === 'retry' || mode === 'water') score.textContent = `${r.retry.fixed.length}/${r.retry.total}`;
      else {
        const to = mode === 'relax' ? r.correct : r.score;
        later(350, () => countUp(score, to, { ms: Math.min(1400, 500 + to / 4), onTick: () => audio.play('count') }));
      }
      if (r.newBest) {
        later(1500, () => {
          badge.append(h('div.ribbon', 'NEW BEST'));
          audio.play('newBest');
          app.fx.confetti({ x: 0.3, y: 2.2, z: 0 }, { count: 80, spread: 4.5 });
        });
      }

      clear(body);
      if (daily) body.append(dailyCard(r));
      if (mode === 'duel') body.append(duelCard(r));
      // the expressions just missed, while they are fresh (a second chance offers the rest once more)
      const offer = mode === 'retry' || mode === 'water' ? secondChance(r.retry.missed, { again: true, mode }) : secondChance(r.wrong);
      if (offer) body.append(offer);
      // the rest of the garden: more thirsty flowers than one round waters
      if (mode === 'water' && !offer) {
        const more = app.garden?.refresh().thirsty.length ?? 0;
        if (more) {
          body.append(
            h(
              'div.second.second--water',
              h('span.second__ico', icon('drop')),
              h('div.second__body', h('b', `${more} more ${more === 1 ? 'flower needs' : 'flowers need'} water`), h('span', 'Another quick round puts the next ten right.')),
              h('button.btn.btn--gold.second__go', { 'data-quiet': '1', onclick: () => (audio.play('select'), app.garden.water()) }, icon('drop'), 'Keep watering')
            )
          );
        }
      }
      const gains = progressBlock(r);
      if (gains) body.append(gains);
      // characters unlocked by the game, and by a streak milestone reached during it
      // new characters: one card (several at once share it, so the progress rows stay in view)
      const unlocked = [...new Set([...r.unlocked, ...(app.progress?.run?.unlocked ?? [])])];
      if (unlocked.length) {
        later(1100 + (r.newBest ? 900 : 0), () => {
          const defs = unlocked.map((id) => getCharacter(id));
          const imgs = unlocked.map((id) => {
            const img = h('img', { alt: '' });
            const thumb = app.thumbs.get(id);
            if (thumb) img.src = thumb.normal;
            else whenThumb(id, img);
            return img;
          });
          const names = defs.map((d) => d.name);
          const card =
            unlocked.length === 1
              ? h('div.unlock', imgs[0], h('div', h('div.unlock__eyebrow', 'NEW CHARACTER'), h('div.unlock__name', `${defs[0].name} — ${defs[0].title}`)))
              : h(
                  'div.unlock.unlock--many',
                  h('div.unlock__eyebrow', `${unlocked.length} NEW CHARACTERS`),
                  h('div.unlock__row', imgs.map((img, i) => h('span.unlock__face', { style: { '--i': i } }, img))),
                  h('div.unlock__names', `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`)
                );
          // after the share / challenge card on daily and duel results, first otherwise
          if (daily || mode === 'duel') body.firstChild.after(card);
          else body.prepend(card);
          audio.play('unlock');
        });
      }

      const wrong = (mode === 'retry' || mode === 'water' ? r.retry.missed : r.wrong).filter((id) => getExpression(id));
      if (wrong.length) {
        body.append(
          h('div.eyebrow', mode === 'retry' || mode === 'water' ? 'Still to learn' : 'Worth another look'),
          h(
            'div.review',
            wrong.map((id) => {
              const e = getExpression(id);
              return h('div.review__item', h('div.review__expr', phrase(e.text)), h('div.review__mean', e.meaning));
            })
          )
        );
      } else if (r.answered > 0) {
        body.append(h('div.review__item', { style: { borderLeftColor: 'var(--mint)' } }, h('div.review__expr', 'Flawless'), h('div.review__mean', 'Not a single expression got past you.')));
      }

      const ids = wrong.length ? wrong : r.seen;
      clear(reviewBtn).append(icon('cards'), wrong.length ? 'Review' : 'Flashcards');
      reviewBtn.disabled = !ids.length && !save.seenIds.length;
      reviewBtn.onclick = () => ui.go('flashcards', { from: 'results', ids: ids.length ? ids : null, label: wrong.length ? 'Missed this game' : 'This game' });
      this.last = r;
    },
    hide(next) {
      timers.forEach(clearTimeout);
      timers = [];
      clearInterval(ticker);
      // leaving for anywhere but a review of this game puts the character back on its feet
      if (next !== 'flashcards' && next !== 'play') app.game.quit();
    },
    key(e) {
      if (e.key === 'Enter' || e.key === ' ') playBtn.click();
      else if (e.key === 'Escape') app.toMenu();
    },
  };
}
