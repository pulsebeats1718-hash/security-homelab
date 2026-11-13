# App icon

Maple the fox looks up, delighted, at a golden speech bubble falling from a dusk sky like a
shooting star: the game in one picture.

The icon is built in three layers on a 1024 × 1024 canvas:

| Layer | File | What |
| --- | --- | --- |
| 1 | `sky.svg` | dusk sky (indigo to violet to a warm glow), the bubble's light, stars |
| 2 | `render.html`, `render.js`, `render-fox.cjs` | Maple, rendered by the game's own engine and character model on a transparent background (pose, expression, lights and camera are the defaults in `render.js`) |
| 3 | `front.svg` | the speech bubble (gold frame, cream face, “), its comet trail and sparkles |

`make-icons.sh` renders the fox, stacks the layers and writes every size to `public/icons/`:

- `icon-maskable-512.png`, `icon-maskable-192.png`: full bleed. The fox's face and the bubble
  stay inside the central 80 % circle, so Android can crop to any shape.
- `icon-512.png`, `icon-192.png`: the central 90 %, cut to a rounded square.
- `apple-touch-icon.png`: 180 × 180, opaque (iOS rounds the corners).

## Rebuild

```bash
npx vite --config dev/vite.nohmr.config.js     # dev server on port 5174 (leave it running)
dev/icon/make-icons.sh                         # in a second terminal, from the project folder
```

Needs Node with Playwright (Chromium), ImageMagick (`convert`) and `rsvg-convert`. With Python 3
and Pillow it also packs `icon-512.png` into 8 bits with smooth corners (`pack-png.py`), about
half the size; without them that file stays full colour. To try another
pose, open `http://localhost:5174/dev/icon/render.html?gu=1&gx=0.4` (parameters are listed at
the top of `render.js`); if the framing changes, adjust `FOX_SCALE` and `FOX_AT` in
`make-icons.sh`.

## Favicon

`favicon.svg` is a flat, simplified version for browser tabs (it reads at 16 px). It is inlined
in `index.html` as a data URI, because the single-file build has no separate files. After editing
it, paste it into the `<link rel="icon">` in `index.html`, with `<`, `>` and `#` written as
`%3C`, `%3E` and `%23`.
