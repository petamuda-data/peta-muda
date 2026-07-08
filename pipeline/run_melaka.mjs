// Lean Melaka build. Election corpus comes from the MECo GitHub-raw mirrors
// (CC0, same author as electiondata.my — verified to carry all 28 Melaka DUNs
// including PRN 2021, labelled SE-15 in the corpus) so the build also works
// where lake.electiondata.my is unreachable; socio-economics come from the
// same data.gov.my datasets as Johor and degrade gracefully when offline.
// No prices/saluran/kawasanku/crime — the app no longer renders them, and no
// Melaka saluran dataset has been published (only jhr/nsn exist on the lake).
// Invoke with PIPELINE_STATE=Melaka so the shared steps filter correctly:
//   PIPELINE_STATE=Melaka EDITION=muda node pipeline/run_melaka.mjs
// Output: site/data/melaka/{index.json, seats/*.json, dun.geojson}
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { STATE, EDITION } from './config.mjs'
import { fetchText } from './lib/fetch.mjs'
import { parseCsvObjects } from './lib/csv.mjs'
import { seatCode, seatName, slugify } from './steps/seats.mjs'
import { buildHistory } from './steps/history.mjs'
import { loadGeo } from './steps/geo.mjs'

if (STATE !== 'Melaka') {
  console.error('run_melaka.mjs must be invoked with PIPELINE_STATE=Melaka')
  process.exit(1)
}

const MIRROR = {
  ballots: 'https://raw.githubusercontent.com/Thevesh/paper-meco-results/main/data/consol_ballots.csv',
  stats: 'https://raw.githubusercontent.com/Thevesh/paper-meco-results/main/data/consol_stats.csv',
  votersGe15: 'https://raw.githubusercontent.com/Thevesh/analysis-election-msia/main/data/voters_ge15.csv',
  // one row per DUN with income_median/gini/poverty/unemployment (2020 census);
  // GitHub-raw so it works where data.gov.my is unreachable
  censusDun: 'https://raw.githubusercontent.com/Thevesh/analysis-election-msia/main/data/census_dun.csv',
}

