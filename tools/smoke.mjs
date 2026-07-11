// Release smoke test: drives the built site in headless Chromium and asserts
// the product surface end-to-end (home, seat Field/Analysis, briefing builder,
// volunteer hub, cross-region links, language toggle, about page).
// Fails on page/console errors, any FAIL check, or horizontal overflow.
//
// Run:  npm i --no-save playwright   (browsers are pre-installed in CI/dev
//       images via PLAYWRIGHT_BROWSERS_PATH; never add playwright to deps)
//       node tools/smoke.mjs
//
// Date-aware: GOTV assertions flip automatically once Johor's polling day has
// passed (the card hides itself), and the contest card is accepted in both
// its pre-results ("Pertandingan") and results-in ("Keputusan") forms.
import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const server = spawn('node', ['tools/serve.mjs'], { cwd: ROOT, stdio: 'pipe' })
await new Promise(r => setTimeout(r, 1500))

// Johor GOTV window: the card renders only until polling day (inclusive)
const johorIdx = JSON.parse(await readFile(new URL('../site/data/index.json', import.meta.url), 'utf8'))
const today = new Date(); today.setHours(0, 0, 0, 0)
const gotvActive = !!johorIdx.election?.polling_date && new Date(`${johorIdx.election.polling_date}T00:00:00`) >= today

const exe = process.env.CHROMIUM_PATH ?? (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined)
const browser = await chromium.launch(exe ? { executablePath: exe } : {})
const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'], viewport: { width: 390, height: 844 } })
const page = await context.newPage()
const errors = []
page.on('pageerror', e => errors.push(`pageerror: ${e.message}`))
page.on('console', m => { if (m.type() === 'error') errors.push(`console: ${m.text()}`) })

const base = 'http://127.0.0.1:8123'
const checks = []
const has = async (label, needle) => {
  const body = await page.evaluate(() => document.body.innerText)
  checks.push(`${body.toLowerCase().includes(needle.toLowerCase()) ? 'PASS' : 'FAIL'} ${label}: "${needle}"`)
}
const lacks = async (label, needle) => {
  const body = await page.evaluate(() => document.body.innerText)
  checks.push(`${body.toLowerCase().includes(needle.toLowerCase()) ? 'FAIL (present!)' : 'PASS'} ${label} absent: "${needle}"`)
}
const noOverflow = async (label) => {
  const w = await page.evaluate(() => document.documentElement.scrollWidth)
  checks.push(`${w <= 390 ? 'PASS' : 'FAIL'} ${label} no horizontal overflow (scrollWidth ${w})`)
}

// ---- home (BM, fresh visitor => Melaka is the default front) ----
await page.goto(`${base}/#/`, { waitUntil: 'networkidle' })
const freshMlk = await page.evaluate(() => document.querySelector('.state-toggle button[data-state="melaka"]')?.classList.contains('active') ?? false)
checks.push(`${freshMlk ? 'PASS' : 'FAIL'} fresh visitor defaults to Melaka (MLK=${freshMlk})`)
await has('fork volunteer btn', 'Saya sukarelawan')
await lacks('locate button removed', 'Guna lokasi saya')
await has('find-seat search button kept', 'Cari kerusi anda')
await lacks('custom install chip removed', 'Pasang aplikasi')
await lacks('cost-trend card cut', 'penunjuk lebih tinggi daripada setahun lalu')
await lacks('crime card cut', 'Jenayah di Johor')
await has('MUDA voice card present', 'Apa MUDA kata tentang isu semasa')
await has('MUDA voice card is attributed', 'sumber')
await lacks('no weather-alerts card on home', 'Amaran cuaca')
await lacks('no flood-alerts card on home', 'Amaran banjir langsung')
await noOverflow('home')

