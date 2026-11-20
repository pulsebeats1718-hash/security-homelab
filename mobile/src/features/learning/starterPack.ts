import type { ExpressionEntry } from "./types";

type Starter = Omit<ExpressionEntry, "id" | "savedAt" | "origin" | "practised" | "sessionId">;

/** A small, curated set of everyday British expressions so the bank is useful from day one. */
export const STARTER_EXPRESSIONS: Starter[] = [
  {
    phrase: "call it a day",
    kind: "idiom",
    meaning: "to stop working on something for now",
    example: "We've been at this for hours — shall we call it a day?",
    synonyms: ["wrap it up", "pack it in", "knock off"],
  },
  {
    phrase: "be knackered",
    kind: "expression",
    meaning: "to be extremely tired (informal, very British)",
    example: "I was up at five for my flight, so I'm absolutely knackered.",
    synonyms: ["be shattered", "be exhausted", "be worn out"],
  },
  {
    phrase: "not my cup of tea",
    kind: "idiom",
    meaning: "not something I like or enjoy",
    example: "Horror films aren't really my cup of tea.",
    synonyms: ["not my thing", "not for me", "not my scene"],
  },
  {
    phrase: "catch up (with someone)",
    kind: "phrasal-verb",
    meaning: "to talk to someone you haven't seen for a while and hear their news",
    example: "Let's grab a coffee next week and properly catch up.",
    synonyms: ["have a natter", "touch base", "get together"],
  },
  {
    phrase: "fair enough",
    kind: "expression",
    meaning: "used to accept that what someone said is reasonable",
    example: "“I'd rather stay in tonight.” “Fair enough, maybe Saturday then.”",
    synonyms: ["that's reasonable", "I get that", "point taken"],
  },
  {
    phrase: "put off",
    kind: "phrasal-verb",
    meaning: "to delay doing something, usually because you don't want to do it",
    example: "I keep putting off ringing the dentist.",
    synonyms: ["postpone", "delay", "leave till later"],
  },
  {
    phrase: "make a decision",
    kind: "collocation",
    meaning: "to decide (we say 'make', not 'do' or 'take', in British English)",
    example: "I need to make a decision about the job by Friday.",
    synonyms: ["decide", "make up your mind", "settle on"],
  },
  {
    phrase: "a bit of a nightmare",
    kind: "expression",
    meaning: "quite stressful or difficult (understated in a typically British way)",
    example: "Getting across London during the tube strike was a bit of a nightmare.",
    synonyms: ["a pain", "a hassle", "a faff"],
  },
  {
    phrase: "get the hang of",
    kind: "idiom",
    meaning: "to learn how to do something after some practice",
    example: "Driving on the left is weird at first, but you get the hang of it.",
    synonyms: ["get used to", "pick up", "master"],
  },
  {
    phrase: "on the same page",
    kind: "idiom",
    meaning: "agreeing about or understanding something in the same way",
    example: "Before the meeting, let's make sure we're all on the same page.",
    synonyms: ["in agreement", "of one mind", "aligned"],
  },
  {
    phrase: "fancy (doing something)",
    kind: "expression",
    meaning: "to want to do something (informal British)",
    example: "Do you fancy going for a walk along the canal?",
    synonyms: ["feel like", "want to", "be up for"],
  },
  {
    phrase: "run out of",
    kind: "phrasal-verb",
    meaning: "to use all of something so there's none left",
    example: "We've run out of milk — I'll nip to the shop.",
    synonyms: ["use up", "be out of", "exhaust"],
  },
];

/** Picks today's expression deterministically, preferring ones practised least. */
export function expressionOfTheDay(entries: ExpressionEntry[], now = new Date()): ExpressionEntry | undefined {
  if (!entries.length) return undefined;
  const leastPractised = Math.min(...entries.map((entry) => entry.practised));
  const pool = entries.filter((entry) => entry.practised === leastPractised);
  const day = Math.floor(now.getTime() / 86_400_000);
  return pool[day % pool.length];
}
