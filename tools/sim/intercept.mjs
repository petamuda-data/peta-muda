// Fetch interceptor for offline pipeline simulation. Loaded via
//   node --import <repo>/tools/sim/intercept.mjs pipeline/run.mjs
// with SIM_FIXTURES pointing at a fixture dir containing manifest.json
// ({ "<url>": "<relative file>" }). Every outbound fetch is served from the
// fixture tree — HEAD and Range requests included, so hyparquet's
// asyncBufferFromUrl works — and any URL missing from the manifest throws,
// which guarantees the simulation never silently touches the network.
import { readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const FIX = process.env.SIM_FIXTURES
if (!FIX) throw new Error('SIM_FIXTURES not set')
const manifest = JSON.parse(readFileSync(path.join(FIX, 'manifest.json'), 'utf8'))

globalThis.fetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : input.url
  const rel = manifest[url]
  if (!rel) throw new Error(`SIM: unmapped URL ${url}`)
  const buf = await readFile(path.join(FIX, rel))
  const method = (init.method ?? (typeof input !== 'string' ? input.method : null) ?? 'GET').toUpperCase()
  const base = { 'content-type': 'application/octet-stream', 'accept-ranges': 'bytes' }
  if (method === 'HEAD') {
    return new Response(null, { status: 200, headers: { ...base, 'content-length': String(buf.length) } })
  }
  const range = new Headers(init.headers ?? {}).get('range')
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range)
    const start = m[1] === '' ? buf.length - Number(m[2]) : Number(m[1])
    const end = m[1] !== '' && m[2] !== '' ? Math.min(Number(m[2]), buf.length - 1) : buf.length - 1
    const slice = buf.subarray(start, end + 1)
    return new Response(slice, {
      status: 206,
      headers: { ...base, 'content-length': String(slice.length), 'content-range': `bytes ${start}-${end}/${buf.length}` },
    })
  }
  return new Response(buf, { status: 200, headers: { ...base, 'content-length': String(buf.length) } })
}
