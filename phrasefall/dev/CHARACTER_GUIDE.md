# Phrasefall character guide

How to build a character for Phrasefall. Read this, then read the four reference
models in `src/characters/models/` (`fox.js`, `astronaut.js`, `robot.js`, `wizard.js`)
and the kit in `src/characters/kit/` (`kit.js`, `face.js`, `rig.js`) plus
`src/characters/animator.js`.

## Art direction

Premium stylised "designer vinyl toy" chibi figures, like collectible art toys:
soft rounded forms, clean saturated colour blocking, a big expressive head, tiny
body, glossy bead eyes. Every character must share that look and those
proportions (always start from `k.biped`) but have an instantly recognisable
silhouette, palette and personality.

- 4–7 materials per character: 1–2 dominant colours, 1 secondary, 1 small accent,
  plus neutrals. Harmonious and saturated, never muddy; avoid pure black
  (use deep navy / charcoal / dark brown) and pure white for large areas.
- Big readable shapes first, then a few well-chosen details (buttons, trims,
  buckles). No noisy clutter. Nothing spiky sticking out of cheeks.
- Distinctive silhouette: hats, ears, hair, tails, capes, props.
- The face must be fully visible from the front in the idle pose. Props must not
  cover it. Give human characters varied skin tones and hairstyles.
- Original designs only. No existing franchise characters, logos or emblems.
- No text or numerals (we have no font geometry). Use stripes, stars, shapes.
- Roughly 35–75 meshes per character. Only use the `k.*` primitives (they share
  cached geometry); do not construct `new THREE.XxxGeometry` yourself.

## Coordinates and skeleton

- Units ≈ metres; a character is ≈ 2.0 tall, feet on y = 0, facing **+Z**.
- "L" is the character's own left = **+X**. `k.both((s) => …)` runs with s = +1 (left) then −1 (right).
- `const rig = k.biped({...})` creates: `rig.pivot → rig.hips → rig.legL/legR` and
  `rig.hips → rig.torso → rig.armL/armR → rig.handL/handR`, `rig.torso → rig.head`.
  Add parts to these groups in *their local space*:
  - torso-local: y = 0 at the hip line, the pear body spans y −0.07…0.68, widest (r≈0.4) at y≈0.19, front surface z≈0.34 there.
  - arm-local: shoulder at origin, arm hangs down −Y to the hand at y≈−0.43 (`rig.handL/R` is a group at the hand).
  - leg-local: hip at origin, foot at y≈−0.34.
  - head-local: origin at the neck; head centre is `rig.headCenter` (≈ (0, 0.44, 0)), radii `rig.headRadii` (≈ [0.57, 0.52, 0.53]).
- `k.biped` options: `skin, top, bottom, shoe, hand, sleeve` (materials), `legLen, legR, legGap, foot:[x,y,z], torso:[sx,sy,sz], head:[rx,ry,rz], armLen, armR, shoulderW, shoulderY, handR, armRest, neckSink`, and `noHead / noTorso / noArms / noLegs` to supply your own meshes. Built meshes are on `rig.m` (`torso, head, armL, handL, legL, footL, …`) — you may hide (`.visible = false`) or rescale them.
- Never add children to a mesh made by `k.ball/k.dome` (they are scaled); add to the joint group instead.
- `k.at(obj, x, y, z, rx, ry, rz)` positions and returns. `k.onSphere(obj, yawDeg, pitchDeg, lift, radii?, center?)` sits an object on the head (or any ellipsoid) with its +Z pointing outward: yaw 0 = front, +90 = the character's left; pitch + = up.
- Extra animatable joints: `rig.joint('tail', group)` (the animator drives `tailX/Y/Z`).
- `rig.spring(obj, {axis, gain, sway, speed, phase, k, d, yawGain})` gives ears, tails, capes, antennae, hat tips springy follow-through. Use it generously — it is what makes the toys feel alive.
- `rig.tickers.push((t, dt, rig, animator) => …)` for prop animation (lights pulsing, a ball being juggled). `animator.clip?.name` tells you which action clip is playing (`cheer`, `attack`, `kick`, `hit`, `ko`, `select`, `wave`, `power`, `appear`) or is null when idling.
- `rig.props.muzzle = someObject3D` marks where projectiles launch from (defaults to the right hand). `rig.props.sparkle = obj` marks a spot that emits magic sparkles.

