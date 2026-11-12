/**
 * Expression database.
 *
 * Each stage file exports an array of expressions (schema: scripts/check-expressions.mjs).
 * To add content, append objects to a stage file — or add a new stage file, import it
 * here and add it to BY_STAGE. Nothing else in the game needs to change.
 */
import stage1 from './stage1.js';
import stage2 from './stage2.js';
import stage3 from './stage3.js';
import stage4 from './stage4.js';
import stage5 from './stage5.js';

export const BY_STAGE = [stage1, stage2, stage3, stage4, stage5];

/** Every expression, tagged with its stage number (1-based). */
export const EXPRESSIONS = BY_STAGE.flatMap((list, i) => list.map((e) => ({ ...e, stage: i + 1 })));

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
