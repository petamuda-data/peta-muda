// Per-scenario assertions over the simulated pipeline output.
// Each check pushes a failure string; empty list = scenario passes.
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'

const loadDir = async (dataDir) => {
  const index = JSON.parse(await readFile(path.join(dataDir, 'index.json'), 'utf8'))
  const seats = {}
  for (const f of await readdir(path.join(dataDir, 'seats'))) {
    const d = JSON.parse(await readFile(path.join(dataDir, 'seats', f), 'utf8'))
    seats[d.code] = d
  }
  return { index, seats }
}

// normalize away fields the simulation intentionally does not reproduce
// exactly (price medians re-derive from sparse fixture obs; careers rebuild
// from truncated contest lists; source_health depends on the live monitor)
const normalizeSeat = (s) => {
  const c = structuredClone(s)
  c.prices = null
  // result_date is a new output field; committed data predates it, so ignore
  // it in the pending-fidelity baseline (real rebuilds populate it everywhere)
  if (c.election2026) delete c.election2026.result_date
  delete c.muda_stances // new edition-gated field; committed data predates it
  // theme keys on curated issues are new metadata; committed data predates them
  if (c.local_issues) {
    for (const it of [...(c.local_issues.seat ?? []), ...(c.local_issues.statewide ?? [])]) delete it.theme
  }
  if (c.election2026?.ballot) for (const b of c.election2026.ballot) b.career = b.career ? '<career>' : null
  if (c.saluran2022) for (const dm of c.saluran2022.dms) dm.turnout_perc = dm.turnout_perc == null ? null : Math.round(dm.turnout_perc)
  c.bbox = c.bbox ? c.bbox.map(v => Math.round(v * 10) / 10) : null
  return c
}
const normalizeSummary = (s) => {
  const c = { ...s }
  delete c.kpdn_district // re-derived, unchanged by flip
  return c
}

const diffPaths = (a, b, base = '', out = [], depth = 0) => {
  if (out.length > 25 || depth > 12) return out
  if (a === b) return out
  if (typeof a !== typeof b || a == null || b == null || typeof a !== 'object') {
    if (typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) < 1e-6) return out
    out.push(`${base}: ${JSON.stringify(a)?.slice(0, 60)} != ${JSON.stringify(b)?.slice(0, 60)}`)
    return out
  }
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const k of keys) diffPaths(a[k], b[k], `${base}.${k}`, out, depth + 1)
  return out
}

