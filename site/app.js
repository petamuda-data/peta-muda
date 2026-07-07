// Peta MUDA — Seat Command Center (static, no build step).
// Data: electiondata.my (CC0) + data.gov.my/OpenDOSM (CC BY 4.0) + KPDN PriceCatcher.
import { suggestTheme } from './ops-match.mjs'

// localStorage may be blocked (SecurityError) or hold a foreign value written
// by another app on a shared origin (e.g. github.io) — only accept 'en'/'bm'.
const storage = {
  get(k) { try { return localStorage.getItem(k) } catch { return null } },
  set(k, v) { try { localStorage.setItem(k, v) } catch { /* blocked */ } },
}
const LANGS = ['bm', 'en']
const LANG_LABEL = { bm: 'BM', en: 'EN' }
const state = {
  lang: LANGS.includes(storage.get('lang')) ? storage.get('lang') : 'bm',
  index: null,
  seats: new Map(), // slug -> seat json
  geo: null,
}

// ---------- i18n ----------
const STR = {
  bm: {
    tagline: 'Pusat Data Kerusi — PRN Johor 2026',
    days_to_poll: 'hari lagi ke hari mengundi',
    poll_day: 'Hari mengundi: 11 Julai 2026',
    early_vote: 'Undi awal: 7 Julai 2026',
    poll_today: 'HARI MENGUNDI — keluar mengundi!',
    poll_over: 'PRN Johor 2026 telah selesai. Terima kasih kerana mengundi!',
    featured: 'Kerusi Blok Progresif (MUDA–PSM)',
    as_of: 'Harga setakat',
    cost_trend_title: 'Kos sara hidup — berbanding dulu',
    cost_trend_sub: 'Perubahan harga sebenar berbanding 1 bulan hingga 1 tahun lalu — naik (merah) atau turun (hijau) ikut data',
    cost_trend_note: 'Setiap angka membandingkan harga hari ini dengan harga tempoh lalu. CPI: OpenDOSM (inflasi rasmi Johor). Petrol: harga runcit mingguan KPDN. Bakul makanan: median PriceCatcher barangan bukan kawalan harga. Arah mengikut data — sahkan sebelum menerbitkan.',
    win_12m: '1 thn',
    fuel_now: 'Harga petrol kini',
    all_seats: 'Semua 56 kerusi DUN Johor',
    search: 'Cari kerusi, kawasan atau parlimen…',
    locate_btn: 'Guna lokasi saya',
    locate_finding: 'Mencari kawasan anda…',
    locate_denied: 'Tak dapat akses lokasi — cari kerusi anda di bawah.',
    locate_outside: 'Lokasi anda di luar Johor — cari kerusi anda di bawah.',
    install_btn: 'Pasang aplikasi di telefon anda',
    voters: 'pengundi',
    youth: 'bawah 30',
    majority: 'majoriti',
    turnout: 'keluar mengundi',
    tab_brief: 'Ringkas',
    tab_field: 'Lapangan',
    tab_hq: 'Analisis',
    contest_2026: 'Pertandingan 11 Julai 2026',
    contest_sub: 'Senarai calon rasmi (hari penamaan 27 Jun) — data ElectionData.MY',
    results_2026: 'Keputusan 11 Julai 2026',
    results_sub: 'Keputusan rasmi — data ElectionData.MY',
    first_time: 'Calon kali pertama',
    career_line: (c, w, el, yr) => `Rekod: ${c} tandingan, ${w} menang · terakhir ${el} (${yr})`,
    record_hop: (n) => `Bertukar parti ${n} kali`,
    record_switchedin: (p) => `Bertanding atas tiket ${p} buat kali pertama tahun ini`,
    muda_title: 'MUDA — parti kecil, kesan besar',
    brief_btn: 'Briefing AI (untuk ChatGPT/Gemini)',
    brief_saved: 'Fail .md dimuat turun!',
    volunteer_title: 'Briefing AI untuk sukarelawan',
    volunteer_sub: 'Cari kerusi anda, dapatkan briefing AI dengan satu klik — sedia untuk tampal terus ke ChatGPT/Gemini.',
    volunteer_get_btn: 'Dapatkan briefing AI',
    volunteer_loading: 'Menjana…',
    volunteer_none: 'Tiada kerusi sepadan.',
    volunteer_copied: (seat) => `✓ Briefing ${seat} telah disalin — sedia untuk tampal`,
    volunteer_cta_sub: 'Buka chat BARU, kemudian tampal (Cmd/Ctrl+V):',
    volunteer_open_chatgpt: 'Buka ChatGPT',
    volunteer_open_gemini: 'Buka Gemini',
    ceiling_exceeds: (p) => `+${p}% melebihi`,
    stress_line: (r) => `Daripada setiap RM100 pendapatan, RM${r} habis untuk perbelanjaan isi rumah`,
    bloc_candidate: 'Calon Blok Progresif',
    prices_here: 'Harga barang dapur di kawasan anda',
    prices_sub: (d) => `Harga median di premis KPDN daerah ${d} — berbanding Mac 2022, PRN lalu`,
    col_item: 'Barang',
    col_price: 'Harga',
    col_then: 'Mac 2022',
    col_12w: '3 bln',
    trend: 'Arah',
    income_ctx: 'Konteks pendapatan',
    income_median: 'Pendapatan penengah isi rumah',
    income_mean: 'Pendapatan purata',
    poverty: 'Kadar kemiskinan mutlak',
    gini: 'Ketaksamaan (Gini)',
    u_rate: 'Kadar pengangguran',
    pp_line: (b, i) => `Sejak PRN Mac 2022: harga barang dapur naik ${b}%/thn, pendapatan hanya ${i}%/thn — kuasa beli keluarga semakin menyusut.`,
    share: 'Kongsi ringkasan',
    copied: 'Disalin!',
    story_title: 'Cerita kempen — 5 langkah',
    story_sub: 'Satu naratif tersusun; butiran penuh di bahagian bawah',
    beat_path: 'Jalan kemenangan',
    beat_voters: 'Pengundi penentu',
    beat_message: 'Mesej di pintu',
    beat_ground: 'Peta lapangan',
    beat_ask: 'Tindakan',
    beat_local: 'Tempatan',
    beat_national: 'Nasional',
    issues_national: 'Nasional',
    issues_title: 'Isu tempatan (disahkan sumber)',
    issues_sub: 'Isu khusus kawasan ini, disemak terhadap laporan berita — nombor rujukan boleh diklik',
    issues_statewide: 'Seluruh Johor',
    talking_points: 'Isu untuk rumah ke rumah',
    tp_sub: 'Dijana automatik daripada data rasmi — semak sebelum guna',
    demo_title: 'Profil pengundi (daftar pemilih 2026)',
    demo_sub: 'Daftar pemilih JHR-SE-16 — ElectionData.MY',
    age_dist: 'Umur pengundi',
    ethnic_dist: 'Etnik pengundi',
    new_voters: 'pengundi baharu sejak PRU15 (Nov 2022)',
    women: 'wanita',
    history: 'Sejarah keputusan',
    saluran: 'Analisis daerah mengundi (PRN 2022)',
    saluran_sub: 'Undian mengikut daerah mengundi — kenal pasti kubu & medan rebutan',
    dm: 'Daerah mengundi',
    export: 'Muat turun data',
    export_json: 'JSON penuh kerusi',
    export_csv: 'CSV daerah mengundi',
    winner: 'Pemenang',
    election: 'Pilihan raya',
    sources: 'Sumber data',
    built: 'Data dibina',
    disclaimer: 'Alat maklumat tidak rasmi berasaskan 100% data terbuka kerajaan/awam. Bukan ramalan. Sahkan fakta sebelum penerbitan kempen.',
    err: 'Maaf, data tidak dapat dimuatkan.',
    candidates: 'calon',
    income_note: (y) => `Anggaran HIES ${y}, DOSM`,
    price_note: 'Harga ialah median premis yang dipantau KPDN; boleh berbeza di kedai berlainan.',
    no_price: 'Tiada data harga daerah — median Johor ditunjukkan.',
    top3_note: (n) => `3 kenaikan paling ketara sejak PRN Mac 2022, daripada ${n} barangan dipantau.`,
  },
  en: {
    tagline: 'Seat Command Center — 2026 Johor Election',
    days_to_poll: 'days to polling day',
    poll_day: 'Polling day: 11 July 2026',
    early_vote: 'Early voting: 7 July 2026',
    poll_today: 'POLLING DAY — get out and vote!',
    poll_over: 'The 2026 Johor election has concluded. Thank you for voting!',
    featured: 'Progressive Bloc seats (MUDA–PSM)',
    as_of: 'Prices as of',
    cost_trend_title: 'Cost of living — versus before',
    cost_trend_sub: 'Real price change versus 1 month to 1 year ago — up (red) or down (green), the direction the data shows',
    cost_trend_note: 'Each figure compares today’s price with the price then. CPI: OpenDOSM (official Johor inflation). Fuel: KPDN weekly retail. Food basket: median PriceCatcher price of non-price-controlled staples. Direction follows the data — verify before publishing.',
    win_12m: '1yr',
    fuel_now: 'Fuel price now',
    all_seats: 'All 56 Johor state seats',
    search: 'Search seat, area or parlimen…',
    locate_btn: 'Use my location',
    locate_finding: 'Finding your area…',
    locate_denied: 'Couldn’t access your location — search for your seat below.',
    locate_outside: 'You seem to be outside Johor — search for your seat below.',
    install_btn: 'Install the app on your phone',
    voters: 'voters',
    youth: 'under 30',
    majority: 'majority',
    turnout: 'turnout',
    tab_brief: 'Brief',
    tab_field: 'Field',
    tab_hq: 'Analysis',
    contest_2026: 'The 11 July 2026 contest',
    contest_sub: 'Official candidate list (nomination 27 Jun) — ElectionData.MY',
    results_2026: 'The 11 July 2026 result',
    results_sub: 'Official result — ElectionData.MY',
    first_time: 'First-time candidate',
    career_line: (c, w, el, yr) => `Record: ${c} contests, ${w} won · last ${el} (${yr})`,
    record_hop: (n) => `Switched party ${n} times`,
    record_switchedin: (p) => `Standing on the ${p} ticket for the first time this year`,
    muda_title: 'MUDA — small party, big bite',
    brief_btn: 'AI briefing (for ChatGPT/Gemini)',
    brief_saved: '.md file downloaded!',
    volunteer_title: 'Volunteer AI briefings',
    volunteer_sub: 'Find your seat, get an AI briefing in one tap — ready to paste straight into ChatGPT/Gemini.',
    volunteer_get_btn: 'Get my AI briefing',
    volunteer_loading: 'Generating…',
    volunteer_none: 'No matching seats.',
    volunteer_copied: (seat) => `✓ ${seat} briefing copied to clipboard`,
    volunteer_cta_sub: 'Open a NEW chat, then paste it in (Cmd/Ctrl+V):',
    volunteer_open_chatgpt: 'Open ChatGPT',
    volunteer_open_gemini: 'Open Gemini',
    ceiling_exceeds: (p) => `+${p}% over`,
    stress_line: (r) => `Household spending absorbs RM${r} of every RM100 earned`,
    bloc_candidate: 'Progressive Bloc candidate',
    prices_here: 'Grocery prices in your area',
    prices_sub: (d) => `Median prices at KPDN premises in ${d} district — versus Mar 2022, the last election`,
    col_item: 'Item',
    col_price: 'Price',
    col_then: 'Mar 2022',
    col_12w: '3 mo',
    trend: 'Trend',
    income_ctx: 'Income context',
    income_median: 'Median household income',
    income_mean: 'Mean income',
    poverty: 'Absolute poverty rate',
    gini: 'Inequality (Gini)',
    u_rate: 'Unemployment rate',
    pp_line: (b, i) => `Since the Mar 2022 election: the kitchen basket is up ${b}%/yr but income only ${i}%/yr — household purchasing power is shrinking.`,
    share: 'Share summary',
    copied: 'Copied to clipboard!',
    story_title: 'The campaign story — 5 beats',
    story_sub: 'One ordered narrative; full detail in the sections below',
    beat_path: 'Path to victory',
    beat_voters: 'The deciders',
    beat_message: 'The doorstep message',
    beat_ground: 'The ground map',
    beat_ask: 'The ask',
    beat_local: 'Local',
    beat_national: 'National',
    issues_national: 'National',
    issues_title: 'Local issues (source-verified)',
    issues_sub: 'Issues specific to this area, checked against news reporting — reference numbers are clickable',
    issues_statewide: 'Johor-wide',
    talking_points: 'Door-knocking talking points',
    tp_sub: 'Auto-generated from official data — verify before use',
    demo_title: 'Voter profile (2026 electoral roll)',
    demo_sub: 'JHR-SE-16 roll — ElectionData.MY',
    age_dist: 'Voter age',
    ethnic_dist: 'Voter ethnicity',
    new_voters: 'new voters since GE15 (Nov 2022)',
    women: 'women',
    history: 'Result history',
    saluran: 'Polling-district analysis (2022 election)',
    saluran_sub: 'Votes by polling district — find strongholds & battlegrounds',
    dm: 'Polling district',
    export: 'Download data',
    export_json: 'Full seat JSON',
    export_csv: 'Polling-district CSV',
    winner: 'Winner',
    election: 'Election',
    sources: 'Data sources',
    built: 'Data built',
    disclaimer: 'Unofficial information tool built 100% on open government/public data. Not a prediction. Verify facts before campaign publication.',
    err: 'Sorry, data could not be loaded.',
    candidates: 'candidates',
    income_note: (y) => `HIES ${y} estimate, DOSM`,
    price_note: 'Prices are medians across KPDN-monitored premises; individual shops vary.',
    no_price: 'No district price data — Johor median shown.',
    top3_note: (n) => `Top 3 rises since the Mar 2022 election, out of ${n} monitored items.`,
  },
}
const L = (k, ...args) => {
  const dict = STR[state.lang] ?? STR.bm
  // untranslated keys fall back to English (not Malay), so a Chinese reader
  // never sees stray Malay for a key that only exists in en/bm
  const v = dict[k] ?? STR.en[k] ?? STR.bm[k] ?? k
  return typeof v === 'function' ? v(...args) : v
}
// three-way inline microcopy: bm / en / zh (zh falls back to en if omitted)
const T = (bm, en, zh) => state.lang === 'zh' ? (zh ?? en) : state.lang === 'en' ? en : bm
// language-tagged data field: prefer the current language, else en, else bm.
// Curated content has no _zh yet, so Chinese shows the English text (honest —
// verbatim quotes and sourced prose are never machine-translated).
const pick = (o, base) => o == null ? '' : (o[`${base}_${state.lang}`] ?? o[`${base}_en`] ?? o[`${base}_bm`] ?? '')

