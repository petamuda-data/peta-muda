// PriceCatcher (KPDN daily grocery prices) via storage.data.gov.my monthly
// parquet files. Two-phase scan:
//   A) latest 2 months, Johor only -> pick the basket item per category with
//      the widest premise coverage;
//   B) all months -> weekly medians per item at national / Johor / KPDN-district
//      scope + latest per-premise snapshot for Johor.
import { fetchText } from '../lib/fetch.mjs'
import { parseCsvObjects } from '../lib/csv.mjs'
import { scanParquetUrl, asIsoDate } from '../lib/parquet.mjs'
import { SOURCES, STATE, BASKET, PRICE_MONTHS, PRICE_WEEKS, PRICE_ANCHOR_MONTH } from '../config.mjs'

// KPDN uses both 'Ledang' and 'Tangkak' for the same Johor district.
export const mergeDistrict = (d) => (d === 'Ledang' ? 'Tangkak' : d)

const mondayOf = (iso) => {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
  return d.toISOString().slice(0, 10)
}

const median = (arr) => {
  if (!arr.length) return null
  const s = [...arr].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

const monthList = (n) => {
  const out = []
  const now = new Date()
  for (let i = 0; i < n; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`)
  }
  return out
}

export async function loadPrices() {
  // lookups
  const itemsCsv = parseCsvObjects(await fetchText(SOURCES.lookupItem))
  const premisesCsv = parseCsvObjects(await fetchText(SOURCES.lookupPremise))
  const items = new Map()
  for (const r of itemsCsv) {
    const code = parseInt(r.item_code, 10)
    if (!Number.isFinite(code) || code < 0) continue
    items.set(code, { code, item: r.item.trim(), unit: r.unit.trim(), group: r.item_group.trim(), category: r.item_category.trim() })
  }
  const premises = new Map()
  for (const r of premisesCsv) {
    const code = parseInt(parseFloat(r.premise_code), 10)
    if (!Number.isFinite(code) || code < 0) continue
    premises.set(code, {
      code,
      premise: (r.premise || '').trim(),
      type: (r.premise_type || '').trim(),
      state: (r.state || '').trim(),
      district: mergeDistrict((r.district || '').trim()),
    })
  }
  const johorPremises = new Set([...premises.values()].filter(p => p.state === STATE).map(p => p.code))

  // candidate item codes per category
  const candidates = new Map() // code -> categoryKey (first matching category wins)
  for (const cat of BASKET) {
    for (const it of items.values()) {
      if (cat.patterns.some(p => p.test(it.item)) && !candidates.has(it.code)) candidates.set(it.code, cat.key)
    }
  }

  const months = monthList(PRICE_MONTHS)
  const available = []
  for (const ym of months) {
    try {
      // probe availability via a tiny scan; fetchRaw caches the file
      await scanParquetUrl(SOURCES.pricecatcherMonth(ym), () => { throw new Error('__stop__') })
      available.push(ym)
    } catch (e) {
      if (e.message === '__stop__') { available.push(ym); continue }
      console.warn(`pricecatcher ${ym} unavailable (${e.message.slice(0, 80)})`)
    }
  }
  if (!available.length) throw new Error('no PriceCatcher months available')

  // ---- Phase A: coverage in Johor (latest 2 available months) ----
  const coverage = new Map() // item_code -> Set(premise_code)
  let maxDate = ''
  for (const ym of available.slice(0, 2)) {
    await scanParquetUrl(SOURCES.pricecatcherMonth(ym), (r) => {
      const item = Number(r.item_code)
      if (!candidates.has(item)) return
      const prem = Number(r.premise_code)
      if (!johorPremises.has(prem)) return
      const d = asIsoDate(r.date)
      if (d > maxDate) maxDate = d
      if (!coverage.has(item)) coverage.set(item, new Set())
      coverage.get(item).add(prem)
    })
  }

  const basket = []
  for (const cat of BASKET) {
    let picked = null
    for (const pattern of cat.patterns) {
      const matches = [...items.values()]
        .filter(it => pattern.test(it.item))
        .map(it => ({ it, cov: coverage.get(it.code)?.size ?? 0 }))
        .sort((a, b) => b.cov - a.cov)
      if (matches.length && matches[0].cov >= 10) { picked = matches[0]; break }
      if (matches.length && (!picked || matches[0].cov > picked.cov)) picked = matches[0]
    }
    if (picked && picked.cov > 0) {
      basket.push({
        code: picked.it.code,
        key: cat.key,
        label_bm: cat.label_bm,
        label_en: cat.label_en,
        item: picked.it.item,
        unit: picked.it.unit,
        johor_coverage: picked.cov,
      })
    } else {
      console.warn(`basket: no coverage for category ${cat.key}, dropped`)
    }
  }
  const basketCodes = new Set(basket.map(b => b.code))

  // ---- Phase B: weekly medians + latest premise snapshot ----
  const weekly = new Map() // `${item}|${scope}|${week}` -> number[]
  const monthly = new Map() // `${item}|${scope}|${ym}` -> number[] (national cost-of-living history)
  const latestByPremiseItem = new Map() // `${prem}|${item}` -> {date, price}
  const push = (key, v) => {
    let a = weekly.get(key)
    if (!a) { a = []; weekly.set(key, a) }
    a.push(v)
  }
  const pushM = (key, v) => {
    let a = monthly.get(key)
    if (!a) { a = []; monthly.set(key, a) }
    a.push(v)
  }
  for (const ym of available) {
    await scanParquetUrl(SOURCES.pricecatcherMonth(ym), (r) => {
      const item = Number(r.item_code)
      if (!basketCodes.has(item)) return
      const price = Number(r.price)
      if (!Number.isFinite(price) || price <= 0) return
      const prem = Number(r.premise_code)
      const p = premises.get(prem)
      if (!p) return
      const d = asIsoDate(r.date)
      if (d > maxDate) maxDate = d
      const week = mondayOf(d)
      const month = d.slice(0, 7)
      push(`${item}|nat|${week}`, price)
      pushM(`${item}|nat|${month}`, price)
      if (p.state === STATE) {
        push(`${item}|joh|${week}`, price)
        push(`${item}|d:${p.district}|${week}`, price)
        pushM(`${item}|joh|${month}`, price)
        const k = `${prem}|${item}`
        const prev = latestByPremiseItem.get(k)
        if (!prev || d > prev.date) latestByPremiseItem.set(k, { date: d, price })
      }
    })
  }

  // monthly national+Johor medians for the fetched months, per basket code —
  // fed to the rolling price_history artifact (fresh/authoritative for these
  // recent months; older months come from the committed artifact untouched)
  const monthlyMedians = {} // ym -> { code -> {nat, joh} }
  for (const [key, arr] of monthly) {
    const [itemStr, scope, ym] = key.split('|')
    if (arr.length < 15) continue // thin months are unreliable; skip
    const code = Number(itemStr)
    if (!monthlyMedians[ym]) monthlyMedians[ym] = {}
    if (!monthlyMedians[ym][code]) monthlyMedians[ym][code] = {}
    monthlyMedians[ym][code][scope === 'nat' ? 'nat' : 'joh'] = +median(arr).toFixed(2)
  }

  // materialize weekly medians, keep last PRICE_WEEKS weeks
  const allWeeks = new Set()
  for (const key of weekly.keys()) allWeeks.add(key.split('|').pop())
  const weeks = [...allWeeks].sort().slice(-PRICE_WEEKS)
  const weekSet = new Set(weeks)

  const series = {}
  for (const b of basket) series[b.code] = { national: {}, johor: {}, districts: {} }
  for (const [key, arr] of weekly) {
    const [itemStr, scope, week] = key.split('|')
    if (!weekSet.has(week)) continue
    const m = median(arr)
    const s = series[Number(itemStr)]
    if (!s || m == null) continue
    if (scope === 'nat') s.national[week] = +m.toFixed(2)
    else if (scope === 'joh') s.johor[week] = +m.toFixed(2)
    else {
      const district = scope.slice(2)
      if (!s.districts[district]) s.districts[district] = {}
      s.districts[district][week] = +m.toFixed(2)
    }
  }

  // latest premise snapshot (within 14 days of maxDate), grouped by district
  const cutoff = new Date(new Date(`${maxDate}T00:00:00Z`).getTime() - 14 * 86400e3).toISOString().slice(0, 10)
  const byDistrict = {}
  for (const [k, v] of latestByPremiseItem) {
    if (v.date < cutoff) continue
    const [premStr, itemStr] = k.split('|')
    const p = premises.get(Number(premStr))
    if (!byDistrict[p.district]) byDistrict[p.district] = new Map()
    const dmap = byDistrict[p.district]
    if (!dmap.has(p.code)) dmap.set(p.code, { premise_code: p.code, premise: p.premise, type: p.type, prices: {} })
    dmap.get(p.code).prices[Number(itemStr)] = { price: v.price, date: v.date }
  }
  const latest = {}
  for (const [district, dmap] of Object.entries(byDistrict)) {
    latest[district] = [...dmap.values()]
      .filter(pr => Object.keys(pr.prices).length >= 3)
      .sort((a, b) => Object.keys(b.prices).length - Object.keys(a.prices).length)
  }

  // ---- Anchor month (previous Johor election): long-run price comparison ----
  // Monthly medians (more robust than a single week). Items whose KPDN codes
  // were introduced after 2022 (e.g. the Sep 2023 item-list revision) simply
  // have no anchor and are skipped downstream.
  const anchorJohor = new Map() // item -> prices[]
  const anchorDistrict = new Map() // `${district}|${item}` -> prices[]
  try {
    await scanParquetUrl(SOURCES.pricecatcherMonth(PRICE_ANCHOR_MONTH), (r) => {
      const item = Number(r.item_code)
      if (!basketCodes.has(item)) return
      const price = Number(r.price)
      if (!Number.isFinite(price) || price <= 0) return
      const p = premises.get(Number(r.premise_code))
      if (!p || p.state !== STATE) return
      if (!anchorJohor.has(item)) anchorJohor.set(item, [])
      anchorJohor.get(item).push(price)
      const dk = `${p.district}|${item}`
      if (!anchorDistrict.has(dk)) anchorDistrict.set(dk, [])
      anchorDistrict.get(dk).push(price)
    })
  } catch (e) {
    console.warn(`anchor month ${PRICE_ANCHOR_MONTH} unavailable (${e.message.slice(0, 80)})`)
  }
  const anchor = { month: PRICE_ANCHOR_MONTH, johor: {}, districts: {} }
  for (const [item, arr] of anchorJohor) if (arr.length >= 15) anchor.johor[item] = +median(arr).toFixed(2)
  for (const [key, arr] of anchorDistrict) {
    if (arr.length < 8) continue
    const [district, item] = key.split('|')
    if (!anchor.districts[district]) anchor.districts[district] = {}
    anchor.districts[district][item] = +median(arr).toFixed(2)
  }

  return { basket, weeks, series, latest, anchor, max_date: maxDate, months_used: available, monthlyMedians, johorPremises }
}