// ---- seat FIELD (Johor seat: also exercises the cross-region auto-switch) ----
await page.goto(`${base}/#/seat/n01-buloh-kasap/field`, { waitUntil: 'networkidle' })
await page.waitForTimeout(600)
const tabDefs = await page.$$eval('.tabs button', bs => bs.map(b => b.dataset.tab))
checks.push(`${tabDefs.length === 2 && tabDefs[0] === 'field' && tabDefs[1] === 'hq' && !tabDefs.includes('brief') ? 'PASS' : 'FAIL'} exactly 2 tabs field+hq, no brief (${tabDefs.join(',')})`)
const hero = await page.locator('.card.hero').count()
checks.push(`${hero === 0 ? 'PASS' : 'FAIL'} black hero card removed (${hero})`)
const posterSrcBm = await page.evaluate(() => document.querySelector('img.poster-img')?.getAttribute('src') || '')
checks.push(`${/^posters\/[a-z-]+\.png$/.test(posterSrcBm) && !posterSrcBm.includes('-en') ? 'PASS' : 'FAIL'} BM poster file has no -en suffix (${posterSrcBm})`)
const mono = await page.locator('.seat-head .monogram').count()
checks.push(`${mono === 1 ? 'PASS' : 'FAIL'} monogram plate (${mono})`)
if (gotvActive) {
  await has('GOTV on Field (poll window open)', 'Jom keluar mengundi')
  const sprLink = await page.locator('a[href^="https://mysprsemak.spr.gov.my"]').count()
  checks.push(`${sprLink === 1 ? 'PASS' : 'FAIL'} SPR semak link on Field (${sprLink})`)
  const waBtn = await page.locator('a.btn.wa').count()
  checks.push(`${waBtn === 1 ? 'PASS' : 'FAIL'} WhatsApp .wa button: GOTV only (${waBtn})`)
} else {
  await lacks('GOTV auto-hidden after polling day', 'Jom keluar mengundi')
}
await has('poster download btn on Field', 'poster')
const posterImg = await page.evaluate(() => { const i = document.querySelector('img.poster-img'); return i ? i.naturalWidth : 0 })
checks.push(`${posterImg > 0 ? 'PASS' : 'FAIL'} poster image visible by default (naturalWidth ${posterImg})`)
const storyOl = await page.locator('ol.story').count()
checks.push(`${storyOl === 0 ? 'PASS' : 'FAIL'} duplicate story card removed (ol.story: ${storyOl})`)
await lacks('duplicate issues card removed', 'Isu tempatan (disahkan sumber)')
const bodyF = await page.evaluate(() => document.body.innerText)
checks.push(`${!/beat 4|langkah 4/.test(bodyF) ? 'PASS' : 'FAIL'} no positional 'beat 4/langkah 4' reference`)
await lacks('income card off Field', 'Berbanding penengah')
await lacks('no weather-alerts card on seat', 'Amaran cuaca')
await lacks('no flood-alerts card on seat', 'Amaran banjir langsung')
await noOverflow('seat field top')

// ---- seat default tab is FIELD, and Lapangan is the first tab ----
await page.goto(`${base}/#/seat/n51-bukit-batu`, { waitUntil: 'networkidle' })
await page.waitForTimeout(400)
await has('bare seat URL opens Field', 'Cerita kempen')
const firstTab = await page.locator('.tabs button').first().getAttribute('data-tab')
checks.push(`${firstTab === 'field' ? 'PASS' : 'FAIL'} Lapangan is the first tab (${firstTab})`)
const backBtns = await page.locator('a.btn[href="#/"], .crumbs a[href="#/"]').count()
checks.push(`${backBtns >= 2 ? 'PASS' : 'FAIL'} prominent back buttons on seat page (${backBtns})`)

