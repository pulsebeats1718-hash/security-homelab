/**
 * Literal Theatre — idioms acted out literally on the island (the screen is
 * src/ui/screens/theatre.js, which loads this module on its first visit).
 *
 *   scenes/<expression-id>.js   one scene per idiom (see director.js for the shape)
 *   director.js                 builds a scene, runs and loops it, frames the camera, takes it down
 *   kit.js, actor.js, props.js  what scenes are made of: the stage kit, the actors, shared props
 *
 * Every scene's id is an expression id in the game's database. To add one, drop a module into
 * scenes/ and, if its idiom means nearly the same as another (or looks like another scene), list
 * them together in NEAR so they are never offered against each other.
 */
export { Director } from './director.js';

const modules = import.meta.glob('./scenes/*.js', { eager: true });

/** Every scene, by id. */
export const SCENES = Object.values(modules)
  .map((m) => m.default)
  .filter((d) => d?.id && typeof d.build === 'function')
  .sort((a, b) => a.id.localeCompare(b.id));

export const sceneById = (id) => SCENES.find((d) => d.id === id) ?? null;

/**
 * Idioms that must never be offered as wrong answers for each other: close in meaning, or close
 * enough in the picture (two rainy scenes, two cloudy ones) that a learner could fairly pick either.
 */
const NEAR = [
  // close in meaning
  ['on-cloud-nine', 'over-the-moon', 'i-m-over-the-moon'],
  ['spill-the-beans', 'let-the-cat-out-of-the-bag'],
  ['butterflies-in-your-stomach', 'have-butterflies-in-your-stomach', 'get-cold-feet'],
  ['a-storm-in-a-teacup', 'make-a-mountain-out-of-a-molehill'],
  ['pigs-might-fly', 'once-in-a-blue-moon'],
  ['the-elephant-in-the-room', 'let-sleeping-dogs-lie', 'the-tip-of-the-iceberg'],
  ['bark-up-the-wrong-tree', 'a-red-herring'],
  ['the-early-bird-catches-the-worm', 'an-early-bird'],
  ['all-ears', 'i-m-all-ears'],
  ['under-the-weather', 'ive-been-under-the-weather'],
  ['in-hot-water', 'be-on-thin-ice', 'skate-on-thin-ice'],
  // close in the picture
  ['on-cloud-nine', 'have-your-head-in-the-clouds'],
  ['rain-cats-and-dogs', 'under-the-weather', 'rain-on-someones-parade', 'a-storm-in-a-teacup'],
  ['break-the-ice', 'the-tip-of-the-iceberg', 'get-cold-feet', 'as-cool-as-a-cucumber'],
  ['a-piece-of-cake', 'the-icing-on-the-cake', 'bite-off-more-than-you-can-chew'],
  ['over-the-moon', 'once-in-a-blue-moon'],
  ['a-couch-potato', 'a-hot-potato', 'hit-the-sack', 'hit-the-hay'],
  ['a-fish-out-of-water', 'a-red-herring'],
  ['spill-the-beans', 'cry-over-spilt-milk'],
  ['bark-up-the-wrong-tree', 'let-sleeping-dogs-lie'],
];

const nearMap = new Map();
for (const group of NEAR) {
  for (const id of group) {
    if (!nearMap.has(id)) nearMap.set(id, new Set());
    for (const other of group) if (other !== id) nearMap.get(id).add(other);
  }
}

/** Ids never to offer against `id` (its own scene's `avoid` list included, both ways). */
export function related(id) {
  const out = new Set(nearMap.get(id) ?? []);
  for (const d of SCENES) {
    if (d.id === id) for (const a of d.avoid ?? []) out.add(a);
    else if (d.avoid?.includes(id)) out.add(d.id);
  }
  return [...out];
}

/** Well-known idioms from the database that make good wrong answers now and then. */
export const EXTRA = [
  'cry-over-spilt-milk',
  'out-of-the-woods',
  'in-the-same-boat',
  'the-ball-is-in-your-court',
  'cost-an-arm-and-a-leg',
  'once-in-a-blue-moon',
  'the-last-straw',
  'a-blessing-in-disguise',
  'call-it-a-day',
  'sit-on-the-fence',
  'pull-someones-leg',
  'head-over-heels',
  'hit-the-sack',
  'a-red-herring',
  'cry-wolf',
  'put-all-your-eggs-in-one-basket',
  'get-cold-feet',
  'make-a-mountain-out-of-a-molehill',
  'the-icing-on-the-cake',
  'rain-on-someones-parade',
  'break-a-leg',
  'let-sleeping-dogs-lie',
  'see-eye-to-eye',
];
