# Phrasefall expression guide

How to write expressions for the Phrasefall database: British English idioms,
phrasal verbs, set phrases, everyday expressions and collocations.

## How an expression is used

1. **In play** the `text` falls from the sky on a card (one or two lines). The
   player has a few seconds to pick its meaning from four buttons: `meaning`
   plus the three `distractors`, shuffled. Buttons are small, so options must be
   short, plain and quick to read.
2. **Afterwards** it becomes a flashcard showing every field: meaning, example,
   synonyms, register, context and a common mistake. This is where the learning
   happens, so these fields must be accurate and genuinely useful.

## Files

Every `*.js` file in `src/data/expressions/stageN/` is loaded automatically and
belongs to stage N. Each file is an ES module whose default export is an array:

```js
/** Stage 3 — Idioms: body parts. Schema: dev/EXPRESSION_GUIDE.md */
export default [
  {
    id: 'keep-an-eye-on',
    text: 'keep an eye on',
    type: 'idiom',
    level: 1,
    meaning: 'watch or look after something carefully',
    distractors: ['stare at someone rudely', 'ignore a problem on purpose', 'check your eyesight regularly'],
    example: 'Could you keep an eye on my bag while I grab a coffee?',
    synonyms: ['watch over', 'mind'],
    register: 'Neutral',
    context: 'Very common for minding belongings, children or pets, and for monitoring a situation at work.',
    mistake: 'Use "an eye", not "the eye" or "my eye": "keep an eye on the kids".',
  },
];
```

## Fields

| field | rule |
|---|---|
| `id` | kebab-case slug of the text, unique across the whole database (`keep-an-eye-on`) |
| `text` | the expression as shown on the card. Max 34 characters. Lower case unless it is a full utterance with "I" or a proper noun. Base form, no "to". Include `someone`/`something` only when the object is part of the fixed phrase (`pull someone's leg`) |
| `type` | stage 1 `everyday`, stage 2 `phrasal`, stage 3 `idiom`, stage 4 `set-phrase`, stage 5 `collocation` or `advanced` |
| `level` | 1, 2 or 3 — see below |
| `meaning` | the correct answer. Max 56 characters, ideally 20–45. No full stop. Plain words a B1 learner knows. Must not reuse the key words of the expression |
| `distractors` | exactly 3 wrong answers, same grammar and similar length as the meaning, max 56 characters, no full stop |
| `example` | one natural, modern British sentence or mini-dialogue that uses the expression, max 120 characters |
| `synonyms` | 1–3 short alternatives (plain paraphrases or equivalent expressions) |
| `register` | exactly one of `Very informal`, `Informal`, `Neutral`, `Formal` |
| `context` | when, where and with whom it is used, max 140 characters |
| `mistake` | one real learner error (wrong word, preposition, pattern, false friend, American form, literal misreading), max 150 characters |

Strings with apostrophes: use double quotes (`"it's"`) or escape them.

## Levels

`level` places an expression inside its stage. New players mostly see level 1;
levels 2 and 3 appear as they discover more of the stage.

- **1 — core:** among the most frequent expressions of this kind; a learner meets them every week.
- **2 — common:** well known to fluent speakers, used regularly.
- **3 — less common:** harder or more specialised, but still natural and current (never archaic).

Aim for roughly 35% level 1, 40% level 2, 25% level 3 in each file.

## Quality bar

- **Accuracy first.** If you are not sure of an expression's exact meaning,
  form or register in British English, choose another one.
- **British English** spelling and forms (`beat about the bush`, `on second thoughts`,
  `a storm in a teacup`). Examples set in British life: trains, the pub, school, the office, football, the weather.
- **Distractors** must be tempting to someone guessing — a literal reading of the
  words, the meaning of a similar expression, the opposite — but clearly wrong to
  someone who knows it. None may be a near-synonym of the meaning, another real
  meaning of the same expression, or arguably correct in some context.
- **Never give the answer away:** the meaning must not be longer, more detailed
  or more "dictionary-like" than the distractors, and must not repeat the expression's words.
- **One entry per expression.** Pick the most common sense of a phrasal verb.
  Variants of the same expression count as the same (`a piece of cake` = `piece of cake`).
