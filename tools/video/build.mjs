// Generates self-contained HyperFrames compositions (one index.html per video)
// for the Peta MUDA promo clips. Pure CSS animation, no CDN, no external assets
// — vertical 1080x1920 for WhatsApp. Scenes fade in/out on a single timeline;
// element entrances use absolute animation-delays (HyperFrames seeks the
// document timeline deterministically, so delays fire at the right wall-clock).
//
// Usage: node tools/video/build.mjs   → writes tools/video/{sukarelawan,hq}/index.html
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(fileURLToPath(import.meta.url))
const W = 1080, H = 1920, FADE = 0.4

// ---- brand kit (mirrors site/styles.css) ----
const INK = '#141414', BG = '#f6f6f4', MUTED = '#6b7280', RED = '#c81e3a', GREEN = '#0c7c59'
const URL = 'peta-muda.petamuda-data.workers.dev'

const brand = (size = 70) => `<div class="brand" style="font-size:${size}px">` +
  `<b>PETA</b><i>MUDA</i></div>`

// A scene = { dur, bg?, html }. html may use classes: .kicker .head .sub .big
// .row .pill .hot .good .step .stepn .card .cap ; elements with class "in" get
// a rise+fade entrance (delay set by generator, relative to scene start).
function page(title, scenes, { accent = INK } = {}) {
  let t = 0
  const timed = scenes.map((s, i) => {
    const start = t, end = t + s.dur; t = end
    return { ...s, i, start, end }
  })
  const total = t
  const pct = (sec) => (100 * sec / total).toFixed(3) + '%'

  const sceneCss = timed.map(s => {
    // container visibility window with soft fades
    const a = Math.max(0, s.start - FADE), b = s.start, c = Math.max(s.start, s.end - FADE), d = s.end
    return `@keyframes sc${s.i}{0%,${pct(a)}{opacity:0}${pct(b)},${pct(c)}{opacity:1}${pct(d)},100%{opacity:0}}
.sc${s.i}{animation:sc${s.i} ${total}s linear forwards}`
  }).join('\n')

  const sceneHtml = timed.map(s => {
    // give every ".in" element an absolute entrance delay just after scene start
    let n = 0
    const html = s.html.replace(/class="in([^"]*)"/g, (_, rest) => {
      const delay = (s.start + 0.15 + n * 0.28).toFixed(2)
      n++
      return `class="in${rest}" style="animation-delay:${delay}s"`
    })
    return `<section class="scene sc${s.i}" style="background:${s.bg ?? BG}">${html}</section>`
  }).join('\n')

  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
