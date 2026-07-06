// DOSM Kawasanku per-constituency scorecard (amenities, utilities, income).
// The parquet carries three variants per indicator: _x (normalized jitter
// position), _y (jitter row), _t (raw value). We keep the raw _t values.
import { readParquetUrl, asNum } from '../lib/parquet.mjs'
import { SOURCES } from '../config.mjs'

const INDICATORS = [
  'income_mean', 'expenditure_mean', 'gini', 'poverty',
  'labour_urate', 'labour_prate',
  'electricity', 'water',
  'hospital', 'clinic', 'school', 'police_fire', 'grocery', 'atm', 'petrol',
  'population_density', 'household_size',
  'voters_total', 'voter_turnout',
]

export async function loadKawasanku(seats) {
  const columns = ['area_type', 'area', ...INDICATORS.map(k => `${k}_t`)]
  const rows = await readParquetUrl(SOURCES.kawasanku, { columns })
  const wanted = new Map(seats.map(s => [s.seat, s.code]))
  const out = new Map()
  for (const r of rows) {
    if (r.area_type !== 'dun') continue
    const code = wanted.get(r.area)
    if (!code) continue
    const rec = {}
    for (const k of INDICATORS) rec[k] = asNum(r[`${k}_t`])
    out.set(code, rec)
  }
  return out
}
