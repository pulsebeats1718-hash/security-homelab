/**
 * Achievements: surprise badges for milestones, to give players long-term goals.
 * src/game/achievements.js unlocks them; src/ui/achievements.js shows them in My Collection.
 *
 *   id      kebab-case and never renamed: saves keep save.data.ach[id] = when it was unlocked
 *   name    fun, at most 24 characters
 *   text    what to do, at most 70 characters; kind and clear for every age
 *   icon    a name from src/ui/icons.js
 *   group   one of GROUPS (the grid shows the groups in that order)
 *   count   what is counted: a measure in src/game/achievements.js (MEASURES)
 *   goal    how many it takes; left out when once is enough
 *   secret  the text stays hidden ("???") until the badge is won; the name is the clue
 *
 * Checked by `node src/game/achievements.test.mjs`.
 */
import { PLACES } from './places.js';

export const GROUPS = ['Playing', 'Streaks', 'Learning', 'Garden', 'Situations & Theatre', 'Friends', 'Explorer', 'Secret'];

/** The level that opens the last place on the journey (Sydney). */
const LAST_PLACE_LEVEL = Math.max(...PLACES.map((p) => p.level));

export const ACHIEVEMENTS = [
  // ── Playing ─────────────────────────────────────────────────────────────
  { id: 'first-steps', name: 'First steps', text: 'Finish your first game', icon: 'play', group: 'Playing', count: 'games' },
  { id: 'ten-game-test', name: 'Ten-game test', text: 'Finish 10 games', icon: 'repeat', group: 'Playing', count: 'games', goal: 10 },
  { id: 'on-fire', name: 'On fire', text: 'Get 10 right in a row to start fever mode', icon: 'bolt', group: 'Playing', count: 'bestStreak', goal: 10 },
  { id: 'golden-touch', name: 'Golden touch', text: 'Catch 10 golden cards', icon: 'coin', group: 'Playing', count: 'golden', goal: 10 },
  { id: 'unstoppable', name: 'Unstoppable', text: 'Reach a ×20 streak in one game', icon: 'gauge', group: 'Playing', count: 'bestStreak', goal: 20 },
  { id: 'twister', name: 'Twister', text: 'Get 50 twist cards right', icon: 'layers', group: 'Playing', count: 'twists', goal: 50 },
  { id: 'perfect-daily', name: 'Perfect daily', text: 'Get all 20 right on your first go at a daily challenge', icon: 'target', group: 'Playing', count: 'perfectDailies' },
  { id: 'silver-lining', name: 'Silver lining', text: 'Beat your first boss storm cloud', icon: 'cloud', group: 'Playing', count: 'bosses' },
  { id: 'storm-chaser', name: 'Storm chaser', text: 'Beat 5 boss storm clouds', icon: 'wind', group: 'Playing', count: 'bosses', goal: 5 },
  { id: 'power-player', name: 'Power player', text: 'Use 10 power-ups', icon: 'shield', group: 'Playing', count: 'powersUsed', goal: 10 },

  // ── Streaks ─────────────────────────────────────────────────────────────
  { id: 'hat-trick', name: 'Hat-trick', text: 'Reach your daily goal three days in a row', icon: 'hat', group: 'Streaks', count: 'streakDays', goal: 3 },
  { id: 'creature-of-habit', name: 'Creature of habit', text: 'Keep a daily streak going for 7 days', icon: 'flame', group: 'Streaks', count: 'streakDays', goal: 7 },
  { id: 'month-of-sundays', name: 'Month of Sundays', text: 'Keep a daily streak going for 30 days', icon: 'calendar', group: 'Streaks', count: 'streakDays', goal: 30 },

  // ── Learning ────────────────────────────────────────────────────────────
  { id: 'wordsmith', name: 'Wordsmith', text: 'Master 100 expressions', icon: 'book', group: 'Learning', count: 'mastered', goal: 100 },
  { id: 'second-time-lucky', name: 'Second time lucky', text: 'Put 20 expressions right in second chances', icon: 'refresh', group: 'Learning', count: 'secondChances', goal: 20 },
  { id: 'bookworm', name: 'Bookworm', text: 'Review 100 flashcards', icon: 'cards', group: 'Learning', count: 'reviews', goal: 100 },

  // ── Garden ──────────────────────────────────────────────────────────────
  { id: 'budding-gardener', name: 'Budding gardener', text: 'Grow the first flower in your memory garden', icon: 'leaf', group: 'Garden', count: 'flowers' },
  { id: 'green-fingers', name: 'Green fingers', text: 'Grow 50 flowers in your memory garden', icon: 'flower', group: 'Garden', count: 'flowers', goal: 50 },
  { id: 'rain-maker', name: 'Rain maker', text: 'Water 50 thirsty flowers', icon: 'drop', group: 'Garden', count: 'watered', goal: 50 },

  // ── Situations & Theatre ────────────────────────────────────────────────
  { id: 'chatterbox', name: 'Chatterbox', text: 'Finish 10 different situations', icon: 'chat', group: 'Situations & Theatre', count: 'situations', goal: 10 },
  { id: 'spot-on', name: 'Spot on', text: 'Get every reply right first time in a situation', icon: 'check', group: 'Situations & Theatre', count: 'perfectTalks' },
  { id: 'globetrotter', name: 'Globetrotter', text: 'Finish a situation in every place on your journey', icon: 'map', group: 'Situations & Theatre', count: 'talkPlaces', goal: PLACES.length },
  { id: 'showstopper', name: 'Showstopper', text: 'Get everything right in a Literal Theatre round', icon: 'masks', group: 'Situations & Theatre', count: 'perfectShows' },

  // ── Friends ─────────────────────────────────────────────────────────────
  { id: 'challenger', name: 'Challenger', text: 'Send a friend a challenge', icon: 'share', group: 'Friends', count: 'challenges' },
  { id: 'champion', name: 'Champion', text: 'Win a challenge a friend sent you', icon: 'medal', group: 'Friends', count: 'challengesWon' },
  { id: 'party-animal', name: 'Party animal', text: 'Finish a party game', icon: 'friends', group: 'Friends', count: 'parties' },

  // ── Explorer ────────────────────────────────────────────────────────────
  { id: 'rising-star', name: 'Rising star', text: 'Reach level 10', icon: 'star', group: 'Explorer', count: 'level', goal: 10 },
  { id: 'jet-setter', name: 'Jet-setter', text: `Reach level ${LAST_PLACE_LEVEL} and open every place on your journey`, icon: 'plane', group: 'Explorer', count: 'level', goal: LAST_PLACE_LEVEL },
  { id: 'treasure-hunter', name: 'Treasure hunter', text: 'Discover 500 different expressions', icon: 'sparkle', group: 'Explorer', count: 'discovered', goal: 500 },
  { id: 'sticker-collector', name: 'Sticker collector', text: 'Complete a set in your sticker album', icon: 'sticker', group: 'Explorer', count: 'setsDone' },

  // ── Secret ──────────────────────────────────────────────────────────────
  { id: 'night-owl', name: 'Night owl', text: 'Finish a game between 10\u00a0pm and 4\u00a0am', icon: 'clock', group: 'Secret', count: 'nightGames', secret: true },
  { id: 'early-bird', name: 'Early bird', text: 'Finish a game between 5 and 8 in the morning', icon: 'sun', group: 'Secret', count: 'earlyGames', secret: true },
  { id: 'weekend-warrior', name: 'Weekend warrior', text: 'Finish games on both days of a weekend', icon: 'ball', group: 'Secret', count: 'weekends', secret: true },
  { id: 'jackpot', name: 'Jackpot!', text: 'Catch a golden card in fever mode', icon: 'chest', group: 'Secret', count: 'jackpots', secret: true },
];

export const getAchievement = (id) => ACHIEVEMENTS.find((a) => a.id === id) ?? null;