export async function verifyScenario(scenario, simDataDir, committedDataDir) {
  const failures = []
  const ok = (cond, msg) => { if (!cond) failures.push(msg) }
  const sim = await loadDir(simDataDir)

  const flippedCodes = {
    'pending': [], 'full-flip': null, // null = all
    'partial-flip': Object.keys(sim.seats).filter(c => Number(c.slice(2)) <= 28),
    'stats-lag': null,
    'garbage': [], // garbage seats are NOT expected to flip cleanly
    'appended': [], // appended seats are the interesting ones, asserted separately
  }[scenario]

  const codes = Object.keys(sim.seats).sort()
  ok(codes.length === 56, `expected 56 seats, got ${codes.length}`)

  // candidate-record layer: every candidate with a career must carry an
  // ordered party_timeline, and a known cross-party mover must show >1 party
  for (const code of codes) {
    for (const b of sim.seats[code].election2026?.ballot ?? []) {
      if (!b.career) continue
      const tl = b.career.party_timeline
      ok(Array.isArray(tl), `${code}/${b.name}: career missing party_timeline`)
      if (Array.isArray(tl)) {
        const years = tl.map(s => s.from)
        ok(years.every((y, i) => i === 0 || y >= years[i - 1]), `${code}/${b.name}: party_timeline not oldest-first`)
        ok(tl.every((s, i) => i === 0 || s.party !== tl[i - 1].party), `${code}/${b.name}: adjacent same-party stints not merged`)
      }
    }
  }
  {
    // N.44 Larkin carries Suhaizan bin Kaiat (PAS → AMANAH), our timeline fixture
    const suhaizan = (sim.seats['N.44']?.election2026?.ballot ?? []).find(b => b.name.includes('Suhaizan'))
    if (suhaizan) {
      const parties = new Set((suhaizan.career?.party_timeline ?? []).map(s => s.party))
      ok(parties.size > 1, `N.44 Suhaizan should show a multi-party timeline, got ${[...parties].join('/')}`)
    }
  }

  // ---- MUDA edition gating + Undi18 rollup consistency (all scenarios) ----
  {
    const jc = sim.index.johor_context ?? {}
    // crime: Johor context present with sane shape (fixtured from the real schema)
    ok(jc.crime?.total_latest > 0, 'johor_context.crime missing/zero')
    ok(jc.crime?.latest_year === '2023', `crime latest_year expected 2023, got ${jc.crime?.latest_year}`)
    ok((jc.crime?.by_type_latest?.length ?? 0) > 0, 'crime by_type_latest empty')
    ok((jc.crime?.by_district_latest?.length ?? 0) > 0, 'crime by_district_latest empty')
    ok(!(jc.crime?.by_district_latest ?? []).some(d => d.district === 'All'), 'crime must exclude the All rollup district')
    ok(!(jc.crime?.by_type_latest ?? []).some(t => t.type === 'all'), 'crime must exclude the all rollup type')
    ok(jc.undi18?.total_18_20 > 0, 'undi18 rollup missing/zero')
    let sum1820 = 0
    for (const code of codes) {
      const rolls = sim.seats[code].demographics ?? []
      const d = rolls.find(x => x.election === 'JHR-SE-16') ?? rolls[0]
      sum1820 += d?.age?.age_18_20 ?? 0
    }
    ok(jc.undi18?.total_18_20 === sum1820, `undi18 total ${jc.undi18?.total_18_20} != seat sum ${sum1820}`)
    if (sim.index.edition === 'muda') {
      ok((sim.index.muda_record?.national?.length ?? 0) > 0, 'muda edition missing muda_record.national')
      ok((jc.muda?.seats_contested ?? 0) > 0, 'muda edition missing johor_context.muda')
      const txt = JSON.stringify(sim.index.muda_record ?? {})
      ok(!/MUDA (passed|tabled|meluluskan|membentangkan) undi18/i.test(txt), 'guardrail: Undi18 must attribute to Syed Saddiq, not the MUDA party')
    } else {
      ok(sim.index.muda_record == null, 'neutral edition must omit muda_record')
      ok(jc.muda == null, 'neutral edition must omit johor_context.muda')
    }
    // ceiling compliance must be per-kg normalized: the synthetic rice is a
    // 10KG pack at RM26.00, so observed must read RM2.60 (exactly at ceiling),
    // never the raw pack price (which would scream +900%)
    for (const code of codes) {
      const beras = sim.seats[code].prices?.items?.find(i => i.key === 'beras')
      if (beras?.ceiling && beras.ceiling.observed != null) {
        ok(Math.abs(beras.ceiling.observed - 2.6) < 0.01, `${code}: beras ceiling.observed ${beras.ceiling.observed} != per-kg 2.60`)
        ok(Math.abs(beras.ceiling.exceeds_perc) < 1, `${code}: beras exceeds_perc ${beras.ceiling.exceeds_perc} not ~0 after kg normalization`)
      }
    }
    // national cost-of-living trend: 4 windows, signed numeric deltas, and the
    // food composite must be built from NON-controlled items only (excludes
    // the ceiling staples ayam/minyak/beras). Synthetic fixtures rise over the
    // year, so CPI, fuel and food 12-month deltas must all read positive.
    const ct = sim.index.cost_trend
    ok(ct != null, 'cost_trend missing')
    if (ct) {
      ok(JSON.stringify(ct.windows) === JSON.stringify(['1m', '3m', '6m', '12m']), `cost_trend windows ${JSON.stringify(ct.windows)}`)
      ok((ct.series?.length ?? 0) >= 3, `cost_trend too few series (${ct.series?.length})`)
      for (const s of ct.series ?? []) {
        ok(!!(s.key && s.label_bm && s.label_en && s.deltas), `cost_trend series ${s.key} missing fields`)
        for (const w of ct.windows) ok(s.deltas[w] === null || typeof s.deltas[w] === 'number', `cost_trend ${s.key}.${w} not numeric/null`)
      }
      const byKey = Object.fromEntries((ct.series ?? []).map(s => [s.key, s]))
      // CPI + fuel come from clean synthetic series (cpi fixture cumulative;
      // fuel a monotone-rising fixture) so their 12m must read positive.
      ok(byKey.cpi?.deltas?.['12m'] > 0, `cpi 12m delta should be positive (fixtures rise): ${byKey.cpi?.deltas?.['12m']}`)
      ok(byKey.fuel_ron95?.deltas?.['12m'] > 0, `fuel_ron95 12m delta should be positive: ${byKey.fuel_ron95?.deltas?.['12m']}`)
      // food composite mixes the real committed recent months with synthetic
      // older ones, so its SIGN is data-dependent (varies with each data
      // refresh) — assert the mechanism computed a number, not a direction.
      ok(byKey.food_basket != null, 'food_basket series should be present')
      ok(typeof byKey.food_basket?.deltas?.['12m'] === 'number', `food_basket 12m should compute: ${byKey.food_basket?.deltas?.['12m']}`)
    }
    // national issues: neutral metadata, both editions — every entry themed,
    // bilingual and sourced; in the muda build every theme must resolve to a
    // stance so the doorstep beat can always overlay a MUDA angle
    const ni = sim.index.national_issues ?? []
    ok(ni.length >= 3, `national_issues too small (${ni.length})`)
    for (const it of ni) {
      ok(!!(it.theme && it.issue_bm && it.issue_en && it.sources?.length && it.verdict), 'national issue missing theme/text/sources/verdict')
    }
    if (sim.index.edition === 'muda') {
      const anySeat = sim.seats[codes[0]]
      const stanceKeys = new Set((anySeat.muda_stances ?? []).map(t => t.key))
      for (const it of ni) ok(stanceKeys.has(it.theme), `national issue theme '${it.theme}' has no statewide muda_stances entry`)
    }
    // stance layer: neutral seats carry null; muda seats carry arrays whose
    // every quote is attributed AND sourced (no unsourced quotes, ever)
    for (const code of codes) {
      const st = sim.seats[code].muda_stances
      if (sim.index.edition === 'muda') {
        ok(st === null || Array.isArray(st), `${code}: muda_stances must be null or array`)
        for (const t of st ?? []) {
          for (const q of t.quotes ?? []) {
            ok(!!(q.text && q.who && q.source), `${code}/${t.key}: quote missing text/who/source — unsourced quotes must not ship`)
          }
        }
      } else {
        ok(st == null, `${code}: neutral edition must omit muda_stances`)
      }
    }
  }

  if (scenario === 'pending') {
    // fidelity baseline: simulated output must reproduce the committed data
    const com = await loadDir(committedDataDir)
    for (const code of codes) {
      const d = diffPaths(normalizeSeat(com.seats[code]), normalizeSeat(sim.seats[code]), code)
      failures.push(...d.slice(0, 5))
    }
    const comSum = Object.fromEntries(com.index.seats.map(s => [s.code, normalizeSummary(s)]))
    const simSum = Object.fromEntries(sim.index.seats.map(s => [s.code, normalizeSummary(s)]))
    for (const code of codes) failures.push(...diffPaths(comSum[code], simSum[code], `index:${code}`).slice(0, 3))
    return failures
  }

  const isFlipped = (code) => flippedCodes === null || flippedCodes.includes(code)

  for (const code of codes) {
    const s = sim.seats[code]
    const sum = sim.index.seats.find(x => x.code === code)
    const flipped = scenario === 'appended' ? false : isFlipped(code)
    const special = (scenario === 'garbage' && Number(code.slice(2)) <= 5)
      || (scenario === 'appended' && ['N.41', 'N.13', 'N.48'].includes(code))

    if (flipped) {
      ok(s.election2026.ballot === null, `${code}: election2026.ballot should be null post-flip`)
      const h0 = s.history[0]
      ok(h0?.date === '2026-07-11', `${code}: history[0] should be the 2026 contest, got ${h0?.date}`)
      ok(h0?.status === 'completed', `${code}: history[0].status should be completed`)
      ok(h0?.ballot?.[0]?.result?.startsWith('won'), `${code}: history[0].ballot[0] should be the winner`)
      ok((h0?.ballot ?? []).every(b => b.result !== 'pending'), `${code}: no pending rows in completed 2026 contest`)
      const totalVotes = (h0?.ballot ?? []).reduce((a, b) => a + (b.votes ?? 0), 0)
      ok(totalVotes > 0, `${code}: completed 2026 contest has zero total votes`)
      ok(sum.last_result?.date === '2026-07-11', `${code}: index last_result should be the 2026 result`)
      ok(sum.last_result?.winner === h0?.ballot?.[0]?.name, `${code}: index winner mismatch`)
      if (scenario !== 'stats-lag') {
        ok(h0?.voters_total != null, `${code}: 2026 stats (voters_total) missing`)
        ok(h0?.majority_perc != null, `${code}: 2026 stats (majority_perc) missing`)
        ok(sum.last_result?.majority_perc != null, `${code}: index majority_perc missing`)
      } else {
        ok(h0?.voters_total == null, `${code}: stats-lag should leave voters_total absent`)
      }
    } else if (!special) {
      ok(Array.isArray(s.election2026.ballot) && s.election2026.ballot.length > 0,
        `${code}: still-pending seat should keep its 2026 ballot`)
      ok(s.history[0]?.date !== '2026-07-11', `${code}: pending seat should have no 2026 history entry`)
      ok(s.election2026.ballot?.every(b => b.result === 'pending') ?? false,
        `${code}: pending ballot rows should all be result=pending`)
    }
  }

  // scenario-specific probes documenting the interesting behavior
  if (scenario === 'garbage') {
    for (const code of ['N.01', 'N.02', 'N.03', 'N.04', 'N.05']) {
      const s = sim.seats[code]
      const h0 = s.history[0]
      // blanked result strings must NOT be published as a completed contest
      ok(!(h0?.date === '2026-07-11' && h0?.status === 'completed'),
        `${code}: blanked-result mid-count rows were published as a completed 2026 contest (winner='${h0?.ballot?.[0]?.name}', total votes=${(h0?.ballot ?? []).reduce((a, b) => a + (b.votes ?? 0), 0)})`)
    }
  }
  if (scenario === 'appended') {
    for (const code of ['N.41', 'N.13', 'N.48']) {
      const s = sim.seats[code]
      const nUnique = new Set((s.election2026.ballot ?? s.history[0]?.ballot ?? []).map(b => b.uid)).size
      const nRows = (s.election2026.ballot ?? s.history[0]?.ballot ?? []).length
      ok(nRows === nUnique, `${code}: duplicated candidates after lake append (${nRows} rows, ${nUnique} unique)`)
      ok(s.election2026.ballot === null && s.history[0]?.date === '2026-07-11',
        `${code}: appended result rows should still complete the contest (ballot=${s.election2026.ballot ? 'stuck' : 'null'}, history[0]=${s.history[0]?.date})`)
    }
  }
  if ((scenario === 'full-flip' || scenario === 'partial-flip') && isFlipped('N.48')) {
    const sum = sim.index.seats.find(x => x.code === 'N.48')
    ok(sum.featured === true, 'N.48 Skudai (PSM) should stay featured after the flip')
    ok(sum.bloc_party === 'PSM', `N.48 bloc_party should survive the flip, got ${sum.bloc_party}`)
    ok(sum.muda_candidate != null, 'N.48 bloc candidate name should survive the flip')
  }
  if (scenario === 'full-flip') {
    const n41 = sim.seats['N.41']
    ok(n41.election2026.bloc_party != null,
      `N.41 seat JSON bloc_party should survive the flip (share text renders "(null)" otherwise), got ${n41.election2026.bloc_party}`)
    const sum41 = sim.index.seats.find(x => x.code === 'N.41')
    ok(sum41.n_candidates_2026 != null, 'N.41 n_candidates_2026 should survive the flip')
  }
  return failures
}
