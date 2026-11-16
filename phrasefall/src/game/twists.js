/**
 * Twist cards: other ways to meet an expression the player already knows, mixed
 * into classic and relax games (see TWIST_CHANCE in game.js).
 *
 *   flip    the meaning falls; pick the expression (out of four)
 *   gap     a phrasal verb's example sentence falls with its particle missing:
 *           "It rang for ages, but nobody picked ___." → up / off / down / over
 *   listen  the expression is spoken, not shown; pick its meaning
 *   build   the meaning falls; tap the expression's words in the right order
 *
 * Recognising a meaning is the easiest kind of memory; these make the player
 * recall the expression itself (flip, build), notice how it is used (gap) or
 * catch it by ear (listen).
 *
 * Pure functions over plain expression objects (no DOM, no data loader), so the
 * rules are unit-tested in twists.test.mjs.
 */
import { shuffle } from '../core/utils.js';

export const TWIST_KINDS = ['flip', 'gap', 'listen', 'build'];

/** How the interface names each twist, and what it asks. */
export const TWIST_INFO = {
  flip: { label: 'Flip', ask: 'Pick the expression that means this' },
  gap: { label: 'Fill the gap', ask: 'Which word is missing?' },
  listen: { label: 'Listen', ask: 'Listen, then pick the meaning' },
  build: { label: 'Build it', ask: 'Tap the words in the right order' },
};

/** Words that can follow a verb in a two-word phrasal verb. */
export const PARTICLES = ['up', 'down', 'out', 'off', 'on', 'in', 'over', 'away', 'back', 'through', 'round', 'around', 'about', 'along', 'across', 'by', 'into', 'after', 'for', 'with', 'at', 'to', 'forward', 'apart', 'ahead', 'behind', 'under', 'past', 'aside', 'together'];
/** The particles offered as wrong answers: common enough that none of them looks odd. */
const GAP_DISTRACTORS = ['up', 'down', 'out', 'off', 'on', 'in', 'over', 'away', 'back', 'through', 'about', 'along', 'across', 'round'];
/** Pairs that mean the same in many phrasal verbs, so one must never be the wrong answer for the other. */
const SAME = { round: 'around', around: 'round' };

/** Short everyday words that say nothing about a meaning. */
const STOP = new Set('a an the to of in on at for with and or but is are be been being it its this that these those you your someone something somebody sb sth who what when how not no very really just so than then as by from into about up out off over do does did doing done get gets got make makes made have has had one ones some any all more most much many way thing things time people person'.split(' '));

/** "pick up (a language)" → "pick up" */
export const mainText = (text) => String(text).replace(/\s*\([^()]*\)\s*$/, '').trim();

const norm = (s) => mainText(s).toLowerCase();

