/**
 * The memory garden's bookkeeping (the flowers themselves are src/world/garden.js):
 *
 *   planted   every expression mastered at least once grows a flower (save.plantedIds)
 *   thirsty   a planted expression due for spaced-repetition review: its flower droops
 *   wilted    thirsty, and answered wrong last time
 *
 * Watering is a short review round (game mode 'water', like a second chance) with the most
 * overdue thirsty expressions; each one put right stands its flower up again.
 */
import { getExpression, expressionsReady } from '../data/expressions/index.js';
import { Garden, KIND_FOR_TYPE } from '../world/garden.js';

/** At most this many flowers are watered in one round. */
export const WATER_MAX = 10;

/** { plants: [{ id, kind, state }], thirsty: [ids, most overdue first], count } */
export function gardenState(save, now = Date.now()) {
  const plants = [];
  const thirsty = [];
  for (const id of save.plantedIds()) {
    const e = getExpression(id);
    if (!e) continue;
    const due = save.isDue(id, now);
    const state = due ? (save.stat(id).last === 'w' ? 'wilted' : 'thirsty') : 'ok';
    if (due) thirsty.push(id);
    plants.push({ id, kind: KIND_FOR_TYPE[e.type] ?? 'daisy', state });
  }
  thirsty.sort((a, b) => (save.stat(a).due ?? 0) - (save.stat(b).due ?? 0));
  return { plants, thirsty, count: plants.length };
}

/** The garden on the island, kept in step with the save. */
export function createGarden(app) {
  const world = new Garden(app.env, { quality: app.stage.qualityName === 'low' ? 'low' : 'high' });
  const garden = {
    world,
    state: { plants: [], thirsty: [], count: 0 },
    /** Re-read the save and update the flowers. Returns the state (empty until the expressions load). */
    refresh() {
      if (!expressionsReady()) return garden.state;
      garden.state = gardenState(app.save);
      world.setPlants(garden.state.plants);
      return garden.state;
    },
    /** Start a watering round with the thirstiest flowers. */
    water() {
      const ids = garden.state.thirsty.slice(0, WATER_MAX);
      if (ids.length) app.startGame({ mode: 'water', ids });
      return ids.length;
    },
  };
  return garden;
}
