// Fetch helpers with retry, polite pacing and an on-disk cache (.cache/)
// so development re-runs don't hammer the public endpoints.
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises'
import path from 'node:path'

const CACHE_DIR = '.cache'
const USE_CACHE = process.env.PIPELINE_NO_CACHE !== '1'
// Every source is mutable (nomination ballots appear overnight; the current
// PriceCatcher month grows daily), so cached copies expire after a few hours.
const CACHE_TTL_MS = (Number(process.env.PIPELINE_CACHE_TTL_HOURS) || 6) * 3600e3
const UA = 'PetaMuda/0.1 (civic data app; contact: dev)'

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function cachePath(url) {
  const hash = createHash('sha1').update(url).digest('hex').slice(0, 20)
  const name = url.replace(/[^a-z0-9.]+/gi, '_').slice(-60)
  return path.join(CACHE_DIR, `${hash}_${name}`)
}

export async function fetchRaw(url, { retries = 3, as = 'text' } = {}) {
  const file = await cachePath(url)
  if (USE_CACHE) {
    try {
      const st = await stat(file)
      if (Date.now() - st.mtimeMs < CACHE_TTL_MS) {
        const buf = await readFile(file)
        return as === 'text' ? buf.toString('utf8') : buf
      }
      console.log(`cache expired (> ${CACHE_TTL_MS / 3600e3}h), refetching ${url.slice(0, 90)}`)
    } catch { /* miss */ }
  }
  let lastErr
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA } })
      if (res.status === 429 || res.status >= 500) {
        lastErr = new Error(`HTTP ${res.status} for ${url}`)
        await sleep(2000 * (attempt + 1) ** 2)
        continue
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
      const buf = Buffer.from(await res.arrayBuffer())
      await mkdir(CACHE_DIR, { recursive: true })
      await writeFile(file, buf)
      return as === 'text' ? buf.toString('utf8') : buf
    } catch (e) {
      lastErr = e
      await sleep(1500 * (attempt + 1))
    }
  }
  throw lastErr
}

export const fetchText = (url, opts) => fetchRaw(url, { ...opts, as: 'text' })
export const fetchBuffer = (url, opts) => fetchRaw(url, { ...opts, as: 'buffer' })

export async function fetchJson(url, opts) {
  const text = await fetchText(url, opts)
  return JSON.parse(text)
}

// data.gov.my documents 4 req/min; space API calls out.
let lastApiCall = 0
export async function fetchDataGovMy(url) {
  const since = Date.now() - lastApiCall
  if (since < 2000) await sleep(2000 - since)
  lastApiCall = Date.now()
  return fetchJson(url)
}
