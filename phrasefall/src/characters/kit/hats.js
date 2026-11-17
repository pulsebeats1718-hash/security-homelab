/** Hats for every character (sticker album rewards) — placeholder while they are being built. */
export const HATS = [
  { id: 'top-hat', name: 'Top hat' },
  { id: 'party', name: 'Party hat' },
  { id: 'flowers', name: 'Flower crown' },
  { id: 'beanie', name: 'Woolly hat' },
  { id: 'straw', name: 'Straw hat' },
  { id: 'crown', name: 'Crown' },
  { id: 'grad', name: 'Graduation cap' },
  { id: 'beret', name: 'Beret' },
];
/** Put hat `id` on a character rig (null removes it). Returns false if this character can't wear it. */
export function setHat() {
  return false;
}
