#!/usr/bin/env bash
# Rebuilds the app icons in public/icons/ (see README.md in this folder).
#   npx vite --config dev/vite.nohmr.config.js   # dev server on port 5174, in another terminal
#   dev/icon/make-icons.sh
# Needs Node with Playwright (Chromium), ImageMagick (convert) and rsvg-convert.
set -euo pipefail
cd "$(dirname "$0")"
OUT=../../public/icons
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# where the fox sits on the 1024 × 1024 canvas (fits the default framing in render.js)
FOX_SCALE=58%
FOX_AT=-150+346

node render-fox.cjs "$TMP/fox.png" >/dev/null           # 2048 × 2048, transparent background
rsvg-convert -w 1024 -h 1024 sky.svg -o "$TMP/sky.png"
rsvg-convert -w 1024 -h 1024 front.svg -o "$TMP/front.png"
convert "$TMP/fox.png" -resize "$FOX_SCALE" "$TMP/fox-small.png"
convert "$TMP/sky.png" "$TMP/fox-small.png" -geometry "$FOX_AT" -composite "$TMP/front.png" -composite -alpha off "$TMP/master.png"

# convert … <output>, stripped, best zlib compression
png() {
  local out="${*: -1}"
  convert "${@:1:$#-1}" -strip -quality 95 "$out"
}

# maskable: full bleed; everything that matters sits inside the central 80 % circle
# (the 512 px one in 256 colours, finely dithered: half the size, no visible difference)
png "$TMP/master.png" -resize 512x512 -dither FloydSteinberg -colors 256 "PNG8:$OUT/icon-maskable-512.png"
png "$TMP/master.png" -resize 192x192 "$OUT/icon-maskable-192.png"

# any: the central 90 %, cut to a rounded square with transparent corners
convert "$TMP/master.png" -crop 922x922+51+51 +repage "$TMP/zoom.png"
for s in 512 192; do
  r=$((s * 22 / 100))
  png "$TMP/zoom.png" -resize "${s}x${s}" -alpha set \
    \( -size "${s}x${s}" xc:none -fill white -draw "roundrectangle 0,0,$((s - 1)),$((s - 1)),$r,$r" \) \
    -compose DstIn -composite "PNG32:$OUT/icon-$s.png"
done

# the 512 px one in 8 bits too, keeping its corners smooth (needs Python with Pillow; skipped without)
if python3 -c 'import PIL' 2>/dev/null; then
  convert "$TMP/zoom.png" -resize 512x512 -dither FloydSteinberg -colors 239 "PNG8:$TMP/any-512.png"
  python3 pack-png.py "$TMP/any-512.png" "$OUT/icon-512.png" "$OUT/icon-512.png"
fi

# Apple touch icon: opaque, square (iOS rounds the corners itself)
png "$TMP/zoom.png" -resize 180x180 -background '#17123f' -flatten "$OUT/apple-touch-icon.png"

ls -l "$OUT"
