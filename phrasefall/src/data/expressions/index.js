/**
 * Expression database.
 *
 * Every file in ./stageN/ is picked up automatically and its expressions belong
 * to stage N. To add content, append to a file or drop a new file into a stage
 * folder, then run `npm run check:data`. Schema and style: dev/EXPRESSION_GUIDE.md.
 */
import { STAGES } from '../stages.js';

const modules = import.meta.glob('./stage*/*.js', { eager: true, import: 'default' });

/** Expressions per stage (index 0 = stage 1), each tagged with stage and level. */
export const BY_STAGE = STAGES.map(() => []);
for (const path of Object.keys(modules).sort()) {
  const n = Number(path.match(/stage(\d+)\//)?.[1]);
  const list = modules[path];
  if (!n || n > BY_STAGE.length || !Array.isArray(list)) continue;
  for (const e of list) BY_STAGE[n - 1].push({ ...e, stage: n, level: e.level ?? 1 });
}

/** Every expression in the game. */
export const EXPRESSIONS = BY_STAGE.flat();

const byId = new Map(EXPRESSIONS.map((e) => [e.id, e]));
export const getExpression = (id) => byId.get(id);
export const TOTAL_EXPRESSIONS = EXPRESSIONS.length;

export const TYPE_LABELS = {
  everyday: 'Everyday',
  phrasal: 'Phrasal verb',
  idiom: 'Idiom',
  'set-phrase': 'Set phrase',
  collocation: 'Collocation',
  advanced: 'Advanced',
};
