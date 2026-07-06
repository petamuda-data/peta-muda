// Fixture generator for the offline pipeline simulation. Reconstructs every
// remote source file (lake CSVs, DOSM parquets, data.gov.my APIs, PriceCatcher)
// from the COMMITTED site/data outputs, then applies a scenario transform to
// the 2026 contest rows — so we can replay results night before it happens.
//
// Scenarios (see scenarioSpec):
//   pending           today's state verbatim (harness fidelity baseline)
//   full-flip         all 56 seats have official results
//   partial-flip      seats N.01-N.28 resulted, N.29-N.56 still pending
//   stats-lag         ballots resulted but headline_stats has no 2026 rows
//   garbage           5 seats mid-count: result '' with zero votes
//   appended          3 seats where the lake APPENDED result rows next to
//                     the old pending rows instead of updating in place
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { parquetWriteBuffer } from 'hyparquet-writer'
import { SOURCES, DATASET_IDS, STATE, ELECTION_2026 } from '../../pipeline/config.mjs'

const POLL_DATE = ELECTION_2026.polling_date // '2026-07-11'
const EL_2026 = 'SE-16' // headline files use short ids (SE-01..SE-15 today)

// ---------- helpers ----------
const csvEsc = (v) => {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
const toCsv = (header, rows) =>
  [header.join(','), ...rows.map(r => header.map(h => csvEsc(r[h])).join(','))].join('\n') + '\n'

// deterministic per-seat jitter in [0,1) — no Math.random so runs reproduce
const hash01 = (s) => {
  let h = 2166136261
  for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) }
  return ((h >>> 0) % 10000) / 10000
}

// ---------- synthesize a plausible official result for one seat ----------
// Vote shares come from the seat's real 2022 bloc totals mapped onto the real
// 2026 ballot; turnout from the seat's real 2022 turnout with a small jitter.
function synthesizeResult(seat) {
  const ballot = seat.election2026.ballot
  const roll = seat.demographics.find(d => d.election === 'JHR-SE-16')?.voters_total
    ?? seat.election2026.voters_total
  const totals = seat.saluran2022?.totals ?? {}
  const sumTotals = Object.values(totals).reduce((a, b) => a + b, 0) || 1
  const share = Object.fromEntries(Object.entries(totals).map(([b, v]) => [b, v / sumTotals]))
  const blocOf = (b) => b.party === 'MUDA' || (b.party_uid || '').includes('MUDA') ? 'MUDA'
    : ['PH', 'BN', 'PN'].includes(b.coalition) ? b.coalition : 'LAIN'

  // raw share per candidate; blocs sharing candidates split 70/30, blocs with
  // no 2022 votes get a small floor so nobody lands on exactly zero
  const byBloc = new Map()
  for (const b of ballot) {
    const k = blocOf(b)
    if (!byBloc.has(k)) byBloc.set(k, [])
    byBloc.get(k).push(b)
  }
  const raw = new Map()
  const split = [1, 0.35, 0.15, 0.08] // second+ candidates of the same bloc get a slice
  for (const [k, cands] of byBloc) {
    const s = share[k] || 0.03 // blocs with no 2022 votes get a small floor
    cands.forEach((c, i) => raw.set(c.uid, s * (split[i] ?? 0.05)))
  }
  // the sim narrative: MUDA holds Puteri Wangsa (exercises the winner-checkmark
  // path on a bloc seat); everything else falls where 2022 shares put it
  if (seat.code === 'N.41') {
    const muda = ballot.find(b => b.party === 'MUDA')
    const top = [...raw.entries()].sort((a, b) => b[1] - a[1])[0]
    if (muda && top[0] !== muda.uid) {
      const t = raw.get(top[0])
      raw.set(top[0], raw.get(muda.uid) ?? 0.02)
      raw.set(muda.uid, t)
    }
  }
  const rawSum = [...raw.values()].reduce((a, b) => a + b, 0) || 1
  const turnout2022 = seat.kawasanku?.voter_turnout ?? 60
  const turnout = Math.min(88, Math.max(38, turnout2022 + (hash01(seat.code) - 0.5) * 8))
  const cast = Math.round(roll * turnout / 100)
  const rejected = Math.round(cast * 0.012)
  const valid = cast - rejected

  let acc = 0
  const rows = ballot.map((b, i) => {
    const isLast = i === ballot.length - 1
    const v = isLast ? valid - acc : Math.round(valid * (raw.get(b.uid) ?? 0) / rawSum)
    acc += v
    return { ...b, votes: Math.max(0, v) }
  })
  rows.sort((a, b) => b.votes - a.votes)
  const out = rows.map((r, i) => ({
    ...r,
    votes_perc: 100 * r.votes / valid,
    result: i === 0 ? 'won' : (100 * r.votes / valid < 12.5 ? 'lost_deposit' : 'lost'),
  }))
  return {
    ballot: out,
    stats: {
      voters_total: roll,
      voter_turnout: +(100 * cast / roll).toFixed(2),
      majority: out[0].votes - (out[1]?.votes ?? 0),
      majority_perc: +((100 * (out[0].votes - (out[1]?.votes ?? 0))) / valid).toFixed(2),
      votes_rejected: rejected,
    },
  }
}

