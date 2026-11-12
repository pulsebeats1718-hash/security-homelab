// Validates the expression database (see dev/EXPRESSION_GUIDE.md).
//
//   node scripts/check-expressions.mjs                      every file, full report
//   node scripts/check-expressions.mjs <file> [<file>…]     check these files (duplicates checked against all files)
//   node scripts/check-expressions.mjs --find <words…>      list existing expressions containing all the words
//   node scripts/check-expressions.mjs --stats              counts per stage, file, type and level
//
// Exit code 1 when any checked file has a problem.
import { readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = join(root, 'src/data/expressions');

const TYPES_BY_STAGE = { 1: ['everyday'], 2: ['phrasal'], 3: ['idiom'], 4: ['set-phrase'], 5: ['collocation', 'advanced'] };
const REGISTERS = new Set(['Very informal', 'Informal', 'Neutral', 'Formal']);
const LIMITS = { text: 34, meaning: 56, example: 120, context: 140, mistake: 150 };
// common function words and light verbs: sharing these is not a giveaway
const FUNCTION_WORDS = new Set(['that', 'this', 'what', 'have', 'with', 'from', 'into', 'onto', 'they', 'them', 'their', 'there', 'then', 'than', 'when', 'where', 'which', 'will', 'would', 'could', 'should', 'been', 'were', 'more', 'most', 'much', 'very', 'just', 'some', 'about', 'over', 'under', 'down', 'make', 'made', 'take', 'took', 'give', 'gave', 'keep', 'come', 'came', 'goes', 'going', 'does', 'done', "don't", "isn't", "it's", "i'm", "you're", "can't", "won't", 'even', 'also', 'only', 'like', 'well']);
const STOP = new Set(['the', 'a', 'an', 'to', 'of', 'in', 'on', 'at', 'and', 'or', 'it', 'is', 'be', 'your', 'my', 'you', 'i', 'as', 'for', 'with', 'one', 'someone', 'something', 'somebody']);

/** Normalised form used to catch the same expression written twice. */
export function norm(text) {
  return String(text)
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/\(.*?\)/g, ' ')
    .replace(/\b(someone|somebody|something|one)'s\b/g, ' ')
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/\b(someone|somebody|something|sb|sth|your|my|his|her|their|our|its|yourself|myself|oneself)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(to|a|an|the) /, '')
    .replace(/^as (\w+) as /, '$1 as ');
}

function listFiles() {
  const out = [];
  for (const dir of readdirSync(dataDir).sort()) {
    const m = dir.match(/^stage(\d+)$/);
    if (!m || !statSync(join(dataDir, dir)).isDirectory()) continue;
    for (const f of readdirSync(join(dataDir, dir)).sort()) if (f.endsWith('.js')) out.push({ path: join(dataDir, dir, f), stage: Number(m[1]) });
  }
  return out;
}

async function load(file) {
  try {
    const mod = await import(`${pathToFileURL(file.path).href}?t=${Date.now()}`);
    if (!Array.isArray(mod.default)) return { ...file, list: [], loadError: 'default export must be an array' };
    return { ...file, list: mod.default };
  } catch (e) {
    return { ...file, list: [], loadError: e.message.split('\n')[0] };
  }
}

const args = process.argv.slice(2);
const all = await Promise.all(listFiles().map(load));
const rel = (p) => relative(root, p);

// ── --find ─────────────────────────────────────────────────────────────────
if (args[0] === '--find') {
  const words = args.slice(1).map((w) => w.toLowerCase());
  let n = 0;
  for (const f of all) for (const e of f.list) {
    const t = String(e.text ?? '').toLowerCase();
    if (words.every((w) => t.includes(w))) {
      console.log(`${e.text}   (${rel(f.path)})`);
      n++;
    }
  }
  console.log(n ? `${n} match(es)` : 'no matches');
  process.exit(0);
}

// ── --stats ────────────────────────────────────────────────────────────────
if (args[0] === '--stats') {
  let total = 0;
  for (let s = 1; s <= 5; s++) {
    const files = all.filter((f) => f.stage === s);
    const n = files.reduce((a, f) => a + f.list.length, 0);
    total += n;
    const lv = [1, 2, 3].map((l) => files.reduce((a, f) => a + f.list.filter((e) => (e.level ?? 1) === l).length, 0));
    console.log(`stage ${s}: ${String(n).padStart(4)}   levels 1/2/3: ${lv.join(' / ')}`);
    for (const f of files) console.log(`    ${rel(f.path).padEnd(52)} ${String(f.list.length).padStart(4)}${f.loadError ? '   LOAD ERROR: ' + f.loadError : ''}`);
  }
  console.log(`total: ${total}`);
  process.exit(0);
}

// ── validation ─────────────────────────────────────────────────────────────
const targets = args.length ? all.filter((f) => args.some((a) => resolve(a) === f.path)) : all;
if (args.length && !targets.length) {
  console.log(`No expression file matches ${args.join(' ')} (files must live in src/data/expressions/stageN/).`);
  process.exit(1);
}

// index of every id / normalised text across the whole database
const ids = new Map();
const texts = new Map();
for (const f of all) for (const e of f.list) {
  const where = rel(f.path);
  if (e?.id) (ids.get(e.id) ?? ids.set(e.id, []).get(e.id)).push(where);
  if (e?.text) (texts.get(norm(e.text)) ?? texts.set(norm(e.text), []).get(norm(e.text))).push({ where, text: e.text });
}

