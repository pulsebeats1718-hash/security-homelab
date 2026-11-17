# Phrasefall

A 3D arcade game for learning English expressions. Idioms, phrasal verbs and set
phrases fall from the sky towards your character; pick the right meaning from
four options before they land.

- **Simple to play** – one tap per answer. Three lives. +100 per correct answer,
  bonus points at streaks of 5 and 10.
- **Ways to play** – *Play* (classic, endless), the *daily challenge*, *Relax* (no
  lives and no clock: slow cards, an *Example* button that holds the card while you
  read, finish when you like), *Challenge a friend* (20 cards from a seed; the link
  carries your score, your friend plays exactly the same cards and both results show
  side by side, no server involved; `src/game/duel.js`), *Party* (pass-and-play for 2–4
  people on one phone: names and characters, 5 or 10 cards each, everyone gets the same
  cards, a pass screen between turns and a scoreboard; party games never count towards
  the phone owner's progress; `src/ui/screens/party.js`) and *Second chance* (straight
  after a game, the expressions you missed fall again, slowly, with no lives to lose;
  one missed again comes back once more).
- **Boss storm clouds** (`src/world/boss.js`) – at the end of each stage of a classic game
  a grumpy storm cloud rolls in (Grumble, Drizzle, Thunderbumble, Gloomsby, The Great
  Muddle) and throws a quick volley of four cards from the stage, a little faster. Hit it
  three times and it cheers up, turns white and floats away: +150 × the stage and a
  power-up (two from stage 3). In the endless final stage a boss comes back every 12
  right answers.
- **Power-ups** (`src/game/powers.js`) – kept between classic games (up to 9 of each):
  *Shield* (the next miss costs no life), *Slow-mo* (the next three cards fall 1.7×
  slower), *50/50* (two wrong answers vanish) and *Hint* (shows the example). One of each
  to start; more drop from golden cards, now and then from a right answer, and from bosses.
- **Sticker album** (`src/data/sets.js`, `src/game/album.js`) – 16 themed sets of 16
  well-known expressions (weather, food, money, feelings, animals …) under *My Collection →
  Stickers*. Master every expression in a set to earn its sticker and a reward: a hat that
  every character can wear (`src/characters/kit/hats.js`) or a decoration for the memory
  garden (`src/world/decor.js`). Any set can be practised on its own (relax mode dealing
  only that set's cards). Check the sets with `node scripts/check-sets.mjs`.
- **Achievements** (`src/data/achievements.js`, `src/game/achievements.js`) – 34 badges in
  eight groups (playing, streaks, learning, garden, Situations & Theatre, friends, explorer,
  and four secret ones) under *My Collection → Badges*, each with a progress bar. They
  unlock from game events and from what the save already records, so a returning player
  gets the ones already earned; party games, second chances and watering rounds don't
  count as games.
- **Memory garden** (`src/world/garden.js`, `src/game/garden.js`) – every expression you
  master plants a flower on the island: daisies for everyday phrases, tulips for phrasal
  verbs, sunflowers for idioms, bluebells for set phrases, lavender for collocations, roses
  for advanced expressions. When an expression is due for review its flower droops and
  fades; the garden chip on the menu starts a quick *watering* round (up to ten, like a
  second chance) and each one put right stands up again. Flowers keep their spot in each
  place and grow outwards from the dais, clear of the place's buildings, streets and water.
- **Situations** (`src/ui/screens/talk.js`, content in `src/data/situations/`) – comic-strip
  conversations with the characters in each place. At each turn you pick the most natural of
  three expressions; a wrong pick explains what it really means, the right one appears in
  your bubble with a note on why it fits. A reply right first time counts as a right answer
  for that expression. Places open with your level. Writing guide: `dev/SITUATIONS_GUIDE.md`;
  check with `node scripts/check-situations.mjs`.
- **Literal Theatre** (`src/ui/screens/theatre.js`, scenes in `src/world/theatre/`) – the
  island's characters act out 25 idioms word for word (raining cats and dogs, the elephant
  in the room, pigs might fly …) and you guess which idiom it is from four. Rounds of six,
  least-seen first; right first time counts as a right answer for that expression. Its
  door is at the top of *Situations*.
- **Twist cards** (`src/game/twists.js`) – about one card in four that shows an
  expression you have met before asks for it another way: *Flip* (the meaning falls,
  pick the expression), *Fill the gap* (a phrasal verb's example with its particle
  missing; the wrong options are never real phrasal verbs with that verb), *Listen*
  (spoken, not shown) and *Build it* (tap the words in order). +50 points and +5 XP.
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
- **Four seasons** (`src/world/seasons/`, `src/data/seasons.js`) – the world follows the
  player's calendar (meteorological seasons, flipped for southern-hemisphere time
  zones) or a season chosen in Settings: autumn leaves tumbling across the sky,
  winter snow with a snowman, spring flowers and butterflies, and a summer beach
  where every character wears sunglasses and a swim ring
  (`src/characters/kit/summer.js`). Seasons dress every place.
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
  install screenshots, service worker); after the first visit it plays offline. On Android it
  installs from Chrome and opens full screen, and the phone's Back button closes screens and
  pauses games. How to publish it and install it: [ANDROID.md](ANDROID.md).
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
built game works offline. `node src/online/merge.test.mjs` runs the cloud-save tests,
`node src/game/progress.test.mjs` the level, streak and quest tests,
`node src/game/twists.test.mjs` the twist-card and friend-challenge tests and
`node src/game/achievements.test.mjs` the achievement tests.

## Controls

| | |
|---|---|
| Answer | tap / click an option, or keys `1`–`4` / `A`–`D` |
| Build it | tap the words in order, or keys `1`–`6` |
| Listen | *Again* button or `R` to hear it again |
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
  world/                  sky, lighting themes, island, clouds, particle effects, the memory garden and
                          its decorations, boss storm clouds; places/ (Home, London, New York, Sydney),
                          seasons/, theatre/ (Literal Theatre's scenes)
  data/situations/        the Situations, one file per place
  data/sets.js            the sticker album's themed sets
  game/                   rules and modes (game.js), fixed 20-card runs (run.js) for the daily challenge
                          (daily.js) and friend challenges (duel.js), twist cards (twists.js), power-ups
                          (powers.js), the sticker album (album.js), achievements (achievements.js),
                          levels/streak/quests (progress.js), the falling card, camera framing, the live hero
  audio/                  synthesised sound effects and generative music
  online/                 optional Google sign-in, cloud save and leaderboards (Firebase, loaded on demand)
  ui/                     screens (menu, Today, Your journey, characters, HUD, results, flashcards …), notes
  styles/main.css         the interface look
dev/                      character and world preview pages, character authoring guide, app icon (icon/)
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