<style>
  html,body{margin:0;padding:0}
  #main-composition{width:${W}px;height:${H}px;position:relative;overflow:hidden;
    font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:${BG}}
  .scene{position:absolute;inset:0;box-sizing:border-box;display:flex;flex-direction:column;
    justify-content:center;gap:44px;padding:150px 96px;opacity:0}
  .brand{font-weight:900;letter-spacing:2px;display:inline-block}
  .brand b{background:${INK};color:#fff;padding:8px 18px}
  .brand i{background:#fff;color:${INK};padding:8px 18px;border:3px solid ${INK};font-style:normal}
  .kicker{font-size:44px;font-weight:800;color:${accent};text-transform:uppercase;letter-spacing:3px;margin:0}
  .head{font-size:120px;font-weight:900;color:${INK};margin:0;line-height:1.03;letter-spacing:-2px}
  .head.sm{font-size:96px}
  .sub{font-size:56px;font-weight:600;color:${MUTED};margin:0;line-height:1.28}
  .big{font-size:150px;font-weight:900;color:${INK};margin:0;line-height:1}
  .hot{color:${RED}}
  .good{color:${GREEN}}
  .row{display:flex;align-items:center;gap:28px}
  .pill{font-size:46px;font-weight:800;color:#fff;background:${INK};padding:12px 26px;border-radius:999px;display:inline-block}
  .step{display:flex;align-items:flex-start;gap:32px;margin:0}
  .stepn{flex:0 0 auto;width:96px;height:96px;border-radius:50%;background:${INK};color:#fff;
    font-size:56px;font-weight:900;display:flex;align-items:center;justify-content:center}
  .stept{font-size:64px;font-weight:800;color:${INK};line-height:1.1;margin:0;padding-top:8px}
  .card{background:#fff;border:3px solid ${INK};border-radius:28px;padding:52px 56px;box-shadow:0 18px 44px rgba(0,0,0,.12)}
  .card h3{font-size:52px;font-weight:900;margin:0 0 28px;color:${INK}}
  .card li{font-size:46px;font-weight:600;color:${INK};line-height:1.32;margin:0 0 20px;list-style:none;padding-left:52px;position:relative}
  .card li::before{content:"\\203A";position:absolute;left:0;color:${accent};font-weight:900}
  .cap{font-size:52px;font-weight:800;color:${INK};margin:0}
  .url{font-size:40px;font-weight:800;color:${INK};border:3px solid ${INK};padding:14px 22px;border-radius:14px;
    font-family:ui-monospace,monospace;display:inline-block;letter-spacing:.5px}
  .foot{font-size:44px;font-weight:700;color:${MUTED};margin:0}
  /* entrance */
  .in{opacity:0;animation-name:rise;animation-duration:.7s;animation-timing-function:cubic-bezier(.2,.7,.2,1);
    animation-fill-mode:both}
  .in.fade{animation-name:fade}
  @keyframes rise{from{opacity:0;transform:translateY(46px)}to{opacity:1;transform:none}}
  @keyframes fade{from{opacity:0}to{opacity:1}}
  ${sceneCss}
</style></head>
<body>
  <div id="main-composition" data-composition-id="${title}" data-width="${W}" data-height="${H}" data-start="0" data-duration="${total}">
    ${sceneHtml}
  </div>
</body></html>`
}

// ---------------- VOLUNTEER (sukarelawan) ----------------
const sukarelawan = page('sukarelawan', [
  { dur: 8, html: `
    ${brand(78)}
    <h1 class="head in">Skrip rumah<br>ke rumah anda.</h1>
    <p class="sub in">Dua ketikan. Enam puluh saat.</p>` },
  { dur: 9, html: `
    <p class="kicker in">Ketuk pintu malam ini?</p>
    <h1 class="head in">Apa nak<br>cakap?</h1>` },
  { dur: 10, html: `
    <p class="kicker in">Fakta di tangan anda</p>
    <h1 class="head in">Harga naik.<br>Gaji tak kejar.</h1>
    <p class="sub in">Harga barang dapur naik <span class="hot">sejak PRN Mac 2022</span> — kuasa beli keluarga makin menyusut.</p>` },
  { dur: 12, html: `
    <p class="kicker in">Dua ketikan sahaja</p>
    <div class="step in"><div class="stepn">1</div><p class="stept">Cari kawasan anda</p></div>
    <div class="step in"><div class="stepn">2</div><p class="stept">Salin skrip<br>rumah ke rumah</p></div>
    <p class="sub in">Siap untuk WhatsApp — tanpa latihan.</p>` },
  { dur: 11, html: `
    <p class="kicker in">Anda dapat</p>
    <div class="card in">
      <h3>Isi rumah ke rumah</h3>
      <ul style="margin:0;padding:0">
        <li>Harga barang dapur — naik sejak PRN lalu</li>
        <li>Kerusi majoriti tipis — setiap undi penting</li>
        <li>Pengundi muda &amp; Undi18 di kawasan anda</li>
      </ul>
    </div>` },
  { dur: 8, html: `
    <p class="kicker in">Sebar terus</p>
    <h1 class="head sm in">Kongsi ke<br>WhatsApp.</h1>
    <p class="sub in">Satu ketikan — terus ke kumpulan anda.</p>` },
  { dur: 8, bg: INK, html: `
    <div class="in" style="align-self:flex-start"><div class="brand" style="font-size:78px"><b style="background:#fff;color:${INK}">PETA</b><i style="background:transparent;color:#fff;border-color:#fff">MUDA</i></div></div>
    <p class="cap in" style="color:#fff">Percuma. Data rasmi.<br>Mula malam ini.</p>
    <span class="url in" style="color:#fff;border-color:#fff">${URL}</span>` },
])

// ---------------- HQ ----------------
const hq = page('hq', [
  { dur: 8, html: `
    ${brand(78)}
    <h1 class="head in">56 kerusi.<br>Satu skrin.</h1>
    <p class="sub in">Pusat data kerusi PRN Johor.</p>` },
  { dur: 9, html: `
    <p class="kicker in">Setiap kerusi</p>
    <h1 class="head in">Mesej di pintu —<br>tiga baris,<br>siap.</h1>` },
  { dur: 11, html: `
    <p class="kicker in">Resit, bukan pendapat</p>
    <h1 class="head sm in">Harga hari ini<br>vs Mac 2022.</h1>
    <p class="sub in">Setiap barang — naik <span class="hot">merah</span>, turun <span class="good">hijau</span>. Ikut data.</p>` },
  { dur: 12, html: `
    <p class="kicker in">Cerita kempen</p>
    <div class="card in">
      <h3>5 langkah tersusun</h3>
      <ul style="margin:0;padding:0">
        <li>Jalan kemenangan</li>
        <li>Pengundi penentu</li>
        <li>Mesej di pintu</li>
        <li>Peta lapangan</li>
        <li>Tindakan</li>
      </ul>
    </div>` },
  { dur: 10, html: `
    <p class="kicker in">Peta lapangan</p>
    <h1 class="head sm in">Undi ikut<br>saluran.</h1>
    <p class="sub in">Kubu &amp; kawasan rebutan 2022 — fokus tenaga di tempat yang betul.</p>` },
  { dur: 6, html: `
    <p class="kicker in">Data anda</p>
    <h1 class="head sm in">Eksport<br>JSON / CSV.</h1>` },
  { dur: 8, bg: INK, html: `
    <div class="in" style="align-self:flex-start"><div class="brand" style="font-size:78px"><b style="background:#fff;color:${INK}">PETA</b><i style="background:transparent;color:#fff;border-color:#fff">MUDA</i></div></div>
    <p class="cap in" style="color:#fff">Kemas kini harian.<br>Data rasmi terbuka.</p>
    <span class="url in" style="color:#fff;border-color:#fff">${URL}</span>` },
])

for (const [name, html] of [['sukarelawan', sukarelawan], ['hq', hq]]) {
  const dir = join(ROOT, name)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'index.html'), html)
  writeFileSync(join(dir, 'hyperframes.json'),
    JSON.stringify({ $schema: 'https://hyperframes.heygen.com/schema/hyperframes.json', paths: { blocks: '.', assets: 'assets' } }, null, 2))
  console.log(`wrote ${name}/index.html`)
}
