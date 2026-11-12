// Applies a batch of corrections to an expression file and rewrites it in the house format.
//
//   node scripts/patch-expressions.mjs <file> <patch.json>
//   node scripts/patch-expressions.mjs <file> - <<'EOF'
//   { "hold-up": { "distractors": ["…", "…", "…"], "mistake": "…" },
//     "some-id": { "__delete": true },
//     "other-id": { "__replace": { full new entry } } }
//   EOF
//   node scripts/patch-expressions.mjs <file> --format      just reformat
//
// Keys are entry ids. A patch object changes only the fields it names.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ORDER = ['id', 'text', 'type', 'level', 'meaning', 'distractors', 'example', 'synonyms', 'register', 'context', 'mistake'];

const q = (s) => {
  s = String(s);
  if (!s.includes("'")) return `'${s.replace(/\\/g, '\\\\')}'`;
  if (!s.includes('"')) return JSON.stringify(s);
  return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
};
const val = (v) => (Array.isArray(v) ? `[${v.map(q).join(', ')}]` : typeof v === 'number' ? String(v) : q(v));

export function format(header, list) {
  const body = list
    .map((e) => {
      const keys = [...ORDER.filter((k) => k in e), ...Object.keys(e).filter((k) => !ORDER.includes(k))];
      return `  {\n${keys.map((k) => `    ${k}: ${val(e[k])},`).join('\n')}\n  },`;
    })
    .join('\n');
  return `${header.trimEnd()}\nexport default [\n${body}\n];\n`;
}

const [fileArg, patchArg] = process.argv.slice(2);
if (!fileArg || !patchArg) {
  console.log('usage: node scripts/patch-expressions.mjs <file> <patch.json | - | --format>');
  process.exit(1);
}
const file = resolve(fileArg);
const src = readFileSync(file, 'utf8');
const header = src.slice(0, src.indexOf('export default'));
const list = (await import(`${pathToFileURL(file).href}?t=${Date.now()}`)).default.map((e) => ({ ...e }));

let patch = {};
if (patchArg !== '--format') patch = JSON.parse(patchArg === '-' ? readFileSync(0, 'utf8') : readFileSync(resolve(patchArg), 'utf8'));

const byId = new Map(list.map((e, i) => [e.id, i]));
let changed = 0;
let deleted = 0;
const missing = [];
for (const [id, p] of Object.entries(patch)) {
  if (!byId.has(id)) {
    missing.push(id);
    continue;
  }
  const i = byId.get(id);
  if (p.__delete) {
    list[i] = null;
    deleted++;
  } else if (p.__replace) {
    list[i] = { ...p.__replace };
    changed++;
  } else {
    Object.assign(list[i], p);
    changed++;
  }
}
const out = list.filter(Boolean);
writeFileSync(file, format(header, out));
console.log(`${fileArg}: ${changed} changed, ${deleted} deleted, ${out.length} entries${missing.length ? `; unknown ids: ${missing.join(', ')}` : ''}`);
