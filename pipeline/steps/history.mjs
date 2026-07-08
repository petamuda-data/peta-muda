// Election history per DUN from the electiondata.my open data lake
// (headline_ballots.csv + headline_stats.csv, every contest 1955-present).
// Seats are matched across delimitation exercises by seat NAME within Johor,
// so pre-2018 contests under a different N-number still attach to the current
// seat; the code shown per contest is the one used on that polling day.
import { fetchText } from '../lib/fetch.mjs'
import { parseCsvObjects } from '../lib/csv.mjs'
import { SOURCES, STATE } from '../config.mjs'
import { seatCode, seatName } from './seats.mjs'

const num = (v) => (v === '' || v == null ? null : Number(v))

export async function loadHistory(seats) {
  const [ballotsText, statsText] = await Promise.all([
    fetchText(SOURCES.headlineBallots),
    fetchText(SOURCES.headlineStats),
  ])
  return buildHistory(ballotsText, statsText, seats)
}

// Core classification, separated from the fetch so alternate runners (the
// Melaka build uses the GitHub-raw MECo mirror of the same corpus) can reuse
// the exact grouping/settlement rules.
export function buildHistory(ballotsText, statsText, seats) {
  const ballots = parseCsvObjects(ballotsText).filter(r => r.state === STATE && r.seat.startsWith('N.'))
  const stats = parseCsvObjects(statsText).filter(r => r.state === STATE && r.seat.startsWith('N.'))

  const statKey = (r) => `${r.date}|${r.seat}`
  const statByContest = new Map(stats.map(r => [statKey(r), r]))

  // group ballots by contest
  const contests = new Map()
  for (const r of ballots) {
    const k = statKey(r)
    if (!contests.has(k)) contests.set(k, { date: r.date, election: r.election, seat: r.seat, ballot: [] })
    contests.get(k).ballot.push({
      uid: r.candidate_uid,
      name: r.name,
      party: r.party,
      party_uid: r.party_uid,
      coalition: r.coalition,
      coalition_uid: r.coalition_uid,
      votes: num(r.votes),
      votes_perc: num(r.votes_perc),
      result: r.result,
    })
  }

  // attach stats + index by seat name
  const bySeatName = new Map()
  for (const c of contests.values()) {
    // count-week lake updates may append resulted rows next to stale pending
    // ones; keep one row per candidate, preferring the settled/latest row
    const byCand = new Map()
    for (const b of c.ballot) {
      const k = b.uid || b.name
      const prev = byCand.get(k)
      if (!prev
        || (prev.result === 'pending' && b.result !== 'pending')
        || (prev.result !== 'pending' && b.result !== 'pending' && (b.votes ?? 0) > (prev.votes ?? 0))) {
        byCand.set(k, b)
      }
    }
    c.ballot = [...byCand.values()]
    c.ballot.sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0))
    const s = statByContest.get(`${c.date}|${c.seat}`)
    if (s) {
      c.voters_total = num(s.voters_total)
      // in the lake headline_stats file, voter_turnout is already a percentage
      c.voter_turnout_perc = num(s.voter_turnout)
      c.majority = num(s.majority)
      c.majority_perc = num(s.majority_perc)
      c.votes_rejected = num(s.votes_rejected)
    }
    const nm = seatName(c.seat)
    if (!bySeatName.has(nm)) bySeatName.set(nm, [])
    bySeatName.get(nm).push(c)
  }
  for (const list of bySeatName.values()) list.sort((a, b) => b.date.localeCompare(a.date))

  const out = new Map()
  for (const seat of seats) {
    const list = (bySeatName.get(seat.name) ?? []).map(c => {
      // nomination lineups for future polling days ship with result='pending'.
      // A contest only counts as completed once its results look complete:
      // no pending/blank rows AND real vote counts — otherwise a mid-count
      // lake state (result strings blanked or flipped before totals arrive)
      // would be published as an official result. Single-candidate walkovers
      // are the one legitimate zero-vote completed contest (23 in the lake).
      const unsettled = c.ballot.some(b => b.result === 'pending' || !b.result)
      const totalVotes = c.ballot.reduce((a, b) => a + (b.votes ?? 0), 0)
      const walkover = c.ballot.length === 1 && (c.ballot[0].result ?? '').startsWith('won')
      return {
        ...c,
        status: unsettled || (totalVotes === 0 && !walkover) ? 'upcoming' : 'completed',
        code_then: seatCode(c.seat),
        seat: undefined,
      }
    })
    out.set(seat.code, list)
  }
  return out
}

// Career records for a set of candidate uids, from the same headline file
// (every contest nationwide, parlimen + DUN, 1955-present).
export async function loadCareers(uids) {
  const rows = parseCsvObjects(await fetchText(SOURCES.headlineBallots))
  const byUid = new Map()
  for (const r of rows) {
    if (!uids.has(r.candidate_uid) || r.result === 'pending') continue
    if (!byUid.has(r.candidate_uid)) byUid.set(r.candidate_uid, [])
    byUid.get(r.candidate_uid).push({
      date: r.date,
      election: r.election,
      seat: r.seat,
      state: r.state,
      party: r.party,
      votes_perc: num(r.votes_perc),
      result: r.result,
    })
  }
  const out = new Map()
  for (const [uid, contests] of byUid) {
    contests.sort((a, b) => b.date.localeCompare(a.date))
    out.set(uid, {
      contested: contests.length,
      won: contests.filter(c => c.result.startsWith('won')).length,
      last: contests[0],
      contests: contests.slice(0, 8),
      party_timeline: partyTimeline(contests),
    })
  }
  return out
}

// Collapse a candidate's contest list into consecutive party "stints" (oldest
// first), so the record can show "PAS 2004–2013 → AMANAH 2018–now". Contests
// share a date when someone stands for a parlimen AND a state seat the same
// day; those must read as one stint, not a switch — so we bucket by year and
// take the party of the year's first contest. Coalition realignment is not a
// party switch, so this tracks the party label the candidate stood under.
function partyTimeline(contests) {
  const byYear = new Map() // year -> party of that year's earliest contest
  for (const c of [...contests].sort((a, b) => a.date.localeCompare(b.date))) {
    const year = c.date.slice(0, 4)
    if (!byYear.has(year)) byYear.set(year, c.party)
  }
  const stints = []
  for (const [year, party] of byYear) {
    const tail = stints[stints.length - 1]
    if (tail && tail.party === party) tail.to = year
    else stints.push({ party, from: year, to: year })
  }
  return stints
}
