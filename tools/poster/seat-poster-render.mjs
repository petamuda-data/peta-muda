// Poster generator (Editorial Punch, 1080x1920). Re-render after data changes:
//   npm i --no-save playwright   (NEVER add to package.json -- nightly CI must not download browsers)
//   node tools/poster/poster-render.mjs        (state posters)
//   node tools/poster/seat-poster-render.mjs   (seat posters)
// Outputs land in site/posters/ and go live on the next push (static assets).
// Every dataset carries its own closeBig/foot (not just kicker/head/closeSub)
// so BM and EN outputs never mix languages via poster.html's markup defaults.
import { chromium } from 'playwright'
import { fileURLToPath } from 'node:url'
const here = fileURLToPath(new URL('.', import.meta.url))
const out = fileURLToPath(new URL('../../site/posters/', import.meta.url))

const CLOSE_BIG_BM = 'MUDA — <em>parti baharu.</em>'
const FOOT_BM = 'Setiap angka bersumber daripada data rasmi terbuka.'
const CLOSE_BIG_EN = 'MUDA — <em>the new party.</em>'
const FOOT_EN = 'Every figure sourced from official open data.'

const CUKAI = { tag: 'Cukai', num: 'SST ↑', txt: 'Mereka cukai sewa & klinik anda (Julai 2025) — dan <b>batalkan cukai orang kaya</b> musim yang sama.' }
const CUKAI_EN = { tag: 'Tax', num: 'SST ↑', txt: 'They taxed your rent & clinic visits (July 2025) — and <b>scrapped the tax on the rich</b> the same season.' }

const SEATS = {
  'bukit-batu': {
    state: 'N.51 BUKIT BATU',
    kicker: 'Kerusi ini diputuskan oleh —',
    head: '137 <em>UNDI.</em>',
    closeBig: CLOSE_BIG_BM, foot: FOOT_BM,
    pillars: [
      { tag: 'Undi', num: '0.6%', txt: 'Majoriti 2022 hanya <b>137 undi</b> — dan keluar mengundi jatuh <b>87% → 54%</b>.' },
      { tag: 'Anda', num: '14,417', txt: '<b>14,417 pengundi bawah 30</b> di kerusi ini. Undi anda penentu — bukan kiasan.' },
      { tag: 'Air', num: '455,499', txt: 'Pencemaran Sungai Johor memutuskan bekalan air kepada <b>455,499 akaun</b> (Nov 2025).' },
      CUKAI,
    ],
    closeSub: 'Calon MUDA: <b>Premanand a/l Maniam</b> · Keluar mengundi Sabtu, <b>11 Julai</b>.',
  },
  'maharani': {
    state: 'N.15 MAHARANI',
    kicker: 'Kerusi ini diputuskan oleh —',
    head: '1,037 <em>UNDI.</em>',
    closeBig: CLOSE_BIG_BM, foot: FOOT_BM,
    pillars: [
      { tag: 'Undi', num: '4.9%', txt: 'Majoriti 2022 hanya <b>1,037 undi</b> — dan hanya <b>56%</b> keluar mengundi (2018: 84%).' },
      { tag: 'Anda', num: '9,179', txt: '<b>9,179 pengundi bawah 30</b> di Maharani — cukup untuk terbalikkan keputusan.' },
      { tag: 'Gaji', num: '6–7×', txt: 'Separuh dari kita berpendapatan bawah RM2,800. Gaji Singapura <b>6–7 kali ganda</b> — sebab itu anak Muar pergi.' },
      CUKAI,
    ],
    closeSub: 'Calon MUDA: <b>Amir Fiqri</b> · Keluar mengundi Sabtu, <b>11 Julai</b>.',
  },
  'puteri-wangsa': {
    state: 'N.41 PUTERI WANGSA',
    kicker: 'Kerusi anak muda Malaysia —',
    head: '42,333 <em>BAWAH 30.</em>',
    closeBig: CLOSE_BIG_BM, foot: FOOT_BM,
    pillars: [
      { tag: 'Kerusi', num: '1', txt: 'Kerusi MUDA yang <b>satu-satunya</b>. Dimenangi 2022 — pertahankan dia.' },
      { tag: 'Baharu', num: '12,945', txt: '<b>12,945 pengundi baharu</b> sejak PRU15 — dan hanya 48% keluar pada 2022 (2018: 87%). Setiap undi perlu dicari semula.' },
      { tag: 'Banjir', num: '13,000', txt: 'Banjir kilat Mac 2025: <b>13,000 dipindahkan</b>, JB paling teruk — dan ia berulang.' },
      CUKAI,
    ],
    closeSub: 'Calon MUDA: <b>Rashifa Aljunied</b> · Keluar mengundi Sabtu, <b>11 Julai</b>.',
  },
}