/** The meaningful words of a meaning, roughly stemmed. */
export function contentWords(text) {
  return new Set(
    String(text)
      .toLowerCase()
      .replace(/[^a-z' ]+/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP.has(w))
      .map((w) => w.replace(/(ing|ed|es|s)$/, ''))
  );
}

/** Share of the smaller set's words that the two sets have in common (0…1). */
function overlap(a, b) {
  if (!a.size || !b.size) return 0;
  let n = 0;
  for (const w of a) if (b.has(w)) n++;
  return n / Math.min(a.size, b.size);
}

/** The lower-case main texts of every phrasal verb, so a wrong answer is never a real phrasal verb too. */
export function phrasalIndex(list) {
  const set = new Set();
  for (const e of list) if (e.type === 'phrasal') set.add(norm(e.text));
  return set;
}

/**
 * Flip: three other expressions of the same kind as wrong answers. None may share
 * the expression's words ("pick up" twice), be one of its synonyms, or mean much
 * the same thing. Returns { prompt, options } or null when no safe set is found.
 */
export function flipFor(expr, pool, rng = Math.random) {
  const main = norm(expr.text);
  const syn = new Set((expr.synonyms ?? []).map((s) => s.toLowerCase()));
  const words = contentWords(expr.meaning);
  const picked = [];
  const used = new Set([main]);
  const n = pool.length;
  for (let tries = 0; tries < 160 && picked.length < 3 && n; tries++) {
    const e = pool[Math.floor(rng() * n)];
    if (!e || e.id === expr.id || e.type !== expr.type) continue;
    const m = norm(e.text);
    if (used.has(m) || syn.has(m) || (e.synonyms ?? []).some((s) => s.toLowerCase() === main)) continue;
    if (overlap(words, contentWords(e.meaning)) >= 0.34) continue;
    used.add(m);
    picked.push(e);
  }
  if (picked.length < 3) return null;
  const options = shuffle([{ text: expr.text, correct: true }, ...picked.map((e) => ({ text: e.text, correct: false }))], rng);
  return { prompt: expr.meaning, options };
}

/**
 * Fill the gap: a two-word phrasal verb whose particle appears exactly once in its
 * example. Wrong answers are particles that do not make another phrasal verb with
 * the same verb in the game ("turn off" never offers "on"). Returns
 * { sentence, answer, meaning, options } or null.
 */
export function gapFor(expr, known, rng = Math.random) {
  if (expr.type !== 'phrasal' || !expr.example) return null;
  const words = norm(expr.text).split(/\s+/);
  if (words.length !== 2) return null;
  const [verb, particle] = words;
  if (!PARTICLES.includes(particle)) return null;
  const re = new RegExp(`\\b${particle}\\b`, 'gi');
  const hits = expr.example.match(re);
  if (!hits || hits.length !== 1) return null;
  const pool = GAP_DISTRACTORS.filter((p) => p !== particle && SAME[particle] !== p && !known.has(`${verb} ${p}`));
  if (pool.length < 3) return null;
  const wrong = shuffle(pool.slice(), rng).slice(0, 3);
  const options = shuffle([{ text: particle, correct: true }, ...wrong.map((text) => ({ text, correct: false }))], rng);
  return { sentence: expr.example.replace(re, '___'), answer: particle, meaning: expr.meaning, options };
}

/**
 * Build it: an expression of three to six words, shuffled into tiles (never in
 * the right order already). Punctuation is left off the tiles, so "know?" does
 * not give away the last word. Returns { prompt, words, tiles, full } or null:
 * `words` in order, `tiles` shuffled, `full` the expression as written.
 */
export function buildFor(expr, rng = Math.random) {
  const full = mainText(expr.text);
  const words = full
    .split(/\s+/)
    .map((w) => w.replace(/[?!.,;:]+$/, ''))
    .filter(Boolean);
  if (words.length < 3 || words.length > 6) return null;
  let order = words.map((_, i) => i);
  for (let i = 0; i < 12; i++) {
    order = shuffle(order, rng);
    if (order.some((v, j) => words[v] !== words[j])) break;
  }
  if (order.every((v, j) => words[v] === words[j])) return null;
  return { prompt: expr.meaning, words, tiles: order.map((i) => words[i]), full };
}

/** Listen: only expressions without a sense hint (the hint is not spoken, so it could be ambiguous). */
export const canListenTo = (expr) => !/\(/.test(expr.text) && mainText(expr.text).length <= 60;

/**
 * Choose a twist for a card, or null. `pool`: expressions to draw flip answers
 * from (the card's stage); `known`: phrasalIndex(); `canListen`: the device can speak.
 * @returns {null | { kind: 'flip'|'gap'|'listen'|'build', options?: Array, prompt?: string, sentence?: string, words?: string[], tiles?: string[], meaning?: string }}
 */
export function pickTwist(expr, { pool, known, canListen = false, rng = Math.random }) {
  const choices = [];
  const flip = flipFor(expr, pool, rng);
  if (flip) choices.push({ w: 3, twist: { kind: 'flip', ...flip } });
  const gap = gapFor(expr, known, rng);
  if (gap) choices.push({ w: 4, twist: { kind: 'gap', ...gap } });
  if (canListen && canListenTo(expr)) choices.push({ w: 2, twist: { kind: 'listen' } });
  const build = buildFor(expr, rng);
  if (build) choices.push({ w: 2.5, twist: { kind: 'build', ...build } });
  if (!choices.length) return null;
  let r = rng() * choices.reduce((s, c) => s + c.w, 0);
  for (const c of choices) {
    r -= c.w;
    if (r <= 0) return c.twist;
  }
  return choices[choices.length - 1].twist;
}
