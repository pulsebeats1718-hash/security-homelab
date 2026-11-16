/**
 * Friend challenges. A challenge is a fixed run of 20 cards built from a seed
 * (run.js), so two players with the same seed get exactly the same cards with
 * the answers in the same places. Results travel in the link itself — no server:
 *
 *   https://…/?duel=<payload>   payload = base64url(JSON { v, s, n, c, p, k, t, b, m, r? })
 *     s seed · n name · c character · p points · k right answers · t cards
 *     b best streak · m marks ("ccw…", one per card) · r the result being answered { n, p, k }
 *
 * Anything that arrives in a link is checked and trimmed before it is used, and
 * names are only ever shown as text. Scores in a link can be edited by whoever
 * sends it: fine between friends, which is all this is for.
 *
 * Results you have played are kept on this device only (localStorage), so a
 * reply to your own challenge can show both scores straight away.
 */
import { hash32 } from '../core/utils.js';
import { pickRun, RUN_CARDS } from './run.js';

export const DUEL_CARDS = RUN_CARDS;
const VERSION = 1;
const STORE = 'phrasefall:duels';
const NAME_KEY = 'phrasefall:duel-name';
const KEEP = 40;
export const NAME_MAX = 16;

/** A fresh challenge seed: 8 random base-36 characters. */
export function newDuelSeed() {
  const bytes = new Uint8Array(8);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (b) => (b % 36).toString(36)).join('');
}

/** A seed from a link: letters and digits only, 4–16 of them. */
export const cleanSeed = (s) => (typeof s === 'string' && /^[a-z0-9]{4,16}$/.test(s) ? s : null);

/** The 20 cards for a seed. `byStage`: the expression lists (BY_STAGE in the game). */
export function buildDuel(seed, byStage) {
  return pickRun(byStage, { seed: hash32(`phrasefall:duel:${seed}`), rankKey: (id) => `duel|${seed}|${id}`, cards: DUEL_CARDS });
}

/** A name to show a friend: letters (any alphabet), digits, spaces, apostrophes, dots and hyphens; at most 16. */
export function cleanName(name) {
  if (typeof name !== 'string') return '';
  return name
    .normalize('NFC')
    .replace(/[^\p{L}\p{N} '.-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, NAME_MAX)
    .trim();
}

const int = (v, lo, hi) => (Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.round(v))) : null);

function toBase64Url(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromBase64Url(s) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

/**
 * Pack a result for a link.
 * @param {{ seed: string, name: string, character: string, score: number, correct: number, total: number, bestStreak: number, marks: string, reply?: { name: string, score: number, correct: number } | null }} r
 */
export function encodeDuel(r) {
  const out = { v: VERSION, s: r.seed, n: cleanName(r.name), c: r.character, p: r.score, k: r.correct, t: r.total, b: r.bestStreak, m: String(r.marks || '').slice(0, DUEL_CARDS) };
  if (r.reply) out.r = { n: cleanName(r.reply.name), p: r.reply.score, k: r.reply.correct };
  return toBase64Url(JSON.stringify(out));
}

/**
 * Unpack and check a link's payload. Returns null for anything malformed.
 * `isCharacter(id)`: true for a real character id (unknown ones become null).
 * @returns {null | { seed, name, character, score, correct, total, bestStreak, marks, reply: null | { name, score, correct } }}
 */
export function decodeDuel(payload, isCharacter = () => true) {
  if (typeof payload !== 'string' || payload.length > 600 || !/^[A-Za-z0-9_-]+$/.test(payload)) return null;
  let o;
  try {
    o = JSON.parse(fromBase64Url(payload));
  } catch {
    return null;
  }
  if (!o || typeof o !== 'object' || o.v !== VERSION) return null;
  const seed = cleanSeed(o.s);
  const total = int(o.t, 1, DUEL_CARDS);
  const correct = int(o.k, 0, DUEL_CARDS);
  const score = int(o.p, 0, 100000);
  if (!seed || total == null || correct == null || score == null || correct > total) return null;
  const marks = typeof o.m === 'string' ? o.m.replace(/[^cw]/g, '').slice(0, total) : '';
  let reply = null;
  if (o.r && typeof o.r === 'object') {
    const rs = int(o.r.p, 0, 100000);
    const rk = int(o.r.k, 0, DUEL_CARDS);
    if (rs != null && rk != null) reply = { name: cleanName(o.r.n), score: rs, correct: rk };
  }
  return {
    seed,
    name: cleanName(o.n),
    character: typeof o.c === 'string' && isCharacter(o.c) ? o.c : null,
    score,
    correct,
    total,
    bestStreak: int(o.b, 0, DUEL_CARDS) ?? 0,
    marks,
    reply,
  };
}

/** The link that opens a challenge. `base`: the game's address (origin + path). */
export const duelLink = (base, payload) => `${base}?duel=${payload}`;

/** Who won, from the first player's point of view: 'win' | 'lose' | 'draw'. Points first, then right answers. */
export function duelOutcome(me, them) {
  if (me.score !== them.score) return me.score > them.score ? 'win' : 'lose';
  if (me.correct !== them.correct) return me.correct > them.correct ? 'win' : 'lose';
  return 'draw';
}

/** Share text: who played, the emoji row and the score. */
export function duelShareText({ name, score, correct, total, marks, reply }, url) {
  const cells = Array.from({ length: total }, (_, i) => (marks[i] === 'c' ? '🟩' : marks[i] === 'w' ? '🟥' : '⬜'));
  const lines = [];
  if (reply) {
    const outcome = duelOutcome({ score, correct }, reply);
    lines.push(outcome === 'win' ? `I beat your ${reply.score.toLocaleString('en-GB')} on our Phrasefall challenge!` : outcome === 'draw' ? 'We drew on our Phrasefall challenge!' : `You won our Phrasefall challenge this time.`);
  } else {
    lines.push(`${name ? `${name} challenges you` : 'I challenge you'} on Phrasefall! Can you beat my score on the same 20 expressions?`);
  }
  lines.push(cells.slice(0, 10).join(''), cells.slice(10).join(''), `${correct}/${total} · ${score.toLocaleString('en-GB')} points`);
  if (url) lines.push(url);
  return lines.filter(Boolean).join('\n');
}

// ── this device's results ───────────────────────────────────────────────
function readStore() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE) || '{}');
    return raw && typeof raw === 'object' ? raw : {};
  } catch {
    return {};
  }
}

/** Your result for a seed on this device: { score, correct, total, bestStreak, marks, own, at } or null. */
export function myDuel(seed) {
  const r = readStore()[seed];
  return r && typeof r === 'object' ? r : null;
}

/** Remember your result for a seed (keeps the newest 40). `own`: you started this challenge. */
export function rememberDuel(seed, result) {
  const store = readStore();
  store[seed] = { ...store[seed], ...result, at: Date.now() };
  const keys = Object.keys(store).sort((a, b) => (store[b].at ?? 0) - (store[a].at ?? 0));
  for (const k of keys.slice(KEEP)) delete store[k];
  try {
    localStorage.setItem(STORE, JSON.stringify(store));
  } catch {
    /* private mode: challenges still work, they are just not remembered */
  }
}

/** The name you last used for challenges on this device. */
export function savedDuelName() {
  try {
    return cleanName(localStorage.getItem(NAME_KEY) || '');
  } catch {
    return '';
  }
}
export function saveDuelName(name) {
  try {
    localStorage.setItem(NAME_KEY, cleanName(name));
  } catch {
    /* not remembered */
  }
}