let errors = 0;
let warnings = 0;
let checked = 0;
for (const f of targets) {
  const name = rel(f.path);
  const out = [];
  const err = (id, msg) => out.push(`  ✗ ${id}: ${msg}`);
  const warn = (id, msg) => out.push(`  ⚠ ${id}: ${msg}`);
  if (f.loadError) err('(file)', `could not load: ${f.loadError}`);
  const seenHere = new Set();
  for (const e of f.list) {
    checked++;
    const id = e?.id ?? '(no id)';
    for (const k of ['id', 'text', 'type', 'meaning', 'example', 'register', 'context', 'mistake']) {
      if (typeof e[k] !== 'string' || !e[k].trim()) err(id, `missing string field "${k}"`);
    }
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(e.id ?? '')) err(id, 'id must be kebab-case (a-z, 0-9, hyphens)');
    if (seenHere.has(e.id)) err(id, 'duplicate id in this file');
    seenHere.add(e.id);
    const idElsewhere = (ids.get(e.id) ?? []).filter((w) => w !== name);
    if (idElsewhere.length) err(id, `id also used in ${[...new Set(idElsewhere)].join(', ')}`);
    const sameText = (texts.get(norm(e.text ?? '')) ?? []).filter((x) => !(x.where === name && x.text === e.text));
    if (sameText.length) err(id, `same expression as "${sameText[0].text}" in ${sameText[0].where}`);
    const allowed = TYPES_BY_STAGE[f.stage] ?? [];
    if (!allowed.includes(e.type)) err(id, `type "${e.type}" not allowed in stage ${f.stage} (use ${allowed.join(' or ')})`);
    if (![1, 2, 3].includes(e.level)) err(id, 'level must be 1, 2 or 3');
    if (!REGISTERS.has(e.register)) err(id, `register must be one of ${[...REGISTERS].join(' / ')}`);
    for (const [k, max] of Object.entries(LIMITS)) {
      if (typeof e[k] === 'string' && e[k].length > max) err(id, `${k} is ${e[k].length} chars (max ${max})`);
    }
    if (/[.,;:]$/.test(e.text ?? '')) err(id, 'text should not end with . , ; or :');
    if (!Array.isArray(e.distractors) || e.distractors.length !== 3) err(id, 'needs exactly 3 distractors');
    else {
      const opts = [e.meaning, ...e.distractors].map((s) => String(s).trim().toLowerCase());
      if (new Set(opts).size !== 4) err(id, 'meaning and distractors must all differ');
      e.distractors.forEach((d, i) => {
        if (typeof d !== 'string' || !d.trim()) err(id, `distractor ${i + 1} empty`);
        else if (d.length > LIMITS.meaning) err(id, `distractor ${i + 1} is ${d.length} chars (max ${LIMITS.meaning})`);
        if (/[.!]$/.test(d)) err(id, `distractor ${i + 1} should not end with punctuation`);
      });
      const lens = [e.meaning, ...e.distractors].map((s) => String(s).length);
      if (e.meaning.length === Math.max(...lens) && e.meaning.length > 1.6 * Math.min(...lens.slice(1)) + 8) {
        err(id, 'meaning is much longer than every distractor (gives the answer away)');
      }
    }
    if (/[.!]$/.test(e.meaning ?? '')) err(id, 'meaning should not end with punctuation');
    if (!Array.isArray(e.synonyms) || e.synonyms.length < 1 || e.synonyms.length > 3) err(id, 'needs 1–3 synonyms');
    // soft check: the example should visibly use the expression
    if (typeof e.example === 'string' && typeof e.text === 'string') {
      const words = norm(e.text).split(' ').filter((w) => w.length > 1 && !STOP.has(w));
      const ex = e.example.toLowerCase();
      if (words.length && !words.some((w) => ex.includes(w.replace(/'s$/, '')))) warn(id, 'example does not seem to contain the expression');
    }
    // soft check: the meaning should not hand the player a key word of the expression
    if (typeof e.meaning === 'string' && typeof e.text === 'string') {
      const stem = (w) => w.replace(/'s$/, '').replace(/(ing|ed|es|s)$/, '');
      const keys = norm(e.text).split(' ').filter((w) => w.length >= 4 && !STOP.has(w) && !FUNCTION_WORDS.has(w)).map(stem);
      const meaningWords = norm(e.meaning).split(' ').map(stem);
      const shared = keys.filter((k) => k.length >= 3 && meaningWords.includes(k));
      if (shared.length) warn(id, `meaning repeats "${shared.join('", "')}" from the expression (gives the answer away)`);
    }
  }
  const nErr = out.filter((l) => l.includes('✗')).length;
  errors += nErr;
  warnings += out.length - nErr;
  console.log(`${name}: ${f.list.length} expressions${out.length ? '' : ' ✓'}`);
  if (out.length) console.log(out.join('\n'));
}

if (!args.length) {
  const total = all.reduce((a, f) => a + f.list.length, 0);
  console.log(`\n${total} expressions in ${all.length} files`);
}
console.log(errors ? `\n${errors} problem(s)${warnings ? `, ${warnings} warning(s)` : ''} in ${checked} expressions` : `\nAll ${checked} checked expressions valid ✓${warnings ? ` (${warnings} warning(s))` : ''}`);
process.exit(errors ? 1 : 0);