// ---- seat field (n51) ----
await page.goto(`${base}/#/seat/n51-bukit-batu/field`, { waitUntil: 'networkidle' })
await page.waitForTimeout(400)
await has('campaign-story group in builder', 'Cerita kempen')
const heroN51Count = await page.locator('.card.hero').count()
checks.push(`${heroN51Count === 0 ? 'PASS' : 'FAIL'} n51 Field has no black hero (${heroN51Count})`)
await has('talking points groups', 'Tempatan')
await has('MUDA-first talking points', 'MUDA:')
await has('issue as context under MUDA line', 'Isu di sini')
await has('AI briefing button lives on Field tab', 'Briefing AI')
await has('notes card kept', 'Nota lapangan')
await lacks('stances card merged away', 'Jawapan MUDA untuk isu tempatan')
await lacks('record card merged away', 'Rekod calon')
await lacks('premises cut', 'Premis harga terdekat')
await lacks('demographics moved off field', 'Profil pengundi')
await noOverflow('seat field')

// ---- seat analysis ----
await page.goto(`${base}/#/seat/n51-bukit-batu/hq`, { waitUntil: 'networkidle' })
await page.waitForTimeout(400)
await has('history kept', 'Sejarah keputusan')
await has('saluran kept', 'Analisis daerah mengundi')
await has('demographics moved here', 'Profil pengundi')
await has('johor roll ethnicity bars', 'Etnik pengundi')
await lacks('no census fallback on johor', 'banci 2020')
await lacks('kawasanku cut', 'Penunjuk kawasan')
await lacks('socio series cut', 'Siri sosioekonomi')
await has('income moved to Analysis', 'Konteks pendapatan')
await has('growth since 2019 row', 'Pertumbuhan sejak 2019')
const incHq = await page.evaluate(() => [...document.querySelectorAll('.card h2')].find(h => /Konteks pendapatan/i.test(h.textContent))?.closest('.card')?.innerText || '')
checks.push(`${/nasional/.test(incHq) && /Johor/.test(incHq) ? 'PASS' : 'FAIL'} income % vs national+state on Analysis`)
checks.push(`${/Pendapatan \(nilai 2024\)/.test(incHq) ? 'PASS' : 'FAIL'} real-terms row on Analysis income card`)
const contestHdr = await page.evaluate(() => [...document.querySelectorAll('.card h2')].some(h => /Pertandingan 11 Julai|Keputusan 11 Julai/i.test(h.textContent)))
checks.push(`${contestHdr ? 'PASS' : 'FAIL'} contest/results card on Analysis`)
await noOverflow('seat analysis')

// ---- cross-region deep links just work in both directions ----
await page.goto(`${base}/#/seat/n01-kuala-linggi/hq`, { waitUntil: 'networkidle' })
await page.waitForTimeout(700)
const xH1 = await page.evaluate(() => document.querySelector('h1')?.innerText || '')
const xMlk = await page.evaluate(() => document.querySelector('.state-toggle button[data-state="melaka"]')?.classList.contains('active') ?? false)
checks.push(`${/KUALA LINGGI/i.test(xH1) && xMlk ? 'PASS' : 'FAIL'} melaka deep link auto-switches region (${xH1}, MLK=${xMlk})`)
await has('melaka census ethnicity bars', 'banci 2020')
await has('melaka bumiputera label', 'Bumiputera')
await page.goto(`${base}/#/seat/n51-bukit-batu/hq`, { waitUntil: 'networkidle' })
await page.waitForTimeout(700)
const xJhr = await page.evaluate(() => document.querySelector('.state-toggle button[data-state="johor"]')?.classList.contains('active') ?? false)
checks.push(`${xJhr ? 'PASS' : 'FAIL'} johor deep link switches back (JHR=${xJhr})`)

