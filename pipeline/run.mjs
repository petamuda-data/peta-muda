// Peta MUDA pipeline: joins electiondata.my (results, voter rolls, boundaries),
// data.gov.my / OpenDOSM (income, poverty, labour, CPI, fuel) and KPDN
// PriceCatcher (via storage.data.gov.my, discovered/health-checked through
// pasarapi.xyz) into static JSON consumed by the site in /site.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fetchJson } from './lib/fetch.mjs'
import { SOURCES, DATASET_IDS, ELECTION_2026, STATE, EDITION } from './config.mjs'
import { loadSeats } from './steps/seats.mjs'
import { loadHistory, loadCareers } from './steps/history.mjs'
import { loadSaluran } from './steps/saluran.mjs'
import { loadDemographics } from './steps/demographics.mjs'
import { loadKawasanku } from './steps/kawasanku.mjs'
import { loadSocio, loadDunParlimen, loadCpi, loadFuel } from './steps/socio.mjs'
import { loadPrices, mergeDistrict } from './steps/prices.mjs'
import { updatePriceHistory, buildCostTrend } from './steps/cost_of_living.mjs'
import { loadGeo } from './steps/geo.mjs'
import { loadCrime } from './steps/crime.mjs'
import { loadIntake } from './steps/intake.mjs'
import { loadAlerts } from './steps/alerts.mjs'

