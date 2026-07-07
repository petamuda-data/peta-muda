// News crawler: sweeps Malaysian news RSS for Johor-relevant stories that hit
// a MUDA-stance theme, and inserts them as DRAFTS into the private intake
// queue (Supabase). It NEVER publishes anything — admins approve in /ops.html.
//
// Standalone (not part of run.mjs): run by .github/workflows/intake.yml every
// 4 hours. Requires SUPABASE_URL / SUPABASE_ANON_KEY / INTAKE_PASS env.
// Per-feed failures are logged and skipped — one broken feed never kills the
// sweep. Dedup is by sha256(link) via the intake table's unique url_hash.
//
// Usage: node pipeline/news.mjs            (insert drafts)
//        node pipeline/news.mjs --dry-run  (print matches, insert nothing)
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fetchText } from './lib/fetch.mjs'
import { suggestTheme, buildSeatMatcher, isJohorStory } from '../site/ops-match.mjs'

const FEEDS = [
  ['FMT', 'https://www.freemalaysiatoday.com/feed/'],
  ['FMT BM', 'https://www.freemalaysiatoday.com/category/bahasa/feed/'],
  ['Malay Mail', 'https://www.malaymail.com/feed/rss/malaysia'],
  ['The Star', 'https://www.thestar.com.my/rss/News/Nation'],
  ['NST', 'https://www.nst.com.my/feed'],
  ['Berita Harian', 'https://www.bharian.com.my/feed'],
]
const MAX_AGE_H = 48
const DRY = process.argv.includes('--dry-run')

// minimal RSS/Atom item extraction — good enough for mainstream feeds, no deps
function parseFeed(xml) {
  const items = []
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) ?? []
  for (const b of blocks) {
    const tag = (name) => {
      const m = b.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'))
      return m ? m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, '').trim() : ''
    }
    const linkAttr = b.match(/<link[^>]*href="([^"]+)"/i)?.[1]
    items.push({
      title: tag('title'),
      link: tag('link') || linkAttr || tag('guid'),
      description: tag('description') || tag('summary') || tag('content:encoded'),
      pubDate: tag('pubDate') || tag('published') || tag('updated'),
    })
  }
  return items.filter(i => i.title && i.link)
}

async function submitDraft(item) {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_ANON_KEY, pass = process.env.INTAKE_PASS
  const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/intake_submit`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      p_pass: pass, p_kind: 'news', p_status: 'draft',
      p_text_bm: item.text, p_theme: item.theme, p_seat_codes: item.seats,
      p_source_url: item.link, p_source_name: item.feed,
      p_url_hash: createHash('sha256').update(item.link).digest('hex'),
    }),
  })
  if (!res.ok) throw new Error(`intake_submit HTTP ${res.status}: ${(await res.text()).slice(0, 180)}`)
  const body = await res.text()
  return body && body !== 'null' // null = duplicate (url_hash conflict), not inserted
}

const idx = JSON.parse(await readFile(path.join('site', 'data', 'index.json'), 'utf8'))
const suggestSeats = buildSeatMatcher(idx.seats)

if (!DRY && (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY || !process.env.INTAKE_PASS)) {
  console.error('news: SUPABASE_URL / SUPABASE_ANON_KEY / INTAKE_PASS not set — nothing to do (use --dry-run to test matching)')
  process.exit(1)
}

let found = 0, inserted = 0, dupes = 0
for (const [feed, feedUrl] of FEEDS) {
  let xml
  try { xml = await fetchText(feedUrl, { retries: 1 }) }
  catch (e) { console.error(`news: feed failed ${feed}: ${e.message}`); continue }
  const items = parseFeed(xml)
  for (const it of items) {
    const age = it.pubDate ? (Date.now() - new Date(it.pubDate).getTime()) / 36e5 : 0
    if (age > MAX_AGE_H) continue
    const text = `${it.title} — ${it.description}`.slice(0, 600)
    const theme = suggestTheme(text)
    if (!theme || !isJohorStory(text, suggestSeats)) continue
    const story = { feed, link: it.link, text: `${it.title}${it.description ? ` — ${it.description.slice(0, 300)}` : ''}`, theme, seats: suggestSeats(text) }
    found++
    if (DRY) { console.log(`[${theme}] (${story.seats.join(',') || 'statewide'}) ${it.title} <${it.link}>`); continue }
    try {
      const fresh = await submitDraft(story)
      fresh ? inserted++ : dupes++
    } catch (e) { console.error(`news: submit failed: ${e.message}`) }
  }
  console.log(`news: ${feed} scanned (${items.length} items)`)
}
console.log(`news: ${found} match(es), ${inserted} new draft(s), ${dupes} duplicate(s) skipped`)
