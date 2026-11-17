/**
 * The sticker album: themed sets of expressions (src/data/sets.js). A set is complete once
 * every expression in it has been mastered at least once (it has a flower in the memory
 * garden, so progress never goes backwards). Completing one earns its sticker and a reward:
 * a hat every character can wear (src/characters/kit/hats.js) or a decoration for the
 * garden (src/world/decor.js).
 *
 * save.data.album = { [setId]: completedAtMs }   save.data.look = { hat: id | null }
 * Emits 'album:complete' { set } once per set.
 */
import { SETS } from '../data/sets.js';
import { HATS } from '../characters/kit/hats.js';
import { DECOR } from '../world/decor.js';

/** Each set's reward: eight hats and eight garden decorations. */
export const REWARDS = {
  weather: { kind: 'decor', id: 'windmill' },
  food: { kind: 'hat', id: 'party' },
  money: { kind: 'hat', id: 'crown' },
  feelings: { kind: 'hat', id: 'flowers' },
  animals: { kind: 'decor', id: 'beehive' },
  work: { kind: 'hat', id: 'top-hat' },
  travel: { kind: 'hat', id: 'straw' },
  time: { kind: 'decor', id: 'sundial' },
  home: { kind: 'decor', id: 'bench' },
  friends: { kind: 'decor', id: 'bunting' },
  learning: { kind: 'hat', id: 'grad' },
  sport: { kind: 'hat', id: 'beanie' },
  health: { kind: 'decor', id: 'birdbath' },
  nature: { kind: 'decor', id: 'fountain' },
  talking: { kind: 'hat', id: 'beret' },
  success: { kind: 'decor', id: 'wishing-well' },
};

/** { kind, id, name, text } for a set's reward. */
export function rewardFor(setId) {
  const r = REWARDS[setId];
  if (!r) return null;
  if (r.kind === 'hat') {
    const hat = HATS.find((x) => x.id === r.id);
    return { ...r, name: hat?.name ?? r.id, text: `a ${(hat?.name ?? r.id).toLowerCase()} for every character` };
  }
  const d = DECOR.find((x) => x.id === r.id);
  return { ...r, name: d?.name ?? r.id, text: `a ${(d?.name ?? r.id).toLowerCase()} for your garden` };
}

/** Progress through one set: { have, total, done, ids: [{ id, state: 'mastered' | 'seen' | 'new' }] }. */
export function setProgress(save, set, planted = new Set(save.plantedIds())) {
  const ids = set.ids.map((id) => ({ id, state: planted.has(id) ? 'mastered' : save.stat(id)?.seen ? 'seen' : 'new' }));
  const have = ids.filter((x) => x.state === 'mastered').length;
  return { have, total: set.ids.length, done: have >= set.ids.length, ids };
}

export function createAlbum(app) {
  const { save, events } = app;
  const store = () => (save.data.album ??= {});
  const look = () => (save.data.look ??= { hat: null });
  const applied = { decor: null, hat: undefined }; // what is on the island now

  const album = {
    /** Every set with its progress and reward. */
    sets() {
      const planted = new Set(save.plantedIds());
      return SETS.map((set) => ({ set, ...setProgress(save, set, planted), reward: rewardFor(set.id), earned: !!store()[set.id] }));
    },
    /** Sets completed since the last check: marks them, unlocks their rewards, announces them. */
    check() {
      const fresh = album.sets().filter((s) => s.done && !s.earned);
      if (!fresh.length) return [];
      for (const s of fresh) store()[s.set.id] = Date.now();
      save.write();
      album.apply();
      for (const s of fresh) {
        events.emit('album:complete', { set: s.set.id });
        app.audio.play('unlock');
        app.ui.toast({ icon: 'sticker', title: `Sticker earned: ${s.set.name}!`, sub: s.reward ? `Your reward: ${s.reward.text}` : 'Every expression mastered', tone: 'gold', ms: 5200 });
      }
      return fresh;
    },
    /** Hats the player has earned. */
    hats() {
      return SETS.filter((s) => store()[s.id] && REWARDS[s.id]?.kind === 'hat').map((s) => REWARDS[s.id].id);
    },
    /** Garden decorations the player has earned. */
    decor() {
      return SETS.filter((s) => store()[s.id] && REWARDS[s.id]?.kind === 'decor').map((s) => REWARDS[s.id].id);
    },
    get hat() {
      const h = look().hat;
      return h && album.hats().includes(h) ? h : null;
    },
    /** Wear an earned hat (null takes it off). */
    wear(id) {
      look().hat = id && album.hats().includes(id) ? id : null;
      save.write();
      album.apply();
    },
    /** Put the earned decorations in the garden and the chosen hat on the character (only what changed). */
    apply() {
      const decor = album.decor();
      const key = decor.join(',');
      if (key !== applied.decor) {
        applied.decor = key;
        app.decor?.set(decor);
      }
      const hat = album.hat;
      if (hat !== applied.hat) {
        applied.hat = hat;
        app.hero.setHat?.(hat);
      }
    },
  };
  return album;
}
