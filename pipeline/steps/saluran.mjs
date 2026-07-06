// Polling-district (daerah mengundi) level analysis of the 2022 Johor state
// election (SE-15) from the lake's saluran files. Aggregates saluran streams
// up to DM level and buckets candidates into blocs (MUDA broken out even when
// riding with a coalition).
import { fetchText } from '../lib/fetch.mjs'
import { parseCsvObjects } from '../lib/csv.mjs'
import { SOURCES } from '../config.mjs'
import { seatName } from './seats.mjs'

const blocOf = (r) => {
  if ((r.party_uid || '').includes('MUDA') || r.party === 'MUDA') return 'MUDA'
  if (r.coalition === 'PH' || r.coalition === 'BN' || r.coalition === 'PN') return r.coalition
  return 'LAIN' // others/independents
}

const dmType = (dm) => {
  if (dm.includes('Undi Pos')) return 'pos'
  if (dm.includes('Undi Awal')) return 'awal'
  return 'biasa'
}

export async function loadSaluran(seats) {
  const [ballotsText, statsText] = await Promise.all([
    fetchText(SOURCES.saluranBallots),
    fetchText(SOURCES.saluranStats),
  ])
  const ballots = parseCsvObjects(ballotsText)
  const stats = parseCsvObjects(statsText)

  // per seat name -> dm code -> aggregation
  const agg = new Map()
  for (const r of ballots) {
    const seat = r.seat // 'N.01 Buloh Kasap'
    const dm = r.dm
    const key = `${seat}|${dm}`
    if (!agg.has(key)) {
      agg.set(key, {
        seat,
        code: dm.split(' ')[0],
        name: dm.slice(dm.indexOf(' ') + 1),
        type: dmType(dm),
        blocs: {},
        valid: 0,
      })
    }
    const a = agg.get(key)
    const bloc = blocOf(r)
    const votes = Number(r.votes) || 0
    a.blocs[bloc] = (a.blocs[bloc] || 0) + votes
    a.valid += votes
  }

  // turnout per dm from stats
  const turn = new Map()
  for (const r of stats) {
    const key = `${r.seat}|${r.dm}`
    if (!turn.has(key)) turn.set(key, { issued: 0, voters: 0 })
    const t = turn.get(key)
    t.issued += Number(r.ballots_issued) || 0
    // voters_total repeats per saluran within a DM only when saluran splits a
    // register slice; the file carries the per-saluran register size, so sum.
    t.voters += Number(r.voters_total) || 0
  }

  const bySeatName = new Map()
  for (const [key, a] of agg) {
    const t = turn.get(`${a.seat}|${a.code} ${a.name}`) ?? turn.get(key)
    const dm = {
      code: a.code,
      name: a.name,
      type: a.type,
      blocs: a.blocs,
      valid: a.valid,
      voters: t?.voters || null,
      turnout_perc: t && t.voters > 0 ? +(100 * t.issued / t.voters).toFixed(1) : null,
    }
    const nm = seatName(a.seat)
    if (!bySeatName.has(nm)) bySeatName.set(nm, [])
    bySeatName.get(nm).push(dm)
  }

  const out = new Map()
  for (const seat of seats) {
    const dms = bySeatName.get(seat.name)
    if (!dms) { out.set(seat.code, null); continue }
    dms.sort((x, y) => x.code.localeCompare(y.code))
    // seat-level bloc totals
    const totals = {}
    let valid = 0
    for (const dm of dms) {
      valid += dm.valid
      for (const [b, v] of Object.entries(dm.blocs)) totals[b] = (totals[b] || 0) + v
    }
    out.set(seat.code, { election: 'SE-15', date: '2022-03-12', totals, valid, dms })
  }
  return out
}
