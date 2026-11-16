/**
 * Situations: short comic-strip conversations, one file per place (home, london, newyork,
 * sydney). Loaded on demand the first time the Situations screen opens. Schema and style:
 * dev/SITUATIONS_GUIDE.md; check with `node scripts/check-situations.mjs`.
 */
import { PLACES } from '../places.js';

const loaders = import.meta.glob(['./*.js', '!./index.js'], { import: 'default' });

/** The order places appear in (the journey's order). */
export const PLACE_ORDER = PLACES.map((p) => p.id);

let all = null;
let loading = null;

/** Every situation, in place order then level: resolves once loaded (memoised). */
export function loadSituations() {
  if (all) return Promise.resolve(all);
  loading ??= Promise.all(Object.entries(loaders).map(([path, load]) => load().then((list) => (Array.isArray(list) ? list : []))))
    .then((lists) => {
      const rank = (p) => (PLACE_ORDER.indexOf(p) + 1 || 99);
      all = lists.flat().sort((a, b) => rank(a.place) - rank(b.place) || a.level - b.level);
      return all;
    })
    .catch((err) => {
      loading = null;
      throw err;
    });
  return loading;
}
