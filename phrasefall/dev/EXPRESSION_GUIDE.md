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
| `id` | kebab-case slug of the text (hint included: `pick-up-a-language`), unique across the whole database. Never change an existing id: players' progress is stored under it |
| `text` | the expression as shown on the card. Max 34 characters. Lower case unless it is a full utterance with "I" or a proper noun. Base form, no "to". Include `someone`/`something` only when the object is part of the fixed phrase (`pull someone's leg`). May end with a sense hint in brackets — see "One entry per meaning" |
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
- **One entry per meaning.** Variants of the same expression count as the same
  (`a piece of cake` = `piece of cake`). A phrase with several common meanings —
  above all the everyday phrasal verbs — gets one entry per meaning, each with a
  **sense hint** in brackets at the end of `text`: `pick up (a language)`,
  `pick up (the phone)`, `take off (a plane)`. The hint names the typical object,
  subject or situation in 1–3 words (max 18 characters) and never gives the meaning
  away. Once a phrase has two meanings, every one of them needs a hint; the
  validator warns until they do. On the card the hint is drawn as a smaller line
  under the phrase. All four options must make sense with the hint.
- **Suitable for all ages:** no swearing, sexual or drug references or slurs. Mild British slang is fine.

## Where expressions come from

The database is the player's own British English phrasebook: a tutor's list of
set phrases, idioms, phrasal verbs and everyday chunks, each with a meaning and an
example, turned into game entries (meaning, distractors, synonyms, register,
context and a common mistake). The book's examples often came from private
chats, so the game's examples are rewritten wherever they named real people.

| file | contents |
|---|---|
| `stageN/book-1.js` … `stageN/book-8.js` | the phrasebook, in book order, split into eight batches; within a batch each expression goes to the stage of its type (below) |
| `stageN/kept.js` | expressions from the earlier database that the Situations and Literal Theatre are built on and the book does not have — read only |
| `stageN/<topic>.js` | anything added later: one file per topic or batch |

Which stage an expression belongs to:

| stage | type | what |
|---|---|---|
| 1 | `everyday` | spoken chunks, replies, reactions, exclamations, greetings, banter and slang words, the pub, the phone, agreeing and disagreeing, complaining, apologising, sympathising, spoken hedges and conversation glue |
| 2 | `phrasal` | phrasal and prepositional verbs |
| 3 | `idiom` | figurative idioms a B2 learner meets in conversation and on TV |
| 4 | `set-phrase` | fixed prepositional and adverbial phrases, binomials, `as … as` and `like …` similes, sentence frames, written hedges and discourse markers, common sayings |
| 5 | `collocation`, `advanced` | natural word partnerships; rarer, literary, formal or distinctly British idioms and proverbs |

Every expression belongs to exactly one file. Sticker-album sets (`src/data/sets.js`),
Situations and Literal Theatre refer to expressions by `id`, so never rename an id.

## Workflow

1. Read this guide and a `book-*.js` file of your stage to see the style and what already exists.
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
