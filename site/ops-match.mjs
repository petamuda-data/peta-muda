// Shared intake matcher: suggests a MUDA-stance theme and target seats for a
// raw story (WhatsApp paste or news item). Used by BOTH the admin page
// (site/ops.js, browser) and the news crawler (pipeline/news.mjs, node) —
// keep it dependency-free ESM.
//
// Theme keys MUST stay aligned with data/manual/muda_stances.json `key`s —
// that alignment is what auto-pairs an approved story with MUDA's answer.

// Ordered: more specific themes first so e.g. SST beats generic cost_of_living.
export const THEME_KEYWORDS = [
  ['sst', [/\bsst\b/i, /cukai jualan/i, /sales tax/i, /cukai perkhidmatan/i]],
  ['floods', [/banjir/i, /\bflood/i, /tebatan/i, /monsun/i, /hujan lebat/i, /evacuat/i, /dipindahkan/i]],
  ['water', [/bekalan air/i, /paip/i, /water (supply|cut|disruption)/i, /air (terputus|keruh|tercemar)/i, /sungai .{0,20}(cemar|pollut)/i, /loji air/i]],
  ['housing', [/perumahan/i, /rumah mampu/i, /affordable hous/i, /\bsewa\b/i, /\brent(al)?\b/i, /apartmen/i, /apartment/i, /kondominium/i, /harga rumah/i, /house price/i, /ppr\b/i]],
  ['wages', [/\bgaji\b/i, /\bupah\b/i, /\bwage/i, /salary/i, /pengangguran/i, /unemploy/i, /kerja di singapura/i, /minimum wage/i, /pendapatan rendah/i]],
  ['traffic', [/\bjem\b/i, /kesesakan/i, /traffic/i, /congestion/i, /\btol\b/i, /lebuh ?raya/i, /jalan (rosak|berlubang)/i, /pothole/i, /causeway/i, /tambak johor/i]],
  ['integrity', [/rasuah/i, /corrupt/i, /integriti/i, /sprm/i, /\bmacc\b/i, /isytihar aset/i, /salah guna/i]],
  ['allocation', [/peruntukan/i, /allocation/i, /geran/i, /dana (kerajaan|negeri)/i]],
  ['furniture', [/perabot/i, /furniture/i]],
  ['cost_of_living', [/kos sara hidup/i, /cost of living/i, /harga .{0,24}(naik|melambung|mahal|meningkat)/i, /harga barang/i, /subsidi/i, /ron ?95/i, /diesel/i, /petrol/i, /inflasi/i, /inflation/i, /\bmahal\b/i, /price (hike|increase|of)/i, /prices? (rise|rose|up)/i]],
]

export function suggestTheme(text) {
  const t = String(text ?? '')
  for (const [key, patterns] of THEME_KEYWORDS) {
    if (patterns.some(re => re.test(t))) return key
  }
  return null
}

// seats: [{ code, name, parlimen, kpdn_district }] (site/data/index.json shape).
// Matches seat names, parlimen names and KPDN district names as whole-ish
// words. Returns up to `max` DUN codes, most-specific (seat name) first.
export function buildSeatMatcher(seats) {
  const norm = (s) => String(s ?? '').toLowerCase()
  const entries = seats.map(s => ({
    code: s.code,
    name: norm(s.name),
    parlimen: norm((s.parlimen ?? '').replace(/^p\.\d+\s*/i, '')),
    district: norm(s.kpdn_district),
  }))
  const wordHit = (haystack, needle) =>
    needle && needle.length >= 4 && haystack.includes(needle)
  return function suggestSeats(text, max = 3) {
    const t = norm(text)
    const scored = []
    for (const e of entries) {
      if (wordHit(t, e.name)) scored.push({ code: e.code, score: 3 })
      else if (wordHit(t, e.parlimen)) scored.push({ code: e.code, score: 2 })
      else if (wordHit(t, e.district)) scored.push({ code: e.code, score: 1 })
    }
    scored.sort((a, b) => b.score - a.score)
    const seen = new Set()
    const out = []
    for (const s of scored) {
      if (!seen.has(s.code)) { seen.add(s.code); out.push(s.code) }
      if (out.length >= max) break
    }
    return out
  }
}

// Johor relevance gate for the crawler: the story must mention Johor itself
// or hit a seat/parlimen/district name.
export function isJohorStory(text, suggestSeats) {
  if (/\bjohor\b/i.test(String(text ?? ''))) return true
  return suggestSeats(text, 1).length > 0
}