// ---------- per-scenario transform of the 2026 rows for one seat ----------
// returns { ballotRows, statsRow } in lake-CSV shape (or null statsRow)
function scenario2026(scenario, seat) {
  const seatStr = `${seat.code} ${seat.name}`
  const base = { state: STATE, seat: seatStr, date: POLL_DATE, election: EL_2026 }
  const pendingRows = seat.election2026.ballot.map(b => ({
    ...base, candidate_uid: b.uid, name: b.name, party: b.party, party_uid: b.party_uid,
    coalition: b.coalition, coalition_uid: b.coalition_uid, votes: 0, votes_perc: '', result: 'pending',
  }))
  const resulted = () => {
    const { ballot, stats } = synthesizeResult(seat)
    return {
      rows: ballot.map(b => ({
        ...base, candidate_uid: b.uid, name: b.name, party: b.party, party_uid: b.party_uid,
        coalition: b.coalition, coalition_uid: b.coalition_uid, votes: b.votes, votes_perc: b.votes_perc, result: b.result,
      })),
      stats: { ...base, ...stats },
    }
  }
  const n = Number(seat.code.slice(2))
  switch (scenario) {
    case 'pending':
      return { ballotRows: pendingRows, statsRow: null }
    case 'full-flip': {
      const r = resulted()
      return { ballotRows: r.rows, statsRow: r.stats }
    }
    case 'partial-flip': {
      if (n > 28) return { ballotRows: pendingRows, statsRow: null }
      const r = resulted()
      return { ballotRows: r.rows, statsRow: r.stats }
    }
    case 'stats-lag': {
      const r = resulted()
      return { ballotRows: r.rows, statsRow: null }
    }
    case 'garbage': {
      if (n > 5) return { ballotRows: pendingRows, statsRow: null }
      // mid-count worst case: result column blanked, votes still zero
      return { ballotRows: pendingRows.map(r => ({ ...r, result: '' })), statsRow: null }
    }
    case 'appended': {
      if (!['N.41', 'N.13', 'N.48'].includes(seat.code)) return { ballotRows: pendingRows, statsRow: null }
      const r = resulted()
      return { ballotRows: [...pendingRows, ...r.rows], statsRow: r.stats }
    }
    default:
      throw new Error(`unknown scenario ${scenario}`)
  }
}