- **Suitable for all ages:** no swearing, sexual or drug references or slurs. Mild British slang is fine.

## Who writes what

Each file has an owner. An expression belongs to exactly one file; when it could
fit several, the rule in the table decides.

| file | contents |
|---|---|
| `stage1/core.js` … `stage5/core.js` | the original 30 per stage — read only |
| `stage1/social.js` | everyday expressions for social life and getting things done: greetings, goodbyes, thanks, apologies, requests, offers, invitations, plans, hospitality, shops, cafés and pubs, phone and messages, travel, time, wishes |
| `stage1/reactions.js` | everyday expressions that react or give a view: exclamations, feelings and states, opinions, agreeing and disagreeing, surprise, sympathy, encouragement, complaints, emphasis, hesitation |
| `stage2/up.js` | phrasal verbs whose first particle is **up** (`come up with`) |
| `stage2/out.js` | first particle **out** (`run out of`) |
| `stage2/off-down.js` | first particle **off** or **down** (`cut down on`) |
| `stage2/on-in.js` | first particle **on**, **in** or **into** (`get on with`) |
| `stage2/other-particles.js` | every other particle: over, through, round/around, about, back, away, across, along, after, for, with, forward, ahead, apart, by, behind, together, against, under, past, without … |
| `stage3/*.js` | idioms. Decide by the **first** rule that matches: |
| `stage3/body.js` | 1. contains a body-part word (head, face, eye, ear, nose, mouth, lip, tongue, tooth, chin, cheek, neck, throat, shoulder, arm, elbow, hand, finger, thumb, chest, heart, stomach, back, leg, knee, foot, toe, heel, skin, bone, blood, hair, brain) |
| `stage3/animals.js` | 2. contains an animal, bird, fish or insect word |
| `stage3/food-colour-number.js` | 3. contains a food or drink word, a colour, or a number/ordinal/fraction |
| `stage3/nature-time-home.js` | 4. contains a weather or nature word (rain, sun, wind, cloud, ice, fire, water, sea, tree, flower, earth, rock, sky, moon, star …), a time word (time, day, night, hour, minute, week, year, clock), or a household object (house, door, wall, roof, table, chair, bed, pot, kettle, nail, hammer, rope, box, bag …) |
| `stage3/life-work-play.js` | 5. everything else: money, work and business, sport and games, travel and transport, clothes, music and the arts, school, people and relationships |
| `stage4/pairs-similes.js` | binomials and trinomials (`bits and bobs`, `sink or swim`, `lock, stock and barrel`, `slowly but surely`) and fixed `as … as …` similes (`as fit as a fiddle`) |
| `stage4/discourse.js` | discourse markers, fixed adverbial and prepositional phrases and sentence frames that organise speech and writing (`as a matter of fact`, `on the whole`, `by heart`, `for good`, `if need be`) |
| `stage5/collocations.js` | C1–C2 collocations: verb + noun (`allay fears`), adjective + noun (`a glaring error`), adverb + adjective (`bitterly disappointed`), fixed noun phrases (`a vicious circle`) |
| `stage5/advanced.js` | C1–C2 idioms and expressions, often literary, formal or distinctly British (`a curate's egg`, `beyond the pale`, `a busman's holiday`) |

Stage 3 is for idioms a B2 learner commonly meets in films, TV and conversation;
rarer, literary or formal idioms belong in `stage5/advanced.js`. Binomials and
`as … as …` similes are never stage 3.

## Workflow

1. Read this guide and the `core.js` of your stage to see the style and what already exists.
2. Plan your headwords. Check anything that might already exist:
   `node scripts/check-expressions.mjs --find <word> [<word>…]`
3. Write in batches of about 40 entries. Create the file with the first batch,
   then append each next batch by replacing the final `];` with the new entries
   followed by `];`. Keep the file valid JavaScript at all times — other people's
   tools load every file.
4. After each batch run `node scripts/check-expressions.mjs <your file>` and fix
   every ✗. "same expression as … in another file" means someone already has it:
   replace yours with a different expression. Check each ⚠ warning too.
5. At the target count, review the whole file once more: meaning accurate?
   any distractor arguably right? answer given away? British form? natural example?
   Fix and validate again.

Run `node scripts/check-expressions.mjs --stats` for counts per stage, file and level.