const OUT = path.join('site', 'data', 'melaka')
const t0 = Date.now()
const log = (msg) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${msg}`)

// The 9 shortlisted DUNs, matched BY NAME (codes are re-derived from live
// data so a naming variant like Kelebang/Klebang can't star the wrong seat).
const FOCUS_NAMES = new Set([
  'gadek', 'machap jaya', 'paya rumput', 'kelebang', 'klebang',
  'pengkalan batu', 'bukit katil', 'kesidang', 'duyong', 'bemban',
])

// ---- seat spine + GE15 roll from the voters mirror (28 rows, has parlimen) ----
log('loading GE15 voter roll (MECo mirror)')
const voterRows = parseCsvObjects(await fetchText(MIRROR.votersGe15)).filter(r => r.state === STATE)
if (voterRows.length !== 28) throw new Error(`expected 28 Melaka DUN rows in voters_ge15, got ${voterRows.length}`)
const num = (v) => (v === '' || v == null ? null : Number(v))
const band = (r, b) => (num(r[`male_${b}`]) ?? 0) + (num(r[`female_${b}`]) ?? 0)
const seats = voterRows.map(r => {
  const code = seatCode(r.dun)
  const name = seatName(r.dun)
  return {
    code,
    name,
    seat: r.dun,
    slug: slugify(code, name),
    state: STATE,
    parlimen: r.parlimen,
    kpdn_districts: [],
    featured: FOCUS_NAMES.has(name.toLowerCase()),
  }
}).sort((a, b) => Number(a.code.slice(2)) - Number(b.code.slice(2)))
log(`seats: ${seats.length} (focus: ${seats.filter(s => s.featured).map(s => s.code).join(', ')})`)

// GE-15 (Nov 2022) is the freshest gazetted Melaka roll until the next PRN is
// called; the mirror has no ethnicity columns, so `ethnic` is honestly null
// (the app skips the ethnic bars when absent).
const ROLL_ID = 'GE-15'
const demographics = new Map(voterRows.map(r => {
  const rec = {
    election: ROLL_ID,
    date: '2022-11-19',
    voters_total: num(r.total),
    sex_male: ['18_20', '21_29', '30_39', '40_49', '50_59', '60_69', '70_79', '80_89', '90+'].reduce((a, b) => a + (num(r[`male_${b}`]) ?? 0), 0),
    sex_female: ['18_20', '21_29', '30_39', '40_49', '50_59', '60_69', '70_79', '80_89', '90+'].reduce((a, b) => a + (num(r[`female_${b}`]) ?? 0), 0),
    age: {
      age_18_20: band(r, '18_20'), age_21_29: band(r, '21_29'), age_30_39: band(r, '30_39'),
      age_40_49: band(r, '40_49'), age_50_59: band(r, '50_59'), age_60_69: band(r, '60_69'),
      age_70_79: band(r, '70_79'), age_80_89: band(r, '80_89'), 'age_90+': band(r, '90+'),
    },
    ethnic: null,
    votertype: {
      regular: num(r.votertype_regular),
      early: (num(r.votertype_early_army) ?? 0) + (num(r.votertype_early_police) ?? 0),
      postal_overseas: num(r.votertype_postal_overseas),
    },
  }
  return [seatCode(r.dun), [rec]]
}))

// ---- history from the MECo consolidated mirror (same schema as the lake) ----
log('loading election history (MECo mirror)')
const [ballotsText, statsText] = await Promise.all([fetchText(MIRROR.ballots), fetchText(MIRROR.stats)])
const history = buildHistory(ballotsText, statsText, seats)

// ---- socio from the census_dun mirror (GitHub-raw; one 2020 row per DUN),
// shaped to the same {income:[], inequality:[], poverty:[], labour:[]} the app
// reads. Single-vintage, so each series has one entry — enough for the income
// context card; no data.gov.my dependency. ----
log('loading socioeconomic series (census_dun mirror)')
const socio = await (async () => {
  const out = new Map(seats.map(s => [s.code, {}]))
  try {
    const rows = parseCsvObjects(await fetchText(MIRROR.censusDun)).filter(r => r.state === STATE)
    const byName = new Map(rows.map(r => [seatName(r.dun).toLowerCase(), r]))
    for (const seat of seats) {
      const r = byName.get(seat.name.toLowerCase())
      if (!r) continue
      const date = `${r.year ?? '2020'}-01-01`
      out.set(seat.code, {
        income: r.income_median ? [{ date, income_median: num(r.income_median), income_mean: num(r.income_avg) }] : [],
        inequality: r.gini ? [{ date, gini: num(r.gini) }] : [],
        poverty: r.poverty_incidence != null && r.poverty_incidence !== '' ? [{ date, poverty_absolute: num(r.poverty_incidence) }] : [],
        labour: r.labour_unemployment_rate ? [{ date, u_rate: num(r.labour_unemployment_rate) }] : [],
      })
    }
  } catch (e) {
    log(`census_dun unavailable (${e.message}), skipping socio`)
  }
  return { get: (code) => out.get(code) ?? {} }
})()

// ---- boundaries (DOSM national geojson, filtered to Melaka by the step) ----
log('loading boundaries')
const { geojson, bboxes } = await loadGeo(seats)

// ---- manual Melaka content ----
const readManual = async (file, fallback) => {
  try { return JSON.parse(await readFile(path.join('data', 'manual', 'melaka', file), 'utf8')) }
  catch { log(`no manual melaka/${file}, using defaults`); return fallback }
}
const prn = await readManual('prn.json', { election: {} })
const issuesManual = await readManual('issues.json', { seats: {}, statewide: [] })
const nationalIssues = JSON.parse(await readFile(path.join('data', 'manual', 'national_issues.json'), 'utf8')).issues ?? []
let mudaStances = null
let mudaRecord = null
if (EDITION === 'muda') {
  mudaStances = await readManual('muda_stances.json', null)
  try { mudaRecord = JSON.parse(await readFile(path.join('data', 'manual', 'muda_record.json'), 'utf8')) } catch { /* optional */ }
}

// Election meta: no Melaka polling date exists yet — the assembly's term ends
// Dec 2026, polls due by late Feb 2027. The app hides countdown/GOTV/contest
// cards while polling_date is null.
const election = {
  id: 'MLK-PRN-NEXT',
  name_bm: 'Pilihan Raya Negeri Melaka (PRN)',
  name_en: 'Melaka State Election',
  polling_date: null,
  early_voting_date: null,
  nomination_date: null,
  roll_id: ROLL_ID,
  ...prn.election,
}

// ---- assemble ----
await mkdir(path.join(OUT, 'seats'), { recursive: true })
const summaries = []
for (const seat of seats) {
  const demo = demographics.get(seat.code) ?? []
  const current = demo[0] ?? null
  const completed = (history.get(seat.code) ?? []).filter(c => c.status === 'completed')
  const last = completed[0] ?? null
  const youth = current ? +((100 * (current.age.age_18_20 + current.age.age_21_29)) / current.voters_total).toFixed(1) : null

  const seatJson = {
    ...seat,
    bbox: bboxes.get(seat.code) ?? null,
    election2026: {
      ...election,
      is_target: seat.featured,
      ballot: null,
      result_date: null,
      voters_total: current?.voters_total ?? null,
      muda_candidate: null,
      bloc_party: null,
    },
    demographics: demo,
    history: completed,
    saluran2022: null,
    socio: socio.get(seat.code) ?? {},
    kawasanku: null,
    prices: null,
    local_issues: {
      seat: issuesManual.seats?.[seat.code] ?? [],
      statewide: issuesManual.statewide ?? [],
      updated: issuesManual.updated ?? null,
    },
    muda_stances: mudaStances
      ? (mudaStances.themes ?? []).filter(t => t.statewide || (t.applies_to ?? []).includes(seat.code))
      : null,
  }
  await writeFile(path.join(OUT, 'seats', `${seat.slug}.json`), JSON.stringify(seatJson))

  summaries.push({
    code: seat.code, name: seat.name, slug: seat.slug, parlimen: seat.parlimen,
    kpdn_district: null, featured: seat.featured,
    muda_candidate: null, bloc_party: null,
    n_candidates_2026: null,
    voters_total: current?.voters_total ?? null,
    youth_perc: youth,
    income_median: socio.get(seat.code)?.income?.at(-1)?.income_median ?? null,
    income_year: socio.get(seat.code)?.income?.at(-1)?.date?.slice(0, 4) ?? null,
    u_rate: socio.get(seat.code)?.labour?.at(-1)?.u_rate ?? null,
    last_result: last ? (() => {
      const w = last.ballot.find(b => (b.result ?? '').startsWith('won')) ?? last.ballot[0] ?? null
      return {
        date: last.date, election: last.election,
        winner: w?.name ?? null, party: w?.party ?? null, coalition: w?.coalition ?? null,
        majority_perc: last.majority_perc ?? null,
        turnout_perc: last.voter_turnout_perc ?? null,
      }
    })() : null,
  })
}

// Undi18 statewide rollup from the current roll (neutral demographic fact)
const undi18 = (() => {
  let total_18_20 = 0, total_voters = 0
  const by_seat = []
  for (const seat of seats) {
    const cur = (demographics.get(seat.code) ?? [])[0]
    if (!cur) continue
    const n = cur.age?.age_18_20 ?? 0
    total_18_20 += n
    total_voters += cur.voters_total ?? 0
    by_seat.push({ code: seat.code, name: seat.name, slug: seat.slug, n_18_20: n, voters_total: cur.voters_total ?? null, perc: cur.voters_total ? +(100 * n / cur.voters_total).toFixed(1) : null })
  }
  by_seat.sort((a, b) => b.n_18_20 - a.n_18_20)
  return { roll: ROLL_ID, total_18_20, total_voters, perc: total_voters ? +(100 * total_18_20 / total_voters).toFixed(1) : null, by_seat }
})()

// MUDA's Melaka footprint, computed from the corpus rather than curated.
// (Expected: none — MUDA was registered on 23 Dec 2021, a month AFTER the
// Nov 2021 Melaka election — so this ships null unless the data says otherwise.)
const mudaMelaka = EDITION === 'muda' ? (() => {
  const contests = []
  for (const seat of seats) {
    for (const c of history.get(seat.code) ?? []) {
      if (c.status !== 'completed') continue
      const m = c.ballot.find(b => b.party === 'MUDA')
      if (!m) continue
      contests.push({ code: seat.code, name: seat.name, slug: seat.slug, date: c.date, votes: m.votes ?? null, perc: m.votes_perc ?? null, won: (m.result ?? '').startsWith('won') })
    }
  }
  contests.sort((a, b) => (b.perc ?? 0) - (a.perc ?? 0))
  if (!contests.length) return null
  return { election: contests[0].date >= '2021-11-01' ? 'PRN-2021' : 'various', date: contests[0].date, seats_contested: contests.length, won: contests.filter(c => c.won).length, contests }
})() : null

const index = {
  built_at: new Date().toISOString(),
  state: STATE,
  election,
  seats: summaries,
  edition: EDITION,
  national_issues: nationalIssues,
  johor_context: { crime: null, undi18, muda: mudaMelaka },
  muda_record: mudaRecord,
  source_health: null,
  attribution: [
    { name: 'ElectionData.MY / MECo corpus (CC0)', url: 'https://electiondata.my' },
    { name: 'data.gov.my / OpenDOSM (CC BY 4.0)', url: 'https://data.gov.my' },
  ],
}
await writeFile(path.join(OUT, 'index.json'), JSON.stringify(index))
await writeFile(path.join(OUT, 'dun.geojson'), JSON.stringify(geojson))

// ---- sanity ----
const withDemo = summaries.filter(s => s.voters_total).length
const withResult = summaries.filter(s => s.last_result).length
log(`sanity: demographics=${withDemo}/28 results=${withResult}/28 geo=${geojson.features.length}/28`)
const bemban = summaries.find(s => s.name.toLowerCase() === 'bemban')
if (bemban) log(`Bemban check: voters=${bemban.voters_total} last=${bemban.last_result?.winner} (${bemban.last_result?.party}) majority=${bemban.last_result?.majority_perc}%`)
if (withDemo < 24 || withResult < 24 || geojson.features.length < 24) {
  console.error('SANITY FAIL: too many Melaka seats missing core data')
  process.exit(1)
}
log('done')
