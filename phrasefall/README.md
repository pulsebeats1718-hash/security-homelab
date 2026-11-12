# Phrasefall

A 3D arcade game for learning English expressions. Idioms, phrasal verbs and set
phrases fall from the sky towards your character; pick the right meaning from
four options before they land.

- **Simple to play** – one tap per answer. Three lives. +100 per correct answer,
  bonus points at streaks of 5 and 10.
- **Five stages** – everyday expressions → phrasal verbs → idioms → set phrases →
  advanced expressions and collocations. Each stage is faster and moves the world
  on through the day, from sunrise to a starlit aurora.
- **20 collectable characters** – real-time 3D, each with its own idle animation
  and reactions. Purely cosmetic; unlocked by playing.
- **Learning built in** – every expression you meet becomes a flashcard (meaning,
  example, synonyms, register and context, common mistake). *My Collection* tracks
  what you have mastered, got wrong, flagged to practise or marked as a favourite.
- **150 British English expressions**, each with hand-written wrong answers.

## Run it

```bash
npm install
npm run dev            # http://localhost:5173
npm run build          # static site in dist/
npm run build:single   # one self-contained HTML file in dist-single/
npm run check:data     # validate the expression database
```

Requires Node 18+. The only runtime dependency is [three.js](https://threejs.org);
fonts (Fredoka, Nunito — both OFL) are bundled, so the built game works offline.

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
    expressions/          stage1.js … stage5.js — the expression database
    stages.js             pace, goals and scoring rules
    roster.js             character order and unlock rules
  characters/
    kit/                  the character construction kit: shared skeleton, toy material, face rig
    animator.js           procedural animation: idle layers, action clips, secondary motion
    models/               one file per character (auto-discovered)
    thumbnails.js         portrait renderer for the collection strip
  world/                  sky, lighting themes, island, clouds, particle effects
  game/                   rules (game.js), the falling card, camera framing, the live hero
  audio/                  synthesised sound effects and generative music
  ui/                     screens (menu, characters, HUD, results, flashcards, collection …)
  styles/main.css         the interface look
dev/                      character and world preview pages, character authoring guide
scripts/                  data validator and screenshot helpers used during development
```

Game logic never touches the DOM and the interface never touches the 3D scene:
they talk through a small event bus (`game:question`, `game:answered`,
`game:score`, …), which keeps each part replaceable.

### Add expressions

Append objects to a file in `src/data/expressions/` (or add a new stage file and
list it in `index.js`), then run `npm run check:data`.

```js
{
  id: 'break-the-ice',
  text: 'break the ice',
  type: 'idiom',                      // everyday | phrasal | idiom | set-phrase | collocation | advanced
  meaning: 'help people relax when they first meet',
  distractors: ['…', '…', '…'],       // three plausible wrong answers
  example: 'Sam told a silly joke to break the ice.',
  synonyms: ['put people at ease'],
  register: 'Neutral',                // Very informal | Informal | Neutral | Formal
  context: 'When and where it is used.',
  mistake: 'A common learner error.',
}
```

### Add a character

1. Create `src/characters/models/<id>.js` — see `dev/CHARACTER_GUIDE.md` and any
   existing model. A character is ~150–350 lines built from the kit's primitives.
2. Add `{ id, rule }` to `src/data/roster.js` to place it in the collection and
   give it an unlock rule.

Preview while you work at `http://localhost:5173/dev/characters.html?ids=<id>`.

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
- **Progress is saved in the browser** (`localStorage`). It does not sync between
  devices and is lost if site data is cleared.
- Flashcard pronunciation uses the browser's speech synthesis, so the voice
  depends on the device.
