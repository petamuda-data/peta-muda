// Where has MUDA (and PSM) actually done well, and what do those places share?
// Computed from the lake's headline + saluran files and our seat JSONs.
import { fetchText } from '../pipeline/lib/fetch.mjs'
import { parseCsvObjects } from '../pipeline/lib/csv.mjs'
import { readParquetUrl, asNum } from '../pipeline/lib/parquet.mjs'
import { SOURCES } from '../pipeline/config.mjs'
import { readFile } from 'node:fs/promises'

const ballots = parseCsvObjects(await fetchText(SOURCES.headlineBallots))

// 1 — every MUDA and PSM candidacy ever (completed contests)
for (const party of ['MUDA', 'PSM']) {
  const rows = ballots.filter(r => r.party === party && r.result !== 'pending')
  console.log(`\n=== ${party}: ${rows.length} candidacies (completed) ===`)
  for (const r of rows.sort((a, b) => a.date.localeCompare(b.date))) {
    console.log(`${r.date} ${r.election.padEnd(11)} ${r.state.padEnd(9)} ${r.seat.padEnd(28)} ${String(r.votes_perc ? (+r.votes_perc).toFixed(1) : '?').padStart(5)}% ${r.result}`)
  }
}

// 2 — Johor SE-15 (2022): DM-level MUDA share in contested seats
const sal = parseCsvObjects(await fetchText(SOURCES.saluranBallots))
const salStats = parseCsvObjects(await fetchText(SOURCES.saluranStats))
const mudaSeats = [...new Set(sal.filter(r => r.party === 'MUDA').map(r => r.seat))]
console.log(`\n=== Johor SE-15 seats where MUDA stood: ${mudaSeats.join(' | ')} ===`)

const dmType = (dm) => {
  const name = dm.slice(dm.indexOf(' ') + 1).toUpperCase()
  if (/FELDA|LADANG|KG\.|KAMPONG|KAMPUNG|PARIT|SIMPANG|SUNGAI|SG\./.test(name)) return 'rural'
  if (/TAMAN|BANDAR|DESA|PEKAN|INDAH|JAYA|MOUNT|PUTERI|SERI ALAM|AUSTIN/.test(name)) return 'urban'
  return 'other'
}

const dmAgg = new Map()
for (const r of sal) {
  if (!mudaSeats.includes(r.seat)) continue
  if (r.dm.includes('Undi Pos') || r.dm.includes('Undi Awal')) continue
  const k = `${r.seat}|${r.dm}`
  if (!dmAgg.has(k)) dmAgg.set(k, { seat: r.seat, dm: r.dm, muda: 0, valid: 0 })
  const a = dmAgg.get(k)
  const v = Number(r.votes) || 0
  a.valid += v
  if (r.party === 'MUDA') a.muda += v
}
const turn = new Map()
for (const r of salStats) {
  const k = `${r.seat}|${r.dm}`
  if (!turn.has(k)) turn.set(k, { issued: 0, voters: 0 })
  turn.get(k).issued += Number(r.ballots_issued) || 0
  turn.get(k).voters += Number(r.voters_total) || 0
}
const dms = [...dmAgg.values()].filter(d => d.valid > 50).map(d => {
  const t = turn.get(`${d.seat}|${d.dm}`)
  return {
    ...d,
    share: 100 * d.muda / d.valid,
    turnout: t && t.voters > 0 ? 100 * t.issued / t.voters : null,
    voters: t?.voters ?? null,
    type: dmType(d.dm),
  }
})

console.log(`\n=== DM-level MUDA share by locality type (n=${dms.length} DMs) ===`)
for (const ty of ['urban', 'rural', 'other']) {
  const g = dms.filter(d => d.type === ty)
  if (!g.length) continue
  const mean = g.reduce((s, d) => s + d.share, 0) / g.length
  const meanT = g.filter(d => d.turnout).reduce((s, d) => s + d.turnout, 0) / g.filter(d => d.turnout).length
  const meanV = g.reduce((s, d) => s + (d.voters || 0), 0) / g.length
  console.log(`${ty.padEnd(6)} n=${String(g.length).padStart(3)}  MUDA ${mean.toFixed(1)}%  turnout ${meanT.toFixed(1)}%  avg size ${Math.round(meanV)}`)
}

console.log('\n=== Top 12 MUDA DMs (2022) ===')
for (const d of [...dms].sort((a, b) => b.share - a.share).slice(0, 12)) {
  console.log(`${d.share.toFixed(1)}%  ${d.seat.padEnd(22)} ${d.dm.slice(d.dm.indexOf(' ') + 1).padEnd(24)} ${d.type.padEnd(6)} turnout ${d.turnout?.toFixed(0)}% size ${d.voters}`)
}
console.log('\n=== Bottom 8 MUDA DMs (2022) ===')
for (const d of [...dms].sort((a, b) => a.share - b.share).slice(0, 8)) {
  console.log(`${d.share.toFixed(1)}%  ${d.seat.padEnd(22)} ${d.dm.slice(d.dm.indexOf(' ') + 1).padEnd(24)} ${d.type.padEnd(6)} turnout ${d.turnout?.toFixed(0)}% size ${d.voters}`)
}

// correlation share vs turnout, share vs size
const corr = (xs, ys) => {
  const n = xs.length
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n
  let num = 0, dx = 0, dy = 0
  for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); dx += (xs[i] - mx) ** 2; dy += (ys[i] - my) ** 2 }
  return num / Math.sqrt(dx * dy)
}
const withT = dms.filter(d => d.turnout != null && d.voters)
console.log(`\ncorr(MUDA share, turnout) = ${corr(withT.map(d => d.share), withT.map(d => d.turnout)).toFixed(3)}`)
console.log(`corr(MUDA share, log DM size) = ${corr(withT.map(d => d.share), withT.map(d => Math.log(d.voters))).toFixed(3)}`)

// 3 — seat-level: MUDA 2022 share vs demographics (SE-15 roll) + income
const demo = await readParquetUrl(SOURCES.demographics)
const seatShare = new Map()
for (const d of dms) {
  if (!seatShare.has(d.seat)) seatShare.set(d.seat, { muda: 0, valid: 0 })
  const s = seatShare.get(d.seat)
  s.muda += d.muda; s.valid += d.valid
}
console.log('\n=== Seat-level: MUDA 2022 share vs seat profile ===')
const incomeRows = JSON.parse(await readFile('site/data/index.json', 'utf8')).seats
for (const [seat, s] of seatShare) {
  const dRow = demo.find(r => r.state === 'Johor' && r.seat === seat && r.election === 'JHR-SE-15')
  const youth = dRow ? 100 * (asNum(dRow.age_18_20) + asNum(dRow.age_21_29)) / asNum(dRow.voters_total) : null
  const chinese = dRow ? 100 * asNum(dRow.ethnic_chinese) / asNum(dRow.voters_total) : null
  const malay = dRow ? 100 * asNum(dRow.ethnic_malay) / asNum(dRow.voters_total) : null
  const idx = incomeRows.find(x => `${x.code} ${x.name}` === seat)
  console.log(`${seat.padEnd(24)} MUDA ${(100 * s.muda / s.valid).toFixed(1).padStart(5)}%  youth ${youth?.toFixed(0)}%  cina ${chinese?.toFixed(0)}%  melayu ${malay?.toFixed(0)}%  income RM${idx?.income_median ?? '?'}`)
}
