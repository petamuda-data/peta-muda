// Crime & safety context from data.gov.my's public-safety dataset
// (storage.data.gov.my/publicsafety/crime_district.parquet). Real schema,
// confirmed by running it on the Actions runner:
//   columns: state, district, category, type, date, crimes  (crimes = INT64)
//   category: assault | property   type: <specific> | all
//   district: <14 Johor police districts> | All   date: 2016..2023 (yearly)
// "district" is a POLICE district (≠ electoral seat / KPDN price district), so
// crime is surfaced as JOHOR-LEVEL context (trend + type + district table),
// not a per-seat join.
//
// Fully non-fatal: ANY error returns null and the pipeline continues, matching
// loadCpi/loadFuel. Rollup rows (district 'All', type 'all') are excluded from
// the leaf sum to avoid double counting.
import { readParquetUrl, asIsoDate, asNum } from '../lib/parquet.mjs'
import { SOURCES, STATE } from '../config.mjs'

const isAll = (v) => {
  const s = String(v ?? '').trim().toLowerCase()
  return s === 'all' || s === 'semua' || s === 'total' || s === ''
}
// BigInt-safe JSON for diagnostics (parquet INT64 columns deserialize to BigInt)
const safeJson = (o) => JSON.stringify(o, (_k, v) => (typeof v === 'bigint' ? Number(v) : v))

export async function loadCrime() {
  try {
    const rows = await readParquetUrl(SOURCES.crimeDistrict)
    if (!rows?.length) { console.warn('crime_district returned no rows, skipping'); return null }

    // ---- diagnostics: the real shape, in the build log ----
    const cols = Object.keys(rows[0])
    const johor = rows.filter(r => r.state === STATE)
    const distinct = (key, src = johor) => [...new Set(src.map(r => r[key]))]
    console.log(`[crime] columns: ${cols.join(', ')}`)
    console.log(`[crime] rows total=${rows.length} johor=${johor.length}`)
    if (!johor.length) { console.warn(`[crime] no rows for state='${STATE}'; skipping`); return null }
    console.log(`[crime] johor districts: ${distinct('district').join(' | ')}`)
    console.log(`[crime] categories: ${distinct('category').join(' | ')}`)
    console.log(`[crime] types: ${distinct('type').join(' | ')}`)
    const allDates = distinct('date').map(asIsoDate).sort()
    console.log(`[crime] date range: ${allDates[0]} .. ${allDates.at(-1)} (${allDates.length} distinct)`)
    console.log(`[crime] sample row: ${safeJson(rows[0])}`)

    // ---- aggregation (leaf rows only; 'crimes' is the value column) ----
    const norm = (r) => {
      const iso = asIsoDate(r.date)
      return {
        district: String(r.district ?? '').trim(),
        category: String(r.category ?? '').trim(),
        type: String(r.type ?? '').trim(),
        value: asNum(r.crimes) ?? 0,
        year: iso?.slice(0, 4),
      }
    }
    const leaves = johor.map(norm).filter(r => !isAll(r.category) && !isAll(r.type) && !isAll(r.district))
    const latestYear = allDates.at(-1)?.slice(0, 4)

    const totalByYear = {}
    for (const r of leaves) totalByYear[r.year] = (totalByYear[r.year] ?? 0) + r.value
    const total_by_year = Object.entries(totalByYear).sort().map(([year, value]) => ({ year, value }))

    const typeAgg = {}
    for (const r of leaves) if (r.year === latestYear) {
      const k = `${r.category}|${r.type}`
      typeAgg[k] = (typeAgg[k] ?? 0) + r.value
    }
    const by_type_latest = Object.entries(typeAgg)
      .map(([k, value]) => ({ category: k.split('|')[0], type: k.split('|')[1], value }))
      .sort((a, b) => b.value - a.value)

    const distAgg = {}
    for (const r of leaves) if (r.year === latestYear) distAgg[r.district] = (distAgg[r.district] ?? 0) + r.value
    const by_district_latest = Object.entries(distAgg)
      .map(([district, value]) => ({ district, value }))
      .sort((a, b) => b.value - a.value)

    const latestTotal = totalByYear[latestYear] ?? 0
    const prevYear = total_by_year.at(-2)?.year
    const prevTotal = prevYear ? totalByYear[prevYear] : null
    console.log(`[crime] Johor ${latestYear}: total=${latestTotal} across ${by_district_latest.length} districts, ${by_type_latest.length} crime types`)

    return {
      state: STATE,
      source: 'data.gov.my / PDRM (crime_district)',
      latest_year: latestYear,
      total_latest: latestTotal,
      change_yoy_perc: prevTotal ? +(100 * (latestTotal - prevTotal) / prevTotal).toFixed(1) : null,
      total_by_year,
      by_type_latest,
      by_district_latest,
    }
  } catch (e) {
    console.warn(`crime_district failed (${e.message.slice(0, 120)}), skipping`)
    return null
  }
}
