/**
 * Cloud save encoding for saves/{uid}. Pure functions, round-trip tested in merge.test.mjs.
 *
 * Firestore caps a document at 1 MiB. As plain JSON, 4,000 expression records come to
 * ~450 KB; here the per-id record maps (`expr`, `daily`) become tab-separated rows under a
 * shared column list, with integers in base 36, which is ~150 KB for 4,000 records. Fields
 * nobody planned for (new columns, nested values, new top-level keys) are carried as-is:
 * new keys become new columns, and any value that is not a small scalar falls back to JSON.
 *
 *   { v: 1,
 *     data: '{"version":1,"character":"fox",…}'   everything else, as JSON (settings stay on the device)
 *     rows: '§expr\tseen\tcorrect…\nbreak-the-ice\t3\t2…\n§daily\t…'
 *     t:    newest local change included (ms) }
 */
export const FORMAT = 1;
/** Kept on each device (volume, graphics quality and pace are per device). */
export const LOCAL_ONLY = ['settings'];
/** id → flat record maps, packed as rows. */
export const RECORD_MAPS = ['expr', 'daily'];

const B36 = /^-?[0-9a-z]+$/;
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

// ── cells ───────────────────────────────────────────────────────────────
//   ''  absent      N null      T / F booleans      'text  short string
//   J…  JSON        otherwise a safe integer in base 36 (lower case, optional '-')
function cell(v) {
  if (v === undefined) return '';
  if (v === null) return 'N';
  if (v === true) return 'T';
  if (v === false) return 'F';
  if (typeof v === 'number' && Number.isSafeInteger(v)) return v.toString(36);
  if (typeof v === 'string' && v.length <= 200 && !/[\t\n\r]/.test(v)) return `'${v}`;
  return `J${JSON.stringify(v)}`;
}
function uncell(s) {
  if (s === '') return undefined;
  if (s === 'N') return null;
  if (s === 'T') return true;
  if (s === 'F') return false;
  if (s[0] === "'") return s.slice(1);
  if (s[0] === 'J') return JSON.parse(s.slice(1));
  if (B36.test(s)) return parseInt(s, 36);
  throw new Error(`Unreadable cell "${s.slice(0, 20)}"`);
}
// ids are written raw unless they could be mistaken for a section line or a quoted id
const idOut = (id) => (/[\t\n\r]/.test(id) || id[0] === '§' || id[0] === '"' || id === '' ? JSON.stringify(id) : id);
const idIn = (s) => (s[0] === '"' ? JSON.parse(s) : s);
const colOut = (c) => (/[\t\n\r]/.test(c) || c[0] === 'J' || c === '' ? `J${JSON.stringify(c)}` : c);
const colIn = (s) => (s[0] === 'J' ? JSON.parse(s.slice(1)) : s);

function packMap(name, map) {
  const cols = [];
  const at = new Map();
  const recs = Object.entries(map).filter(([, r]) => isObj(r));
  for (const [, r] of recs) for (const k of Object.keys(r)) if (!at.has(k)) at.set(k, cols.push(k) - 1);
  const lines = [[`§${name}`, ...cols.map(colOut)].join('\t')];
  for (const [id, r] of recs) {
    const cells = new Array(cols.length).fill('');
    for (const [k, v] of Object.entries(r)) cells[at.get(k)] = cell(v);
    let n = cells.length;
    while (n && cells[n - 1] === '') n--;
    lines.push([idOut(id), ...cells.slice(0, n)].join('\t'));
  }
  return lines.join('\n');
}

function unpackRows(text) {
  const maps = {};
  let cols = null;
  let map = null;
  for (const line of text.split('\n')) {
    if (!line) continue;
    const parts = line.split('\t');
    if (parts[0][0] === '§') {
      map = maps[parts[0].slice(1)] = {};
      cols = parts.slice(1).map(colIn);
      continue;
    }
    if (!map) throw new Error('Row before section');
    const rec = {};
    for (let i = 1; i < parts.length; i++) {
      const v = uncell(parts[i]);
      if (v !== undefined && cols[i - 1] != null) rec[cols[i - 1]] = v;
    }
    map[idIn(parts[0])] = rec;
  }
  return maps;
}

/** Save data → Firestore fields { v, data, rows, t }. */
export function encodeSave(save, t = Date.now()) {
  const rest = {};
  const sections = [];
  for (const [k, v] of Object.entries(save)) {
    if (LOCAL_ONLY.includes(k) || v === undefined || typeof v === 'function') continue;
    if (RECORD_MAPS.includes(k) && isObj(v)) sections.push(packMap(k, v));
    else rest[k] = v;
  }
  return { v: FORMAT, data: JSON.stringify(rest), rows: sections.join('\n'), t: Math.round(t) || 0 };
}

/**
 * Firestore fields → { save, t }. Throws if the document is malformed or written by a newer
 * format this build cannot read — the caller must then leave the cloud copy alone.
 */
export function decodeSave(doc) {
  if (!isObj(doc) || typeof doc.data !== 'string') throw new Error('Not a save document');
  if (doc.v !== FORMAT) throw new Error(`Save format ${doc.v} is newer than this build`);
  const save = JSON.parse(doc.data);
  if (!isObj(save)) throw new Error('Save data is not an object');
  Object.assign(save, unpackRows(typeof doc.rows === 'string' ? doc.rows : ''));
  return { save, t: typeof doc.t === 'number' ? doc.t : 0 };
}

/** Bytes Firestore counts for the encoded fields (UTF-8 + 1 per string, field names, numbers). */
export function encodedSize(fields) {
  let n = 32;
  for (const [k, v] of Object.entries(fields)) n += k.length + 1 + (typeof v === 'string' ? new TextEncoder().encode(v).length + 1 : 8);
  return n;
}
