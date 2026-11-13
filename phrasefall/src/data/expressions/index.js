/**
 * Expression database.
 *
 * Every file in ./stageN/ is picked up automatically and its expressions belong
 * to stage N. To add content, append to a file or drop a new file into a stage
 * folder, then run `npm run check:data`. Schema and style: dev/EXPRESSION_GUIDE.md.
 *
 * The files are loaded on demand: each one is its own chunk, fetched in parallel
 * by `loadExpressions()` (main.js starts it at the very beginning of boot, next
 * to the WebGL setup). Until it resolves the exports below are empty, so code
 * that needs the data waits for `whenExpressionsReady()` or checks
 * `expressionsReady()` first. The exports are live bindings filled in place:
 * `BY_STAGE`, `EXPRESSIONS` and `getExpression` keep their identity, and
 * `TOTAL_EXPRESSIONS` reads the real count once loaded (read it when you render,
 * not when a module is created).
 */
import { STAGES } from '../stages.js';

/** path → () => Promise<expression[]>; one lazily loaded chunk per file. */
const loaders = import.meta.glob('./stage*/*.js', { import: 'default' });

/** Expressions per stage (index 0 = stage 1), each tagged with stage and level. Filled once loaded. */
export const BY_STAGE = STAGES.map(() => []);

/** Every expression in the game. Filled once loaded. */
export const EXPRESSIONS = [];

/** Number of expressions in the game; 0 until loaded (live binding). */
export let TOTAL_EXPRESSIONS = 0;

const byId = new Map();
export const getExpression = (id) => byId.get(id);

let ready = false;
let loading = null;

/** True once every stage file has arrived. */
export const expressionsReady = () => ready;

/**
 * Fetch every stage file (in parallel) and fill the exports. Memoised: every
 * caller shares one promise. If a file fails to arrive (say the connection
 * drops) the promise rejects and the next call tries again.
 */
export function loadExpressions() {
  if (ready) return Promise.resolve(EXPRESSIONS);
  if (loading) return loading;
  const paths = Object.keys(loaders).sort();
  loading = Promise.all(paths.map((p) => loaders[p]()))
    .then((lists) => {
      paths.forEach((path, i) => {
        const n = Number(path.match(/stage(\d+)\//)?.[1]);
        const list = lists[i];
        if (!n || n > BY_STAGE.length || !Array.isArray(list)) return;
        for (const e of list) BY_STAGE[n - 1].push({ ...e, stage: n, level: e.level ?? 1 });
      });
      for (const e of BY_STAGE.flat()) {
        EXPRESSIONS.push(e);
        byId.set(e.id, e);
      }
      TOTAL_EXPRESSIONS = EXPRESSIONS.length;
      ready = true;
      return EXPRESSIONS;
    })
    .catch((err) => {
      loading = null;
      throw err;
    });
  return loading;
}

/** Resolves (with every expression) once the database is loaded; starts loading if needed. */
export const whenExpressionsReady = loadExpressions;

export const TYPE_LABELS = {
  everyday: 'Everyday',
  phrasal: 'Phrasal verb',
  idiom: 'Idiom',
  'set-phrase': 'Set phrase',
  collocation: 'Collocation',
  advanced: 'Advanced',
};
