// National cost-of-living trend: a rolling monthly-median store plus 1/3/6/12
// month price deltas for CPI, fuel and a national food basket.
//
// The food side is expensive (one PriceCatcher parquet per month), so closed
// past months are stored — immutable — in data/derived/price_history.json and
// never refetched. loadPrices already scans the recent months for the weekly
// series and hands their monthly medians here (authoritative/fresh); only truly
// missing older months are fetched, so the full 13-month pull happens once.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { scanParquetUrl, asIsoDate } from '../lib/parquet.mjs'
import { SOURCES, STATE, PRICE_HISTORY_MONTHS, PRICE_HISTORY_PATH } from '../config.mjs'

const median = (arr) => {
  if (!arr.length) return null
  const s = [...arr].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

// trailing n months as "YYYY-MM", oldest-first
const monthList = (n) => {
  const out = []
  const now = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`)
  }
  return out
}

// median national + Johor price per basket code for one PriceCatcher month
async function monthMedians(ym, basketCodes, johorPremises) {
  const nat = new Map(); const joh = new Map()
  const push = (map, code, v) => { let a = map.get(code); if (!a) { a = []; map.set(code, a) } a.push(v) }
  await scanParquetUrl(SOURCES.pricecatcherMonth(ym), (r) => {
    const item = Number(r.item_code)
    if (!basketCodes.has(item)) return
    const price = Number(r.price)
    if (!Number.isFinite(price) || price <= 0) return
    push(nat, item, price)
    if (johorPremises.has(Number(r.premise_code))) push(joh, item, price)
  })
  const out = {}
  for (const [code, arr] of nat) {
    if (arr.length < 15) continue
    out[code] = { nat: +median(arr).toFixed(2) }
    const j = joh.get(code)
    if (j && j.length >= 15) out[code].joh = +median(j).toFixed(2)
  }
  return out
}

// Load + extend the committed monthly-median artifact. Returns
// { months: { ym: { code: {nat,joh} } }, order: ym[] (oldest-first), fetched: ym[] }.
export async function updatePriceHistory({ basket, johorPremises, monthlyMedians }) {
  const basketCodes = new Set(basket.map(b => b.code))
  const target = monthList(PRICE_HISTORY_MONTHS)
  const rebuild = process.env.PRICE_HISTORY_REBUILD === '1'

  let stored = {}
  if (!rebuild) {
    try { stored = (JSON.parse(await readFile(PRICE_HISTORY_PATH, 'utf8'))).months ?? {} }
    catch { stored = {} } // first run / backfill
  }

  // start from stored, overlay the fresh recent months loadPrices just computed
  const months = {}
  for (const ym of target) if (stored[ym]) months[ym] = stored[ym]
  for (const [ym, byCode] of Object.entries(monthlyMedians ?? {})) {
    if (target.includes(ym)) months[ym] = byCode // fresh wins for recent months
  }

  // backfill any target month still missing (one-time 13-month pull, or a gap)
  const fetched = []
  const current = target[target.length - 1]
  const prev = target[target.length - 2]
  for (const ym of target) {
    const stale = ym === current || ym === prev // always refresh the two newest
    if (months[ym] && !stale) continue
    if (months[ym] && stale && monthlyMedians?.[ym]) continue // already fresh from loadPrices
    try {
      const m = await monthMedians(ym, basketCodes, johorPremises)
      if (Object.keys(m).length) { months[ym] = m; fetched.push(ym) }
    } catch (e) {
      // month unavailable (404 for very old / not-yet-published) — leave a gap
      console.warn(`price_history: ${ym} unavailable (${String(e.message).slice(0, 60)})`)
    }
  }

  // trim to the target window and persist
  const trimmed = {}
  for (const ym of target) if (months[ym]) trimmed[ym] = months[ym]
  try {
    await mkdir(path.dirname(PRICE_HISTORY_PATH), { recursive: true })
    await writeFile(PRICE_HISTORY_PATH, JSON.stringify({ updated: new Date().toISOString().slice(0, 10), months: trimmed }, null, 0) + '\n')
  } catch (e) {
    console.warn(`price_history: could not write artifact (${e.message})`)
  }

  const order = target.filter(ym => trimmed[ym])
  return { months: trimmed, order, fetched }
}

// ---- trend deltas ----

// % change of a fuel field over ~days, latest vs the weekly row nearest the target
const fuelDelta = (fuel, field, days) => {
  if (!fuel?.length) return null
  const latest = fuel[fuel.length - 1]
  const cur = latest?.[field]
  if (cur == null) return null
  const targetMs = new Date(`${latest.date}T00:00:00Z`).getTime() - days * 86400e3
  let best = null; let bestGap = Infinity
  for (const r of fuel) {
    if (r[field] == null) continue
    const gap = Math.abs(new Date(`${r.date}T00:00:00Z`).getTime() - targetMs)
    if (gap < bestGap) { bestGap = gap; best = r }
  }
  // require the reference row to be within ~3 weeks of the target, else no window
  if (!best || bestGap > 21 * 86400e3 || best.date === latest.date) return null
  return +(100 * (cur - best[field]) / best[field]).toFixed(1)
}

// cumulative CPI over the last k months, from month-on-month (%), as a % level change
const cpiDelta = (cpi, k) => {
  if (!cpi || cpi.length < k) return null
  let f = 1
  for (const r of cpi.slice(-k)) f *= 1 + (r.inflation_mom ?? 0) / 100
  return +((f - 1) * 100).toFixed(1)
}

// national food basket delta over k months: median of per-item national %-change,
// over items present at BOTH ends (matched basket) and NOT price-controlled
const foodDelta = (order, months, k, foodCodes) => {
  if (order.length < k + 1) return null
  const endYm = order[order.length - 1]
  const startYm = order[order.length - 1 - k]
  const end = months[endYm]; const start = months[startYm]
  if (!end || !start) return null
  const changes = []
  for (const code of foodCodes) {
    const a = start[code]?.nat; const b = end[code]?.nat
    if (a != null && b != null && a > 0) changes.push(100 * (b - a) / a)
  }
  if (changes.length < 3) return null
  return +median(changes).toFixed(1)
}

// Assemble the national cost_trend object (neutral; ships in both editions).
export function buildCostTrend({ cpi, fuel, priceHistory, basket, controlledKeys }) {
  const WINDOWS = [['1m', 1, 30], ['3m', 3, 91], ['6m', 6, 182], ['12m', 12, 365]]
  const controlled = new Set(controlledKeys ?? [])
  const foodCodes = basket.filter(b => !controlled.has(b.key)).map(b => b.code)
  const { order = [], months = {} } = priceHistory ?? {}

  const deltasBy = (fn) => Object.fromEntries(WINDOWS.map(([lbl, mo, days]) => [lbl, fn(mo, days)]))

  const series = []
  const cpiRow = deltasBy((mo) => cpiDelta(cpi, mo))
  if (Object.values(cpiRow).some(v => v != null)) {
    series.push({
      key: 'cpi', scope: 'Johor',
      label_bm: 'Inflasi rasmi (CPI Johor)', label_en: 'Official inflation (Johor CPI)',
      deltas: cpiRow, yoy: cpi?.length ? cpi[cpi.length - 1].inflation_yoy ?? null : null,
    })
  }
  const ron95 = deltasBy((_mo, days) => fuelDelta(fuel, 'ron95', days))
  if (Object.values(ron95).some(v => v != null)) {
    series.push({ key: 'fuel_ron95', scope: 'Nasional', label_bm: 'Petrol RON95 (tanpa subsidi)', label_en: 'Petrol RON95 (unsubsidised)', deltas: ron95 })
  }
  const diesel = deltasBy((_mo, days) => fuelDelta(fuel, 'diesel', days))
  if (Object.values(diesel).some(v => v != null)) {
    series.push({ key: 'fuel_diesel', scope: 'Nasional', label_bm: 'Diesel (tanpa subsidi)', label_en: 'Diesel (unsubsidised)', deltas: diesel })
  }
  const food = deltasBy((mo) => foodDelta(order, months, mo, foodCodes))
  if (Object.values(food).some(v => v != null)) {
    series.push({ key: 'food_basket', scope: 'Nasional', label_bm: 'Bakul makanan (bukan kawalan)', label_en: 'Food basket (non-controlled)', deltas: food })
  }

  if (!series.length) return null
  return { updated: new Date().toISOString().slice(0, 10), windows: WINDOWS.map(w => w[0]), series }
}
