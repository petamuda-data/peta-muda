// Poster generator (Editorial Punch, 1080x1920). Re-render after data changes:
//   npm i --no-save playwright   (NEVER add to package.json -- nightly CI must not download browsers)
//   node tools/poster/poster-render.mjs        (state posters)
//   node tools/poster/seat-poster-render.mjs   (seat posters)
// Outputs land in site/posters/ and go live on the next push (static assets).
// Every dataset carries its OWN kicker/head/closeBig/closeSub/foot so language
// never leaks from poster.html's markup defaults — BM and EN outputs are both
// fully self-contained per language, keyed by filename suffix (-en = English).
import { chromium } from 'playwright'
import { fileURLToPath } from 'node:url'
const here = fileURLToPath(new URL('.', import.meta.url))
const out = fileURLToPath(new URL('../../site/posters/', import.meta.url))

const KICKER_BM = 'Sebelum anda mengundi —'
const HEAD_BM = 'ADAKAH HIDUP ANDA <em>LEBIH BAIK?</em>'
const CLOSE_BIG_BM = 'MUDA — <em>parti baharu.</em>'
const CLOSE_SUB_BM = 'Jujur, muda, di sini. Berdiri untuk anda, bukan untuk diri sendiri.'
const FOOT_BM = 'Setiap angka bersumber daripada data rasmi terbuka.'

const KICKER_EN = 'Before you vote —'
const HEAD_EN = 'IS YOUR LIFE <em>BETTER?</em>'
const CLOSE_BIG_EN = 'MUDA — <em>the new party.</em>'
const CLOSE_SUB_EN = 'Honest, young, here. Standing for you, not for itself.'
const FOOT_EN = 'Every figure sourced from official open data.'

const JOHOR = {
  state: 'JOHOR', kicker: KICKER_BM, head: HEAD_BM, closeBig: CLOSE_BIG_BM, closeSub: CLOSE_SUB_BM, foot: FOOT_BM,
  pillars: [
    { tag: 'Gaji', num: '6–7×', txt: 'Separuh dari kita berpendapatan bawah RM2,800 sebulan. Gaji penengah Singapura <b>6–7 kali ganda</b> — sebab itu anak muda kita pergi.' },
    { tag: 'Banjir', num: '45,218', txt: 'Batu Pahat, Segamat, Kluang banjir <b>setiap tahun</b>. 45,218 dipindahkan pada 2023 — dan berulang sejak itu.' },
    { tag: 'Cukai', num: 'SST ↑', txt: 'Mereka cukai sewa & klinik anda (Julai 2025) — dan <b>batalkan cukai orang kaya</b> musim yang sama.' },
    { tag: 'Air', num: '455,499', txt: 'Satu insiden pencemaran Sungai Johor memutuskan bekalan air kepada <b>455,499 akaun</b> (Nov 2025).' },
  ],
}
const MELAKA = {
  state: 'MELAKA', kicker: KICKER_BM, head: HEAD_BM, closeBig: CLOSE_BIG_BM, closeSub: CLOSE_SUB_BM, foot: FOOT_BM,
  pillars: [
    { tag: 'Air', num: '~5%', txt: 'Simpanan air Melaka cuma <b>~5%</b> — antara paling nipis di negara (paras disyorkan 10-15%).' },
    { tag: 'Banjir', num: '106 lokasi', txt: '106 lokasi berisiko banjir, <b>26 di Jasin</b> — dan Jasin banjir <b>dua kali</b> pada 2025 (Mac & Okt).' },
    { tag: 'Cukai', num: 'SST ↑', txt: 'Mereka cukai sewa & klinik anda (Julai 2025) — dan <b>batalkan cukai orang kaya</b> musim yang sama.' },
    { tag: 'Gaji', num: '1 / 3', txt: 'Separuh dari kita berpendapatan bawah RM2,800; <b>1 dari 3 graduan</b> kerja bawah kelayakan. Anak muda terpaksa pergi.' },
  ],
}

const JOHOR_EN = {
  state: 'JOHOR', kicker: KICKER_EN, head: HEAD_EN, closeBig: CLOSE_BIG_EN, closeSub: CLOSE_SUB_EN, foot: FOOT_EN,
  pillars: [
    { tag: 'Wages', num: '6–7×', txt: 'Half of us earn under RM2,800 a month. Singapore’s median wage is <b>6–7 times higher</b> — that’s why our young people leave.' },
    { tag: 'Floods', num: '45,218', txt: 'Batu Pahat, Segamat, Kluang flood <b>every year</b>. 45,218 evacuated in 2023 — and it has happened again since.' },
    { tag: 'Tax', num: 'SST ↑', txt: 'They taxed your rent & clinic visits (July 2025) — and <b>scrapped the tax on the rich</b> the same season.' },
    { tag: 'Water', num: '455,499', txt: 'One Sungai Johor pollution incident cut water to <b>455,499 accounts</b> (Nov 2025).' },
  ],
}
const MELAKA_EN = {
  state: 'MELAKA', kicker: KICKER_EN, head: HEAD_EN, closeBig: CLOSE_BIG_EN, closeSub: CLOSE_SUB_EN, foot: FOOT_EN,
  pillars: [
    { tag: 'Water', num: '~5%', txt: 'Melaka’s water reserve is just <b>~5%</b> — among the thinnest in the country (recommended level: 10-15%).' },
    { tag: 'Floods', num: '106 sites', txt: '106 flood-risk locations, <b>26 in Jasin</b> — and Jasin flooded <b>twice</b> in 2025 (March & October).' },
    { tag: 'Tax', num: 'SST ↑', txt: 'They taxed your rent & clinic visits (July 2025) — and <b>scrapped the tax on the rich</b> the same season.' },
    { tag: 'Wages', num: '1 / 3', txt: 'Half of us earn under RM2,800; <b>1 in 3 graduates</b> work below their qualification. Our young people are forced to leave.' },
  ],
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
for (const [name, data] of [['johor', JOHOR], ['melaka', MELAKA], ['johor-en', JOHOR_EN], ['melaka-en', MELAKA_EN]]) {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 })
  await page.addInitScript((d) => { window.__POSTER__ = d }, data)
  await page.goto(`file://${here}poster.html`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(200)
  await page.screenshot({ path: `${out}${name}.png` })
  await page.close()
}
await browser.close()
console.log('rendered johor + melaka posters (bm + en) (png)')
