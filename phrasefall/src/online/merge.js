/**
 * Merging two copies of a save — this device's and the cloud's. Pure, no DOM; unit-tested
 * with `node src/online/merge.test.mjs`. The save is treated as data, so fields added
 * later by other modules merge sensibly without changes here:
 *
 *   expr, daily     id → record maps: per id the whole record with the later `t` wins (so
 *                   new per-record fields such as box/due travel with it); for daily records
 *                   a finished attempt beats an unfinished one
 *   totals          counters: the cloud's value plus what this device added since it last
 *                   synced (`base`), so two devices never double count or lose games
 *   arrays          union (unlocked, seenUnlocks, …)
 *   numbers         maximum (best score / streak / stage, version, …)
 *   booleans        or (tutorialDone, …)
 *   objects         merged key by key with these same rules
 *   anything else   (e.g. the selected character) from whichever side changed last
 *   settings        always this device's: volume, graphics and pace are per device
 */
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

export const RECORD_MAPS = ['expr', 'daily'];
export const COUNTERS = ['totals'];
export const LOCAL_ONLY = ['settings'];

/**
 * @param {object} local   this device's save
 * @param {object|null} cloud the cloud save (decoded), or null if there is none
 * @param {{ localNewer?: boolean, base?: object|null }} opts
 *        localNewer  this device changed more recently than the cloud copy (decides plain values)
 *        base        the counters as they were at this device's last sync with this account
 *                    ({ totals: {...} }); null when the local save has never been synced
 *                    (a guest save), in which case all of its counts are new
 */
export function mergeSaves(local, cloud, { localNewer = true, base = null } = {}) {
  if (!isObj(cloud)) return clone(local);
  if (!isObj(local)) return clone(cloud);
  const out = {};
  for (const k of new Set([...Object.keys(local), ...Object.keys(cloud)])) {
    const a = local[k];
    const b = cloud[k];
    if (LOCAL_ONLY.includes(k)) out[k] = a !== undefined ? a : b;
    else if (RECORD_MAPS.includes(k)) out[k] = mergeRecords(a, b);
    else if (COUNTERS.includes(k)) out[k] = mergeCounters(a, b, base ? base[k] ?? {} : null, localNewer);
    else out[k] = mergeValue(a, b, localNewer);
  }
  return clone(out);
}

/** Per id, the record with the later `t` (a finished daily attempt beats an unfinished one). */
export function mergeRecords(a, b) {
  if (!isObj(a)) return isObj(b) ? b : a;
  if (!isObj(b)) return a;
  const out = { ...b };
  for (const [id, ra] of Object.entries(a)) {
    const rb = b[id];
    out[id] = pickRecord(ra, rb);
  }
  return out;
}

function pickRecord(a, b) {
  if (!isObj(b)) return a;
  if (!isObj(a)) return b;
  if (typeof a.done === 'boolean' && typeof b.done === 'boolean' && a.done !== b.done) return a.done ? a : b;
  const ta = typeof a.t === 'number' ? a.t : 0;
  const tb = typeof b.t === 'number' ? b.t : 0;
  if (ta !== tb) return ta > tb ? a : b;
  return (b.seen ?? 0) > (a.seen ?? 0) ? b : a;
}

/** cloud + (local − base); never less than either side. Without a base every local count is new. */
export function mergeCounters(a, b, base, localNewer = true) {
  if (!isObj(a)) return isObj(b) ? b : a;
  if (!isObj(b)) return a;
  const out = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const x = a[k];
    const y = b[k];
    if (typeof x === 'number' && typeof y === 'number') {
      const synced = base && typeof base[k] === 'number' ? base[k] : 0;
      out[k] = Math.max(x, y + Math.max(0, x - synced));
    } else {
      out[k] = mergeValue(x, y, localNewer);
    }
  }
  return out;
}

export function mergeValue(a, b, localNewer = true) {
  if (a === undefined) return b;
  if (b === undefined) return a;
  if (Array.isArray(a) && Array.isArray(b)) {
    const seen = new Set();
    const out = [];
    for (const v of [...a, ...b]) {
      const key = isObj(v) || Array.isArray(v) ? JSON.stringify(v) : `${typeof v}:${v}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push(v);
      }
    }
    return out;
  }
  if (isObj(a) && isObj(b)) {
    const out = {};
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) out[k] = mergeValue(a[k], b[k], localNewer);
    return out;
  }
  if (typeof a === 'number' && typeof b === 'number') return Math.max(a, b);
  if (typeof a === 'boolean' && typeof b === 'boolean') return a || b;
  return localNewer ? a : b;
}

/** The counters to remember as "already in the cloud" after a sync. */
export function countersOf(save) {
  const out = {};
  for (const k of COUNTERS) if (isObj(save?.[k])) out[k] = { ...save[k] };
  return out;
}
