// Import adversarially-verified doorstep issues from a verification-workflow
// output file into data/manual/issues.json.
// Usage: node tools/import_issues.mjs <workflow-output.json>
import { readFile, writeFile } from 'node:fs/promises'

const raw = JSON.parse(await readFile(process.argv[2], 'utf8'))
const results = (raw.result?.results ?? []).filter(r => r.verdict !== 'REFUTED')

const seats = {}
const statewide = []
for (const r of [...results].sort((a, b) => a.index - b.index)) {
  const item = {
    issue_bm: r.issue_bm,
    issue_en: r.issue_en,
    receipt_bm: r.receipt_bm,
    receipt_en: r.receipt_en,
    sources: (r.sources ?? []).slice(0, 4),
    verdict: r.verdict,
  }
  const codes = [...new Set(r.area.match(/N\.\d{2}/g) ?? [])]
  if (/statewide/i.test(r.area) || !codes.length) statewide.push(item)
  else for (const c of codes) (seats[c] ??= []).push(item)
}

// keep the signal: max 3 per seat + 3 statewide (agents ranked theirs
// most-compelling-first; verification preserved the index order)
for (const c of Object.keys(seats)) seats[c] = seats[c].slice(0, 3)

const out = {
  _comment: 'Curated local doorstep issues. Every entry survived an adversarial fact-check (one hostile verifier per issue re-fetching all sources); corrections were applied to the wording. Edit freely; re-run the pipeline after edits.',
  updated: new Date().toISOString().slice(0, 10),
  seats,
  statewide: statewide.slice(0, 3),
}
await writeFile('data/manual/issues.json', JSON.stringify(out, null, 2))
console.log(`wrote issues.json: ${Object.entries(seats).map(([c, l]) => `${c}=${l.length}`).join(' ')} statewide=${out.statewide.length} (from ${results.length} verified)`)
