#!/usr/bin/env bash
# Re-encode the 60 fps hero sequence into lightweight WebP tiers.
# Sources: frames/hero/qhd60-desktop (2560x1440 jpg) and frames/hero/hq60-mobile (1080x1920 jpg).
# Output:  frames/hero60/{desktop,mobile,preview-desktop,preview-mobile}/NNNN.webp + posters.
set -euo pipefail
cd "$(dirname "$0")/.."

SRC_D=frames/hero/qhd60-desktop
SRC_M=frames/hero/hq60-mobile
OUT=frames/hero60
mkdir -p "$OUT"/{desktop,mobile,preview-desktop,preview-mobile}

encode() { # src dst w h q
  [ -s "$2" ] || cwebp -quiet -q "$5" -m 5 -resize "$3" "$4" "$1" -o "$2"
}
frame() {
  encode "$SRC_D/$1.jpg" "$OUT/desktop/$1.webp" 1920 1080 70
  encode "$SRC_D/$1.jpg" "$OUT/preview-desktop/$1.webp" 640 360 50
  encode "$SRC_M/$1.jpg" "$OUT/mobile/$1.webp" 720 1280 70
  encode "$SRC_M/$1.jpg" "$OUT/preview-mobile/$1.webp" 270 480 50
}
export -f encode frame
export SRC_D SRC_M OUT

ls "$SRC_D" | sed 's/\.jpg$//' | xargs -P "$(sysctl -n hw.ncpu)" -n 1 bash -c 'frame "$0"'

cp "$OUT/desktop/0001.webp" "$OUT/poster.webp"
cp "$OUT/mobile/0001.webp" "$OUT/mobile-poster.webp"
du -sh "$OUT"/*