// ---------- utils ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const fmtNum = (v) => v == null ? '–' : Number(v).toLocaleString(state.lang === 'zh' ? 'zh-MY' : state.lang === 'en' ? 'en-MY' : 'ms-MY')
const fmtRM = (v) => v == null ? '–' : `RM${Number(v).toFixed(2)}`
const fmtPct = (v, dp = 1) => v == null ? '–' : `${Number(v).toFixed(dp)}%`
const deltaHtml = (v) => {
  if (v == null) return '<span class="delta-flat">–</span>'
  if (Math.abs(v) < 0.05) return '<span class="delta-flat">0%</span>'
  const cls = v > 0 ? 'delta-up' : 'delta-down'
  const arrow = v > 0 ? '▲' : '▼'
  return `<span class="${cls}">${arrow}${Math.abs(v).toFixed(1)}%</span>`
}
// Badge colored by the coalition AT THAT CONTEST when known (BERSATU won 2018
// as PH, GERAKAN's old wins were BN, MIPP/PEJUANG ride with PN in 2026);
// falls back to the party's own class when standing alone.
const partyBadge = (p, coalition) => {
  const cls = ['PH', 'BN', 'PN'].includes(coalition) ? coalition : esc(p)
  return `<span class="badge ${cls}">${esc(p)}</span>`
}

// "as of" label for price data, flagged red if the source feed has stalled
const asOfHtml = (maxDate) => {
  if (!maxDate) return ''
  const days = Math.round((Date.now() - new Date(`${maxDate}T00:00:00`).getTime()) / 86400e3)
  const stale = days > 7
  return ` · <span${stale ? ' class="delta-up"' : ''}>${L('as_of')} ${esc(maxDate)}${stale ? ` (${days}d!)` : ''}</span>`
}

const BLOC_COLORS = { PH: 'var(--ph)', BN: 'var(--bn)', PN: 'var(--pn)', MUDA: 'var(--muda)', LAIN: 'var(--lain)' }

// ---------- charts ----------
function sparkline(weeks, seriesList, w = 92, h = 32) {
  const vals = seriesList.flatMap(s => weeks.map(wk => s.data[wk]).filter(v => v != null))
  if (!vals.length) return ''
  const min = Math.min(...vals), max = Math.max(...vals)
  const span = (max - min) || 1
  const x = (i) => 4 + (i / Math.max(weeks.length - 1, 1)) * (w - 8)
  const y = (v) => h - 4 - ((v - min) / span) * (h - 8)
  let out = `<svg class="sparkline" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`
  for (const s of seriesList) {
    const valued = weeks.map((wk, i) => [i, s.data[wk]]).filter(([, v]) => v != null)
    if (valued.length > 1) {
      const pts = valued.map(([i, v]) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`)
      out += `<polyline points="${pts.join(' ')}" fill="none" stroke="${s.color}" stroke-width="${s.width ?? 2}" stroke-linejoin="round" ${s.dash ? 'stroke-dasharray="3 3"' : ''}/>`
    }
    // mark the exact pair the % compares: hollow dot + dotted baseline at the
    // first plotted value, solid dot at the last
    if (s.mark && valued.length > 1) {
      const [fi, fv] = valued[0]
      const [li, lv] = valued[valued.length - 1]
      out += `<line x1="${x(fi).toFixed(1)}" y1="${y(fv).toFixed(1)}" x2="${w - 4}" y2="${y(fv).toFixed(1)}" stroke="${s.color}" stroke-width="1" stroke-dasharray="2 3" opacity="0.4"/>`
      out += `<circle cx="${x(fi).toFixed(1)}" cy="${y(fv).toFixed(1)}" r="2" fill="var(--card)" stroke="${s.color}" stroke-width="1.3"/>`
      out += `<circle cx="${x(li).toFixed(1)}" cy="${y(lv).toFixed(1)}" r="3" fill="var(--accent-2)"/>`
    }
  }
  return out + '</svg>'
}

// First-vs-last of the plotted window — the same pair the sparkline marks,
// so the displayed % always matches the drawn line by construction.
function windowStats(series, weeks) {
  const valued = weeks.filter(w => series[w] != null)
  if (valued.length < 2) return null
  const first = series[valued[0]]
  const last = series[valued[valued.length - 1]]
  if (!first) return null
  return { first, last, perc: +(100 * (last - first) / first).toFixed(1) }
}

function barRow(label, perc, valText, color = 'var(--ink)') {
  return `<div class="bar-row"><span>${esc(label)}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.min(perc, 100)}%;background:${color}"></div></div><span class="bar-val">${esc(valText)}</span></div>`
}

function stackBar(blocs, valid) {
  const order = ['PH', 'MUDA', 'BN', 'PN', 'LAIN']
  let html = '<div class="stack">'
  for (const b of order) {
    const v = blocs[b] || 0
    if (v > 0 && valid > 0) html += `<div style="width:${(100 * v / valid).toFixed(1)}%;background:${BLOC_COLORS[b]}" title="${b}: ${fmtNum(v)}"></div>`
  }
  return html + '</div>'
}

function miniMap(feature, bbox, size = 84) {
  if (!feature) return ''
  const [minX, minY, maxX, maxY] = bbox
  const spanX = (maxX - minX) || 1, spanY = (maxY - minY) || 1
  const scale = (size - 8) / Math.max(spanX, spanY)
  const px = (x) => 4 + (x - minX) * scale + (size - 8 - spanX * scale) / 2
  const py = (y) => size - 4 - (y - minY) * scale - (size - 8 - spanY * scale) / 2
  const rings = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates
  let d = ''
  for (const poly of rings) for (const ring of poly) {
    d += ring.map(([x, y], i) => `${i ? 'L' : 'M'}${px(x).toFixed(1)} ${py(y).toFixed(1)}`).join('') + 'Z'
  }
  return `<svg class="minimap" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><path d="${d}" fill="#e9e9e6" stroke="var(--ink)" stroke-width="1.5"/></svg>`
}

// ---------- data ----------
async function loadIndex() {
  if (!state.index) state.index = await (await fetch('data/index.json')).json()
  return state.index
}
async function loadSeat(slug) {
  if (!state.seats.has(slug)) state.seats.set(slug, await (await fetch(`data/seats/${slug}.json`)).json())
  return state.seats.get(slug)
}
async function loadGeo() {
  if (!state.geo) state.geo = await (await fetch('data/johor_dun.geojson')).json()
  return state.geo
}

// Which seat contains this WGS84 point? Even-odd ray casting across every
// ring of every polygon, so holes count correctly. Returns a slug or null.
function seatAtPoint(geo, lng, lat) {
  const inRing = (ring) => {
    let inside = false
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j]
      if ((yi > lat) !== (yj > lat) && lng < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside
    }
    return inside
  }
  for (const f of geo.features) {
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates
    for (const rings of polys) {
      let inside = false
      for (const ring of rings) if (inRing(ring)) inside = !inside
      if (inside) return f.properties.slug
    }
  }
  return null
}

// ---------- views ----------
const app = document.getElementById('app')

function renderFooter(idx) {
  const el = document.getElementById('footer')
  if (!idx) { el.innerHTML = ''; return }
  const health = idx.source_health
    ? Object.entries(idx.source_health).map(([id, h]) =>
        `<span class="${h?.ok ? 'health-ok' : 'health-bad'}">●</span> ${esc(id)}`).join(' &nbsp; ')
    : ''
  el.innerHTML = `
    <p><strong>${L('sources')}:</strong> ${idx.attribution.map(a => `<a href="${esc(a.url)}" target="_blank" rel="noopener">${esc(a.name)}</a>`).join(' · ')}</p>
    ${health ? `<p>${health}</p>` : ''}
    <p>${L('built')}: ${new Date(idx.built_at).toLocaleString()} · ${L('disclaimer')}</p>`
}

function countdownCard(idx) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const poll = new Date(`${idx.election.polling_date}T00:00:00`)
  const days = Math.round((poll - today) / 86400e3)
  let inner
  if (days > 0) {
    inner = `<div class="days" style="--dleft:${Math.max(0, Math.min(1, days / 14)).toFixed(2)}">${days}</div>
      <div><div class="label">${L('days_to_poll')}</div>
      <div class="sublabel">${L('poll_day')} · ${L('early_vote')}</div></div>`
  } else if (days === 0) {
    inner = `<div class="days">0</div><div class="label">${L('poll_today')}</div>`
  } else {
    inner = `<div class="label">${L('poll_over')}</div>`
  }
  return `<div class="card"><div class="countdown">${inner}</div></div>`
}

// ---- pro-MUDA edition (EDITION=muda) advocacy layer, gated on idx.edition ----
function mudaHomeCard(idx) {
  if (idx.edition !== 'muda') return ''
  const u = idx.johor_context?.undi18
  const m = idx.johor_context?.muda
  const rec = idx.muda_record
  const headline = rec ? pick(rec, 'headline') : L('muda_title')
  const sub = rec ? pick(rec, 'sub') : ''
  const stats = []
  if (u) stats.push(`<div style="min-width:130px"><div style="font-size:1.7rem;font-weight:800;color:var(--accent)">${fmtNum(u.total_18_20)}</div><div style="color:var(--muted);font-size:.72rem">${T('pengundi 18–20 tahun di daftar Johor 2026 — kohort yang dibuka oleh reformasi Undi18 2019', "voters aged 18–20 on Johor's 2026 roll — the cohort the 2019 Undi18 reform opened up", '2026年柔佛选民册上18–20岁的选民 — 2019年 Undi18 改革所开放的群体')}</div></div>`)
  if (m) stats.push(`<div style="min-width:130px"><div style="font-size:1.7rem;font-weight:800;color:var(--accent)">${m.won}/${m.seats_contested}</div><div style="color:var(--muted);font-size:.72rem">${T(`kerusi Johor dimenangi MUDA pada 2022 (purata ${m.avg_perc}% undi)`, `Johor seats MUDA won in 2022 (avg ${m.avg_perc}% of the vote)`, `2022年 MUDA 胜出的柔佛议席（平均 ${m.avg_perc}% 选票）`)}</div></div>`)
  return `<div class="card accent">
    <h2>${esc(headline)}</h2>
    ${sub ? `<p class="sub">${esc(sub)}</p>` : ''}
    ${stats.length ? `<div style="display:flex;gap:1.2rem;flex-wrap:wrap;margin:.6rem 0 .2rem">${stats.join('')}</div>` : ''}
  </div>`
}

// ---- MUDA's answer to this seat's doorstep issues (muda edition only —
// neutral builds never carry seat.muda_stances, so presence is the gate) ----
// ---- AI field briefing: a self-contained MD prompt for ChatGPT/Gemini.
// Carries the seat's data snapshot + a ground-intel protocol: operator keeps
// typing what they hear at the doors; the external assistant grounds advice in
// the data but treats ground reports as the leading indicator — merged with
// the data where related, listed separately ("OF NOTE") where not.
// Edition-aware by construction: includes muda_stances only when the build
// carries them. Plain text — no HTML escaping (this is an .md, not the DOM).
// robust copy: Clipboard API first, then a hidden-textarea execCommand fallback
// for insecure contexts / older browsers. Returns whether the copy succeeded.
// (Same chain the shareBtn handler uses.)
// talking points are built as HTML for the Field tab; this strips them back to
// WhatsApp-ready plain text (tags out, the five esc() entities decoded)
const htmlToText = (s) => String(s).replace(/<[^>]+>/g, '')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")

