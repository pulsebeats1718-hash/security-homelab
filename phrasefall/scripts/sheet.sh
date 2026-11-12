#!/usr/bin/env bash
# Character review sheet: renders the given characters in 8 standard views and
# stitches them into one image.
#   scripts/sheet.sh fox,robot out.png
# Needs a dev server: npx vite --config dev/vite.nohmr.config.js  (port 5174, no hot reload)
set -euo pipefail
IDS="$1"; OUT="$2"
PORT="${PORT:-5174}"
BASE="http://localhost:$PORT/dev/characters.html?ids=$IDS"
TMP="$(mktemp -d)"
N=$(echo "$IDS" | tr ',' '\n' | wc -l)
W=$(( N * 330 + 80 )); [ "$W" -lt 700 ] && W=700
shot() { node "$(dirname "$0")/shot.cjs" "$BASE$2" "$TMP/$1.png" "$W" 470 "${3:-1400}" | grep -v '^saved' || true; }
shot 1-front "" 2200
shot 2-back "&yaw=155"
shot 3-side "&yaw=80"
shot 4-cheer "&clip=cheer&u=0.4"
shot 5-attack "&clip=attack&u=0.55&gaze=1"
shot 6-hit "&clip=hit&u=0.08"
shot 7-ko "&clip=ko&u=1"
shot 8-locked "&sil=1&bg=dark"
montage "$TMP"/*.png -tile 2x4 -geometry +4+4 -background "#222" -depth 8 -type TrueColor "$OUT"
rm -rf "$TMP"
echo "sheet: $OUT  (rows: front|back, side|cheer, attack|hit, ko|locked)"