const OUT = path.join('site', 'data')
const t0 = Date.now()
const log = (msg) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${msg}`)

// ---- source health via pasarapi.xyz (best effort) ----
let health = null
try {
  const h = await fetchJson(SOURCES.pasarHealth)
  health = Object.fromEntries(DATASET_IDS.map(id => [id, h.health?.[id] ? { ok: h.health[id].ok, status: h.health[id].status } : null]))
  log('pasarapi health fetched')
} catch (e) {
  log(`pasarapi health unavailable: ${e.message}`)
}

// ---- load everything ----
log('loading DUN->parlimen crosswalk (data.gov.my)')
const dunParlimen = await loadDunParlimen()
log('loading seat spine (electiondata.my)')
const seats = await loadSeats(dunParlimen)
log(`seats: ${seats.length} (featured: ${seats.filter(s => s.featured).map(s => s.code).join(', ')})`)

log('loading election history (lake headline files)')
const history = await loadHistory(seats)
// career records for everyone on a 2026 ballot
const pendingUids = new Set()
for (const seat of seats) {
  for (const c of history.get(seat.code) ?? []) {
    if (c.status === 'upcoming') for (const b of c.ballot) if (b.uid) pendingUids.add(b.uid)
  }
}
log(`loading career records for ${pendingUids.size} 2026 candidates`)
const careers = pendingUids.size ? await loadCareers(pendingUids) : new Map()
log('loading saluran-level SE-15 results')
const saluran = await loadSaluran(seats)
log('loading voter demographics (incl. SE-16 roll)')
const demographics = await loadDemographics(seats)
log('loading kawasanku scorecard')
const kawasanku = await loadKawasanku(seats)
log('loading socioeconomic series (data.gov.my)')
const { socio } = await loadSocio(seats)
log('loading CPI + fuel')
const cpi = await loadCpi()
const fuel = await loadFuel()
log('loading crime (Johor context)')
const crime = await loadCrime()
log('loading PriceCatcher (this downloads a few MB per month on first run)')
const prices = await loadPrices()
log(`basket: ${prices.basket.map(b => `${b.key}=#${b.code}(${b.johor_coverage})`).join(' ')}`)
log('loading boundaries')
const { geojson, bboxes } = await loadGeo(seats)

// ---- manual 2026 contest info ----
let manual = { election: {}, seats: {} }
try {
  manual = JSON.parse(await readFile(path.join('data', 'manual', 'se16.json'), 'utf8'))
} catch { log('no manual se16.json, using config defaults') }

// ---- curated local issues (research-verified, hand-maintained) ----
let issuesManual = { seats: {}, statewide: [] }
try {
  issuesManual = JSON.parse(await readFile(path.join('data', 'manual', 'issues.json'), 'utf8'))
} catch { log('no manual issues.json, skipping local issues') }

// ---- intake queue: admin-approved ground reports + news (Supabase in CI,
// committed snapshot offline — see steps/intake.mjs) ----
const intake = await loadIntake(log)

// ---- live flood-warning feed (JPS via data.gov.my; snapshot fallback) ----
const liveAlerts = await loadAlerts(STATE, log)

// ---- curated national issues (research-verified, hand-maintained; neutral,
// both editions — sourced facts like issues.json, surfaced app-wide) ----
let nationalIssues = { issues: [] }
try {
  nationalIssues = JSON.parse(await readFile(path.join('data', 'manual', 'national_issues.json'), 'utf8'))
} catch { log('no manual national_issues.json, skipping national issues') }
// ---- CPI deflator (real-terms income): compound annual inflation to base_year
// so nominal HIES income can be expressed in constant ringgit at the door.
let cpiDeflator = null
try {
  const cpi = JSON.parse(await readFile(path.join('data', 'manual', 'cpi_malaysia.json'), 'utf8'))
  const rate = Object.fromEntries(cpi.series.map(r => [r.year, r.inflation_pct]))
  const mult = {}
  for (const { year } of cpi.series) {
    let m = 1
    for (let y = year + 1; y <= cpi.base_year; y++) if (rate[y] != null) m *= 1 + rate[y] / 100
    mult[year] = Number(m.toFixed(6))
  }
  cpiDeflator = { base_year: cpi.base_year, mult, source: cpi.sources?.[0] ?? '', verdict: cpi.verdict ?? '' }
} catch { /* cpi optional */ }


// ---- government price ceilings (hand-maintained; neutral, both editions) ----
let priceCeilings = { items: {} }
try {
  priceCeilings = JSON.parse(await readFile(path.join('data', 'manual', 'price_ceilings.json'), 'utf8'))
} catch { log('no manual price_ceilings.json, skipping ceiling compliance') }

// ---- pro-MUDA edition: curated national record (advocacy build only) ----
let mudaRecord = null
let mudaStances = null
if (EDITION === 'muda') {
  try {
    mudaRecord = JSON.parse(await readFile(path.join('data', 'manual', 'muda_record.json'), 'utf8'))
  } catch { log('no muda_record.json, skipping MUDA record') }
  try {
    mudaStances = JSON.parse(await readFile(path.join('data', 'manual', 'muda_stances.json'), 'utf8'))
  } catch { log('no muda_stances.json, skipping MUDA stances') }
}

// ---- results-integrity gate ----
// Any contest that classifies as completed inside the 2026 election window
// must carry a coherent official result (exactly one winner, real votes for
// contested seats). A mid-count lake state that slips past the classifier
// must never be committed and served as official — refuse to publish instead.
{
  const nom26 = manual.election?.nomination_date ?? ELECTION_2026.nomination_date
  const today = new Date().toISOString().slice(0, 10)
  const problems = []
  for (const seat of seats) {
    for (const c of history.get(seat.code) ?? []) {
      if (c.status === 'upcoming' && c.date < today) {
        log(`WARNING: ${seat.code} contest dated ${c.date} still unsettled (pending/blank rows or zero votes) — kept as upcoming, not published as a result`)
      }
      if (c.status !== 'completed' || c.date < nom26) continue
      const winners = c.ballot.filter(b => (b.result ?? '').startsWith('won')).length
      const totalVotes = c.ballot.reduce((a, b) => a + (b.votes ?? 0), 0)
      if (winners !== 1) problems.push(`${seat.code} ${c.date}: ${winners} winner rows`)
      if (totalVotes === 0 && c.ballot.length > 1) problems.push(`${seat.code} ${c.date}: contested seat with zero total votes`)
    }
  }
  if (problems.length) {
    console.error(`SANITY FAIL: incoherent 2026 results, refusing to publish:\n  ${problems.join('\n  ')}`)
    process.exit(1)
  }
}

// ---- assemble ----
await mkdir(path.join(OUT, 'seats'), { recursive: true })

const priceBlockFor = (seat) => {
  const districts = [...new Set(seat.kpdn_districts.map(mergeDistrict))]
  const district = districts[0] ?? null
  const items = prices.basket.map(b => {
    const s = prices.series[b.code]
    const dSeries = district ? (s.districts[district] ?? {}) : {}
    const weeks = prices.weeks
    // anchor on the series' own latest valued week (a sparse district can lag
    // the shared axis); a change is only reported against a strictly earlier
    // observation at least `back` weeks before it, else null
    const idxOfLast = (series) => {
      for (let i = weeks.length - 1; i >= 0; i--) if (series[weeks[i]] != null) return i
      return -1
    }
    const refBefore = (series, from, back) => {
      for (let i = from - back; i >= 0; i--) if (series[weeks[i]] != null) return series[weeks[i]]
      return null
    }
    const lastD = idxOfLast(dSeries)
    const latest = lastD >= 0 ? dSeries[weeks[lastD]] : null
    const w4 = lastD >= 0 ? refBefore(dSeries, lastD, 4) : null
    const w12 = lastD >= 0 ? refBefore(dSeries, lastD, 12) : null
    const lastJ = idxOfLast(s.johor)
    const latestJohor = lastJ >= 0 ? s.johor[weeks[lastJ]] : null
    const lastN = idxOfLast(s.national)
    // change since the previous Johor election (2022-03), district scope when
    // both ends exist there, else Johor scope
    const aD = district ? prices.anchor.districts[district]?.[b.code] ?? null : null
    const aJ = prices.anchor.johor[b.code] ?? null
    let since_se15 = null
    if (latest != null && aD) since_se15 = { perc: +(100 * (latest - aD) / aD).toFixed(1), then: aD, scope: 'district' }
    else if (latestJohor != null && aJ) since_se15 = { perc: +(100 * (latestJohor - aJ) / aJ).toFixed(1), then: aJ, scope: 'johor' }
    // government price ceiling, for the 3 items that currently have one —
    // compliance is checked against whichever scope the current price uses
    // (district median where available, else Johor), so it compares like
    // with like rather than mixing a district figure against a Johor ceiling.
    // Ceilings are per-kg but the picked SKU may be a multi-kg pack (live
    // KPDN rice is a 10kg bag: RM26/10kg = RM2.60/kg, exactly at ceiling —
    // comparing the raw pack price would scream "+900% over"), so the
    // observed price is normalized to the ceiling's kg unit first; if the
    // pack unit isn't expressible in kg, no comparison is made at all.
    const ceil = priceCeilings.items?.[b.key] ?? null
    const observedRaw = latest ?? latestJohor
    const kgMatch = ceil && typeof b.unit === 'string' ? b.unit.match(/^(\d+(?:\.\d+)?)\s*kg$/i) : null
    const kgFactor = kgMatch ? parseFloat(kgMatch[1]) : null
    const observed = observedRaw != null && kgFactor ? +(observedRaw / kgFactor).toFixed(2) : null
    const ceiling = ceil && kgFactor
      ? { ...ceil, observed, observed_pack: observedRaw, pack_unit: b.unit, exceeds_perc: observed != null ? +(100 * (observed - ceil.price) / ceil.price).toFixed(1) : null }
      : null
    return {
      code: b.code, key: b.key, label_bm: b.label_bm, label_en: b.label_en, item: b.item, unit: b.unit,
      latest_district: latest,
      latest_johor: latestJohor,
      latest_national: lastN >= 0 ? s.national[weeks[lastN]] : null,
      change_4w_perc: latest != null && w4 ? +(100 * (latest - w4) / w4).toFixed(1) : null,
      change_12w_perc: latest != null && w12 ? +(100 * (latest - w12) / w12).toFixed(1) : null,
      since_se15,
      ceiling,
      series: { district: dSeries, johor: s.johor, national: s.national },
    }
  })
  return { district, weeks: prices.weeks, max_date: prices.max_date, anchor_month: prices.anchor.month, items, premises: district ? (prices.latest[district] ?? []).slice(0, 25) : [] }
}

const summaries = []
for (const seat of seats) {
  const demo = demographics.get(seat.code) ?? []
  const current = demo.find(d => d.election === 'JHR-SE-16') ?? demo[0] ?? null
  const hist = history.get(seat.code) ?? []
  const upcoming = hist.find(c => c.status === 'upcoming') ?? null
  const completed = hist.filter(c => c.status === 'completed')
  const last = completed[0] ?? null
  // the 2026 contest stays identifiable after results land, so bloc identity
  // (featured star, candidate name, party) survives the pending→results flip
  const poll26 = manual.election?.polling_date ?? ELECTION_2026.polling_date
  const contest2026 = upcoming ?? completed.find(c => c.date === poll26) ?? null
  const priceBlock = priceBlockFor(seat)
  const manualSeat = manual.seats?.[seat.code] ?? null

  const youth = current ? +((100 * (current.age.age_18_20 + current.age.age_21_29)) / current.voters_total).toFixed(1) : null
  // Progressive Bloc candidate on the 2026 ballot (MUDA or PSM, from live data)
  const blocCandidate = contest2026?.ballot.find(b => b.party === 'MUDA' || b.party === 'PSM') ?? null
  // a seat is featured if configured as a target OR a bloc candidate is on the ballot
  const featured = seat.featured || !!blocCandidate
  const ballot2026 = upcoming ? upcoming.ballot.map(b => ({ ...b, career: careers.get(b.uid) ?? null })) : null
  // authoritative "results are in" marker: the 2026 contest exists and has
  // settled into history. The frontend keys off this instead of guessing by
  // comparing dates, so a later by-election in the seat can't be mislabelled.
  const result_date = !upcoming && contest2026 ? contest2026.date : null

  const seatJson = {
    ...seat,
    featured,
    bbox: bboxes.get(seat.code) ?? null,
    election2026: {
      ...ELECTION_2026,
      ...(manual.election ?? {}),
      ...(manualSeat ?? {}),
      is_target: featured,
      ballot: ballot2026,
      result_date,
      voters_total: upcoming?.voters_total ?? current?.voters_total ?? null,
      muda_candidate: blocCandidate?.name ?? manualSeat?.muda_candidate ?? null,
      bloc_party: blocCandidate?.party ?? manualSeat?.bloc ?? null,
    },
    demographics: demo,
    history: completed,
    saluran2022: saluran.get(seat.code),
    socio: socio.get(seat.code) ?? {},
    kawasanku: kawasanku.get(seat.code) ?? null,
    prices: priceBlock,
    local_issues: {
      seat: [...(issuesManual.seats?.[seat.code] ?? []), ...intake.forSeat(seat.code)],
      statewide: [...(issuesManual.statewide ?? []), ...intake.statewide],
      updated: issuesManual.updated ?? null,
    },
    // pro-MUDA edition only: MUDA's stance on this seat's doorstep themes
    muda_stances: mudaStances
      ? (mudaStances.themes ?? []).filter(t => t.statewide || (t.applies_to ?? []).includes(seat.code))
      : null,
  }
  await writeFile(path.join(OUT, 'seats', `${seat.slug}.json`), JSON.stringify(seatJson))

  summaries.push({
    code: seat.code, name: seat.name, slug: seat.slug, parlimen: seat.parlimen,
    kpdn_district: priceBlock.district, featured,
    muda_candidate: blocCandidate?.name ?? manualSeat?.muda_candidate ?? null,
    bloc_party: blocCandidate?.party ?? manualSeat?.bloc ?? null,
    n_candidates_2026: contest2026?.ballot.length ?? null,
    voters_total: current?.voters_total ?? null,
    youth_perc: youth,
    income_median: socio.get(seat.code)?.income?.at(-1)?.income_median ?? null,
    income_year: socio.get(seat.code)?.income?.at(-1)?.date?.slice(0, 4) ?? null,
    u_rate: socio.get(seat.code)?.labour?.at(-1)?.u_rate ?? null,
    last_result: last ? (() => {
      // winner by result string when available, vote order as fallback
      const w = last.ballot.find(b => (b.result ?? '').startsWith('won')) ?? last.ballot[0] ?? null
      return {
        date: last.date, election: last.election,
        winner: w?.name ?? null,
        party: w?.party ?? null,
        coalition: w?.coalition ?? null,
        majority_perc: last.majority_perc ?? null,
        turnout_perc: last.voter_turnout_perc ?? null,
      }
    })() : null,
  })
}

// ---- headline: Johor basket change over ~12 weeks + fuel + cpi ----
const basketChanges = prices.basket.map(b => {
  const s = prices.series[b.code].johor
  const weeks = prices.weeks.filter(w => s[w] != null)
  if (weeks.length < 2) return null
  const latest = s[weeks[weeks.length - 1]]
  const oldest = s[weeks[0]]
  return { key: b.key, label_bm: b.label_bm, label_en: b.label_en, latest, oldest, weeks: weeks.length, change_perc: +(100 * (latest - oldest) / oldest).toFixed(1) }
}).filter(Boolean)

// Johor-scope change since the previous election, for the home page + race card
const sinceSe15Items = prices.basket.map(b => {
  const aJ = prices.anchor.johor[b.code]
  const s = prices.series[b.code].johor
  const wk = prices.weeks.filter(w => s[w] != null)
  if (!aJ || !wk.length) return null
  const latest = s[wk[wk.length - 1]]
  return { key: b.key, label_bm: b.label_bm, label_en: b.label_en, then: aJ, now: latest, perc: +(100 * (latest - aJ) / aJ).toFixed(1) }
}).filter(Boolean)
const sinceMedian = sinceSe15Items.length >= 3
  ? [...sinceSe15Items.map(i => i.perc)].sort((a, b) => a - b)[sinceSe15Items.length >> 1]
  : null

// ---- national cost-of-living trend (CPI + fuel + food over 1/3/6/12 months) ----
// The food side reads/extends the rolling monthly-median artifact so the
// 13-month history is pulled once, not every run (see steps/cost_of_living.mjs).
log('updating price-history artifact + national cost-of-living trend')
const priceHistory = await updatePriceHistory({ basket: prices.basket, johorPremises: prices.johorPremises, monthlyMedians: prices.monthlyMedians })
log(`price_history: ${priceHistory.order.length} months stored${priceHistory.fetched.length ? `, fetched ${priceHistory.fetched.join(',')}` : ' (no extra fetch)'}`)
const costTrend = buildCostTrend({ cpi, fuel, priceHistory, basket: prices.basket, controlledKeys: Object.keys(priceCeilings.items ?? {}) })

// ---- Undi18 statewide rollup (neutral demographic fact) + MUDA Johor record ----
// The 18-20 cohort is the tangible footprint of the 2019 voting-age reform;
// summed across Johor it ships in BOTH editions (it is just demographics).
const undi18 = (() => {
  let total_18_20 = 0, total_voters = 0
  const by_seat = []
  for (const seat of seats) {
    const rolls = demographics.get(seat.code) ?? []
    const cur = rolls.find(d => d.election === 'JHR-SE-16') ?? rolls[0]
    if (!cur) continue
    const n = cur.age?.age_18_20 ?? 0
    total_18_20 += n
    total_voters += cur.voters_total ?? 0
    by_seat.push({ code: seat.code, name: seat.name, slug: seat.slug, n_18_20: n, voters_total: cur.voters_total ?? null, perc: cur.voters_total ? +(100 * n / cur.voters_total).toFixed(1) : null })
  }
  by_seat.sort((a, b) => b.n_18_20 - a.n_18_20)
  return { roll: 'JHR-SE-16', total_18_20, total_voters, perc: total_voters ? +(100 * total_18_20 / total_voters).toFixed(1) : null, by_seat }
})()

// MUDA's 2022 Johor performance from saluran bloc totals (advocacy edition only).
const mudaJohor = EDITION === 'muda' ? (() => {
  let muda_votes = 0, valid = 0
  const contests = []
  for (const seat of seats) {
    const sal = saluran.get(seat.code)
    const m = sal?.totals?.MUDA
    if (!sal || !m) continue
    const h2022 = (history.get(seat.code) ?? []).find(c => c.election === 'SE-15')
    const won = h2022?.ballot?.some(b => b.party === 'MUDA' && (b.result ?? '').startsWith('won')) ?? false
    muda_votes += m
    valid += sal.valid
    contests.push({ code: seat.code, name: seat.name, slug: seat.slug, muda_votes: m, valid: sal.valid, perc: sal.valid ? +(100 * m / sal.valid).toFixed(1) : null, won })
  }
  contests.sort((a, b) => b.perc - a.perc)
  return { election: 'SE-15', date: '2022-03-12', seats_contested: contests.length, won: contests.filter(c => c.won).length, muda_votes, valid, avg_perc: valid ? +(100 * muda_votes / valid).toFixed(1) : null, contests }
})() : null

const index = {
  built_at: new Date().toISOString(),
  state: STATE,
  election: { ...ELECTION_2026, ...(manual.election ?? {}) },
  seats: summaries,
  basket: prices.basket,
  basket_changes: basketChanges,
  basket_since_se15: sinceSe15Items.length ? { anchor_month: prices.anchor.month, median_perc: sinceMedian, items: sinceSe15Items } : null,
  price_max_date: prices.max_date,
  price_months: prices.months_used,
  fuel,
  cpi,
  cost_trend: costTrend,
  edition: EDITION,
  national_issues: nationalIssues.issues ?? [],
  cpi_deflator: cpiDeflator,
  live_alerts: liveAlerts,
  // MUDA's statewide positions, surfaced on the home page's "Apa MUDA kata"
  // card (muda edition only) — always-present, attributed, daily-relevant
  muda_voice: mudaStances ? (mudaStances.themes ?? []).filter(t => t.statewide) : null,
  johor_context: { crime, undi18, muda: mudaJohor },
  muda_record: mudaRecord,
  source_health: health,
  attribution: [
    { name: 'ElectionData.MY (Malaysian Election Corpus, CC0)', url: 'https://electiondata.my' },
    { name: 'data.gov.my / OpenDOSM (CC BY 4.0)', url: 'https://data.gov.my' },
    { name: 'KPDN PriceCatcher via data.gov.my', url: 'https://data.gov.my/data-catalogue/pricecatcher' },
    { name: 'Pasar API (directory + uptime)', url: 'https://pasarapi.xyz' },
  ],
}
await writeFile(path.join(OUT, 'index.json'), JSON.stringify(index))
await writeFile(path.join(OUT, 'johor_dun.geojson'), JSON.stringify(geojson))

// ---- sanity checks ----
// PriceCatcher freshness guard: the current-month file updates daily at
// source; if the newest observation is over a week old the feed has stalled
// (the same silent failure hit the official flood API).
const priceAgeDays = Math.round((Date.now() - new Date(`${prices.max_date}T00:00:00Z`).getTime()) / 86400e3)
if (priceAgeDays > 7) log(`WARNING: PriceCatcher data is ${priceAgeDays} days old (newest obs ${prices.max_date}) — feed may have stalled`)

const withDemo = summaries.filter(s => s.voters_total).length
const withResult = summaries.filter(s => s.last_result).length
const withPrices = summaries.filter(s => s.kpdn_district).length
log(`sanity: demographics=${withDemo}/56 results=${withResult}/56 price-district=${withPrices}/56 saluran=${seats.filter(s => saluran.get(s.code)).length}/56 geo=${geojson.features.length}/56`)
const pw = summaries.find(s => s.code === 'N.41')
log(`Puteri Wangsa check: voters=${pw.voters_total} youth=${pw.youth_perc}% last=${pw.last_result?.winner} (${pw.last_result?.party}) majority=${pw.last_result?.majority_perc}%`)
log(`Progressive Bloc seats on 2026 ballot: ${summaries.filter(s => s.bloc_party).map(s => `${s.code} ${s.name} (${s.bloc_party}: ${s.muda_candidate})`).join(' | ')}`)
if (withDemo < 50 || withResult < 50 || geojson.features.length < 50) {
  console.error('SANITY FAIL: too many seats missing core data')
  process.exit(1)
}
log('done')
