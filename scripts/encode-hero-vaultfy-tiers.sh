#!/usr/bin/env bash
# Builds the hero frame tiers with the same sizes and settings as the Vaultfy hero:
#   hero_desktop2x 2560x1440, hero_desktop 1920x1080, hero_preview_desktop 640x360
#   hero_mobile     720x1280,                         hero_preview_mobile  360x640
# Usage: scripts/encode-hero-vaultfy-tiers.sh <desktop.mp4> <mobile.mp4>
set -euo pipefail
DESKTOP_SRC="$1"; MOBILE_SRC="$2"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/frames"
TMP="$(mktemp -d)"
DESKTOP_FPS=12   # 28.75s source -> 345 frames
MOBILE_FPS=20    # 15.04s source -> 301 frames
JOBS=$(sysctl -n hw.ncpu 2>/dev/null || echo 8)

trap 'rm -rf "$TMP"' EXIT

mkdir -p "$TMP/d" "$TMP/m"
ffmpeg -v error -y -i "$DESKTOP_SRC" -vf "fps=$DESKTOP_FPS,scale=2560:1440:flags=lanczos" -start_number 1 "$TMP/d/frame_%04d.png"
ffmpeg -v error -y -i "$MOBILE_SRC"  -vf "fps=$MOBILE_FPS,scale=1080:1920:flags=lanczos"  -start_number 1 "$TMP/m/frame_%04d.png"

for t in hero_desktop2x hero_desktop hero_preview_desktop hero_mobile hero_preview_mobile; do rm -rf "$OUT/$t"; mkdir -p "$OUT/$t"; done

# One job per source frame: <png> <out-root> <desktop|mobile>
cat > "$TMP/enc.sh" <<'ENC'
#!/usr/bin/env bash
set -e
png="$1"; out="$2"; kind="$3"; name="$(basename "${png%.png}").webp"
e() { cwebp -quiet -q "$1" -sharp_yuv -m 6 -resize "$2" "$3" "$png" -o "$out/$4/$name"; }
if [ "$kind" = desktop ]; then
  e 75 2560 1440 hero_desktop2x; e 75 1920 1080 hero_desktop; e 70 640 360 hero_preview_desktop
else
  e 75 720 1280 hero_mobile; e 70 360 640 hero_preview_mobile
fi
ENC
chmod +x "$TMP/enc.sh"
find "$TMP/d" -name '*.png' -print0 | xargs -0 -P "$JOBS" -I{} "$TMP/enc.sh" {} "$OUT" desktop
find "$TMP/m" -name '*.png' -print0 | xargs -0 -P "$JOBS" -I{} "$TMP/enc.sh" {} "$OUT" mobile

for t in hero_desktop2x hero_desktop hero_preview_desktop hero_mobile hero_preview_mobile; do
  echo "$t: $(ls "$OUT/$t" | wc -l | tr -d ' ') frames, $(du -sh "$OUT/$t" | cut -f1)"
done
