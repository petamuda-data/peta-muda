// Intake queue: admin-approved stories (ground reports pasted from WhatsApp +
// crawler-found news) pulled from the private Supabase queue at build time.
//
// Determinism contract (same pattern as data/derived/price_history.json):
// when SUPABASE_URL/SUPABASE_ANON_KEY/INTAKE_PASS are set (CI), we fetch the
// approved rows AND write data/derived/intake_snapshot.json, which the bot
// commits. When they are absent (local dev, offline sims) we read that
// committed snapshot — so a local build always reproduces the committed
// site/data byte-for-byte.
//
// Published entry shape matches data/manual/issues.json entries, with two
// extra fields: verdict 'GROUND_REPORT' (volunteer report, admin-vetted, no
// public receipt — the frontend labels it "Laporan lapangan") or 'REPORTED'
// (news item, admin-vetted, source URL is the receipt), plus seat_codes used
// only for routing here (stripped before publish).
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const SNAPSHOT = path.join('data', 'derived', 'intake_snapshot.json')
const MAX_PER_SEAT = 2
const MAX_STATEWIDE = 2

async function fetchApproved(log) {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_ANON_KEY
  const pass = process.env.INTAKE_PASS
  if (!url || !key || !pass) return null
  const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/intake_list`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_pass: pass, p_status: 'approved' }),
  })
  if (!res.ok) throw new Error(`intake_list HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const rows = await res.json()
  return rows.map(r => ({
    theme: r.theme ?? null,
    issue_bm: r.text_bm,
    issue_en: r.text_en || r.text_bm,
    receipt_bm: r.receipt || null,
    receipt_en: r.receipt || null,
    sources: r.source_url ? [r.source_url] : [],
    verdict: r.kind === 'ground' ? 'GROUND_REPORT' : 'REPORTED',
    date: (r.approved_at ?? r.created_at ?? '').slice(0, 10) || null,
    seat_codes: r.seat_codes ?? [],
  }))
}

// Returns { forSeat(code), statewide, updated } routing published entries.
export async function loadIntake(log = console.log) {
  let items = null
  try {
    items = await fetchApproved(log)
    if (items) {
      await writeFile(SNAPSHOT, JSON.stringify({ updated: new Date().toISOString().slice(0, 10), items }, null, 1))
      log(`intake: ${items.length} approved item(s) from queue (snapshot written)`)
    }
  } catch (e) {
    // A queue outage must not block the data refresh — fall back to snapshot.
    log(`intake: queue fetch failed (${e.message}), falling back to snapshot`)
  }
  if (!items) {
    try {
      items = JSON.parse(await readFile(SNAPSHOT, 'utf8')).items ?? []
      log(`intake: ${items.length} item(s) from committed snapshot`)
    } catch {
      items = []
      log('intake: no snapshot, none')
    }
  }
  const publish = ({ seat_codes, ...entry }) => entry
  const statewide = items.filter(x => !(x.seat_codes ?? []).length).slice(0, MAX_STATEWIDE).map(publish)
  return {
    forSeat: (code) => items.filter(x => (x.seat_codes ?? []).includes(code)).slice(0, MAX_PER_SEAT).map(publish),
    statewide,
  }
}