async function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    try { await navigator.clipboard.writeText(text); return true } catch { /* denied */ }
  }
  const ta = document.createElement('textarea')
  ta.value = text
  ta.style.position = 'fixed'; ta.style.opacity = '0'
  document.body.appendChild(ta); ta.select()
  let ok = false
  try { ok = document.execCommand('copy') } catch { /* unsupported */ }
  ta.remove()
  return ok
}

// copies an AI briefing to the clipboard and always also downloads it (easiest
// way to forward over WhatsApp); flashes the triggering button with feedback
// origText overrides the "restore to" label — needed when the caller has
// already replaced btnEl's text with a loading indicator before this resolves
async function copyAndDownloadBriefing(md, slug, btnEl, origText) {
  let copied = false
  if (navigator.clipboard?.writeText) {
    try { await navigator.clipboard.writeText(md); copied = true } catch { /* denied */ }
  }
  const blob = new Blob([md], { type: 'text/markdown' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${slug}-ai-briefing.md`
  a.click()
  URL.revokeObjectURL(a.href)
  if (btnEl) {
    const orig = origText ?? btnEl.textContent
    btnEl.textContent = copied ? L('copied') : L('brief_saved')
    setTimeout(() => { btnEl.textContent = orig }, 2000)
  }
}

function briefingMd(seat, idx) {
  // operator instructions: 3-way, Chinese falls back to English for now
  const L2 = (b, e, z) => T(b, e, z)
  const demo = seat.demographics.find(d => d.election === 'JHR-SE-16') ?? seat.demographics[0]
  const lines = []
  const px = (v, d = 1) => v == null ? '–' : Number(v).toFixed(d) + '%'
  const nf = (v) => v == null ? '–' : Number(v).toLocaleString('en-MY')

  lines.push(`# PETA MUDA — AI Field Briefing: ${seat.code} ${seat.name} (PRN Johor 2026)`)
  lines.push(`Generated ${new Date().toISOString().slice(0, 10)} from official open data (ElectionData.MY CC0; data.gov.my/OpenDOSM & KPDN PriceCatcher CC BY 4.0). Data built: ${idx.built_at?.slice(0, 10) ?? '–'}. Polling day: 11 July 2026 (early voting 7 July).`)
  lines.push('')
  lines.push(`## ${L2('CARA GUNA (untuk petugas lapangan)', 'HOW TO USE (for the field operator)')}`)
  lines.push(L2(
`1. Buka chat BARU di ChatGPT atau Gemini.
2. Tampal SELURUH dokumen ini sebagai mesej pertama. Pembantu AI akan sahkan persediaan.
3. Selepas itu, taip sahaja apa yang anda dengar di lapangan (BM atau Inggeris). Contoh: "LAPORAN: Pengundi Taman Molek kata bekalan air putus lagi semalam."
4. Bila-bila masa, taip "senaraikan intel" untuk log penuh, atau "cadangan" untuk nasihat terkini.`,
`1. Open a NEW chat in ChatGPT or Gemini.
2. Paste this ENTIRE document as your first message. The assistant will confirm setup.
3. After that, just type what you hear on the ground (BM or English). Example: "REPORT: Taman Molek voters say the water cut again last night."
4. Anytime, type "list intel" for the full log, or "recommendations" for the latest advice.`))
  lines.push('')
  lines.push('## INSTRUCTIONS TO THE AI ASSISTANT (binding for this whole conversation)')
  lines.push(`You are the campaign field-intelligence assistant for the MUDA / Progressive Bloc team in ${seat.code} ${seat.name} at the 2026 Johor state election. Follow these rules for every reply:

1. GROUND YOUR ADVICE IN DATA. Recommendations must cite the DATA SNAPSHOT below wherever possible.
2. GROUND INTEL IS GOLD. Any operator message reporting something heard/seen on the ground is GROUND INTEL — newer than this dataset and VERY IMPORTANT. Never dismiss it because it disagrees with the data. Log every item with a number and (if given) the place/date.
3. TRIAGE every new report into exactly one of:
   - MERGED ANGLE — it RELATES to something in the data: combine both into one doorstep-ready line ("the data shows X, you are hearing Y — so lead with Z").
   - ⚠ DATA-GROUND MISMATCH — it CONTRADICTS the data: flag the mismatch explicitly, treat the ground report as the leading indicator, suggest one quick verification step, and adjust your recommendations meanwhile.
   - OF NOTE (ground only) — it is UNRELATED to any data here: do NOT force a connection; keep it as its own visible item in every summary until the operator resolves it.
4. KEEP A RUNNING LEDGER with three sections — MERGED ANGLES / MISMATCHES / OF NOTE — and show the updated relevant section after each report.
5. HONESTY RULES: never invent statistics, quotes, or events. Anything not in this snapshot and not reported by the operator must be clearly labelled as your inference. This is election material — remind the operator to verify facts before publishing anything.
6. Where relevant, draw on the MUDA stances and verified quotes in the snapshot for your recommendations — but only use quotes verbatim with their source, and never turn a REPORTED_POSITION into a quotation.
7. Reply in the language the operator writes in (Bahasa Melayu or English).

Confirm setup now by replying with: a 3-line summary of this seat, the ledger (empty), and a request for the first ground report.`)
  lines.push('')
  lines.push('## DATA SNAPSHOT')

  // 2026 contest
  const e = seat.election2026
  lines.push(`### The 2026 contest (${e.result_date ? 'RESULTS IN' : 'candidates on the ballot'})`)
  const contestBallot = e.ballot ?? (seat.history ?? []).find(c => c.date === e.result_date)?.ballot ?? []
  for (const b of contestBallot) {
    const c = b.career
    const cv = c ? `${c.contested} contests, ${c.won} won${c.party_timeline?.length > 1 ? '; party path: ' + c.party_timeline.map(s => s.party).join(' > ') + ' > ' + b.party : ''}` : 'first-time candidate'
    const res = b.result && b.result !== 'pending' ? ` | RESULT: ${b.result}${b.votes ? `, ${nf(b.votes)} votes (${px(b.votes_perc)})` : ''}` : ''
    lines.push(`- ${b.name} (${b.party}${b.coalition && b.coalition !== 'ALONE' ? '/' + b.coalition : ''}) — ${cv}${res}`)
  }
  if (e.muda_candidate) lines.push(`- Progressive Bloc candidate here: ${e.muda_candidate} (${e.bloc_party ?? 'MUDA/PSM'})`)

  // voters
  if (demo) {
    lines.push('', '### Voters (2026 roll)')
    const yt = demo.age.age_18_20 + demo.age.age_21_29
    lines.push(`- Total ${nf(demo.voters_total)} | aged 18-20: ${nf(demo.age.age_18_20)} | aged 18-29: ${nf(yt)} (${px(100 * yt / demo.voters_total)}) | women: ${px(100 * demo.sex_female / demo.voters_total, 0)}`)
    lines.push(`- Ethnic: Malay ${px(100 * demo.ethnic.ethnic_malay / demo.voters_total, 0)}, Chinese ${px(100 * demo.ethnic.ethnic_chinese / demo.voters_total, 0)}, Indian ${px(100 * demo.ethnic.ethnic_indian / demo.voters_total, 0)}`)
  }

  // history + saluran
  const last = (seat.history ?? [])[0]
  if (last) {
    lines.push('', '### Last result & turnout')
    const w = last.ballot.find(b => (b.result ?? '').startsWith('won')) ?? last.ballot[0]
    lines.push(`- ${last.election} (${last.date}): ${w?.name ?? '–'} (${w?.party ?? '–'}) won, majority ${px(last.majority_perc)}, turnout ${px(last.voter_turnout_perc)}`)
  }
  const sal = seat.saluran2022
  if (sal) {
    const tot = Object.entries(sal.totals).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${px(100 * v / sal.valid)}`).join(', ')
    lines.push(`- 2022 bloc shares here: ${tot} (${sal.dms.length} polling districts — low-turnout young areas are the known lever)`)
  }

  // cost of living
  const movers = (seat.prices?.items ?? []).filter(i => i.change_12w_perc != null).sort((a, b) => b.change_12w_perc - a.change_12w_perc).slice(0, 3)
  if (movers.length || seat.socio?.income?.length) {
    lines.push('', '### Cost of living here')
    if (movers.length) lines.push(`- Top price rises (12 weeks, ${seat.prices.district ?? 'Johor'} district medians): ` + movers.map(i => `${i.label_en} +${i.change_12w_perc}%`).join(', '))
    const sinceMovers = (seat.prices?.items ?? []).filter(i => i.since_se15?.perc != null)
      .sort((a, b) => b.since_se15.perc - a.since_se15.perc).slice(0, 3)
    if (sinceMovers.length) lines.push(`- Since the Mar 2022 state election (district medians): ` + sinceMovers.map(i => `${i.label_en} ${i.since_se15.perc > 0 ? '+' : ''}${i.since_se15.perc}%`).join(', '))
    const inc = seat.socio?.income?.at(-1)
    if (inc) lines.push(`- Median household income: RM${nf(inc.income_median)} (${'' + (seat.socio.income.at(-1).date ?? '').slice(0, 4)})`)
    const lab = seat.socio?.labour?.at(-1)
    if (lab?.u_rate != null) lines.push(`- Unemployment rate: ${px(lab.u_rate)}`)
  }

  // verified local issues
  const li = seat.local_issues
  const issues = [...(li?.seat ?? []), ...(li?.statewide ?? [])]
  if (issues.length) {
    lines.push('', '### Verified local issues (fact-checked, with receipts)')
    issues.forEach((it, i) => {
      lines.push(`${i + 1}. ${it.issue_en ?? it.issue_bm}`)
      if (it.receipt_en ?? it.receipt_bm) lines.push(`   Receipt: ${it.receipt_en ?? it.receipt_bm}`)
      if (it.sources?.length) lines.push(`   Sources: ${it.sources.join(' ; ')}`)
    })
  }

  // verified national issues (same curation discipline, uniform across seats)
  const natIssues = idx.national_issues ?? []
  if (natIssues.length) {
    lines.push('', '### Verified national issues (fact-checked, with receipts)')
    natIssues.forEach((it, i) => {
      lines.push(`${i + 1}. ${it.issue_en ?? it.issue_bm}`)
      if (it.receipt_en ?? it.receipt_bm) lines.push(`   Receipt: ${it.receipt_en ?? it.receipt_bm}`)
      if (it.sources?.length) lines.push(`   Sources: ${it.sources.join(' ; ')}`)
    })
  }

  // muda stances (muda edition only — field simply absent otherwise)
  if (seat.muda_stances?.length) {
    lines.push('', "### MUDA's positions on these issues (sourced; quote-verbatim only where marked)")
    for (const t of seat.muda_stances) {
      lines.push(`- [${t.verdict}] ${t.label_en ?? t.label_bm}: ${t.stance_en ?? t.stance_bm}`)
      for (const q of t.quotes ?? []) {
        lines.push(`  QUOTE: "${q.text}" — ${q.who}, ${q.role_en ?? q.role_bm ?? ''} (${(q.date ?? '').slice(0, 7)}) ${q.source}`)
      }
    }
    lines.push('  NOTE FOR ASSISTANT: never paraphrase these into new quotes; REPORTED_POSITION and NO_VERIFIED_POSITION themes must never gain quotation marks.')
  }

  // johor context
  const jc = idx.johor_context
  if (jc?.undi18 || jc?.crime) {
    lines.push('', '### Johor context')
    if (jc.undi18) lines.push(`- Undi18 footprint: ${nf(jc.undi18.total_18_20)} voters aged 18-20 statewide on the 2026 roll${demo ? `; this seat: ${nf(demo.age.age_18_20)}` : ''}`)
    if (jc.crime) lines.push(`- Crime (${jc.crime.latest_year}, police districts ≠ constituencies): ${nf(jc.crime.total_latest)} index crimes statewide, ${jc.crime.change_yoy_perc > 0 ? '+' : ''}${jc.crime.change_yoy_perc ?? '–'}% YoY; top type: ${jc.crime.by_type_latest?.[0]?.type ?? '–'}`)
    const fuel = idx.fuel?.at(-1)
    if (fuel) lines.push(`- Fuel: RON95 BUDI95 RM${fuel.ron95_budi95 ?? '–'} / unsubsidised RM${fuel.ron95 ?? '–'} / diesel RM${fuel.diesel ?? '–'}`)
    const cpi = idx.cpi?.at(-1)
    if (cpi) lines.push(`- Official Johor inflation: ${px(cpi.inflation_yoy)} YoY (${cpi.date?.slice(0, 7)})`)
  }

  // cost-of-living trend versus before (direction per window — use the real sign)
  const ct = idx.cost_trend
  if (ct?.series?.length) {
    lines.push('', '### Cost of living versus before (% change vs 1/3/6/12 months ago; + = up, − = down; verify before publishing)')
    const wl = ct.windows.join(' / ')
    for (const s of ct.series) {
      const vals = ct.windows.map(w => s.deltas[w] == null ? '–' : `${s.deltas[w] > 0 ? '+' : ''}${s.deltas[w]}%`).join(' / ')
      lines.push(`- ${s.label_en} (${wl}): ${vals}`)
    }
  }

  lines.push('', '## DATA CAVEATS (assistant must respect these)')
  lines.push(`- Prices are KPDN premise medians by market district — a catchment approximation, not exact to the constituency.
- Crime data is by POLICE district and statewide context only — never present it as this constituency's figure.
- Data snapshot is as of the build date above; the operator's ground reports are newer. Treat accordingly.
- Verify all facts before publishing campaign material. Quotes above are only usable verbatim with their source cited.`)

  return lines.join('\n')
}


// Cost-of-living direction versus before: one compact table, rows = series
// (official inflation, fuel, food basket), columns = 1/3/6/12-month % change.
// deltaHtml colours rising prices red / falling green (house convention).
// Labels come from this UI map (keyed on series.key) so all three languages
// render properly; unknown future keys fall back to the JSON's own labels.
const COST_TREND_LABELS = {
  cpi: { bm: 'Inflasi rasmi (CPI Johor)', en: 'Official inflation (Johor CPI)', zh: '官方通胀（柔佛CPI）' },
  fuel_ron95: { bm: 'Petrol RON95 (tanpa subsidi)', en: 'Petrol RON95 (unsubsidised)', zh: 'RON95汽油（无补贴）' },
  fuel_diesel: { bm: 'Diesel (tanpa subsidi)', en: 'Diesel (unsubsidised)', zh: '柴油（无补贴）' },
  food_basket: { bm: 'Bakul makanan (bukan kawalan harga)', en: 'Food basket (non-price-controlled)', zh: '食品篮子（非管制品）' },
}
function costTrendCard(idx) {
  const ct = idx.cost_trend
  const fuel = idx.fuel?.at(-1)
  if (!ct?.series?.length) return ''
  // one chip per indicator, its 12-month change — the full matrix lives in briefingMd
  const seriesChips = ct.series.map(s => {
    const label = COST_TREND_LABELS[s.key]?.[state.lang] ?? pick(s, 'label')
    return `<span class="chip">${esc(label)} ${deltaHtml(s.deltas?.['12m'])} <span style="color:var(--muted)">/ ${L('win_12m')}</span></span>`
  }).join('')
  const fuelNow = fuel ? `<h3>${L('fuel_now')}</h3><div class="chips">
    ${fuel.ron95_budi95 != null ? `<span class="chip">RON95 BUDI95 ${fmtRM(fuel.ron95_budi95)}</span>` : ''}
    <span class="chip">RON95 ${T('tanpa subsidi', 'unsub.')} ${fmtRM(fuel.ron95)}</span>
    <span class="chip">RON97 ${fmtRM(fuel.ron97)}</span>
    <span class="chip">Diesel ${fmtRM(fuel.diesel)}</span>
  </div>` : ''
  // the "so what" line: how many indicators are above their level a year ago
  const up12 = ct.series.filter(s => (s.deltas?.['12m'] ?? 0) > 0).length
  const lead = `<p class="hero-line"><strong>${up12}/${ct.series.length}</strong> ${T('penunjuk lebih tinggi daripada setahun lalu', 'indicators higher than a year ago')}</p>`
  return `<div class="card">
    <h2>${L('cost_trend_title')}</h2>
    <p class="sub">${L('cost_trend_sub')}</p>
    ${lead}
    <div class="chips">${seriesChips}</div>
    ${fuelNow}
    <div class="notice" style="font-size:.72rem;margin-top:.5rem">${L('cost_trend_note')}</div>
  </div>`
}

// Task-first entry: the first screen asks "what do you want to do?" instead of
// opening on a dashboard. Volunteers get a one-tap path to their briefing;
// everyone else goes straight to seat search. A returning visitor gets a
// one-tap link back to the seat they last opened.
function heroFork(idx) {
  const lastSlug = storage.get('last_seat')
  const last = lastSlug ? idx.seats.find(s => s.slug === lastSlug) : null
  const resume = last
    ? `<a class="resume-chip" href="#/seat/${esc(last.slug)}">↩ ${T('Kerusi anda', 'Your seat', '您的议席')}: <strong>${esc(last.code)} ${esc(last.name)}</strong></a>`
    : ''
  const vol = idx.edition === 'muda'
    ? `<a class="btn" href="#/volunteer">${T('Saya sukarelawan — beri saya briefing', 'I’m a volunteer — give me my briefing')}</a>`
    : ''
  return `<div class="card fork">
    ${resume}
    ${vol}
    <button class="btn${vol ? ' secondary' : ''}" id="forkLocate">${L('locate_btn')}</button>
    <button class="btn secondary" id="forkSearch">${T('Cari kerusi anda', 'Find your seat')}</button>
    <div class="locate-hint" id="locateHint" hidden></div>
    <button class="install-chip" id="installChip" ${state.installPrompt ? '' : 'hidden'}>${L('install_btn')}</button>
  </div>`
}

async function renderHome() {
  const idx = await loadIndex()
  const featured = idx.seats.filter(s => s.featured)

  app.innerHTML = `
    <p class="kicker">${L('tagline')}</p>
    ${heroFork(idx)}
    ${countdownCard(idx)}
    ${mudaHomeCard(idx)}

    <div class="card">
      <h2>${L('featured')}</h2>
      <p class="sub">${esc((state.lang === 'bm' ? idx.election.name_bm : idx.election.name_en) ?? idx.election.name_bm ?? '')}</p>
      <div class="seat-grid">
        ${featured.map(s => `
          <a class="seat-card featured" href="#/seat/${s.slug}">
            <div class="code">${esc(s.code)} · ${esc(s.parlimen ?? '')}</div>
            <div class="name">${esc(s.name)}</div>
            ${s.muda_candidate ? `<div class="cand">${partyBadge(s.bloc_party)} ${esc(s.muda_candidate)}</div>` : ''}
            <div class="meta">${fmtNum(s.voters_total)} ${L('voters')} · ${fmtPct(s.youth_perc, 0)} ${L('youth')} · ${s.n_candidates_2026 ?? '–'} ${L('candidates')}</div>
          </a>`).join('')}
      </div>
    </div>

    ${costTrendCard(idx)}

    <div class="card">
      <h2>${L('all_seats')}</h2>
      <input class="searchbox" id="seatSearch" placeholder="${L('search')}" autocomplete="off">
      <div class="seat-list" id="seatList"></div>
    </div>`

  const listEl = document.getElementById('seatList')
  const renderList = (q = '') => {
    const needle = q.trim().toLowerCase()
    const rows = idx.seats.filter(s =>
      !needle || `${s.code} ${s.name} ${s.parlimen} ${s.kpdn_district}`.toLowerCase().includes(needle))
    listEl.innerHTML = rows.map(s => `
      <a class="seat-row" href="#/seat/${s.slug}">
        <span class="left">
          <span class="name">${esc(s.code)} ${esc(s.name)} ${s.featured ? '★' : ''}</span>
          <span class="meta">${esc(s.parlimen ?? '')} · ${fmtNum(s.voters_total)} ${L('voters')}</span>
        </span>
        <span class="right">${s.last_result ? `${esc(s.last_result.party)}<br>${L('majority')} ${fmtPct(s.last_result.majority_perc, 1)}` : ''}</span>
      </a>`).join('')
  }
  renderList()
  document.getElementById('seatSearch').addEventListener('input', (e) => renderList(e.target.value))
  const focusSearch = () => {
    const box = document.getElementById('seatSearch')
    box.scrollIntoView({ behavior: 'smooth', block: 'center' })
    box.focus({ preventScroll: true })
  }
  document.getElementById('forkSearch')?.addEventListener('click', focusSearch)
  const locateBtn = document.getElementById('forkLocate')
  locateBtn?.addEventListener('click', () => {
    const hint = document.getElementById('locateHint')
    const fail = (msg) => {
      locateBtn.textContent = L('locate_btn'); locateBtn.disabled = false
      hint.textContent = msg; hint.hidden = false
      focusSearch()
    }
    if (!navigator.geolocation) { fail(L('locate_denied')); return }
    locateBtn.textContent = L('locate_finding'); locateBtn.disabled = true
    // An ignored permission prompt fires neither callback — the geolocation
    // timeout option only counts after permission is granted.
    let done = false
    const settle = (fn) => { if (!done) { done = true; fn() } }
    setTimeout(() => settle(() => fail(L('locate_denied'))), 12000)
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const geo = await loadGeo()
        const slug = seatAtPoint(geo, pos.coords.longitude, pos.coords.latitude)
        settle(() => { if (slug) { location.hash = `#/seat/${slug}` } else { fail(L('locate_outside')) } })
      } catch { settle(() => fail(L('locate_denied'))) }
    }, () => settle(() => fail(L('locate_denied'))), { timeout: 8000, maximumAge: 60000 })
  })
  document.getElementById('installChip')?.addEventListener('click', async () => {
    const p = state.installPrompt
    if (!p) return
    state.installPrompt = null
    document.getElementById('installChip').hidden = true
    p.prompt()
  })
  renderFooter(idx)
}

