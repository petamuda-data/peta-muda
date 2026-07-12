// Release smoke test: drives the built site in headless Chromium and asserts
// the product surface end-to-end (home, seat Field/Analysis, talking-points
// builder, volunteer hub, language toggle, about page). The app is pinned to
// Melaka — Johor deep links must land on home.
// Fails on page/console errors, any FAIL check, or horizontal overflow.
//
// Run:  npm i --no-save playwright   (browsers are pre-installed in CI/dev
//       images via PLAYWRIGHT_BROWSERS_PATH; never add playwright to deps)
//       node tools/smoke.mjs
//
// Date-aware: GOTV assertions flip automatically once Melaka's PRN is called
// and its polling day set (until then the card is absent).
import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const server = spawn('node', ['tools/serve.mjs'], { cwd: ROOT, stdio: 'pipe' })
await new Promise(r => setTimeout(r, 1500))

// Melaka GOTV window: the card renders only once polling_date is set and
// until polling day (inclusive)
const melakaIdx = JSON.parse(await readFile(new URL('../site/data/melaka/index.json', import.meta.url), 'utf8'))
const today = new Date(); today.setHours(0, 0, 0, 0)
const gotvActive = !!melakaIdx.election?.polling_date && new Date(`${melakaIdx.election.polling_date}T00:00:00`) >= today

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

// ---- home (BM, fresh visitor) ----
await page.goto(`${base}/#/`, { waitUntil: 'networkidle' })
const stateToggles = await page.locator('.state-toggle').count()
checks.push(`${stateToggles === 0 ? 'PASS' : 'FAIL'} region toggle gone from header (${stateToggles})`)
await has('home is Melaka', 'Pusat Data Kerusi DUN Melaka')
const langBtns = await page.$$eval('#langToggle button', bs => bs.map(b => ({ t: b.textContent, on: b.classList.contains('active') })))
checks.push(`${langBtns.length === 2 && langBtns[0].t === 'BM' && langBtns[1].t === 'EN' ? 'PASS' : 'FAIL'} BM and EN both visible in header (${langBtns.map(b => b.t).join(',')})`)
checks.push(`${langBtns[0]?.on && !langBtns[1]?.on ? 'PASS' : 'FAIL'} BM segment active by default`)
const brandBoxed = await page.evaluate(() => {
  const m = document.querySelector('.brand-mark')
  return m ? getComputedStyle(m).borderTopWidth !== '0px' : true
})
checks.push(`${!brandBoxed ? 'PASS' : 'FAIL'} brand is a wordmark, not a boxed button`)
const forkAbout = await page.locator('.card.fork a.fork-about[href="#/about"]').count()
checks.push(`${forkAbout === 1 ? 'PASS' : 'FAIL'} prominent About link in the first card (${forkAbout})`)
await has('fork volunteer btn', 'Saya sukarelawan')
await lacks('locate button removed', 'Guna lokasi saya')
await has('find-seat search button kept', 'Cari kerusi anda')
await lacks('custom install chip removed', 'Pasang aplikasi')
await lacks('cost-trend card cut', 'penunjuk lebih tinggi daripada setahun lalu')
await lacks('crime card cut', 'Jenayah di')
await has('MUDA voice card present', 'Apa MUDA kata tentang isu semasa')
await has('MUDA voice card is attributed', 'sumber')
await lacks('no weather-alerts card on home', 'Amaran cuaca')
await lacks('no flood-alerts card on home', 'Amaran banjir langsung')
await noOverflow('home')

// ---- seat FIELD (Melaka seat) ----
await page.goto(`${base}/#/seat/n01-kuala-linggi/field`, { waitUntil: 'networkidle' })
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
  await lacks('GOTV hidden until Melaka polling day is set', 'Jom keluar mengundi')
}
await has('poster download btn on Field', 'poster')
// poster sits below the talking points and lazy-loads; scroll it into view
await page.evaluate(() => document.querySelector('img.poster-img')?.scrollIntoView())
await page.waitForTimeout(600)
const posterImg = await page.evaluate(() => { const i = document.querySelector('img.poster-img'); return i ? i.naturalWidth : 0 })
checks.push(`${posterImg > 0 ? 'PASS' : 'FAIL'} poster image renders inline (naturalWidth ${posterImg})`)
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
await page.goto(`${base}/#/seat/n07-gadek`, { waitUntil: 'networkidle' })
await page.waitForTimeout(400)
await has('bare seat URL opens Field', 'Isu untuk rumah ke rumah')
const firstTab = await page.locator('.tabs button').first().getAttribute('data-tab')
checks.push(`${firstTab === 'field' ? 'PASS' : 'FAIL'} Lapangan is the first tab (${firstTab})`)
const backBtns = await page.locator('a.btn[href="#/"], .crumbs a[href="#/"]').count()
checks.push(`${backBtns >= 2 ? 'PASS' : 'FAIL'} prominent back buttons on seat page (${backBtns})`)

