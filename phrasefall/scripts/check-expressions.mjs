// Validates the expression database. Usage:
//   node scripts/check-expressions.mjs                 (all stage files)
//   node scripts/check-expressions.mjs src/data/expressions/stage3.js
import { readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'src/data/expressions');
const files = process.argv.slice(2).length
  ? process.argv.slice(2).map((f) => resolve(f))
  : readdirSync(dir).filter((f) => /^stage\d+\.js$/.test(f)).sort().map((f) => join(dir, f));

const TYPES = new Set(['everyday', 'phrasal', 'idiom', 'set-phrase', 'collocation', 'advanced']);
const REGISTERS = new Set(['Very informal', 'Informal', 'Neutral', 'Formal']);
const LIMITS = { text: 34, meaning: 56, example: 120, context: 140, mistake: 150 };

let errors = 0;
let total = 0;
const seen = new Map();
const err = (file, id, msg) => { errors++; console.log(`  ✗ [${file}] ${id}: ${msg}`); };

for (const file of files) {
  const name = file.split('/').pop();
  const list = (await import(pathToFileURL(file).href)).default;
  if (!Array.isArray(list)) { err(name, '-', 'default export must be an array'); continue; }
  console.log(`${name}: ${list.length} expressions`);
  total += list.length;
  for (const e of list) {
    const id = e.id ?? '(no id)';
    for (const k of ['id', 'text', 'type', 'meaning', 'example', 'register', 'context', 'mistake']) {
      if (typeof e[k] !== 'string' || !e[k].trim()) err(name, id, `missing string field "${k}"`);
    }
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(e.id ?? '')) err(name, id, 'id must be kebab-case');
    if (seen.has(e.id)) err(name, id, `duplicate id (also in ${seen.get(e.id)})`);
    seen.set(e.id, name);
    if (!TYPES.has(e.type)) err(name, id, `unknown type "${e.type}"`);
    if (!REGISTERS.has(e.register)) err(name, id, `register must be one of ${[...REGISTERS].join(' / ')}`);
    for (const [k, max] of Object.entries(LIMITS)) {
      if (typeof e[k] === 'string' && e[k].length > max) err(name, id, `${k} is ${e[k].length} chars (max ${max})`);
    }
    if (!Array.isArray(e.distractors) || e.distractors.length !== 3) err(name, id, 'needs exactly 3 distractors');
    else {
      const opts = [e.meaning, ...e.distractors].map((s) => String(s).trim().toLowerCase());
      if (new Set(opts).size !== 4) err(name, id, 'meaning and distractors must all differ');
      e.distractors.forEach((d, i) => {
        if (typeof d !== 'string' || !d.trim()) err(name, id, `distractor ${i + 1} empty`);
        else if (d.length > LIMITS.meaning) err(name, id, `distractor ${i + 1} is ${d.length} chars (max ${LIMITS.meaning})`);
        if (/[.!]$/.test(d)) err(name, id, `distractor ${i + 1} should not end with punctuation`);
      });
      const lens = [e.meaning, ...e.distractors].map((s) => String(s).length);
      if (e.meaning.length === Math.max(...lens) && e.meaning.length > 1.6 * Math.min(...lens.slice(1)) + 8) {
        err(name, id, 'meaning is much longer than every distractor (gives the answer away)');
      }
    }
    if (/[.!]$/.test(e.meaning ?? '')) err(name, id, 'meaning should not end with punctuation');
    if (!Array.isArray(e.synonyms) || e.synonyms.length < 1 || e.synonyms.length > 3) err(name, id, 'needs 1–3 synonyms');
  }
}
console.log(errors ? `\n${errors} problem(s) across ${total} expressions` : `\nAll ${total} expressions valid ✓`);
process.exit(errors ? 1 : 0);
