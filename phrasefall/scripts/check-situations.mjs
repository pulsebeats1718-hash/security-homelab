#!/usr/bin/env node
/**
 * Validate the Situations (src/data/situations/*.js) against the expression database.
 *
 *   node scripts/check-situations.mjs                 every file
 *   node scripts/check-situations.mjs --find <text>   expression ids whose text or meaning contains <text>
 *
 * Schema and style: dev/SITUATIONS_GUIDE.md.
 */
import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const exprDir = join(root, 'src/data/expressions');
const sitDir = join(root, 'src/data/situations');
const PLACES = ['home', 'london', 'newyork', 'sydney'];
const CHARACTERS = readdirSync(join(root, 'src/characters/models')).filter((f) => f.endsWith('.js')).map((f) => f.slice(0, -3));

async function loadExpressions() {
  const byId = new Map();
  for (const dir of readdirSync(exprDir).sort()) {
    if (!/^stage\d+$/.test(dir)) continue;
    for (const f of readdirSync(join(exprDir, dir)).sort()) {
      if (!f.endsWith('.js')) continue;
      const list = (await import(pathToFileURL(join(exprDir, dir, f)).href)).default;
      for (const e of list) byId.set(e.id, { ...e, stage: Number(dir.slice(5)) });
    }
  }
  return byId;
}

const exprs = await loadExpressions();
const args = process.argv.slice(2);

if (args[0] === '--find') {
  const q = args.slice(1).join(' ').toLowerCase();
  let n = 0;
  for (const e of exprs.values()) {
    if (!e.text.toLowerCase().includes(q) && !e.meaning.toLowerCase().includes(q)) continue;
    console.log(`${e.id}\t${e.text}\t— ${e.meaning}\t(L${e.level ?? 1}, ${e.type})`);
    if (++n >= 60) break;
  }
  console.log(`${n} match(es)${n >= 60 ? ' (first 60)' : ''}`);
  process.exit(0);
}

const errors = [];
const warnings = [];
const ids = new Set();
let total = 0;
let choices = 0;
const len = (s) => (typeof s === 'string' ? [...s].length : 0);
const mainText = (t) => t.replace(/\s*\([^()]*\)\s*$/, '').trim();

let files = [];
try {
  files = readdirSync(sitDir).filter((f) => f.endsWith('.js') && !f.startsWith('index')).sort();
} catch {
  /* no situations yet */
}
for (const f of files) {
  const place = f.replace(/(-\d+)?\.js$/, '');
  let list;
  try {
    list = (await import(pathToFileURL(join(sitDir, f)).href)).default;
  } catch (err) {
    errors.push(`${f}: does not load: ${err.message}`);
    continue;
  }
  if (!Array.isArray(list)) {
    errors.push(`${f}: default export is not an array`);
    continue;
  }
  for (const s of list) {
    total++;
    const at = `${f} › ${s?.id ?? '?'}`;
    const err = (m) => errors.push(`${at}: ${m}`);
    if (!s || typeof s !== 'object') {
      err('not an object');
      continue;
    }
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s.id ?? '')) err('id must be kebab-case');
    if (ids.has(s.id)) err('duplicate id');
    ids.add(s.id);
    if (!PLACES.includes(s.place)) err(`place must be one of ${PLACES.join(', ')}`);
    if (s.place !== place) err(`place "${s.place}" is in ${f}`);
    if (!s.id?.startsWith(`${s.place}-`)) err('id must start with the place id');
    if (!s.title || len(s.title) > 32) err('title missing or over 32 characters');
    if (!s.scene || len(s.scene) > 80) err('scene missing or over 80 characters');
    if (!CHARACTERS.includes(s.with)) err(`with: unknown character "${s.with}"`);
    if (![1, 2, 3].includes(s.level)) err('level must be 1, 2 or 3');
    const lines = Array.isArray(s.lines) ? s.lines : [];
    if (lines.length < 5 || lines.length > 10) err(`needs 5–10 lines (has ${lines.length})`);
    if (!lines[0]?.say) err('must start with a "say" line');
    if (!lines[lines.length - 1]?.say) err('must end with a "say" line');
    const asks = lines.filter((l) => l?.options);
    choices += asks.length;
    if (asks.length < 2 || asks.length > 3) err(`needs 2–3 choices (has ${asks.length})`);
    const used = new Set();
    lines.forEach((l, i) => {
      const li = `line ${i + 1}`;
      const kinds = ['say', 'you', 'options'].filter((k) => l?.[k] !== undefined);
      if (kinds.length !== 1) return err(`${li}: needs exactly one of say / you / options`);
      if (l.say !== undefined && (!len(l.say) || len(l.say) > 90)) err(`${li}: "say" empty or over 90 characters`);
      if (l.you !== undefined && (!len(l.you) || len(l.you) > 90)) err(`${li}: "you" empty or over 90 characters`);
      if (!l.options) return;
      if (l.ask !== undefined && len(l.ask) > 70) err(`${li}: "ask" over 70 characters`);
      if (!Array.isArray(l.options) || l.options.length !== 3) return err(`${li}: needs exactly three options`);
      const right = l.options.filter((o) => o?.right === true);
      if (right.length !== 1) err(`${li}: needs exactly one right option`);
      // the buttons show each expression's text, sense hint included: two must never look alike,
      // and the right one's hint must not give the answer away
      const mains = l.options.map((o) => exprs.get(o?.id)).filter(Boolean).map((e) => mainText(e.text).toLowerCase());
      if (new Set(mains).size !== mains.length) err(`${li}: two options show the same words (“${mains.join('” / “')}”); only a hint in brackets would tell them apart`);
      const rightExpr = exprs.get(right[0]?.id);
      const hint = rightExpr?.text.match(/\(([^()]+)\)\s*$/)?.[1];
      if (hint && l.ask) {
        const askLow = l.ask.toLowerCase();
        const give = hint.toLowerCase().split(/\s+/).filter((w) => w.length > 3 && askLow.includes(w));
        if (give.length) err(`${li}: the right option's hint “(${hint})” repeats the prompt (“${give.join(', ')}”), which gives the answer away`);
      }
      for (const o of l.options) {
        const e = exprs.get(o?.id);
        if (!e) {
          err(`${li}: unknown expression id "${o?.id}" (try --find)`);
          continue;
        }
        if (used.has(o.id)) err(`${li}: "${o.id}" is used twice in this situation`);
        used.add(o.id);
        if (!o.note || len(o.note) > 120) err(`${li}: note for "${o.id}" missing or over 120 characters`);
        if (o.right) {
          if (!o.line || len(o.line) > 110) err(`${li}: the right option needs a "line" (≤ 110 characters)`);
          else {
            // the line should show the expression: its first word (or a form of it) and the rest
            const words = mainText(e.text).toLowerCase().replace(/[^a-z' ]/g, ' ').split(/\s+/).filter((w) => w.length > 2);
            const lineLow = o.line.toLowerCase();
            const found = words.filter((w) => lineLow.includes(w.slice(0, Math.max(3, w.length - 2)))).length;
            if (words.length && found / words.length < 0.5) warnings.push(`${at} ${li}: the line may not contain “${e.text}”: ${o.line}`);
          }
        } else if (o.line) err(`${li}: only the right option has a "line"`);
      }
    });
  }
}

for (const w of warnings) console.warn(`⚠ ${w}`);
for (const e of errors) console.error(`✗ ${e}`);
if (errors.length) {
  console.error(`\n${errors.length} error(s) in ${total} situation(s)`);
  process.exit(1);
}
console.log(`All ${total} situations valid ✓ (${choices} choices, ${warnings.length} warning(s))`);
