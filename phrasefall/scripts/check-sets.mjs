#!/usr/bin/env node
/**
 * Validate the sticker album's themed sets (src/data/sets.js) against the expression database.
 *
 *   node scripts/check-sets.mjs                 check every set
 *   node scripts/check-sets.mjs --find <text>   expression ids whose text or meaning contains <text>
 */
import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const exprDir = join(root, 'src/data/expressions');
const { ICONS } = await import(pathToFileURL(join(root, 'src/ui/icons.js')).href);

const exprs = new Map();
for (const dir of readdirSync(exprDir).sort()) {
  if (!/^stage\d+$/.test(dir)) continue;
  for (const f of readdirSync(join(exprDir, dir)).sort()) {
    if (!f.endsWith('.js')) continue;
    for (const e of (await import(pathToFileURL(join(exprDir, dir, f)).href)).default) exprs.set(e.id, { ...e, stage: Number(dir.slice(5)) });
  }
}

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

const { SETS } = await import(pathToFileURL(join(root, 'src/data/sets.js')).href);
const errors = [];
const warnings = [];
const seenSet = new Set();
const owner = new Map();
const len = (s) => (typeof s === 'string' ? [...s].length : 0);
if (!Array.isArray(SETS)) errors.push('SETS is not an array');
for (const s of SETS ?? []) {
  const at = s?.id ?? '?';
  const err = (m) => errors.push(`${at}: ${m}`);
  if (!/^[a-z]+(-[a-z]+)*$/.test(s.id ?? '')) err('id must be kebab-case letters');
  if (seenSet.has(s.id)) err('duplicate set id');
  seenSet.add(s.id);
  if (!s.name || len(s.name) > 26) err('name missing or over 26 characters');
  if (!s.blurb || len(s.blurb) > 70) err('blurb missing or over 70 characters');
  if (!ICONS[s.icon]) err(`icon "${s.icon}" is not in src/ui/icons.js`);
  if (!/^#[0-9a-f]{6}$/i.test(s.color ?? '')) err('color must be a #rrggbb hex');
  const ids = Array.isArray(s.ids) ? s.ids : [];
  if (ids.length < 12 || ids.length > 16) err(`needs 12–16 expressions (has ${ids.length})`);
  let hard = 0;
  for (const id of ids) {
    const e = exprs.get(id);
    if (!e) {
      err(`unknown expression id "${id}" (try --find)`);
      continue;
    }
    if (owner.has(id)) err(`"${id}" is already in set "${owner.get(id)}" (each expression belongs to one set)`);
    owner.set(id, s.id);
    if ((e.level ?? 1) >= 3) hard++;
  }
  if (new Set(ids).size !== ids.length) err('an expression is listed twice');
  if (hard > 4) warnings.push(`${at}: ${hard} level-3 expressions; sets should be mostly well-known ones`);
}
for (const w of warnings) console.warn(`⚠ ${w}`);
for (const e of errors) console.error(`✗ ${e}`);
if (errors.length) {
  console.error(`\n${errors.length} error(s) in ${SETS?.length ?? 0} set(s)`);
  process.exit(1);
}
console.log(`All ${SETS.length} sets valid ✓ (${owner.size} expressions, ${warnings.length} warning(s))`);
