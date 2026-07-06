// Voter-roll demographics per seat from the lake's seat_info parquet.
// Crucially includes the JHR-SE-16 (2026-07-11) electoral roll.
import { readParquetUrl, asIsoDate, asNum } from '../lib/parquet.mjs'
import { SOURCES, STATE } from '../config.mjs'

const AGE_KEYS = ['age_18_20', 'age_21_29', 'age_30_39', 'age_40_49', 'age_50_59', 'age_60_69', 'age_70_79', 'age_80_89', 'age_90+']
const ETH_KEYS = ['ethnic_malay', 'ethnic_chinese', 'ethnic_indian', 'ethnic_bumi_sabah', 'ethnic_bumi_sarawak', 'ethnic_orang_asli', 'ethnic_other']

export async function loadDemographics(seats) {
  const rows = await readParquetUrl(SOURCES.demographics)
  const wanted = new Set(seats.map(s => s.seat))
  const bySeat = new Map()
  for (const r of rows) {
    if (r.state !== STATE || !wanted.has(r.seat)) continue
    const rec = {
      election: r.election,
      date: asIsoDate(r.date),
      voters_total: asNum(r.voters_total),
      sex_male: asNum(r.sex_male),
      sex_female: asNum(r.sex_female),
      age: Object.fromEntries(AGE_KEYS.map(k => [k, asNum(r[k])])),
      ethnic: Object.fromEntries(ETH_KEYS.map(k => [k, asNum(r[k])])),
      votertype: {
        regular: asNum(r.votertype_regular),
        early: asNum(r.votertype_early),
        postal_overseas: asNum(r.votertype_postal_overseas),
      },
    }
    if (!bySeat.has(r.seat)) bySeat.set(r.seat, [])
    bySeat.get(r.seat).push(rec)
  }
  const out = new Map()
  for (const seat of seats) {
    const list = (bySeat.get(seat.seat) ?? []).sort((a, b) => b.date.localeCompare(a.date))
    out.set(seat.code, list)
  }
  return out
}
