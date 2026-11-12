/**
 * Stage progression. Each stage has its own vocabulary, time of day and pace.
 *
 *   fall   seconds an expression takes to reach the character at the start of the stage
 *   floor  fastest it gets within the stage
 *   step   seconds shaved off after every correct answer
 *   goal   correct answers needed to clear the stage (the last stage is endless)
 */
export const STAGES = [
  { n: 1, name: 'Everyday Expressions', short: 'Everyday', theme: 'sunrise', fall: 11.5, floor: 10, step: 0.18, goal: 8 },
  { n: 2, name: 'Phrasal Verbs', short: 'Phrasal Verbs', theme: 'midday', fall: 10.5, floor: 9, step: 0.18, goal: 8 },
  { n: 3, name: 'Idioms', short: 'Idioms', theme: 'golden', fall: 9.6, floor: 8.2, step: 0.17, goal: 8 },
  { n: 4, name: 'Set Phrases', short: 'Set Phrases', theme: 'twilight', fall: 8.8, floor: 7.4, step: 0.16, goal: 8 },
  { n: 5, name: 'Advanced Expressions', short: 'Advanced', theme: 'starlight', fall: 8.0, floor: 5.2, step: 0.09, goal: Infinity },
];

/** Player-selectable pace (Settings → Fall speed). Multiplies every fall time. */
export const PACE = {
  relaxed: { label: 'Relaxed', factor: 1.4 },
  standard: { label: 'Standard', factor: 1 },
  fast: { label: 'Fast', factor: 0.78 },
};

export const SCORING = {
  correct: 100,
  streak5: 250,
  streak10: 500,
  lives: 3,
};

/** Bonus awarded for reaching `streak` (0 if none). Every 10th is the big one. */
export function streakBonus(streak) {
  if (streak > 0 && streak % 10 === 0) return SCORING.streak10;
  if (streak > 0 && streak % 5 === 0) return SCORING.streak5;
  return 0;
}