// ---- volunteer hub (region is johor at this point in the flow) ----
await page.goto(`${base}/#/volunteer`, { waitUntil: 'networkidle' })
await page.waitForTimeout(400)
await lacks('AI briefing btn removed from hub', 'Dapatkan briefing AI')
await has('build script link', 'Bina skrip')
await has('hub retitled to script', 'Skrip sukarelawan')
const volBtns = await page.locator('#volList .vol-row a.btn[href*="/field"]').count()
const volRows = await page.locator('#volList .vol-row').count()
checks.push(`${volBtns === volRows && volRows > 0 ? 'PASS' : 'FAIL'} exactly one build-script link per seat row (${volBtns} links / ${volRows} rows)`)
await noOverflow('volunteer hub')
// builder flow: hub link -> Field builder -> 3 pre-checked -> uncheck 1 -> copy
await page.locator('#volList .vol-row a.btn[href*="/field"]').first().click()
await page.waitForTimeout(700)
const tpTotal = await page.locator('#tpBuilder input[type=checkbox]').count()
const tpChecked = await page.locator('#tpBuilder input[type=checkbox]:checked').count()
checks.push(`${tpTotal >= 8 && tpChecked === 3 ? 'PASS' : 'FAIL'} builder all-in: 3 pre-checked of ${tpTotal} (issues uncapped)`)
const tpGroups = await page.$$eval('#tpBuilder h3', hs => hs.map(h => h.textContent))
checks.push(`${tpGroups.some(g => /Cerita kempen/i.test(g)) ? 'PASS' : 'FAIL'} builder includes campaign-story group (${tpGroups.length} h3s)`)
const prev0 = await page.evaluate(() => document.getElementById('tpPreview')?.textContent || '')
checks.push(`${(prev0.match(/•/g) || []).length === 3 && prev0.includes('skrip rumah ke rumah') ? 'PASS' : 'FAIL'} builder preview shows exactly the 3 selected points`)
await page.locator('#tpBuilder input[type=checkbox]:checked').first().uncheck()
await page.waitForTimeout(200)
const prev1 = await page.evaluate(() => document.getElementById('tpPreview')?.textContent || '')
checks.push(`${(prev1.match(/•/g) || []).length === 2 ? 'PASS' : 'FAIL'} unchecking updates preview live (2 bullets)`)
await page.locator('#tpCopy').click()
await page.waitForTimeout(500)
const clip = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '')
checks.push(`${clip === prev1 && (clip.match(/•/g) || []).length === 2 ? 'PASS' : 'FAIL'} copy puts exactly the previewed briefing on the clipboard`)

// ---- language toggle: BM <-> EN only, zh falls back to bm ----
await page.evaluate(() => { localStorage.setItem('lang', 'zh'); location.hash = '#/'; location.reload() })
await page.waitForTimeout(800)
await has('zh localStorage falls back to BM', 'Saya sukarelawan')
await page.evaluate(() => { localStorage.setItem('lang', 'en'); location.reload() })
await page.waitForTimeout(800)
await has('EN works', 'Find your seat')
await page.goto(`${base}/#/seat/n01-buloh-kasap/field`, { waitUntil: 'networkidle' })
await page.waitForTimeout(400)
const posterSrcEn = await page.evaluate(() => document.querySelector('img.poster-img')?.getAttribute('src') || '')
const posterNaturalWidth = await page.evaluate(() => document.querySelector('img.poster-img')?.naturalWidth || 0)
checks.push(`${posterSrcEn.endsWith('-en.png') && posterNaturalWidth > 0 ? 'PASS' : 'FAIL'} EN language shows the -en poster variant (${posterSrcEn}, w=${posterNaturalWidth})`)

// ---- about page ----
await page.goto(`${base}/#/about`, { waitUntil: 'networkidle' })
await page.waitForTimeout(400)
await has('about page problem 1', 'volunteers are willing, but not confident')
await has('about page problem 2', 'stopped opening the door for politics')
await has('about page poster mechanism', 'Before the door, not just at it')
await noOverflow('about page')
await page.goto(`${base}/#/`, { waitUntil: 'networkidle' })
await page.waitForTimeout(300)
const aboutLink = await page.locator('#footer a[href="#/about"]').count()
checks.push(`${aboutLink === 1 ? 'PASS' : 'FAIL'} footer About link present (${aboutLink})`)

console.log(checks.join('\n'))
console.log(errors.length ? `\nERRORS:\n${errors.join('\n')}` : '\nNO PAGE/CONSOLE ERRORS')
await browser.close()
server.kill()
process.exit(errors.length || checks.some(c => c.startsWith('FAIL')) ? 1 : 0)
