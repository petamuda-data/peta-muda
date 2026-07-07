# Promo videos (HyperFrames)

Two silent, caption-driven vertical (1080×1920) clips for WhatsApp:

- **`sukarelawan.mp4`** — for volunteers: "your doorstep script in two taps"
- **`hq.mp4`** — for campaign HQ: "56 seats, one screen"

Both are rendered from `build.mjs`, which generates a self-contained
`index.html` per video — pure CSS animation, brand-styled to match
`site/styles.css`, Bahasa Melayu captions. The finished MP4s live in
`site/videos/` and are served at
`https://peta-muda.petamuda-data.workers.dev/videos/{sukarelawan,hq}.mp4`.

## Editing

Change copy/scenes in **`build.mjs`** (the `sukarelawan` / `hq` scene arrays),
then re-render. Each scene is `{ dur, html }`; elements with class `in` get a
staggered rise-in entrance automatically. Keep animations pure CSS — **no CDN
scripts** (external hosts are blocked in the render environment, and a CDN
GSAP/Lottie will silently render blank).

## Rendering

```bash
cd tools/video
# one-time, into this folder, NEVER saved to package.json:
npm i --no-save --ignore-scripts hyperframes @ffmpeg-installer/ffmpeg ffprobe-static
bash render.sh           # both videos → site/videos/
bash render.sh hq        # just one
```

### Why the extra ffmpeg/ffprobe packages

HyperFrames wants Chrome + FFmpeg + FFprobe. In this environment:

- **Chrome**: the pre-installed Playwright chromium is used via
  `HYPERFRAMES_BROWSER_PATH` (HyperFrames' own Chrome download is network-blocked).
- **FFmpeg**: Playwright's bundled ffmpeg is VP8-only and can't encode H.264, so
  `@ffmpeg-installer/ffmpeg` (a full libx264 build, shipped in the npm tarball —
  no download) is used via `HYPERFRAMES_FFMPEG_PATH`.
- **FFprobe**: not shipped with the above, so `ffprobe-static` supplies it via
  `HYPERFRAMES_FFPROBE_PATH`.

`render.sh` wires all three env vars automatically.

> ⚠️ **Never add `hyperframes`, `@ffmpeg-installer/ffmpeg`, or `ffprobe-static`
> to `package.json`.** The nightly data-refresh workflow runs `npm ci`; if these
> land in the manifest it will try to download a browser on every CI run. Always
> install them with `--no-save --ignore-scripts`.

Rendering a 60-second clip takes a few minutes (headless capture is the slow
part). Output is H.264 / yuv420p, ~2–3 MB each.
