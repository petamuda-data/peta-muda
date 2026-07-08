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

const FLOOD_ENDPOINT = (stateName) =>
  `https://api.data.gov.my/flood-warning?contains=${encodeURIComponent(stateName)}@state`
// METMalaysia civil-defence warnings (heavy rain, thunderstorm, etc.) — national
// feed, filtered client-side to rows mentioning the state.
const WEATHER_ENDPOINT = 'https://api.data.gov.my/weather/warning'

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

// METMalaysia warnings that mention this state, most recent first. Defensive:
// the response shape isn't verifiable from this environment, so we probe many
// plausible field names and yield [] on any mismatch.
function summariseWeather(rows, stateName) {
  const out = []
  const s = stateName.toLowerCase()
  for (const r of Array.isArray(rows) ? rows : []) {
    const title = r.heading_en ?? r.heading ?? r.title ?? r.warning ?? r.msg_en ?? null
    if (!title) continue
    const blob = JSON.stringify(r).toLowerCase()
    // national feed — keep only warnings that name the state (or that carry no
    // area field at all, i.e. nationwide)
    const hasArea = /state|area|location|negeri|daerah/.test(blob)
    if (hasArea && !blob.includes(s)) continue
    out.push({
      title: String(title).slice(0, 140),
      valid_to: r.valid_to ?? r.valid_until ?? r.end ?? null,
    })
  }
  return out.slice(0, 3)
}

// Returns the live-alerts block for a state, or null when there is nothing to
// show (no alerts, or no data). Never throws.
const UA = { headers: { 'User-Agent': 'PetaMuda/0.1 (civic data app)' } }
const fetchArr = async (url) => {
  const res = await fetch(url, UA)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const raw = await res.json()
  return Array.isArray(raw) ? raw : (raw?.data ?? raw?.results ?? [])
}

export async function loadAlerts(stateName, log = console.log) {
  let summary = null
  if (process.env.ALERTS_FEED === '1') {
    try {
      const floodArr = await fetchArr(FLOOD_ENDPOINT(stateName))
      log(`alerts(${stateName}) flood probe: ${floodArr.length} station(s); keys: ${floodArr[0] ? Object.keys(floodArr[0]).join(',') : '(none)'}`)
      summary = summarise(floodArr)
      // weather is best-effort and must never fail the flood feed
      try {
        const wxArr = await fetchArr(WEATHER_ENDPOINT)
        log(`alerts(${stateName}) weather probe: ${wxArr.length} warning(s); keys: ${wxArr[0] ? Object.keys(wxArr[0]).join(',') : '(none)'}`)
        summary.weather = summariseWeather(wxArr, stateName)
      } catch (e) {
        log(`alerts(${stateName}): weather fetch failed (${e.message})`)
        summary.weather = []
      }
      await mkdir(path.dirname(snapshotPath(stateName)), { recursive: true })
      await writeFile(snapshotPath(stateName), JSON.stringify(summary, null, 1))
      log(`alerts(${stateName}): ${summary.total} river station(s) at alert+, ${summary.weather.length} weather warning(s) (snapshot written)`)
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
  // show the card if there is any live signal — flood stations or weather
  const has = (summary.total > 0) || ((summary.weather ?? []).length > 0)
  return has ? summary : null
}
