#!/usr/bin/env bash
# Render the Peta MUDA promo videos with HyperFrames.
# Prereqs (install once, into this folder, WITHOUT touching package.json — the
# nightly CI runs `npm ci` and must never start downloading browsers):
#
#   cd tools/video
#   npm i --no-save --ignore-scripts hyperframes @ffmpeg-installer/ffmpeg ffprobe-static
#
# Chrome comes from the pre-installed Playwright chromium; ffmpeg/ffprobe from
# the bundled npm binaries (HyperFrames' own downloads are blocked here).
#
# Usage:  bash tools/video/render.sh            # both, 30fps, high quality
#         bash tools/video/render.sh sukarelawan
set -euo pipefail
cd "$(dirname "$0")"                    # tools/video

node build.mjs                         # regenerate index.html from build.mjs

# locate a Chrome binary (Playwright's chromium in this environment)
CHROME="${HYPERFRAMES_BROWSER_PATH:-$(ls -d /opt/pw-browsers/chromium-*/chrome-linux/chrome 2>/dev/null | head -1)}"
export HYPERFRAMES_BROWSER_PATH="$CHROME"
export HYPERFRAMES_FFMPEG_PATH="$(node -e "process.stdout.write(require('@ffmpeg-installer/ffmpeg').path)")"
export HYPERFRAMES_FFPROBE_PATH="$(node -e "process.stdout.write(require('ffprobe-static').path)")"
export HYPERFRAMES_NO_AUTO_INSTALL=1 HYPERFRAMES_NO_TELEMETRY=1 HYPERFRAMES_NO_UPDATE_CHECK=1 HYPERFRAMES_NO_FEEDBACK=1 HYPERFRAMES_SKIP_SKILLS=1

HF=node_modules/.bin/hyperframes
OUT=../../site/videos
mkdir -p "$OUT"
for name in "${@:-sukarelawan hq}"; do
  echo "Rendering $name …"
  node "$HF" render -o "$OUT/$name.mp4" --fps 30 --quality high "$name"
done
echo "Done → site/videos/"