// ---- seat field (n07 Gadek — featured, has curated issues) ----
await page.goto(`${base}/#/seat/n07-gadek/field`, { waitUntil: 'networkidle' })
await page.waitForTimeout(400)
await has('campaign-story group in builder', 'Cerita kempen')
const heroN07Count = await page.locator('.card.hero').count()
checks.push(`${heroN07Count === 0 ? 'PASS' : 'FAIL'} n07 Field has no black hero (${heroN07Count})`)
await has('talking points groups', 'Tempatan')
await has('MUDA-first talking points', 'MUDA:')
await has('issue as context under MUDA line', 'Isu di sini')
await has('curated-talking-points button on Field tab', 'Poin perbualan terpilih')
await has('notes card kept', 'Nota lapangan')
await lacks('stances card merged away', 'Jawapan MUDA untuk isu tempatan')
await lacks('record card merged away', 'Rekod calon')
await lacks('premises cut', 'Premis harga terdekat')
await lacks('demographics moved off field', 'Profil pengundi')
await noOverflow('seat field')

// ---- seat analysis ----
await page.goto(`${base}/#/seat/n01-kuala-linggi/hq`, { waitUntil: 'networkidle' })
await page.waitForTimeout(400)
await has('history kept', 'Sejarah keputusan')
await has('demographics moved here', 'Profil pengundi')
// ethnicity renders either as real roll bars (lake reachable at build) or the
// census population fallback (offline build) — assert the section + a shared
// category row, path-agnostically
await has('melaka voter-ethnicity section present', 'Etnik')
await has('melaka ethnicity has category rows', 'Cina')
await lacks('kawasanku cut', 'Penunjuk kawasan')
await lacks('socio series cut', 'Siri sosioekonomi')
await has('income moved to Analysis', 'Konteks pendapatan')
const incHq = await page.evaluate(() => [...document.querySelectorAll('.card h2')].find(h => /Konteks pendapatan/i.test(h.textContent))?.closest('.card')?.innerText || '')
checks.push(`${/nasional/.test(incHq) && /Melaka/.test(incHq) ? 'PASS' : 'FAIL'} income % vs national+state on Analysis`)
await noOverflow('seat analysis')

// ---- app is Melaka-only: a Johor deep link lands on home ----
await page.goto(`${base}/#/seat/n51-bukit-batu/hq`, { waitUntil: 'networkidle' })
await page.waitForTimeout(700)
const jhrHash = await page.evaluate(() => location.hash)
const jhrBody = await page.evaluate(() => document.body.innerText)
checks.push(`${jhrHash === '#/' && /Pusat Data Kerusi DUN Melaka/i.test(jhrBody) ? 'PASS' : 'FAIL'} johor deep link redirects home (hash=${jhrHash})`)

// ---- talking-points export must actually work on a Melaka seat (regression:
// null roll ethnicity used to crash briefingMd, button silently did nothing) ----
await page.goto(`${base}/#/seat/n01-kuala-linggi/field`, { waitUntil: 'networkidle' })
await page.waitForTimeout(500)
await page.locator('#briefBtn').click()
await page.waitForTimeout(800)
const briefClip = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '')
checks.push(`${briefClip.includes('Talking Points') && /Ethnic/.test(briefClip) ? 'PASS' : 'FAIL'} talking-points export works on a Melaka seat (${briefClip.length} chars, ethnicity line present)`)

// ---- volunteer hub ----
await page.goto(`${base}/#/volunteer`, { waitUntil: 'networkidle' })
await page.waitForTimeout(400)
await lacks('AI briefing btn removed from hub', 'Dapatkan briefing AI')
await has('build script link', 'Bina skrip')
await has('hub retitled to script', 'Skrip sukarelawan')
const volBtns = await page.locator('#volList .vol-row a.btn[href*="/field"]').count()
const volRows = await page.locator('#volList .vol-row').count()
checks.push(`${volBtns === volRows && volRows === melakaIdx.seats.length ? 'PASS' : 'FAIL'} one build-script link per Melaka seat (${volBtns} links / ${volRows} rows / ${melakaIdx.seats.length} seats)`)
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
checks.push(`${clip === prev1 && (clip.match(/•/g) || []).length === 2 ? 'PASS' : 'FAIL'} copy puts exactly the previewed talking points on the clipboard`)

// ---- language toggle: BM <-> EN segments, zh falls back to bm ----
await page.evaluate(() => { localStorage.setItem('lang', 'zh'); location.hash = '#/'; location.reload() })
await page.waitForTimeout(800)
await has('zh localStorage falls back to BM', 'Saya sukarelawan')
await page.locator('#langToggle button[data-lang="en"]').click()
await page.waitForTimeout(600)
await has('EN segment click works', 'Find your seat')
const enActive = await page.$$eval('#langToggle button', bs => bs.map(b => b.classList.contains('active')))
checks.push(`${!enActive[0] && enActive[1] ? 'PASS' : 'FAIL'} EN segment shows active after click`)
await page.goto(`${base}/#/seat/n01-kuala-linggi/field`, { waitUntil: 'networkidle' })
await page.waitForTimeout(400)
await page.evaluate(() => document.querySelector('img.poster-img')?.scrollIntoView())
await page.waitForTimeout(600)
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
