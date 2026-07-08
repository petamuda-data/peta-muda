// Live flood-warning feed (JPS river levels via data.gov.my's OpenAPI).
// This is the app's daily "ground signal": when rivers in the state are at
// alert/warning/danger level RIGHT NOW, the seat pages surface it and pair it
// with MUDA's documented #MariBantu flood record — live proof of the current
// administration's unresolved flood exposure, next to MUDA's answer.
//
// Determinism contract (same as intake/price_history): the live fetch only
// runs when ALERTS_FEED=1 (set in CI). It writes data/derived/alerts_snapshot
// for the state, which the bot commits; every other environment (local dev,
// offline sims) reads that snapshot, so builds stay reproducible and the sim's
// URL interceptor is never asked for an unmapped endpoint. Any failure or an
// unexpected response shape degrades to "no alerts" — it can never block a
// refresh.
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'

const ENDPOINT = (stateName) =>
  `https://api.data.gov.my/flood-warning?contains=${encodeURIComponent(stateName)}@state`

const snapshotPath = (stateName) =>
  path.join('data', 'derived', `alerts_${stateName.toLowerCase().replace(/\s+/g, '_')}.json`)

const n = (v) => { const x = Number(v); return Number.isFinite(x) ? x : null }

// Classify a station by its current level against JPS thresholds.
function severity(r) {
  const cur = n(r.water_level_current ?? r.water_level ?? r.level_current)
  if (cur == null) return null
  const danger = n(r.water_level_danger_level ?? r.danger)
  const warning = n(r.water_level_warning_level ?? r.warning)
  const alert = n(r.water_level_alert_level ?? r.alert)
  if (danger != null && cur >= danger) return 'danger'
  if (warning != null && cur >= warning) return 'warning'
  if (alert != null && cur >= alert) return 'alert'
  return null
}

function summarise(rows) {
  const stations = []
  for (const r of Array.isArray(rows) ? rows : []) {
    const sev = severity(r)
    if (!sev) continue
    stations.push({
      name: r.station_name ?? r.name ?? '—',
      district: r.district ?? null,
      level: n(r.water_level_current ?? r.water_level),
      severity: sev,
    })
  }
  const rank = { danger: 3, warning: 2, alert: 1 }
  stations.sort((a, b) => rank[b.severity] - rank[a.severity])
  const counts = { danger: 0, warning: 0, alert: 0 }
  for (const s of stations) counts[s.severity]++
  return {
    as_of: new Date().toISOString().slice(0, 10),
    counts,
    total: stations.length,
    stations: stations.slice(0, 8),
  }
}

// Returns the live-alerts block for a state, or null when there is nothing to
// show (no alerts, or no data). Never throws.
export async function loadAlerts(stateName, log = console.log) {
  let summary = null
  if (process.env.ALERTS_FEED === '1') {
    try {
      const res = await fetch(ENDPOINT(stateName), { headers: { 'User-Agent': 'PetaMuda/0.1 (civic data app)' } })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const raw = await res.json()
      // one-time field-shape probe: confirms the threshold keys map to the live
      // response (a dry day and a field-name mismatch both yield 0 alerts, so
      // log the raw shape until validated, then this can be removed)
      const arr = Array.isArray(raw) ? raw : (raw?.data ?? raw?.results ?? [])
      log(`alerts(${stateName}) probe: ${arr.length} station(s) received; sample keys: ${arr[0] ? Object.keys(arr[0]).join(',') : '(none)'}`)
      summary = summarise(arr)
      await mkdir(path.dirname(snapshotPath(stateName)), { recursive: true })
      await writeFile(snapshotPath(stateName), JSON.stringify(summary, null, 1))
      log(`alerts(${stateName}): ${summary.total} station(s) at alert+ (snapshot written)`)
    } catch (e) {
      log(`alerts(${stateName}): live fetch failed (${e.message}), falling back to snapshot`)
      summary = null
    }
  }
  if (!summary) {
    try {
      summary = JSON.parse(await readFile(snapshotPath(stateName), 'utf8'))
      log(`alerts(${stateName}): ${summary.total ?? 0} station(s) from snapshot`)
    } catch {
      return null
    }
  }
  return summary && summary.total > 0 ? summary : null
}
