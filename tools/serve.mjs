// Tiny static file server for local preview of /site (no dependencies).
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const ROOT = path.resolve('site')
const PORT = process.env.PORT || 8123
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.geojson': 'application/geo+json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json',
  '.mp4': 'video/mp4',
}

createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname)
    if (p.endsWith('/')) p += 'index.html'
    const file = path.join(ROOT, p)
    if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end() }
    const data = await readFile(file)
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream' })
    res.end(data)
  } catch {
    res.writeHead(404); res.end('not found')
  }
}).listen(PORT, () => console.log(`serving site/ at http://localhost:${PORT}`))
