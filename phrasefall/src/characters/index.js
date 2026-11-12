/**
 * Character registry.
 *
 * Every file in ./models is picked up automatically. To add a character:
 *   1. create src/characters/models/<id>.js (see fox.js for the shape of a definition);
 *   2. give it a place and an unlock rule in src/data/roster.js.
 * Characters are purely cosmetic — they never change the rules of the game.
 */
import { createKit } from './kit/kit.js';
import { Animator } from './animator.js';
import { ROSTER } from '../data/roster.js';

const modules = import.meta.glob('./models/*.js', { eager: true });
const defs = new Map();
for (const mod of Object.values(modules)) {
  const def = mod.default;
  if (def?.id && typeof def.build === 'function') defs.set(def.id, def);
}

const order = new Map(ROSTER.map((r, i) => [r.id, i]));
/** All characters in collection order (roster order first, then any extras). */
export const CHARACTERS = [...defs.values()].sort((a, b) => (order.get(a.id) ?? 999) - (order.get(b.id) ?? 999));

export const getCharacter = (id) => defs.get(id) ?? CHARACTERS[0];

/** Build a live, animatable instance of a character. */
export function createCharacter(id) {
  const def = getCharacter(id);
  const k = createKit();
  const rig = def.build(k) ?? k.rig;
  rig.captureRest();
  rig.root.name = `character:${def.id}`;
  const animator = new Animator(rig, def);
  return { def, rig, animator };
}