## Materials

`k.mat(hex, {rough, metal, rim, emissive, emissiveIntensity, transparent, opacity, depthWrite})`,
`k.glow(hex, intensity)` (self-lit), `k.glass(hex, opacity)`, `k.metal(hex, rough)`,
`k.halo(hex, size, opacity)` (additive glow sprite). Always create materials through
the kit — that is what makes damage flashes and locked silhouettes work.

## Face

`k.face({ eye, brow, mouth, cheeks, line, radii, center, parent })` — see the header of
`face.js`. Eyes are glossy beads by default; `shape: 'pill'` + `mat: k.glow(...)` gives LED
eyes. Use `mouth: false` for masks and beaks, and `mouth: { center, radii, pitch }` to put
the mouth on a muzzle. Expressions (neutral, happy, focus, worried, surprised, hurt, ko)
and blinking are automatic; make sure all of them read on your character (e.g. dark
eyes on a dark patch need a lighter ring or brighter surround).

## Definition shape

```js
export default {
  id: 'fox',                 // file name without .js
  name: 'Maple',
  title: 'The Fox',
  blurb: 'One short, witty line.',
  accent: 0xff8a3c,          // UI accent + projectile colour
  shot: 'orb',               // projectile style: 'orb' | 'star' | 'bolt' | 'ball'
  attack: 'attack',          // optional: 'attack' (throw, default) or 'kick'
  build(k) { …; return rig; },
  idle(P, t, rig, animator) { … },      // REQUIRED: the character's own personality loop
  constrain(P, rig, animator) { … },    // optional: clamp the final pose (robes etc.)
};
```

### Pose keys (offsets from the rest pose, radians / metres)

`x y z yaw pitch roll` (whole body), `sq` (squash < 0 / stretch > 0), `grow`, `hipsY`,
`torsoX/Y/Z`, `headX/Y/Z`, `armLX/Y/Z`, `armRX/Y/Z`, `legLX/Z`, `legRX/Z`, `tailX/Y/Z`.
In `idle` always **add** (`P.headZ += …`) so the shared breathing/glancing layer survives.

Useful signs:
- `headX` negative = look up; `headY` positive = turn to the character's left; `headZ` = tilt.
- Arms rest hanging ~0.32 rad outward. Raise sideways: `armLZ` **positive**, `armRZ` **negative**.
  With the arm hanging, `armLX`/`armRX` **negative** swings it forward. Once an arm is raised
  above horizontal the X sign flips (positive X brings the hand forward).
- Chibi arms are short: a hand raised straight up disappears behind the head. Raise arms
  up-and-out (≈ 2.0–2.5 rad) instead, and keep held props beside the head, not in front of it.
- `legLX`/`legRX` negative = leg forward.
- The idle loop should be subtle but specific to the character (a prop being used, a stance,
  a recurring flourish every few seconds built from `t % period`).

## Checking your work

A preview server without hot reload runs at http://localhost:5174 (check with
`curl -s -o /dev/null -w "%{http_code}" http://localhost:5174/`). If it is not up, start it detached:
`nohup setsid npx vite --config dev/vite.nohmr.config.js > /tmp/vite-preview.log 2>&1 < /dev/null &`

```bash
scripts/sheet.sh ninja,pirate /path/to/out.png
```

renders the listed characters in eight standard views (front, back, side, cheer, attack,
hit, ko, locked silhouette) into one image. Look at it and iterate until every view is
clean: no parts floating or poking through, face readable, silhouette distinct, colours
harmonious. For a close look at one thing:

```
http://localhost:5174/dev/characters.html?ids=ninja&zoom=1.6&yaw=30&expr=happy
   other params: clip=<name>&u=<0..1>, gaze=1, worry=1, sil=1, bg=dark, pitch=<deg>, cy=<y>
node scripts/shot.cjs "<url>" out.png 900 700 1500
```

`shot.cjs` prints browser console errors — a model that throws is reported there.
Rendering is software-only (no GPU), so a sheet takes a minute or two; plan your
iterations rather than re-rendering after every tiny tweak.

Finish each character completely — passing all eight views — before starting the
next, so that finished work is always usable even if you are interrupted.