// ---------- main ----------
export async function buildFixtures(scenario, outDir, dataDir = 'site/data') {
  const index = JSON.parse(await readFile(path.join(dataDir, 'index.json'), 'utf8'))
  const geo = JSON.parse(await readFile(path.join(dataDir, 'johor_dun.geojson'), 'utf8'))
  const seats = []
  for (const f of (await readdir(path.join(dataDir, 'seats'))).sort()) {
    seats.push(JSON.parse(await readFile(path.join(dataDir, 'seats', f), 'utf8')))
  }
  await mkdir(outDir, { recursive: true })
  const manifest = {}
  const put = async (url, rel, content) => {
    manifest[url] = rel
    await writeFile(path.join(outDir, rel), content)
  }

  // --- headline ballots + stats (history replay + scenario 2026 rows) ---
  const ballotHeader = ['state', 'seat', 'date', 'election', 'candidate_uid', 'name', 'party', 'party_uid', 'coalition', 'coalition_uid', 'votes', 'votes_perc', 'result']
  const statsHeader = ['state', 'seat', 'date', 'election', 'voters_total', 'voter_turnout', 'majority', 'majority_perc', 'votes_rejected']
  const ballotRows = []
  const statsRows = []
  const careerSeen = new Set()
  for (const seat of seats) {
    for (const h of seat.history) {
      const seatStr = `${h.code_then} ${seat.name}`
      for (const b of h.ballot) {
        ballotRows.push({
          state: STATE, seat: seatStr, date: h.date, election: h.election,
          candidate_uid: b.uid, name: b.name, party: b.party, party_uid: b.party_uid,
          coalition: b.coalition, coalition_uid: b.coalition_uid,
          votes: b.votes ?? '', votes_perc: b.votes_perc ?? '', result: b.result,
        })
      }
      if (h.voters_total != null || h.majority != null) {
        statsRows.push({
          state: STATE, seat: seatStr, date: h.date, election: h.election,
          voters_total: h.voters_total ?? '', voter_turnout: h.voter_turnout_perc ?? '',
          majority: h.majority ?? '', majority_perc: h.majority_perc ?? '', votes_rejected: h.votes_rejected ?? '',
        })
      }
    }
    // career rows for 2026 candidates (non-Johor-DUN contests only, to avoid
    // colliding with the history rows emitted above)
    for (const b of seat.election2026.ballot ?? []) {
      for (const c of b.career?.contests ?? []) {
        const key = `${b.uid}|${c.date}|${c.seat}`
        if (careerSeen.has(key)) continue
        careerSeen.add(key)
        if (c.state === STATE && c.seat.startsWith('N.')) continue
        ballotRows.push({
          state: c.state, seat: c.seat, date: c.date, election: c.election,
          candidate_uid: b.uid, name: b.name, party: c.party, party_uid: '', coalition: '', coalition_uid: '',
          votes: '', votes_perc: c.votes_perc ?? '', result: c.result,
        })
      }
    }
    const { ballotRows: b26, statsRow } = scenario2026(scenario, seat)
    ballotRows.push(...b26)
    if (statsRow) statsRows.push(statsRow)
  }
  await put(SOURCES.headlineBallots, 'headline_ballots.csv', toCsv(ballotHeader, ballotRows))
  await put(SOURCES.headlineStats, 'headline_stats.csv', toCsv(statsHeader, statsRows))

  // --- saluran (SE-15, static replay) ---
  const BLOC_ROW = {
    MUDA: { party: 'MUDA', party_uid: '120-MUDA', coalition: 'ALONE' },
    PH: { party: 'PKR', party_uid: '078-PKR', coalition: 'PH' },
    BN: { party: 'UMNO', party_uid: '001-UMNO', coalition: 'BN' },
    PN: { party: 'PAS', party_uid: '031-PAS', coalition: 'PN' },
    LAIN: { party: 'BEBAS', party_uid: '000-BEBAS', coalition: 'ALONE' },
  }
  const salBallots = []
  const salStats = []
  for (const seat of seats) {
    const sal = seat.saluran2022
    if (!sal) continue
    const seatStr = `${seat.code} ${seat.name}`
    for (const dm of sal.dms) {
      const dmStr = `${dm.code} ${dm.name}`
      for (const [bloc, votes] of Object.entries(dm.blocs)) {
        salBallots.push({ seat: seatStr, dm: dmStr, votes, ...BLOC_ROW[bloc] })
      }
      if (dm.voters != null) {
        salStats.push({
          seat: seatStr, dm: dmStr,
          ballots_issued: Math.round((dm.turnout_perc ?? 0) * dm.voters / 100),
          voters_total: dm.voters,
        })
      }
    }
  }
  await put(SOURCES.saluranBallots, 'saluran_ballots.csv',
    toCsv(['seat', 'dm', 'votes', 'party', 'party_uid', 'coalition'], salBallots))
  await put(SOURCES.saluranStats, 'saluran_stats.csv',
    toCsv(['seat', 'dm', 'ballots_issued', 'voters_total'], salStats))

  // --- seats dropdown ---
  await put(SOURCES.seatsDropdown, 'dropdown.json', JSON.stringify({
    data: seats.map(s => ({ type: 'dun', seat: `${s.seat}, ${STATE}` })),
  }))

  // --- demographics parquet ---
  {
    const rows = []
    for (const seat of seats) {
      for (const d of seat.demographics) {
        rows.push({
          state: STATE, seat: seat.seat, election: d.election, date: d.date,
          voters_total: d.voters_total, sex_male: d.sex_male, sex_female: d.sex_female,
          ...d.age, votertype_regular: d.votertype.regular, votertype_early: d.votertype.early,
          votertype_postal_overseas: d.votertype.postal_overseas,
          ...Object.fromEntries(Object.entries(d.ethnic)),
        })
      }
    }
    const cols = Object.keys(rows[0])
    const buf = parquetWriteBuffer({
      columnData: cols.map(name => ({
        name,
        data: rows.map(r => r[name] ?? null),
        type: ['state', 'seat', 'election', 'date'].includes(name) ? 'STRING' : 'DOUBLE',
      })),
    })
    await put(SOURCES.demographics, 'demographics.parquet', Buffer.from(buf))
  }

  // --- kawasanku parquet ---
  {
    const INDICATORS = ['income_mean', 'expenditure_mean', 'gini', 'poverty', 'labour_urate', 'labour_prate', 'electricity', 'water', 'hospital', 'clinic', 'school', 'police_fire', 'grocery', 'atm', 'petrol', 'population_density', 'household_size', 'voters_total', 'voter_turnout']
    const rows = seats.filter(s => s.kawasanku).map(s => ({
      area_type: 'dun', area: s.seat,
      ...Object.fromEntries(INDICATORS.map(k => [`${k}_t`, s.kawasanku[k] ?? null])),
    }))
    const cols = Object.keys(rows[0])
    const buf = parquetWriteBuffer({
      columnData: cols.map(name => ({
        name, data: rows.map(r => r[name] ?? null),
        type: ['area_type', 'area'].includes(name) ? 'STRING' : 'DOUBLE',
      })),
    })
    await put(SOURCES.kawasanku, 'kawasanku.parquet', Buffer.from(buf))
  }

  // --- geojson (raw shape the geo step expects) ---
  await put(SOURCES.dunGeojson, 'dun.geojson', JSON.stringify({
    type: 'FeatureCollection',
    features: geo.features.map(f => ({
      type: 'Feature',
      properties: { state: STATE, dun: f.properties.dun, parlimen: f.properties.parlimen },
      geometry: f.geometry,
    })),
  }))

  // --- data.gov.my catalogue APIs ---
  const dunFilter = (id) => SOURCES.dataCatalogue(id, `&filter=${encodeURIComponent(STATE)}@state&limit=5000`)
  const SOCIO_KEYS = { income: 'hh_income_dun', poverty: 'hh_poverty_dun', inequality: 'hh_inequality_dun', expenditure: 'hh_expenditure_dun', labour: 'lfs_dun' }
  for (const [key, id] of Object.entries(SOCIO_KEYS)) {
    const rows = []
    for (const seat of seats) {
      const list = seat.socio[key] ?? []
      for (const rec of list) {
        rows.push({ state: STATE, parlimen: seat.parlimen, dun: seat.seat, ...rec })
      }
      // hh_income_dun doubles as the DUN->parlimen crosswalk; every seat must
      // appear there or loadSeats throws
      if (key === 'income' && !list.length) {
        rows.push({ state: STATE, parlimen: seat.parlimen, dun: seat.seat, date: '1900-01-01' })
      }
    }
    await put(dunFilter(id), `${id}.json`, JSON.stringify(rows))
  }
  await put(dunFilter('cpi_state_inflation'), 'cpi.json', JSON.stringify(index.cpi ?? []))
  // Fuel: the committed feed is ~12 weeks — too short for 6/12-month deltas.
  // Synthesize a ~60-week weekly series ENDING at the committed latest values
  // (so the home chips stay realistic) with a gentle rise going back, so the
  // national cost-of-living card can compute all four fuel windows offline.
  const fuelBase = (index.fuel ?? []).at(-1)
  let fuelSeries = index.fuel ?? []
  if (fuelBase?.date) {
    const t = new Date(`${fuelBase.date}T00:00:00Z`).getTime()
    fuelSeries = []
    for (let i = 59; i >= 0; i--) {
      const d = new Date(t - i * 7 * 86400e3).toISOString().slice(0, 10)
      const f = 1 - 0.003 * i // older weeks a touch cheaper → ~18% rise over 12mo
      fuelSeries.push({
        ...fuelBase, date: d,
        ron95: fuelBase.ron95 != null ? +(fuelBase.ron95 * f).toFixed(2) : null,
        ron97: fuelBase.ron97 != null ? +(fuelBase.ron97 * f).toFixed(2) : null,
        diesel: fuelBase.diesel != null ? +(fuelBase.diesel * f).toFixed(2) : null,
        ron95_budi95: 1.99, // subsidised price is held flat
      })
    }
  }
  await put(SOURCES.dataCatalogue('fuelprice', '&limit=120&sort=-date'), 'fuel.json', JSON.stringify(fuelSeries))
  await put(SOURCES.pasarHealth, 'pasar_health.json', JSON.stringify({ health: {} }))

  // --- PriceCatcher: lookups + monthly parquets covering the app's window ---
  {
    // Committed index.basket predates the rice-picker fix (its 'beras' item
    // is the now-excluded imported SKU) and the new garlic category, so
    // neither has real committed data to derive fixture prices from. Inject
    // two synthetic items — a genuinely local/tempatan rice and a garlic
    // entry — with distinct codes, so the sim actually exercises both new
    // code paths (ceiling-eligible local rice pick; garlic basket pick)
    // instead of silently dropping them for lack of fixture coverage.
    const SYN_BERAS_TEMPATAN = 77001
    const SYN_BAWANG_PUTIH = 77002
    const items = [
      ...index.basket.map(b => ({
        item_code: b.code, item: b.item, unit: b.unit, item_group: 'BARANGAN SEGAR', item_category: 'sim',
      })),
      // 10KG pack on purpose — the live KPDN pick is a 10kg bag (RM26/10kg =
      // RM2.60/kg), regression-testing the per-kg ceiling normalization
      { item_code: SYN_BERAS_TEMPATAN, item: 'BERAS SUPER TEMPATAN (SST)', unit: '10KG', item_group: 'BARANGAN SEGAR', item_category: 'sim' },
      { item_code: SYN_BAWANG_PUTIH, item: 'BAWANG PUTIH IMPORT (CHINA)', unit: '1KG', item_group: 'BARANGAN SEGAR', item_category: 'sim' },
    ]
    await put(SOURCES.lookupItem, 'lookup_item.csv',
      toCsv(['item_code', 'item', 'unit', 'item_group', 'item_category'], items))

    const districts = ['Johor Bahru', 'Muar', 'Batu Pahat', 'Segamat', 'Kluang', 'Kota Tinggi', 'Mersing', 'Pontian', 'Tangkak']
    const premises = districts.map((d, i) => ({
      premise_code: 90001 + i, premise: `PASAR SIM ${d.toUpperCase()}`, premise_type: 'Pasar Basah',
      address: '-', state: STATE, district: d,
    }))
    premises.push({ premise_code: 90100, premise: 'HYPERMARKET SIM JOHOR BAHRU 2', premise_type: 'Hypermarket', address: '-', state: STATE, district: 'Johor Bahru' })
    await put(SOURCES.lookupPremise, 'lookup_premise.csv',
      toCsv(['premise_code', 'premise', 'premise_type', 'address', 'state', 'district'], premises))

    const premByDistrict = Object.fromEntries(districts.map((d, i) => [d, 90001 + i]))
    // observations: one per (item, district, week) taken from committed weekly
    // district medians, plus a max_date row so freshness matches the real feed
    const byMonth = new Map()
    const obs = (date, premise_code, item_code, price) => {
      const ym = date.slice(0, 7)
      if (!byMonth.has(ym)) byMonth.set(ym, [])
      byMonth.get(ym).push({ date, premise_code, item_code, price })
    }
    const sample = seats[0].prices
    const weeks = sample.weeks
    for (const b of index.basket) {
      // walk every seat's price block to recover each district's series once
      const seen = new Set()
      for (const seat of seats) {
        const d = seat.prices.district
        if (!d || seen.has(d)) continue
        seen.add(d)
        const item = seat.prices.items.find(i => i.code === b.code)
        const series = item?.series?.district ?? {}
        for (const w of weeks) {
          if (series[w] != null && premByDistrict[d]) obs(w, premByDistrict[d], b.code, series[w])
        }
      }
      // freshness marker at the committed max_date (Johor Bahru hypermarket)
      const johorSeries = seats[0].prices.items.find(i => i.code === b.code)?.series?.johor ?? {}
      const lastWeek = [...weeks].reverse().find(w => johorSeries[w] != null)
      if (lastWeek != null) obs(index.price_max_date, 90100, b.code, johorSeries[lastWeek])
    }
    // synthetic local-rice + garlic observations: every district premise plus
    // the JB hypermarket (10 premises total) at every week, so both clear the
    // >=10-premise coverage threshold the basket picker requires
    const allPremises = [...districts.map(d => premByDistrict[d]), 90100]
    for (const w of weeks) {
      for (const prem of allPremises) {
        obs(w, prem, SYN_BERAS_TEMPATAN, 26.00)
        obs(w, prem, SYN_BAWANG_PUTIH, 9.50)
      }
    }
    obs(index.price_max_date, 90100, SYN_BERAS_TEMPATAN, 26.00)
    obs(index.price_max_date, 90100, SYN_BAWANG_PUTIH, 9.50)
    // anchor month (previous election): >=15 obs per item at the committed
    // Johor anchor value so the "since SE-15" comparison materializes
    for (const it of index.basket_since_se15?.items ?? []) {
      const b = index.basket.find(x => x.key === it.key)
      if (!b) continue
      for (let i = 0; i < 15; i++) {
        obs(`${index.basket_since_se15.anchor_month}-15`, 90100, b.code, it.then)
      }
    }
    // Long-horizon monthly history for the national cost-of-living trend: emit
    // >=15 Johor obs per basket item for each of the trailing 13 months not
    // already covered by the weekly obs above, so price_history's 13-month
    // backfill has data and the 6/12-month food deltas materialize. Non-
    // controlled items drift up going back (older cheaper → ~rising now, a
    // testable direction); controlled staples stay flat.
    {
      const CONTROLLED = new Set(['ayam', 'minyak', 'beras'])
      // "covered" = months with full weekly obs already (the current month only
      // carries a single freshness marker, so it still needs synthetic obs)
      const covered = new Set(weeks.map(w => w.slice(0, 7)))
      const now = new Date(`${index.price_max_date}T00:00:00Z`)
      const histMonths = []
      for (let i = 12; i >= 0; i--) {
        const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
        histMonths.push({ ym: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`, monthsAgo: i })
      }
      const baseFor = (b) => {
        if (b.code === SYN_BERAS_TEMPATAN) return 26.00
        if (b.code === SYN_BAWANG_PUTIH) return 9.50
        const jo = seats[0].prices.items.find(i => i.code === b.code)?.series?.johor ?? {}
        const wk = Object.keys(jo).sort()
        return wk.length ? jo[wk[wk.length - 1]] : null
      }
      const allBasket = [...index.basket, { code: SYN_BERAS_TEMPATAN, key: 'beras_syn' }, { code: SYN_BAWANG_PUTIH, key: 'bawang_putih' }]
      for (const { ym, monthsAgo } of histMonths) {
        if (covered.has(ym)) continue // recent months already have weekly obs
        for (const b of allBasket) {
          const base = baseFor(b)
          if (base == null) continue
          const drift = CONTROLLED.has(b.key) ? 1 : (1 - 0.004 * monthsAgo) // older non-controlled a touch cheaper
          const price = +(base * drift).toFixed(2)
          // current month: date at the committed max_date so freshness is unchanged
          const dateStr = monthsAgo === 0 ? index.price_max_date : `${ym}-15`
          for (let k = 0; k < 15; k++) obs(dateStr, 90100, b.code, price)
        }
      }
    }
    // months the pipeline will request: current back PRICE_MONTHS + anchor +
    // the 13-month history backfill. Emit every month we have obs for; missing
    // requested months are fine (the pipeline tolerates unavailable months).
    for (const [ym, rows] of byMonth) {
      const buf = parquetWriteBuffer({
        columnData: [
          { name: 'date', data: rows.map(r => r.date), type: 'STRING' },
          { name: 'premise_code', data: rows.map(r => r.premise_code), type: 'INT32' },
          { name: 'item_code', data: rows.map(r => r.item_code), type: 'INT32' },
          { name: 'price', data: rows.map(r => r.price), type: 'DOUBLE' },
        ],
      })
      await put(SOURCES.pricecatcherMonth(ym), `pricecatcher_${ym}.parquet`, Buffer.from(buf))
    }
  }


  // --- crime_district.parquet (schema from the real runner probe: state,
  // district, category, type, date, crimes[INT64]; rollup rows district 'All'
  // and type 'all' present and excluded downstream). Deterministic, no RNG. ---
  {
    const districts = ['Batu Pahat', 'Iskandar Puteri', 'Johor Bahru Selatan', 'Johor Bahru Utara', 'Kluang', 'Kota Tinggi', 'Kulaijaya', 'Ledang', 'Mersing', 'Muar', 'Nusajaya', 'Pontian', 'Segamat', 'Seri Alam']
    const cats = { assault: ['causing_injury', 'murder', 'rape', 'robbery_gang_armed', 'robbery_gang_unarmed', 'robbery_solo_armed', 'robbery_solo_unarmed'], property: ['break_in', 'theft_other', 'theft_vehicle_lorry', 'theft_vehicle_motorcar', 'theft_vehicle_motorcycle'] }
    const years = [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023]
    const h = (s) => { let x = 2166136261; for (const c of s) { x ^= c.charCodeAt(0); x = Math.imul(x, 16777619) } return (x >>> 0) % 1000 }
    const baseOf = (t) => t.startsWith('theft') ? 180 : t === 'murder' ? 3 : t === 'rape' ? 14 : t.startsWith('robbery') ? 28 : 55
    const rows = []
    const push = (district, category, type, year, crimes) => rows.push({ state: 'Johor', district, category, type, date: `${year}-01-01`, crimes })
    for (const year of years) {
      const stateTotals = {}
      for (const d of districts) {
        for (const [cat, types] of Object.entries(cats)) {
          let catTotal = 0
          for (const t of types) {
            const v = Math.max(0, baseOf(t) + (h(`${d}${t}${year}`) % baseOf(t)) - (year - 2016) * 6) // gentle downtrend
            catTotal += v
            push(d, cat, t, year, v)
            stateTotals[`${cat}|${t}`] = (stateTotals[`${cat}|${t}`] ?? 0) + v
          }
          push(d, cat, 'all', year, catTotal) // per-district rollup row (excluded downstream)
        }
      }
      // 'All' district state-total rollup rows (also excluded downstream)
      for (const [k, v] of Object.entries(stateTotals)) push('All', k.split('|')[0], k.split('|')[1], year, v)
    }
    const buf = parquetWriteBuffer({
      columnData: [
        { name: 'state', data: rows.map(r => r.state), type: 'STRING' },
        { name: 'district', data: rows.map(r => r.district), type: 'STRING' },
        { name: 'category', data: rows.map(r => r.category), type: 'STRING' },
        { name: 'type', data: rows.map(r => r.type), type: 'STRING' },
        { name: 'date', data: rows.map(r => r.date), type: 'STRING' },
        { name: 'crimes', data: rows.map(r => BigInt(r.crimes)), type: 'INT64' },
      ],
    })
    await put(SOURCES.crimeDistrict, 'crime_district.parquet', Buffer.from(buf))
  }

  await writeFile(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 1))
  return { urls: Object.keys(manifest).length }
}