// ---- volunteer AI-briefing hub (muda edition only): find your seat, get an
// AI briefing in one tap — no need to know a DUN code or dig through tabs ----
async function renderVolunteer() {
  const idx = await loadIndex()
  if (idx.edition !== 'muda') { location.hash = '#/'; return }

  app.innerHTML = `
    <div class="crumbs"><a href="#/">← Johor</a></div>
    <div class="card">
      <h2>${L('volunteer_title')}</h2>
      <p class="sub">${L('volunteer_sub')}</p>
      <div id="volCta"></div>
      <input class="searchbox" id="volSearch" placeholder="${L('search')}" autocomplete="off">
      <div class="seat-list" id="volList"></div>
    </div>`

  const ctaEl = document.getElementById('volCta')
  // after a successful copy, surface a single obvious next step: paste into a
  // fresh ChatGPT/Gemini chat. The briefing is far too large to prefill via a
  // URL param, so "copy → open app → paste" is the only reliable path.
  const showCta = (seat) => {
    ctaEl.innerHTML = `<div class="cta-copied">
      <div class="cta-copied-head">${L('volunteer_copied', `${esc(seat.code)} ${esc(seat.name)}`)}</div>
      <div class="sub">${L('volunteer_cta_sub')}</div>
      <div class="btn-row">
        <a class="btn" href="https://chatgpt.com/" target="_blank" rel="noopener">${L('volunteer_open_chatgpt')}</a>
        <a class="btn" href="https://gemini.google.com/app" target="_blank" rel="noopener">${L('volunteer_open_gemini')}</a>
      </div>
    </div>`
    ctaEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  const listEl = document.getElementById('volList')
  const renderList = (q = '') => {
    const needle = q.trim().toLowerCase()
    const rows = idx.seats.filter(s =>
      !needle || `${s.code} ${s.name} ${s.parlimen} ${s.kpdn_district}`.toLowerCase().includes(needle))
    listEl.innerHTML = rows.length ? rows.map(s => `
      <div class="seat-row vol-row">
        <span class="left">
          <span class="name">${esc(s.code)} ${esc(s.name)} ${s.featured ? '★' : ''}</span>
          <span class="meta">${esc(s.parlimen ?? '')}</span>
        </span>
        <span class="btn-row vol-actions">
          <button class="btn" data-slug="${esc(s.slug)}">${L('volunteer_get_btn')}</button>
          <button class="btn secondary" data-tp="${esc(s.slug)}">${T('Salin skrip', 'Copy script')}</button>
        </span>
      </div>`).join('') : `<p class="sub">${L('volunteer_none')}</p>`
    // no-AI fallback: copy the seat's talking points as WhatsApp-ready text
    listEl.querySelectorAll('button[data-tp]').forEach(btn => btn.addEventListener('click', async () => {
      const orig = btn.textContent
      btn.textContent = L('volunteer_loading')
      btn.disabled = true
      try {
        const seat = await loadSeat(btn.dataset.tp)
        const text = tpText(seat, idx)
        const copied = await copyToClipboard(text)
        if (copied) btn.textContent = L('copied')
        else { window.prompt('Salin / Copy:', text); btn.textContent = orig }
      } finally {
        btn.disabled = false
        if (btn.textContent === L('copied')) setTimeout(() => { btn.textContent = orig }, 2000)
      }
    }))
    listEl.querySelectorAll('button[data-slug]').forEach(btn => btn.addEventListener('click', async () => {
      const slug = btn.dataset.slug
      const orig = btn.textContent
      btn.textContent = L('volunteer_loading')
      btn.disabled = true
      try {
        const seat = await loadSeat(slug)
        const md = briefingMd(seat, idx)
        const copied = await copyToClipboard(md)
        if (copied) {
          btn.textContent = L('copied')
          showCta(seat)
        } else {
          // no download fallback here — hand the raw text over so they can copy it
          window.prompt('Salin / Copy:', md)
          btn.textContent = orig
        }
      } finally {
        btn.disabled = false
        if (btn.textContent === L('copied')) setTimeout(() => { btn.textContent = orig }, 2000)
      }
    }))
  }
  renderList()
  document.getElementById('volSearch').addEventListener('input', (e) => renderList(e.target.value))
  renderFooter(idx)
}

// ---- seat tabs ----
function contestCard(seat) {
  const e = seat.election2026
  // the pipeline sets result_date once the 2026 contest has settled into
  // history — trust that flag rather than re-deriving it by date comparison
  const resultsIn = !e?.ballot && !!e?.result_date
  if (!e?.ballot && !resultsIn) return ''
  // the settled 2026 contest, matched by the pipeline's result_date so a later
  // by-election in the seat is never rendered here
  const done = resultsIn ? (seat.history?.find(c => c.date === e.result_date) ?? seat.history?.[0]) : null
  const ballot = e?.ballot ?? done?.ballot ?? []
  return `<div class="card">
    <h2>${resultsIn ? L('results_2026') : L('contest_2026')}</h2>
    <p class="sub">${resultsIn ? L('results_sub') : L('contest_sub')} · ${fmtNum(resultsIn ? done?.voters_total : e.voters_total)} ${L('voters')}</p>
    <table class="data"><tbody>
      ${ballot.map(b => {
        const isBloc = b.party === 'MUDA' || b.party === 'PSM'
        // winner markup only once results are actually in — during a partial
        // count the pending-style list must not show a premature checkmark
        const won = resultsIn && (b.result ?? '').startsWith('won')
        const career = !resultsIn ? (b.career
          ? L('career_line', b.career.contested, b.career.won, `${b.career.last.election} ${b.career.last.seat}`, b.career.last.date.slice(0, 4))
          : L('first_time')) : null
        // party-switch callout (absorbed from the old record card): switches
        // across the historical timeline, or a fresh-ticket flag for 2026
        const tl = b.career?.party_timeline ?? []
        let switches = 0
        for (let i = 1; i < tl.length; i++) if (tl[i].party !== tl[i - 1].party) switches++
        const histTail = tl[tl.length - 1]
        const switchedIn = histTail && histTail.party !== b.party
        const callout = !resultsIn ? (switchedIn ? L('record_switchedin', b.party) : switches > 0 ? L('record_hop', switches) : null) : null
        return `<tr${isBloc || won ? ' style="font-weight:800"' : ''}>
          <td>${won ? '✓ ' : ''}${esc(b.name)}${isBloc ? ` <span title="${L('bloc_candidate')}">★</span>` : ''}
            ${career ? `<br><span style="color:var(--muted);font-size:.72rem;font-weight:400">${esc(career)}</span>` : ''}
            ${callout ? `<br><span style="color:var(--warn,#b45309);font-size:.72rem;font-weight:600">⚑ ${esc(callout)}</span>` : ''}</td>
          ${resultsIn ? `<td class="num">${fmtNum(b.votes)}${b.votes_perc != null ? ` <span style="color:var(--muted)">(${fmtPct(b.votes_perc)})</span>` : ''}</td>` : ''}
          <td class="num">${partyBadge(b.party, b.coalition)}</td></tr>`
      }).join('')}
    </tbody></table>
    ${e.notes_bm && !resultsIn ? `<div class="notice">${esc(state.lang === 'bm' ? e.notes_bm : (e.notes_en ?? e.notes_bm))}</div>` : ''}
  </div>`
}

function pricesCard(seat, compact = true) {
  const p = seat.prices
  if (!p?.items?.length) return ''
  // signal over noise: only the 3 items that got most expensive since the
  // Mar 2022 election (items with no 2022 anchor fall back to the 12-week
  // change). The sparkline still shows the recent 12-week direction.
  const top = p.items.map(it => {
    const hasDistrict = it.latest_district != null
    const series = hasDistrict ? it.series.district : it.series.johor
    return { it, hasDistrict, series, ws: windowStats(series, p.weeks) }
  }).filter(e => e.ws)
    .sort((a, b) => (b.it.since_se15?.perc ?? b.ws.perc) - (a.it.since_se15?.perc ?? a.ws.perc))
    .slice(0, 3)
  if (!top.length) return ''
  const rows = top.map(({ it, hasDistrict, series, ws }) => {
    const spark = sparkline(p.weeks, [
      { data: series, color: 'var(--ink)', width: 2, mark: true },
    ])
    const then = it.since_se15
      ? `${fmtRM(it.since_se15.then)}<br>${deltaHtml(it.since_se15.perc)}`
      : '–'
    return `<tr>
      <td><strong>${esc(state.lang === 'bm' ? it.label_bm : it.label_en)}</strong><br><span style="color:var(--muted);font-size:.72rem">${esc(it.unit)}</span></td>
      <td class="num"><strong>${fmtRM(ws.last)}</strong></td>
      <td class="num">${then}</td>
      <td>${spark}</td>
      <td class="num">${deltaHtml(ws.perc)}</td>
    </tr>`
  }).join('')
  const anyDistrict = top.some(e => e.hasDistrict)
  // the "so what" line: the single worst rise, readable without the table
  const lead0 = top[0]
  const leadLabel = esc(state.lang === 'bm' ? lead0.it.label_bm : lead0.it.label_en)
  const lead = lead0.it.since_se15?.perc != null
    ? `<p class="hero-line"><strong>${leadLabel} ${lead0.it.since_se15.perc > 0 ? '+' : ''}${lead0.it.since_se15.perc}%</strong> ${T('sejak PRN Mac 2022', 'since the Mar 2022 election', '自2022年3月选举以来')}</p>`
    : `<p class="hero-line"><strong>${leadLabel} ${lead0.ws.perc > 0 ? '+' : ''}${lead0.ws.perc}%</strong> ${T('dalam 12 minggu', 'in 12 weeks', '12周内')}</p>`
  return `<div class="card">
    <h2>${L('prices_here')}</h2>
    <p class="sub">${L('prices_sub', esc(p.district ?? '–'))}${asOfHtml(p.max_date)}</p>
    ${lead}
    <table class="data">
      <thead><tr><th>${L('col_item')}</th><th class="num">${L('col_price')}</th><th class="num">${L('col_then')}</th><th>${L('trend')}</th><th class="num">${L('col_12w')}</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${ceilingStatus(seat)}
    <div class="notice">${L('top3_note', p.items.length)} ${anyDistrict ? L('price_note') : L('no_price')}</div>
  </div>`
}

// government price-ceiling compliance, folded into the prices card as one
// status line: the worst breach of the government's own ceiling, or the clean
// bill — with the manual-verification receipt links
function ceilingStatus(seat) {
  const items = (seat.prices?.items ?? []).filter(i => i.ceiling)
  if (!items.length) return ''
  const bm = state.lang === 'bm'
  const refs = items.filter(it => it.ceiling.source)
    .map((it, i) => `<a href="${esc(it.ceiling.source)}" target="_blank" rel="noopener" style="color:var(--muted)">[${i + 1}]</a>`).join(' ')
  const breaches = items.filter(it => it.ceiling.observed != null && it.ceiling.exceeds_perc != null && it.ceiling.exceeds_perc > 0.5)
    .sort((a, b) => b.ceiling.exceeds_perc - a.ceiling.exceeds_perc)
  const line = breaches.length
    ? `<span class="delta-up">▲</span> <strong>${esc(bm ? breaches[0].label_bm : breaches[0].label_en)}</strong> ${L('ceiling_exceeds', breaches[0].ceiling.exceeds_perc.toFixed(1))} ${T('siling rasmi kerajaan', 'the government’s own official ceiling')}`
    : `<span class="delta-down">✓</span> ${T('Semua barangan terkawal dalam siling rasmi kerajaan', 'All controlled items within the government’s official ceiling')}`
  return `<div class="notice" style="margin-top:.5rem">${line}${refs ? ` ${refs}` : ''}</div>`
}

function incomeCard(seat, idx) {
  const inc = seat.socio.income?.at(-1)
  const pov = seat.socio.poverty?.at(-1)
  const gin = seat.socio.inequality?.at(-1)
  const labArr = seat.socio.labour ?? []
  const lab = labArr.at(-1)
  const labPrev = labArr.length >= 2 ? labArr.at(-2) : null
  if (!inc && !lab) return ''
  const year = inc?.date?.slice(0, 4)
  // purchasing-power squeeze: only shown when the basket is genuinely
  // outrunning income — never present nominal income growth as the story
  const r = seat.prices?.items ? raceStats(seat, idx) : null
  const squeeze = r?.basketAnnual != null && r.incomeAnnual != null && r.basketAnnual > r.incomeAnnual
    ? `<div class="notice" style="margin-top:.5rem"><span class="delta-up">▲</span> ${L('pp_line', r.basketAnnual.toFixed(1), r.incomeAnnual.toFixed(1))}</div>`
    : ''
  return `<div class="card">
    <h2>${L('income_ctx')}</h2>
    ${inc ? `<p class="sub">${L('income_note', year)}</p>` : ''}
    <table class="data"><tbody>
      ${inc ? `<tr><td>${L('income_median')}</td><td class="num"><strong>RM${fmtNum(inc.income_median)}</strong></td><td></td></tr>` : ''}
      ${inc ? `<tr><td>${L('income_mean')}</td><td class="num">RM${fmtNum(inc.income_mean)}</td><td></td></tr>` : ''}
      ${pov ? `<tr><td>${L('poverty')}</td><td class="num">${fmtPct(pov.poverty ?? pov.poverty_absolute)}</td><td></td></tr>` : ''}
      ${gin ? `<tr><td>${L('gini')}</td><td class="num">${(gin.gini ?? '–')}</td><td></td></tr>` : ''}
      ${lab ? `<tr><td>${L('u_rate')} (${lab.date?.slice(0, 4)})</td><td class="num">${fmtPct(lab.u_rate)}</td><td class="num" style="color:var(--muted)">${labPrev ? `${labPrev.date?.slice(0, 4)}: ${fmtPct(labPrev.u_rate)}` : ''}</td></tr>` : ''}
    </tbody></table>
    ${squeeze}
  </div>`
}

// Annualized rates: basket since the Mar 2022 election vs HIES income growth
// vs official CPI — the cross-source comparison no single dataset can make.
function raceStats(seat, idx) {
  const p = seat.prices
  const items = p.items.filter(i => i.since_se15?.perc != null)
  if (items.length < 3 || !p.anchor_month) return null
  const percs = items.map(i => i.since_se15.perc).sort((a, b) => a - b)
  const medPerc = percs[percs.length >> 1]
  const years = (new Date(`${p.max_date}T00:00:00`) - new Date(`${p.anchor_month}-15T00:00:00`)) / (365.25 * 86400e3)
  const basketAnnual = years > 0 ? ((1 + medPerc / 100) ** (1 / years) - 1) * 100 : null
  const inc = seat.socio.income ?? []
  let incomeAnnual = null
  if (inc.length >= 2) {
    const a = inc[0], b = inc.at(-1)
    const yrs = Number(b.date.slice(0, 4)) - Number(a.date.slice(0, 4))
    if (yrs > 0 && a.income_median > 0) incomeAnnual = ((b.income_median / a.income_median) ** (1 / yrs) - 1) * 100
  }
  const cpiYoy = (idx?.cpi ?? []).at(-1)?.inflation_yoy ?? null
  const top = [...items].sort((a, b) => b.since_se15.perc - a.since_se15.perc).slice(0, 3)
  const exp = seat.socio.expenditure?.at(-1)
  const expVal = exp?.expenditure_mean ?? exp?.expenditure ?? null
  const incMean = inc.at(-1)?.income_mean ?? null
  const stress = expVal && incMean ? Math.round(100 * expVal / incMean) : null
  return { items, medPerc, years, basketAnnual, incomeAnnual, cpiYoy, top, stress }
}

// WhatsApp-ready plain-text talking points — one-tap value for volunteers who
// won't paste anything into an AI chat. Mirrors the Field card's groups and
// keeps every MUDA answer's attribution (who, role, year, source URL).
function tpText(seat, idx) {
  const lines = [`📍 ${seat.code} ${seat.name} — ${T('skrip rumah ke rumah', 'door-knocking script', '逐户拜访要点')}`]
  for (const g of talkingPoints(seat, idx)) {
    lines.push('', `— ${g.title.toUpperCase()} —`)
    lines.push(...g.pts.map(p => `• ${p.text}`))
  }
  lines.push('', `${location.origin}${location.pathname}#/seat/${seat.slug}`)
  return lines.join('\n')
}

function shareText(seat) {
  const e = seat.election2026
  const inc = seat.socio.income?.at(-1)
  // lead with the biggest rise since the Mar 2022 election; fall back to the
  // 12-week mover when no item carries a 2022 anchor
  const scored = seat.prices.items.map(it => {
    const series = it.latest_district != null ? it.series.district : it.series.johor
    return { it, ws: windowStats(series, seat.prices.weeks) }
  }).filter(x => x.ws)
  const since = scored.filter(x => x.it.since_se15?.perc != null)
    .sort((a, b) => b.it.since_se15.perc - a.it.since_se15.perc)[0]
  const worst = scored.sort((a, b) => b.ws.perc - a.ws.perc)[0]
  const basketLine = since
    ? `🧺 ${since.it.label_bm}: ${fmtRM(since.ws.last)} (${since.it.since_se15.perc > 0 ? '+' : ''}${since.it.since_se15.perc}% sejak PRN Mac 2022)`
    : worst
      ? `🧺 ${worst.it.label_bm}: ${fmtRM(worst.ws.last)} (${worst.ws.perc > 0 ? '+' : ''}${worst.ws.perc}% / 3 bln)`
      : null
  const lines = [
    `📍 ${seat.code} ${seat.name} — PRN Johor ${e.polling_date === '2026-07-11' ? '11 Julai 2026' : e.polling_date}`,
    e.muda_candidate ? `★ ${L('bloc_candidate')}: ${e.muda_candidate}${e.bloc_party ? ` (${e.bloc_party})` : ''}` : null,
    basketLine,
    inc ? `💰 ${L('income_median')}: RM${fmtNum(inc.income_median)}` : null,
    `Data terbuka rasmi · ${location.origin}${location.pathname}#/seat/${seat.slug}`,
  ].filter(Boolean)
  return lines.join('\n')
}

// The doorstep hero: this seat's argument in three plain lines, shown before
// any table. The tables below are the receipts; this is what you say at the
// door. Every line is guarded — thin-data seats render whatever subset exists.
function doorstepHero(seat, idx) {
  const r = seat.prices?.items ? raceStats(seat, idx) : null
  const lines = []
  if (r?.medPerc != null) {
    const pc = `${r.medPerc > 0 ? '+' : ''}${r.medPerc}%`
    lines.push(T(
      `Harga barang dapur di sini naik <strong>${pc}</strong> sejak PRN Mac 2022.`,
      `The kitchen basket here is up <strong>${pc}</strong> since the Mar 2022 election.`,
      `自2022年3月选举以来，这里的厨房篮子上涨了 <strong>${pc}</strong>。`))
  }
  if (r?.basketAnnual != null && r.incomeAnnual != null && r.basketAnnual > r.incomeAnnual) {
    lines.push(T(
      `Gaji tak kejar — pendapatan naik ${r.incomeAnnual.toFixed(1)}%/thn, harga ${r.basketAnnual.toFixed(1)}%/thn.`,
      `Pay isn't keeping up — income ${r.incomeAnnual.toFixed(1)}%/yr against prices ${r.basketAnnual.toFixed(1)}%/yr.`,
      `工资跟不上 — 收入每年 ${r.incomeAnnual.toFixed(1)}%，物价每年 ${r.basketAnnual.toFixed(1)}%。`))
  } else if (r?.stress != null && r.stress >= 70) {
    lines.push(`${L('stress_line', r.stress)}.`)
  }
  const e = seat.election2026
  const last = seat.history?.[0]
  const contest = []
  if (e?.muda_candidate) {
    contest.push(T(
      `<strong>${esc(e.muda_candidate)}</strong> ★ bertanding untuk ${esc(e.bloc_party ?? 'MUDA')} di sini`,
      `<strong>${esc(e.muda_candidate)}</strong> ★ is standing for ${esc(e.bloc_party ?? 'MUDA')} here`,
      `<strong>${esc(e.muda_candidate)}</strong> ★ 代表 ${esc(e.bloc_party ?? 'MUDA')} 在此参选`))
  }
  if (last?.majority_perc != null && last.majority_perc < 10) {
    contest.push(T(
      `majoriti ${last.date.slice(0, 4)} hanya <strong>${fmtPct(last.majority_perc)}</strong> — setiap undi penting`,
      `the ${last.date.slice(0, 4)} majority was only <strong>${fmtPct(last.majority_perc)}</strong> — every vote counts`,
      `${last.date.slice(0, 4)}年多数票仅 <strong>${fmtPct(last.majority_perc)}</strong> — 每一票都关键`))
  }
  if (contest.length) lines.push(`${contest.join(' · ')}.`)
  if (!lines.length) return ''
  const wa = `https://wa.me/?text=${encodeURIComponent(shareText(seat))}`
  return `<div class="card hero">
    ${lines.map(l => `<p class="hero-line">${l}</p>`).join('')}
    <div class="btn-row">
      <button class="btn" id="shareBtn">${L('share')}</button>
      <a class="btn wa" href="${wa}" target="_blank" rel="noopener">WhatsApp</a>
    </div>
  </div>`
}

function renderBrief(seat, idx) {
  return `
    ${doorstepHero(seat, idx)}
    ${contestCard(seat)}
    ${pricesCard(seat)}
    ${incomeCard(seat, idx)}`
}

// Curated issue → the change MUDA commits to, structured once and rendered
// twice (HTML card + WhatsApp plain text). Attribution is mandatory: stance
// lead + verified quote with who/role/year/source. NO_VERIFIED_POSITION
// stances are skipped entirely — at the door a volunteer leads with the issue,
// never with a non-position (the honest note stays in the stances card).
function issueAnswers(seat, idx) {
  const bm = state.lang === 'bm'
  const li = seat.local_issues ?? {}
  const entries = [
    ...(li.seat ?? []).map(it => ({ it, scope: 'seat' })),
    ...(li.statewide ?? []).slice(0, 2).map(it => ({ it, scope: 'state' })),
    ...((idx?.national_issues ?? []).slice(0, 2)).map(it => ({ it, scope: 'national' })),
  ]
  return entries.map(({ it, scope }) => {
    const lead = leadClause(bm ? (it.issue_bm ?? it.issue_en) : (it.issue_en ?? it.issue_bm))
    const t = (seat.muda_stances ?? []).find(s => s.key === it.theme)
    let stance = null
    if (t && t.verdict !== 'NO_VERIFIED_POSITION') {
      const qs = t.quotes ?? []
      const q = qs.find(x => x.lang === state.lang) ?? qs[0]
      stance = {
        lead: leadClause(pick(t, 'stance')),
        quote: q ? { text: q.text, who: q.who, role: pick(q, 'role'), year: (q.date ?? '').slice(0, 4), source: q.source ?? null } : null,
      }
    }
    return { lead, stance, scope, ground: it.verdict === 'GROUND_REPORT' }
  }).filter(e => e.lead)
}

const GROUND_LABEL = () => T('Laporan lapangan', 'Field report', '现场报告')

const SOL_LABEL = () => T('Penyelesaian MUDA', 'MUDA’s answer', 'MUDA 的方案')

function issuePointHtml(e) {
  const q = e.stance?.quote
  const quoteHtml = q
    ? `<br>“${esc(q.text)}” — <strong>${esc(q.who)}</strong>, ${esc(q.role)} (${esc(q.year)})${q.source ? ` <a href="${esc(q.source)}" target="_blank" rel="noopener" style="color:var(--muted)">[${T('sumber', 'source', '来源')}]</a>` : ''}`
    : ''
  const sol = e.stance
    ? `<br><span style="color:var(--muted);font-size:.82rem"><strong>${SOL_LABEL()}:</strong> ${esc(e.stance.lead)}${quoteHtml}</span>`
    : ''
  const tag = e.ground ? `<span class="badge" style="background:var(--lain);font-size:.6rem">${GROUND_LABEL()}</span> ` : ''
  return `${tag}${esc(e.lead)}${sol}`
}

function issuePointText(e) {
  const q = e.stance?.quote
  let s = e.ground ? `[${GROUND_LABEL()}] ${e.lead}` : e.lead
  if (e.stance) {
    s += `\n  ${SOL_LABEL()}: ${e.stance.lead}`
    if (q) s += `\n  “${q.text}” — ${q.who}, ${q.role} (${q.year})${q.source ? `\n  ${q.source}` : ''}`
  }
  return s
}

// Door-knocking points, grouped and prioritized: grounded LOCAL issues first
// (each with MUDA's attributed answer), the local data evidence beneath them,
// NATIONAL issues second, and campaign targeting facts last. Each point is
// { html, text } so the Field card and the WhatsApp copy stay in lockstep.
function talkingPoints(seat, idx) {
  const p = seat.prices
  const bm = state.lang === 'bm'
  const pt = (html, text) => ({ html, text: text ?? htmlToText(html) })
  const issues = issueAnswers(seat, idx)
  const issuePt = (e) => pt(issuePointHtml(e), issuePointText(e))

  const local = issues.filter(e => e.scope !== 'national').map(issuePt)
  // cross-source data evidence: pasar vs official CPI, prices vs wages
  const r = raceStats(seat, idx)
  if (r?.basketAnnual != null && r.cpiYoy != null && r.basketAnnual > r.cpiYoy + 1) {
    local.push(pt(bm
      ? `Inflasi rasmi Johor hanya <strong>${r.cpiYoy.toFixed(1)}%</strong> setahun — tetapi harga barang dapur di sini naik <strong>${r.basketAnnual.toFixed(1)}%</strong> setahun sejak PRN Mac 2022.`
      : `Official Johor inflation is just <strong>${r.cpiYoy.toFixed(1)}%</strong> a year — but the kitchen basket here is up <strong>${r.basketAnnual.toFixed(1)}%</strong> a year since the Mar 2022 election.`))
  }
  if (r?.basketAnnual != null && r.incomeAnnual != null && r.basketAnnual > r.incomeAnnual) {
    local.push(pt(bm
      ? `Harga dapur naik <strong>${r.basketAnnual.toFixed(1)}%/thn</strong> tetapi pendapatan penengah hanya <strong>${r.incomeAnnual.toFixed(1)}%/thn</strong> — gaji kalah dalam perlumbaan harga.`
      : `Kitchen prices are rising <strong>${r.basketAnnual.toFixed(1)}%/yr</strong> but median income only <strong>${r.incomeAnnual.toFixed(1)}%/yr</strong> — wages are losing the race.`))
  }
  if (r?.stress != null && r.stress >= 70) {
    local.push(pt(`${L('stress_line', r.stress)}.`))
  }
  const topRisers = p.items.map(it => {
    const series = it.latest_district != null ? it.series.district : it.series.johor
    return { it, ws: windowStats(series, p.weeks) }
  }).filter(e => e.ws && e.ws.perc >= 3)
    .sort((a, b) => b.ws.perc - a.ws.perc)
    .slice(0, 2)
  for (const { it, ws } of topRisers) {
    local.push(pt(bm
      ? `Harga <strong>${esc(it.label_bm.toLowerCase())}</strong> naik <strong>${ws.perc}%</strong> dalam 3 bulan di daerah ${esc(p.district)} (kini ${fmtRM(ws.last)}/${esc(it.unit)}).`
      : `<strong>${esc(it.label_en)}</strong> price up <strong>${ws.perc}%</strong> in 3 months in ${esc(p.district)} district (now ${fmtRM(ws.last)}/${esc(it.unit)}).`))
  }
  const incArr = seat.socio.income ?? []
  const inc0 = incArr[0]
  const incN = incArr.at(-1)
  if (inc0 && incN && incN !== inc0 && incN.income_median < inc0.income_median) {
    local.push(pt(bm
      ? `Pendapatan penengah isi rumah di sini <strong>RM${fmtNum(incN.income_median)}</strong> — masih belum pulih ke paras ${inc0.date.slice(0, 4)} (RM${fmtNum(inc0.income_median)}). Harga naik, gaji tidak.`
      : `Median household income here is <strong>RM${fmtNum(incN.income_median)}</strong> — still below its ${inc0.date.slice(0, 4)} level (RM${fmtNum(inc0.income_median)}). Prices went up; pay didn't.`))
  }
  const labArr = seat.socio.labour ?? []
  const labN = labArr.at(-1)
  const labPrev = labArr.length >= 2 ? labArr.at(-2) : null
  if (labN && labPrev && labN.u_rate != null && labPrev.u_rate != null && labN.u_rate > labPrev.u_rate) {
    local.push(pt(bm
      ? `Kadar pengangguran naik ke <strong>${fmtPct(labN.u_rate)}</strong> (${labPrev.date?.slice(0, 4)}: ${fmtPct(labPrev.u_rate)}).`
      : `Unemployment has risen to <strong>${fmtPct(labN.u_rate)}</strong> (${labPrev.date?.slice(0, 4)}: ${fmtPct(labPrev.u_rate)}).`))
  }

  const national = issues.filter(e => e.scope === 'national').map(issuePt)

  const kempen = []
  const demo = seat.demographics.find(d => d.election === 'JHR-SE-16')
  const ge15 = seat.demographics.find(d => d.election === 'GE-15')
  if (demo) {
    const youthN = demo.age.age_18_20 + demo.age.age_21_29
    const youthP = (100 * youthN / demo.voters_total).toFixed(0)
    kempen.push(pt(bm
      ? `<strong>${fmtNum(youthN)}</strong> pengundi bawah 30 tahun (${youthP}% daftar pemilih) — fokus Undi18.`
      : `<strong>${fmtNum(youthN)}</strong> voters under 30 (${youthP}% of the roll) — the Undi18 focus.`))
    if (ge15 && demo.voters_total > ge15.voters_total) {
      kempen.push(pt(`<strong>+${fmtNum(demo.voters_total - ge15.voters_total)}</strong> ${L('new_voters')}.`))
    }
  }
  const last = seat.history[0]
  if (last?.majority_perc != null && last.majority_perc < 10) {
    const yr = last.date?.slice(0, 4) ?? ''
    kempen.push(pt(bm
      ? `Kerusi majoriti tipis: majoriti ${yr} (${esc(last.election)}) hanya <strong>${fmtPct(last.majority_perc)}</strong> (${fmtNum(last.majority)} undi).`
      : `Marginal seat: the ${yr} (${esc(last.election)}) majority was only <strong>${fmtPct(last.majority_perc)}</strong> (${fmtNum(last.majority)} votes).`))
  }

  return [
    { title: T('Tempatan', 'Local', '本地'), pts: local },
    { title: T('Nasional', 'National', '全国'), pts: national },
    { title: T('Fakta kempen', 'Campaign facts', '竞选数据'), pts: kempen },
  ].filter(g => g.pts.length)
}

// ---- ground notes: device-local field reports (phase 1 — no cloud sync).
// Volunteers jot what they hear at the doors; notes live in localStorage only
// and can be exported: WhatsApp-ready text, or JSON in the intake-queue shape
// so the phase-2 admin queue can import them unchanged.
const NOTES_KEY = 'ground_notes'
const loadNotes = () => { try { return JSON.parse(storage.get(NOTES_KEY) ?? '[]') } catch { return [] } }
const saveNotes = (n) => storage.set(NOTES_KEY, JSON.stringify(n))

function groundNotesCard(seat) {
  const notes = loadNotes()
  const mine = notes.filter(n => n.code === seat.code)
  const rows = mine.map(n => `
    <div style="padding:.5rem 0;border-top:1px solid var(--line)">
      <div style="font-size:.72rem;color:var(--muted)">${esc(n.ts.slice(0, 16).replace('T', ' '))}${n.theme ? ` · ${esc(n.theme)}` : ''}</div>
      <div style="font-size:.85rem">${esc(n.text)}</div>
      <button class="btn secondary" data-delnote="${esc(n.ts)}" style="margin-top:.3rem;font-size:.7rem;padding:4px 10px">${T('Padam', 'Delete', '删除')}</button>
    </div>`).join('')
  return `<div class="card" id="notesCard">
    <h2>${T('Nota lapangan', 'Field notes', '现场笔记')}</h2>
    <p class="sub">${T('Catat apa yang anda dengar di pintu. Disimpan dalam telefon ini sahaja — tidak dihantar ke mana-mana. Eksport dan hantar kepada admin bila siap.', 'Jot what you hear at the doors. Stored on this phone only — sent nowhere. Export and send to your admin when ready.', '记录您在门口听到的情况。仅保存在本手机上 — 不会发送到任何地方。准备好后导出发给管理员。')}</p>
    <textarea id="noteText" style="width:100%;box-sizing:border-box;min-height:90px;font:inherit;padding:10px 12px;border:1.5px solid var(--line);border-radius:10px" placeholder="${T('Contoh: Penduduk Taman X kata bekalan air putus 3 hari…', 'e.g. Taman X residents say the water has been out 3 days…', '例如：Taman X 居民说停水三天了…')}"></textarea>
    <div class="btn-row">
      <button class="btn" id="noteSave">${T('Simpan nota', 'Save note', '保存笔记')}</button>
      ${notes.length ? `<button class="btn secondary" id="notesCopy">${T('Salin semua', 'Copy all')} (${notes.length})</button>` : ''}
    </div>
    ${mine.length ? rows : `<p class="sub" style="margin-top:.6rem">${T('Belum ada nota untuk kerusi ini di telefon ini.', 'No notes for this seat on this phone yet.', '本手机上还没有此议席的笔记。')}</p>`}
  </div>`
}

function bindGroundNotes(seat, rerender) {
  const saveBtn = document.getElementById('noteSave')
  if (!saveBtn) return
  saveBtn.addEventListener('click', () => {
    const text = document.getElementById('noteText').value.trim()
    if (text.length < 10) return
    const notes = loadNotes()
    notes.unshift({ ts: new Date().toISOString(), code: seat.code, seat: `${seat.code} ${seat.name}`, text, theme: suggestTheme(text) })
    saveNotes(notes)
    rerender()
  })
  document.querySelectorAll('[data-delnote]').forEach(b => b.addEventListener('click', () => {
    saveNotes(loadNotes().filter(n => n.ts !== b.dataset.delnote))
    rerender()
  }))
  const copyBtn = document.getElementById('notesCopy')
  if (copyBtn) copyBtn.addEventListener('click', async () => {
    const text = loadNotes().map(n => `📍 ${n.seat} (${n.ts.slice(0, 16).replace('T', ' ')})${n.theme ? ` [${n.theme}]` : ''}\n${n.text}`).join('\n\n')
    const ok = await copyToClipboard(text)
    if (!ok) { window.prompt('Salin / Copy:', text); return }
    const orig = copyBtn.textContent
    copyBtn.textContent = L('copied')
    setTimeout(() => { copyBtn.textContent = orig }, 2000)
  })
}

// The prioritized 5-beat narrative: one story a candidate can carry, ordered
// by what wins the seat — path, people, message, ground, ask. Every number is
// pulled from the same verified data as the sections below it.
// The punchy head of a curated issue string for a one-line doorstep message:
// the clause before the first " — ", trimmed to a sentence / ~140 chars. Full
// receipts and sources stay in issuesCard.
function leadClause(text) {
  if (!text) return ''
  const head = text.split(' — ')[0].trim()
  if (head.length <= 140) return head
  const m = head.match(/^.*?[.!?](?=\s|$)/)
  const sent = m ? m[0].trim() : head
  return sent.length <= 140 ? sent : head.slice(0, 137).trimEnd() + '…'
}

// MUDA's official line for an issue theme (muda edition only — neutral builds
// carry no seat.muda_stances, so this renders nothing there). Returns a small
// appended HTML fragment: the stance lead + the top sourced leader quote with
// attribution. NO_VERIFIED_POSITION themes get their honest stance line and
// never a quotation; quotes[] entries are verified exact words by contract.
function mudaAngleFor(theme, seat) {
  if (!theme) return ''
  const t = (seat.muda_stances ?? []).find(s => s.key === theme)
  // no verified position = say nothing at the door (the honest note lives in
  // the issues card receipts, never in the doorstep message)
  if (!t || t.verdict === 'NO_VERIFIED_POSITION') return ''
  const stanceLead = leadClause(pick(t, 'stance'))
  // prefer a quote captured in the current UI language (a real Chinese-source
  // quote once one is added), else the first verbatim quote in any language
  const qs = t.quotes ?? []
  const q = qs.find(x => x.lang === state.lang) ?? qs[0]
  const quoteHtml = q
    ? `<br>“${esc(q.text)}” — <strong>${esc(q.who)}</strong>, ${esc(pick(q, 'role'))} (${esc((q.date ?? '').slice(0, 4))})${q.source ? ` <a href="${esc(q.source)}" target="_blank" rel="noopener" style="color:var(--muted)">[${T('sumber', 'source', '来源')}]</a>` : ''}`
    : ''
  return `<br><span style="color:var(--muted);font-size:.82rem"><strong>MUDA:</strong> ${esc(stanceLead)}${quoteHtml}</span>`
}

function storyFor(seat, idx) {
  const bm = state.lang === 'bm'
  const beats = []
  const hist = seat.history
  const last = hist[0]
  const prev = hist.slice(1).find(c => c.voter_turnout_perc != null)

  // 1 — path to victory (the turnout math)
  if (last) {
    const w = last.ballot.find(b => (b.result ?? '').startsWith('won')) ?? last.ballot[0]
    const t = last.voter_turnout_perc
    const tp = prev?.voter_turnout_perc
    const turnoutCollapsed = t != null && tp != null && tp - t > 10
    beats.push({
      title: L('beat_path'),
      text: bm
        ? `${esc(w?.party ?? '?')} menang pada ${last.date.slice(0, 4)} dengan majoriti <strong>${fmtPct(last.majority_perc)}</strong>${t != null ? `, tetapi hanya <strong>${fmtPct(t, 0)}</strong> keluar mengundi${turnoutCollapsed ? ` (${prev.date.slice(0, 4)}: ${fmtPct(tp, 0)})` : ''}` : ''}. ${turnoutCollapsed ? 'Kerusi ini diputuskan oleh siapa yang KELUAR, bukan siapa yang bertukar parti.' : 'Setiap undi penting.'}`
        : `${esc(w?.party ?? '?')} won in ${last.date.slice(0, 4)} with a <strong>${fmtPct(last.majority_perc)}</strong> majority${t != null ? `, but only <strong>${fmtPct(t, 0)}</strong> turned out${turnoutCollapsed ? ` (${prev.date.slice(0, 4)}: ${fmtPct(tp, 0)})` : ''}` : ''}. ${turnoutCollapsed ? 'This seat is decided by who SHOWS UP, not who switches sides.' : 'Every vote counts.'}`,
    })
  }

  // 2 — the deciders (youth + new voters)
  const demo = seat.demographics.find(d => d.election === 'JHR-SE-16')
  const ge15 = seat.demographics.find(d => d.election === 'GE-15')
  if (demo) {
    const youthN = demo.age.age_18_20 + demo.age.age_21_29
    const youthP = Math.round(100 * youthN / demo.voters_total)
    const newV = ge15 && demo.voters_total > ge15.voters_total ? demo.voters_total - ge15.voters_total : null
    beats.push({
      title: L('beat_voters'),
      text: bm
        ? `<strong>${fmtNum(youthN)}</strong> pengundi bawah 30 (${youthP}% daftar 2026)${newV ? `, termasuk <strong>${fmtNum(newV)}</strong> pengundi baharu sejak PRU15` : ''}.`
        : `<strong>${fmtNum(youthN)}</strong> voters under 30 (${youthP}% of the 2026 roll)${newV ? `, including <strong>${fmtNum(newV)}</strong> new voters since GE15` : ''}.`,
    })
  }

  // 3 — the doorstep message: one local issue + one national issue (full
  // receipts + sources live in issuesCard below; muda edition overlays MUDA's
  // stance + a sourced leader quote so it lands as the party's official line)
  const localIssue = seat.local_issues?.seat?.[0] ?? seat.local_issues?.statewide?.[0] ?? null
  const nationalIssue = idx.national_issues?.[0] ?? null
  if (localIssue || nationalIssue) {
    const section = (label, issue) => {
      if (!issue) return ''
      const lead = leadClause(bm ? (issue.issue_bm ?? issue.issue_en) : (issue.issue_en ?? issue.issue_bm))
      const angle = mudaAngleFor(issue.theme, seat)
      return `<strong>${label}:</strong> ${esc(lead)}${angle}`
    }
    const parts = [section(L('beat_local'), localIssue), section(L('beat_national'), nationalIssue)].filter(Boolean)
    beats.push({ title: L('beat_message'), text: parts.join('<br>') })
  }

  // 4 — the ground map (where to spend shoe leather)
  const sal = seat.saluran2022
  if (sal) {
    const dms = sal.dms.filter(d => d.type === 'biasa' && d.valid > 0)
    const share = (dm, b) => 100 * (dm.blocs[b] || 0) / dm.valid
    const own = (sal.totals.MUDA ? 'MUDA' : sal.totals.PH ? 'PH' : null)
    if (seat.featured && own && dms.length) {
      const top = [...dms].sort((a, b) => share(b, own) - share(a, own)).slice(0, 3)
      const list = top.map(d => `${esc(d.name)} (${share(d, own).toFixed(0)}% ${own}, ${bm ? 'keluar' : 'turnout'} ${fmtPct(d.turnout_perc, 0)})`).join(' · ')
      beats.push({
        title: L('beat_ground'),
        text: bm
          ? `Kubu 2022 tapi ramai tak keluar mengundi — sokongan sedia ada, mula di sini: ${list}.`
          : `2022 strongholds with low turnout = votes waiting to be collected: ${list}.`,
      })
    } else if (dms.length) {
      const close = dms.map(d => {
        const s = Object.values(d.blocs).map(v => 100 * v / d.valid).sort((x, y) => y - x)
        return { d, gap: (s[0] ?? 0) - (s[1] ?? 0) }
      }).sort((a, b) => a.gap - b.gap)[0]
      if (close) beats.push({
        title: L('beat_ground'),
        text: bm
          ? `Medan rebutan paling sengit 2022: <strong>${esc(close.d.name)}</strong> (beza hanya ${close.gap.toFixed(0)} mata). Mulakan di situ.`
          : `Tightest battleground in 2022: <strong>${esc(close.d.name)}</strong> (only ${close.gap.toFixed(0)} points apart). Start there.`,
      })
    }
  }

  // 5 — the ask
  const e = seat.election2026
  if (e?.polling_date) {
    const past = new Date(`${e.polling_date}T00:00:00`) < new Date()
    if (!past) beats.push({
      title: L('beat_ask'),
      text: bm
        ? `Undi awal <strong>7 Julai</strong> · hari mengundi <strong>11 Julai</strong>. Setiap penyokong yang dikenal pasti dalam langkah 4: pastikan mereka tahu pusat mengundi dan ada pengangkutan.`
        : `Early voting <strong>7 July</strong> · polling day <strong>11 July</strong>. For every supporter identified in beat 4: make sure they know their polling centre and have a ride.`,
    })
  }
  return beats
}

function storyCard(seat, idx) {
  const beats = storyFor(seat, idx)
  if (beats.length < 3) return ''
  return `<div class="card">
    <h2>${L('story_title')}</h2>
    <p class="sub">${L('story_sub')}</p>
    <ol class="story">
      ${beats.map(b => `<li><div><div class="beat-title">${esc(b.title)}</div><div>${b.text}</div></div></li>`).join('')}
    </ol>
  </div>`
}

// Curated, source-verified issues: this seat's local ones, the Johor-statewide
// set (data/manual/issues.json), and the national set (national_issues.json).
function issuesCard(seat, idx) {
  const li = seat.local_issues
  if (!li) return ''
  const bm = state.lang === 'bm'
  const render = (list, tag) => list.map(it => {
    const text = bm ? (it.issue_bm ?? it.issue_en) : (it.issue_en ?? it.issue_bm)
    const receipt = bm ? (it.receipt_bm ?? it.receipt_en) : (it.receipt_en ?? it.receipt_bm)
    const refs = (it.sources ?? []).map((u, i) =>
      ` <a href="${esc(u)}" target="_blank" rel="noopener" style="color:var(--muted)">[${i + 1}]</a>`).join('')
    const groundTag = it.verdict === 'GROUND_REPORT' ? `<span class="badge" style="background:var(--lain)">${GROUND_LABEL()}</span> ` : ''
    return `<li>${tag ? `<span class="badge" style="background:var(--lain)">${esc(tag)}</span> ` : ''}${groundTag}${esc(text ?? '')}${receipt ? `<br><span style="color:var(--muted);font-size:.78rem">${esc(receipt)}</span>` : ''}${refs}</li>`
  }).join('')
  const seatItems = li.seat ?? []
  const stateItems = li.statewide ?? []
  const nationalItems = idx?.national_issues ?? []
  if (!seatItems.length && !stateItems.length && !nationalItems.length) return ''
  return `<div class="card">
    <h2>${L('issues_title')}</h2>
    <p class="sub">${L('issues_sub')}</p>
    <ul class="points">
      ${render(seatItems, null)}
      ${render(stateItems, L('issues_statewide'))}
      ${render(nationalItems, L('issues_national'))}
    </ul>
  </div>`
}

function renderField(seat, idx) {
  const pts = talkingPoints(seat, idx)
  return `
    ${storyCard(seat, idx)}
    ${issuesCard(seat, idx)}
    <div class="card">
      <h2>${L('talking_points')}</h2>
      <p class="sub">${L('tp_sub')}</p>
      ${pts.map(g => `<h3>${esc(g.title)}</h3><ul class="points">${g.pts.map(p => `<li>${p.html}</li>`).join('')}</ul>`).join('')}
    </div>
    ${groundNotesCard(seat)}
    ${idx.edition === 'muda' ? `<div class="btn-row"><button class="btn" id="briefBtn">${L('brief_btn')}</button></div>` : ''}`
}

// voter demographics (analyst form factor — lives on the Analisis tab)
function demoCard(seat) {
  const demo = seat.demographics.find(d => d.election === 'JHR-SE-16') ?? seat.demographics[0]
  if (!demo) return ''
  const ageBands = [['18–20', demo.age.age_18_20], ['21–29', demo.age.age_21_29], ['30–39', demo.age.age_30_39], ['40–49', demo.age.age_40_49], ['50–59', demo.age.age_50_59], ['60–69', demo.age.age_60_69], ['70+', demo.age.age_70_79 + demo.age.age_80_89 + demo.age['age_90+']]]
  const eth = [[T('Melayu', 'Malay'), demo.ethnic.ethnic_malay], [T('Cina', 'Chinese'), demo.ethnic.ethnic_chinese], [T('India', 'Indian'), demo.ethnic.ethnic_indian], [T('Lain-lain', 'Others'), demo.ethnic.ethnic_bumi_sabah + demo.ethnic.ethnic_bumi_sarawak + demo.ethnic.ethnic_orang_asli + demo.ethnic.ethnic_other]]
  const maxAge = Math.max(...ageBands.map(a => a[1]))
  const maxEth = Math.max(...eth.map(a => a[1]))
  return `<div class="card">
    <h2>${L('demo_title')}</h2>
    <p class="sub">${L('demo_sub')} · ${fmtNum(demo.voters_total)} ${L('voters')} · ${fmtPct(100 * demo.sex_female / demo.voters_total, 0)} ${L('women')}</p>
    <h3>${L('age_dist')}</h3>
    ${ageBands.map(([lbl, v]) => barRow(lbl, 100 * v / maxAge, fmtPct(100 * v / demo.voters_total, 0))).join('')}
    <h3>${L('ethnic_dist')}</h3>
    ${eth.map(([lbl, v]) => barRow(lbl, 100 * v / maxEth, fmtPct(100 * v / demo.voters_total, 0))).join('')}
  </div>`
}

function renderHq(seat) {
  const hist = seat.history
  const histHtml = `<div class="card">
    <h2>${L('history')}</h2>
    <table class="data">
      <thead><tr><th>${L('election')}</th><th>${L('winner')}</th><th class="num">${L('majority')}</th><th class="num">${L('turnout')}</th></tr></thead>
      <tbody>${hist.map(c => {
        const w = c.ballot.find(b => (b.result ?? '').startsWith('won')) ?? c.ballot[0]
        // "majority" in Malaysian usage = the absolute winning margin in votes;
        // show that as primary with the margin-% secondary (7,114 (13%))
        const majCell = c.majority != null
          ? `${fmtNum(c.majority)}${c.majority_perc != null ? ` <span style="color:var(--muted)">(${fmtPct(c.majority_perc, 0)})</span>` : ''}`
          : fmtPct(c.majority_perc)
        return `
        <tr>
          <td>${esc(c.election)}<br><span style="color:var(--muted);font-size:.72rem">${esc(c.date)} · ${esc(c.code_then)}</span></td>
          <td>${esc(w?.name ?? '')}<br>${partyBadge(w?.party ?? '?', w?.coalition)}</td>
          <td class="num">${majCell}</td>
          <td class="num">${fmtPct(c.voter_turnout_perc)}</td>
        </tr>`
      }).join('')}
      </tbody></table>
  </div>`

  let salHtml = ''
  const sal = seat.saluran2022
  if (sal) {
    const dms = sal.dms.filter(d => d.type === 'biasa')
    const rows = dms.map(dm => {
      const shares = Object.fromEntries(Object.entries(dm.blocs).map(([b, v]) => [b, dm.valid ? 100 * v / dm.valid : 0]))
      const top = Object.entries(shares).sort((a, b) => b[1] - a[1])[0]
      return { dm, shares, top }
    })
    rows.sort((a, b) => (b.shares.MUDA ?? 0) + (b.shares.PH ?? 0) - ((a.shares.MUDA ?? 0) + (a.shares.PH ?? 0)))
    salHtml = `<div class="card">
      <h2>${L('saluran')}</h2>
      <p class="sub">${L('saluran_sub')}</p>
      <div class="legend"><span class="l-ph">PH</span><span class="l-muda">MUDA</span><span class="l-bn">BN</span><span class="l-pn">PN</span><span class="l-lain">Lain</span></div>
      <table class="data">
        <thead><tr><th>${L('dm')}</th><th style="width:38%"></th><th class="num">${L('turnout')}</th></tr></thead>
        <tbody>${rows.map(({ dm, top }) => `
          <tr>
            <td><strong>${esc(dm.name)}</strong><br><span style="color:var(--muted);font-size:.7rem">${esc(dm.code)} · ${fmtNum(dm.voters)} ${L('voters')} · ${top ? `${esc(top[0])} ${top[1].toFixed(0)}%` : ''}</span></td>
            <td>${stackBar(dm.blocs, dm.valid)}</td>
            <td class="num">${fmtPct(dm.turnout_perc, 0)}</td>
          </tr>`).join('')}
        </tbody></table>
    </div>`
  }

  return `${histHtml}${salHtml}${demoCard(seat)}
    <div class="card">
      <h2>${L('export')}</h2>
      <div class="btn-row">
        <a class="btn secondary" href="data/seats/${seat.slug}.json" download>${L('export_json')}</a>
        <button class="btn secondary" id="csvBtn">${L('export_csv')}</button>
      </div>
    </div>`
}

async function renderSeat(slug, tab = 'brief') {
  const [idx, seat] = await Promise.all([loadIndex(), loadSeat(slug)])
  storage.set('last_seat', slug) // powers the home page's one-tap return chip
  let mapSvg = ''
  try {
    const geo = await loadGeo()
    const feature = geo.features.find(f => f.properties.slug === slug)
    if (feature && seat.bbox) mapSvg = miniMap(feature, seat.bbox)
  } catch { /* map optional */ }

  app.innerHTML = `
    <div class="seat-head">
      ${mapSvg}
      <div>
        <div class="crumbs"><a href="#/">← Johor</a> · ${esc(seat.parlimen ?? '')}</div>
        <h1><span class="monogram">${esc(seat.code)}</span> ${esc(seat.name)}</h1>
        <div class="crumbs">${esc(seat.prices.district ?? '')} · ${fmtNum(seat.election2026?.voters_total)} ${L('voters')}</div>
      </div>
    </div>
    <div class="tabs">
      <button data-tab="brief" class="${tab === 'brief' ? 'active' : ''}">${L('tab_brief')}</button>
      <button data-tab="field" class="${tab === 'field' ? 'active' : ''}">${L('tab_field')}</button>
      <button data-tab="hq" class="${tab === 'hq' ? 'active' : ''}">${L('tab_hq')}</button>
    </div>
    <div id="tabContent"></div>`

  const content = document.getElementById('tabContent')
  const renderTab = () => {
    content.innerHTML = tab === 'field' ? renderField(seat, idx) : tab === 'hq' ? renderHq(seat) : renderBrief(seat, idx)
    if (tab === 'field') bindGroundNotes(seat, renderTab)
  }
  renderTab()

  document.querySelectorAll('.tabs button').forEach(btn =>
    btn.addEventListener('click', () => { location.hash = `#/seat/${slug}/${btn.dataset.tab}` }))

  const shareBtn = document.getElementById('shareBtn')
  if (shareBtn) shareBtn.addEventListener('click', async () => {
    const text = shareText(seat)
    if (navigator.share) { try { await navigator.share({ text }) } catch { /* cancelled */ } return }
    let ok = false
    if (navigator.clipboard?.writeText) {
      try { await navigator.clipboard.writeText(text); ok = true } catch { /* denied */ }
    }
    if (!ok) {
      // clipboard API needs a secure context; fall back for plain-http hosting
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'; ta.style.opacity = '0'
      document.body.appendChild(ta); ta.select()
      try { ok = document.execCommand('copy') } catch { /* unsupported */ }
      ta.remove()
    }
    if (!ok) { window.prompt('Salin / Copy:', text); return }
    const orig = shareBtn.textContent
    shareBtn.textContent = L('copied')
    setTimeout(() => { shareBtn.textContent = orig }, 2000)
  })

  const csvBtn = document.getElementById('csvBtn')
  if (csvBtn) csvBtn.addEventListener('click', () => {
    const sal = seat.saluran2022
    if (!sal) return
    const blocs = ['PH', 'MUDA', 'BN', 'PN', 'LAIN']
    const lines = [['dm_code', 'dm_name', 'type', 'voters', 'turnout_perc', 'valid', ...blocs].join(',')]
    for (const dm of sal.dms) {
      lines.push([dm.code, `"${dm.name.replace(/"/g, '""')}"`, dm.type, dm.voters ?? '', dm.turnout_perc ?? '', dm.valid, ...blocs.map(b => dm.blocs[b] ?? 0)].join(','))
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${seat.slug}-saluran-2022.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  })

  const briefBtn = document.getElementById('briefBtn')
  if (briefBtn) briefBtn.addEventListener('click', () => copyAndDownloadBriefing(briefingMd(seat, idx), seat.slug, briefBtn))

  renderFooter(idx)
  window.scrollTo(0, 0)
}

// ---------- router ----------
async function route() {
  const hash = location.hash || '#/'
  try {
    const m = hash.match(/^#\/seat\/([a-z0-9-]+)(?:\/(brief|field|hq))?/)
    if (m) await renderSeat(m[1], m[2] ?? 'brief')
    else if (hash === '#/volunteer') await renderVolunteer()
    else await renderHome()
  } catch (e) {
    console.error(e)
    app.innerHTML = `<div class="card">${L('err')}</div>`
  }
}

// cycle BM → EN → 中文 → BM; the button shows the CURRENT language
const langBtn = document.getElementById('langToggle')
const syncLangBtn = () => {
  langBtn.textContent = LANG_LABEL[state.lang]
  langBtn.setAttribute('aria-label', `Language: ${state.lang.toUpperCase()} — tap to switch`)
}
langBtn.addEventListener('click', () => {
  state.lang = LANGS[(LANGS.indexOf(state.lang) + 1) % LANGS.length]
  storage.set('lang', state.lang)
  syncLangBtn()
  route()
})
syncLangBtn()

window.addEventListener('hashchange', route)
route()

// ---------- PWA: offline cache + one-tap install ----------
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => { /* offline support optional */ })
}
// Chrome/Android fires beforeinstallprompt when installable; stash it so the
// home fork can show a one-tap "Pasang aplikasi" chip (see heroFork).
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  state.installPrompt = e
  document.getElementById('installChip')?.removeAttribute('hidden')
})
