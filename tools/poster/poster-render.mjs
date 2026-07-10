// Poster generator (Editorial Punch, 1080x1920). Re-render after data changes:
//   npm i --no-save playwright   (NEVER add to package.json -- nightly CI must not download browsers)
//   node tools/poster/poster-render.mjs        (state posters)
//   node tools/poster/seat-poster-render.mjs   (seat posters)
// Outputs land in site/posters/ and go live on the next push (static assets).
import { chromium } from 'playwright'
import { fileURLToPath } from 'node:url'
const here = fileURLToPath(new URL('.', import.meta.url))
const out = fileURLToPath(new URL('../../site/posters/', import.meta.url))

const JOHOR = {
  state: 'JOHOR',
  pillars: [
    { tag: 'Gaji', num: '6–7×', txt: 'Separuh dari kita berpendapatan bawah RM2,800 sebulan. Gaji penengah Singapura <b>6–7 kali ganda</b> — sebab itu anak muda kita pergi.' },
    { tag: 'Banjir', num: '45,218', txt: 'Batu Pahat, Segamat, Kluang banjir <b>setiap tahun</b>. 45,218 dipindahkan pada 2023 — dan berulang sejak itu.' },
    { tag: 'Cukai', num: 'SST ↑', txt: 'Mereka cukai sewa & klinik anda (Julai 2025) — dan <b>batalkan cukai orang kaya</b> musim yang sama.' },
    { tag: 'Air', num: '455,499', txt: 'Satu insiden pencemaran Sungai Johor memutuskan bekalan air kepada <b>455,499 akaun</b> (Nov 2025).' },
  ],
}
const MELAKA = {
  state: 'MELAKA',
  pillars: [
    { tag: 'Air', num: '~5%', txt: 'Simpanan air Melaka cuma <b>~5%</b> — antara paling nipis di negara (paras disyorkan 10-15%).' },
    { tag: 'Banjir', num: '106 lokasi', txt: '106 lokasi berisiko banjir, <b>26 di Jasin</b> — dan Jasin banjir <b>dua kali</b> pada 2025 (Mac & Okt).' },
    { tag: 'Cukai', num: 'SST ↑', txt: 'Mereka cukai sewa & klinik anda (Julai 2025) — dan <b>batalkan cukai orang kaya</b> musim yang sama.' },
    { tag: 'Gaji', num: '1 / 3', txt: 'Separuh dari kita berpendapatan bawah RM2,800; <b>1 dari 3 graduan</b> kerja bawah kelayakan. Anak muda terpaksa pergi.' },
  ],
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
for (const [name, data] of [['johor', JOHOR], ['melaka', MELAKA]]) {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 })
  await page.addInitScript((d) => { window.__POSTER__ = d }, data)
  await page.goto(`file://${here}poster.html`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(200)
  await page.screenshot({ path: `${out}${name}.png` })
  await page.close()
}
await browser.close()
console.log('rendered johor + melaka posters (png)')
