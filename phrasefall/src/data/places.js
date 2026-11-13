/**
 * Places the island travels to as the player levels up. Cosmetic only: the
 * scenery for each lives in src/world/places/. `level` is the player level
 * that unlocks it; the player can switch between unlocked places at any time.
 */
export const PLACES = [
  { id: 'home', name: 'Home Island', where: 'Above the clouds', level: 1, color: '#58c46a', blurb: 'Blossom, lanterns and a sky full of floating islands.' },
  { id: 'london', name: 'London', where: 'England', level: 3, color: '#e5484d', blurb: 'Red buses, black cabs and a clock tower that never sleeps.' },
  { id: 'newyork', name: 'New York', where: 'USA', level: 10, color: '#f5b400', blurb: 'Yellow cabs, water towers and a skyline that lights up at night.' },
  { id: 'sydney', name: 'Sydney', where: 'Australia', level: 20, color: '#1fb6c9', blurb: 'Golden sand, surfboards and a harbour full of sails.' },
];

export const getPlace = (id) => PLACES.find((p) => p.id === id) ?? PLACES[0];

/** Places open to a player of `level`, in journey order. */
export const placesForLevel = (level) => PLACES.filter((p) => p.level <= level);

/** The next place still locked at `level`, or null when the journey is complete. */
export const nextPlace = (level) => PLACES.find((p) => p.level > level) ?? null;
