#!/usr/bin/env bash
# Makes the Android app's icons and splash image from the game's own app icons (public/icons/).
#   android/make-icons.sh
# Needs ImageMagick (convert).
#
#   mipmap-*/ic_launcher_background.png   Android 8+ adaptive icon (108 dp): the full-bleed icon art
#                                         at 70 %, so the fox and the speech bubble sit inside every
#                                         launcher's mask, on a blurred copy of itself out to the edges
#   mipmap-*/ic_launcher.png              older Android (48 dp): the rounded-square icon
#   drawable-*/splash.png                 the splash screen while the game loads (128 dp)
set -euo pipefail
cd "$(dirname "$0")"
ART=../public/icons/icon-maskable-512.png
ROUND=../public/icons/icon-512.png
RES=app/src/main/res

for pair in mdpi:1 hdpi:1.5 xhdpi:2 xxhdpi:3 xxxhdpi:4; do
  name=${pair%%:*}
  d=${pair##*:}
  px() { awk -v d="$d" -v n="$1" 'BEGIN { printf "%d", n * d + 0.5 }'; }
  layer=$(px 108)
  art=$(px 75.6) # 70 % of the layer
  mkdir -p "$RES/mipmap-$name" "$RES/drawable-$name"
  convert "$ART" -resize "${layer}x${layer}!" -blur 0x$(px 6) \
    \( "$ART" -resize "${art}x${art}" \) -gravity center -composite \
    -strip "PNG24:$RES/mipmap-$name/ic_launcher_background.png"
  convert "$ROUND" -resize "$(px 48)x$(px 48)" -strip "PNG32:$RES/mipmap-$name/ic_launcher.png"
  convert "$ROUND" -resize "$(px 128)x$(px 128)" -strip "PNG32:$RES/drawable-$name/splash.png"
done
ls -l "$RES"/mipmap-*/ "$RES"/drawable-*/ | grep png
