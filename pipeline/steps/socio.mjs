// Socioeconomic series per DUN from the data.gov.my Data Catalogue API:
// household income / poverty / gini / expenditure (HIES 2019/2022/2024) and
// labour force stats (annual 2021+). Also state CPI inflation and national
// weekly fuel prices for the cost-of-living headline.
import { fetchDataGovMy } from '../lib/fetch.mjs'
import { SOURCES, STATE } from '../config.mjs'

const DUN_DATASETS = {
  income: 'hh_income_dun',
  poverty: 'hh_poverty_dun',
  inequality: 'hh_inequality_dun',
  expenditure: 'hh_expenditure_dun',
  labour: 'lfs_dun',
}

export async function loadSocio(seats) {
  const bySeat = new Map(seats.map(s => [s.seat, {}]))
  const dunParlimen = new Map()

  for (const [key, id] of Object.entries(DUN_DATASETS)) {
    let rows
    try {
      rows = await fetchDataGovMy(SOURCES.dataCatalogue(id, `&filter=${encodeURIComponent(STATE)}@state&limit=5000`))
    } catch (e) {
      console.warn(`socio: ${id} failed (${e.message}), skipping`)
      continue
    }
    for (const r of rows) {
      if (r.parlimen && r.dun) dunParlimen.set(r.dun, r.parlimen)
      const rec = bySeat.get(r.dun)
      if (!rec) continue
      const { dun, state, parlimen, date, ...values } = r
      if (!rec[key]) rec[key] = []
      rec[key].push({ date, ...values })
    }
  }
  for (const rec of bySeat.values()) {
    for (const list of Object.values(rec)) list.sort((a, b) => a.date.localeCompare(b.date))
  }

  const out = new Map()
  for (const seat of seats) out.set(seat.code, bySeat.get(seat.seat) ?? {})
  return { socio: out, dunParlimen }
}

// Standalone: DUN -> parlimen crosswalk (needed before seats are built).
export async function loadDunParlimen() {
  const rows = await fetchDataGovMy(SOURCES.dataCatalogue('hh_income_dun', `&filter=${encodeURIComponent(STATE)}@state&limit=5000`))
  const map = new Map()
  for (const r of rows) if (r.dun && r.parlimen) map.set(r.dun, r.parlimen)
  return map
}

export async function loadCpi() {
  try {
    const rows = await fetchDataGovMy(SOURCES.dataCatalogue('cpi_state_inflation', `&filter=${encodeURIComponent(STATE)}@state&limit=5000`))
    // keep overall division only, last 24 months
    const overall = rows.filter(r => (r.division ?? 'overall') === 'overall')
    overall.sort((a, b) => a.date.localeCompare(b.date))
    return overall.slice(-24)
  } catch (e) {
    console.warn(`cpi_state_inflation failed (${e.message}), skipping`)
    return null
  }
}

export async function loadFuel() {
  try {
    const rows = await fetchDataGovMy(SOURCES.dataCatalogue('fuelprice', '&limit=120&sort=-date'))
    const levels = rows.filter(r => !r.series_type || r.series_type === 'level')
    levels.sort((a, b) => a.date.localeCompare(b.date))
    // keep ~14 months of weekly rows so the national cost-of-living card can
    // compute 1/3/6/12-month fuel deltas (the app still reads .at(-1) for the
    // latest-week chips); the source already returns 120 rows, so this is free
    return levels.slice(-60)
  } catch (e) {
    console.warn(`fuelprice failed (${e.message}), skipping`)
    return null
  }
}
