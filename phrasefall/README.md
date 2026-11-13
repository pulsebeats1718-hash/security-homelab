# Phrasefall

A 3D arcade game for learning English expressions. Idioms, phrasal verbs and set
phrases fall from the sky towards your character; pick the right meaning from
four options before they land.

- **Simple to play** – one tap per answer. Three lives. +100 per correct answer,
  bonus points at streaks of 5 and 10.
- **Fever and golden cards** – ten right in a row starts *fever*: the island glows,
  the music speeds up and every answer scores double until the next miss. About
  one classic card in sixteen is *golden* and worth triple points.
- **Five stages** – everyday expressions → phrasal verbs → idioms → set phrases →
  advanced expressions and collocations. Each stage is faster and moves the world
  on through the day, from sunrise to a starlit aurora.
- **39 collectable characters** – real-time 3D, each with its own idle animation
  and reactions. Purely cosmetic. Three are ready from the start; the rest open two
  at a time in 16 tiers, each needing more points in total across all games
  (10,000, then 20,000, 35,000 … up to 1,000,000) *or* more expressions mastered
  (10, 25, 40 … 750), whichever comes first. Four more are only for keeping a daily
  streak of 7, 30, 100 and 365 days. The pace is set in `src/data/roster.js`.
- **Reasons to come back** (`src/game/progress.js`) – everything earns XP towards
  a player level, and levels move the island to new places: London at level 3,
  New York at 10, Sydney at 20 (switch any time from *Your journey*). A **daily
  goal** of 15 right answers (or the daily challenge) keeps a **daily streak**
  going; missing a day uses up a **brolly**, earned every 7 days, before the
  streak ends. **Three daily quests** (easy, medium, hard — the same for everyone
  on a date) open a **reward chest**. After every game the results show what was
  earned and what is close: XP and level, new places, the goal and streak, quest
  progress, the nearest character unlocks and the gap to your best. *Personal Best*
  adds a weekly report.
- **Learning built in** – every expression you meet becomes a flashcard (meaning,
  example, synonyms, register and context, common mistake). *My Collection* tracks
  what you have mastered, got wrong, flagged to practise or marked as a favourite.
- **Spaced repetition** – each expression sits in a Leitner box (0–5): a right
  answer moves it up, a wrong one back to 0, and it is due again after 0, 1, 3, 7,
  16 or 35 days. Flashcards open on *Due today* ("Not yet" / "I knew it"), and
  classic games deal due expressions more often.
- **Daily challenge** – the same 20 cards for everyone each UTC day (seeded from
  the date, mixed across the stages, mostly level 1–2), a small speed bonus, one
  ranked attempt a day (replays are practice) and a shareable emoji result.
- **Installable and offline** – the production build is a PWA (manifest, icons,
  service worker); after the first visit it plays offline.
