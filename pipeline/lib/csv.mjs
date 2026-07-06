// Minimal RFC-4180-ish CSV parser: handles quoted fields containing commas,
// escaped quotes ("") and newlines. Returns array of row arrays.
export function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ }
        else inQuotes = false
      } else field += ch
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      row.push(field); field = ''
    } else if (ch === '\n') {
      row.push(field); field = ''
      rows.push(row); row = []
    } else if (ch !== '\r') {
      field += ch
    }
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row) }
  return rows
}

// Parse into objects keyed by header row; skips fully-empty lines.
export function parseCsvObjects(text) {
  const rows = parseCsv(text)
  const header = rows[0]
  const out = []
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]
    if (r.length === 1 && r[0] === '') continue
    const obj = {}
    for (let j = 0; j < header.length; j++) obj[header[j]] = r[j] ?? ''
    out.push(obj)
  }
  return out
}