const SEATS_EN = {
  'bukit-batu-en': {
    state: 'N.51 BUKIT BATU',
    kicker: 'This seat was decided by —',
    head: '137 <em>VOTES.</em>',
    closeBig: CLOSE_BIG_EN, foot: FOOT_EN,
    pillars: [
      { tag: 'Votes', num: '0.6%', txt: 'The 2022 majority was just <b>137 votes</b> — and turnout fell <b>87% → 54%</b>.' },
      { tag: 'You', num: '14,417', txt: '<b>14,417 voters under 30</b> in this seat. Your vote decides — not a figure of speech.' },
      { tag: 'Water', num: '455,499', txt: 'Sungai Johor pollution cut water to <b>455,499 accounts</b> (Nov 2025).' },
      CUKAI_EN,
    ],
    closeSub: 'MUDA candidate: <b>Premanand a/l Maniam</b> · Polling day Saturday, <b>11 July</b>.',
  },
  'maharani-en': {
    state: 'N.15 MAHARANI',
    kicker: 'This seat was decided by —',
    head: '1,037 <em>VOTES.</em>',
    closeBig: CLOSE_BIG_EN, foot: FOOT_EN,
    pillars: [
      { tag: 'Votes', num: '4.9%', txt: 'The 2022 majority was just <b>1,037 votes</b> — and only <b>56%</b> turned out (2018: 84%).' },
      { tag: 'You', num: '9,179', txt: '<b>9,179 voters under 30</b> in Maharani — enough to flip the result.' },
      { tag: 'Wages', num: '6–7×', txt: 'Half of us earn under RM2,800. Singapore pays <b>6–7 times more</b> — that’s why Muar’s kids leave.' },
      CUKAI_EN,
    ],
    closeSub: 'MUDA candidate: <b>Amir Fiqri</b> · Polling day Saturday, <b>11 July</b>.',
  },
  'puteri-wangsa-en': {
    state: 'N.41 PUTERI WANGSA',
    kicker: 'Malaysia’s youth seat —',
    head: '42,333 <em>UNDER 30.</em>',
    closeBig: CLOSE_BIG_EN, foot: FOOT_EN,
    pillars: [
      { tag: 'Seat', num: '1', txt: 'MUDA’s <b>only</b> seat. Won in 2022 — defend it.' },
      { tag: 'New', num: '12,945', txt: '<b>12,945 new voters</b> since GE15 — and only 48% turned out in 2022 (2018: 87%). Every vote needs to be found again.' },
      { tag: 'Floods', num: '13,000', txt: 'March 2025 flash floods: <b>13,000 evacuated</b>, JB hit hardest — and it has happened again.' },
      CUKAI_EN,
    ],
    closeSub: 'MUDA candidate: <b>Rashifa Aljunied</b> · Polling day Saturday, <b>11 July</b>.',
  },
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
for (const [name, data] of [...Object.entries(SEATS), ...Object.entries(SEATS_EN)]) {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 })
  await page.addInitScript((d) => { window.__POSTER__ = d }, data)
  await page.goto(`file://${here}poster.html`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(200)
  const h = await page.evaluate(() => document.querySelector('.poster').scrollHeight)
  const footOk = await page.evaluate(() => document.querySelector('.foot').getBoundingClientRect().bottom <= 1920)
  console.log(`${name}: content ${h}px, fits=${h <= 1920}, footer=${footOk}`)
  await page.screenshot({ path: `${out}${name}.png` })
  await page.close()
}
await browser.close()
console.log('rendered 6 seat posters (bm + en) (png)')