- **Online, optional** – sign in with Google to keep progress in the cloud across
  devices and join live leaderboards (today's daily challenge, this week, all time).
  Guests play straight away, and their progress comes along when they sign in.
  Runs on Firebase; setup, costs and limits are in [DEPLOY.md](DEPLOY.md).
- **6,037 British English expressions**, chosen to help learners sound natural:
  964 everyday and spoken phrases (including work and message English), 1,706
  phrasal verbs, 1,299 idioms, 700 set phrases, 1,118 collocations and 250 advanced
  idioms. Common phrasal verbs appear once per meaning, each with a short hint on
  the card: "pick up (a language)", "pick up (the phone)". Every expression has
  three plausible wrong answers, an example, synonyms, register, context and a
  common learner mistake, and a difficulty level; harder ones join a stage as the
  player discovers more of it.

## Run it

```bash
npm install
npm run dev            # http://localhost:5173
npm run build          # static site in dist/
npm run build:single   # one self-contained HTML file in dist-single/
npm run check:data     # validate the expression database (see below)
```

Requires Node 18+. The runtime dependencies are [three.js](https://threejs.org) and,
only in builds with a Firebase config (`.env.local`, see [DEPLOY.md](DEPLOY.md)), the
Firebase SDK, fetched on demand; fonts (Fredoka, Nunito — both OFL) are bundled, so the
built game works offline. `node src/online/merge.test.mjs` runs the cloud-save tests and
`node src/game/progress.test.mjs` the level, streak and quest tests.

## Controls

| | |
|---|---|
| Answer | tap / click an option, or keys `1`–`4` / `A`–`D` |
| Pause | pause button, `Esc` or `P` |
| Characters | arrows or swipe the strip; drag the character to turn it |
| Flashcards | tap to flip, swipe or `←` `→` to move, `Space` to flip |

## How it is put together

```
src/
  main.js                 boot and wiring
  core/                   stage (renderer, camera shots, frame loop), save data, events, maths
  data/
    expressions/          stage1/ … stage5/ — the expression database, one folder per stage
    stages.js             pace, goals and scoring rules
    roster.js             character order and unlock rules
    levels.js             XP rewards and the level curve
    places.js             the places the island travels to, and the levels that open them
  characters/
    kit/                  the character construction kit: shared skeleton, toy material, face rig
    animator.js           procedural animation: idle layers, action clips, secondary motion
    models/               one file per character (auto-discovered)
    thumbnails.js         portrait renderer for the collection strip
  world/                  sky, lighting themes, island, clouds, particle effects; places/ (Home, London, New York, Sydney)
  game/                   rules (game.js), the daily challenge (daily.js), levels/streak/quests (progress.js),
                          the falling card, camera framing, the live hero
  audio/                  synthesised sound effects and generative music
  online/                 optional Google sign-in, cloud save and leaderboards (Firebase, loaded on demand)
  ui/                     screens (menu, Today, Your journey, characters, HUD, results, flashcards …), notes
  styles/main.css         the interface look
dev/                      character and world preview pages, character authoring guide
scripts/                  data validator and screenshot helpers used during development
```

Game logic never touches the DOM and the interface never touches the 3D scene:
they talk through a small event bus (`game:question`, `game:answered`,
`game:score`, …), which keeps each part replaceable.

### Add expressions

Every file in `src/data/expressions/stageN/` is loaded automatically and belongs
to stage N (each file becomes its own chunk, downloaded in parallel while the 3D
world starts; screens that need the data wait for `whenExpressionsReady()`).
Append objects to a file, or drop a new file into a stage folder, then
validate. Schema, style rules, levels and which file owns which kind of
expression: `dev/EXPRESSION_GUIDE.md`.

```js
{
  id: 'break-the-ice',
  text: 'break the ice',
  type: 'idiom',                      // everyday | phrasal | idiom | set-phrase | collocation | advanced
  level: 1,                           // 1 core · 2 common · 3 less common
  meaning: 'help people relax when they first meet',
  distractors: ['…', '…', '…'],       // three plausible wrong answers
  example: 'Sam told a silly joke to break the ice.',
  synonyms: ['put people at ease'],
  register: 'Neutral',                // Very informal | Informal | Neutral | Formal
  context: 'When and where it is used.',
  mistake: 'A common learner error.',
}
```

```bash
node scripts/check-expressions.mjs                 # validate everything
node scripts/check-expressions.mjs <file>          # one file, duplicates checked against all
node scripts/check-expressions.mjs --find ice      # is it already in the game?
node scripts/check-expressions.mjs --stats         # counts per stage, file and level
echo '{ "break-the-ice": { "example": "…" } }' | node scripts/patch-expressions.mjs <file> -
```

The patch tool applies corrections by id and rewrites the file in house style.
The validator rejects duplicates across files, over-long or missing fields, wrong
types for the stage, and answers that give themselves away by being much longer
than the wrong options.

### Add a character

1. Create `src/characters/models/<id>.js` — see `dev/CHARACTER_GUIDE.md` and any
   existing model. A character is ~150–350 lines built from the kit's primitives.
2. Add `{ id, rule }` to `src/data/roster.js` to place it in the collection and
   give it an unlock rule.

Preview while you work at `http://localhost:5173/dev/characters.html?ids=<id>`,
or render a review sheet of eight views (front, back, side, cheer, attack, hit,
KO, locked) with `scripts/sheet.sh <ids> out.png` against the preview server
(`npx vite --config dev/vite.nohmr.config.js`).

### Stages, pace and scoring

All in `src/data/stages.js`: fall time per stage, how much it speeds up per
correct answer, the number of answers that clears a stage, and the points.

## Design notes and honest limits

- **Characters are procedural.** They are genuine lit, shadowed, animated 3D
  models, but assembled in code from soft primitives rather than sculpted and
  rigged in a 3D package. That is what the "designer toy" art direction is built
  around; it keeps the whole game under ~1.5 MB and makes new characters cheap.
  It also means no cloth simulation, fingers or lip-sync.
- **Audio is synthesised** with the Web Audio API — every effect and the music.
  No samples, nothing to license; a composed, recorded soundtrack would be richer.
- **Performance.** One WebGL canvas, ~150 draw calls. Quality presets
  (Auto / High / Medium / Low) plus dynamic resolution keep the frame rate steady
  on phones. Development screenshots were taken with a software renderer, so real
  frame rates were reasoned about rather than measured on physical devices.
- **Progress is saved in the browser** (`localStorage`). Players who sign in also
  get a cloud copy that syncs between devices; a guest's progress is lost if site
  data is cleared.
- **Leaderboard scores come from the player's browser.** The Firestore rules keep
  them within believable bounds, but a determined player could still send a fake
  one; checking games on the server with Cloud Functions is the upgrade path
  (see DEPLOY.md).
- Flashcard pronunciation uses the browser's speech synthesis, so the voice
  depends on the device.
- **Content was written and fact-checked with AI assistance.** Every expression
  went through a separate accuracy review (wrong answers that were really another
  sense, invented "common mistakes", Americanisms, unclear examples), and the
  validator enforces the format. A review by an experienced English teacher is
  still recommended before a commercial release.
