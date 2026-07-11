// Peta MUDA — Seat Command Center (static, no build step).
// Data: electiondata.my (CC0) + data.gov.my/OpenDOSM (CC BY 4.0).
import { suggestTheme } from './ops-match.mjs'

// Code build tag, shown in the footer. Bump on every shipped app change — it's
// the on-device proof of which build a phone is actually running (the cache-
// staleness diagnostic). Not the data build time (that's idx.built_at).
const BUILD = '2026-07-11h'

// localStorage may be blocked (SecurityError) or hold a foreign value written
// by another app on a shared origin (e.g. github.io) — only accept 'en'/'bm'.
const storage = {
  get(k) { try { return localStorage.getItem(k) } catch { return null } },
  set(k, v) { try { localStorage.setItem(k, v) } catch { /* blocked */ } },
}
const LANGS = ['bm', 'en']
const LANG_LABEL = { bm: 'BM', en: 'EN' }
// which state's dataset is loaded. Johor is the live campaign; Melaka is the
// next front (data built by pipeline/run_melaka.mjs into data/melaka/).
const REGIONS = ['johor', 'melaka']
const state = {
  lang: LANGS.includes(storage.get('lang')) ? storage.get('lang') : 'bm',
  region: REGIONS.includes(storage.get('region')) ? storage.get('region') : 'johor',
  index: null,
  seats: new Map(), // slug -> seat json
  geo: null,
}
// per-region data locations. Johor keeps its original paths for compatibility.
const DATA_DIR = () => state.region === 'melaka' ? 'data/melaka/' : 'data/'
const GEO_URL = () => state.region === 'melaka' ? 'data/melaka/dun.geojson' : 'data/johor_dun.geojson'
const REGION_LABEL = () => state.region === 'melaka' ? 'Melaka' : 'Johor'

// ---------- i18n ----------
const STR = {
  bm: {
    days_to_poll: 'hari lagi ke hari mengundi',
    poll_day: 'Hari mengundi: 11 Julai 2026',
    early_vote: 'Undi awal: 7 Julai 2026',
    poll_today: 'HARI MENGUNDI — keluar mengundi!',
    poll_over: () => `PRN ${REGION_LABEL()} telah selesai. Terima kasih kerana mengundi!`,
    featured: 'Kerusi Blok Progresif (MUDA–PSM)',
    search: 'Cari kerusi, kawasan atau parlimen…',
    gotv_title: 'Jom keluar mengundi',
    gotv_today: 'Hari ini hari mengundi — keluar sekarang!',
    gotv_early: (poll) => `Undi awal dah bermula — hari mengundi ${poll}.`,
    gotv_soon: (d, poll) => `${d} hari lagi — hari mengundi ${poll}.`,
    gotv_logistics: 'Pastikan anda tahu pusat mengundi dan saluran anda, bawa MyKad, dan ajak keluarga sekali.',
    gotv_check: 'Semak daftar & saluran anda',
    gotv_invite: 'Ajak kawan',
    gotv_wa: (name, poll, url) => `PRN ${REGION_LABEL()}: hari mengundi ${poll}. Jom kita keluar mengundi di ${name}! Semak kerusi dan calon anda: ${url}`,
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
    volunteer_title: 'Skrip sukarelawan',
    volunteer_sub: 'Cari kerusi anda, bina skrip pintu ke pintu — 3 point terkuat dipilih untuk anda, salin, sedia untuk WhatsApp.',
    volunteer_none: 'Tiada kerusi sepadan.',
    bloc_candidate: 'Calon Blok Progresif',
    income_ctx: 'Konteks pendapatan',
    income_median: 'Pendapatan penengah isi rumah',
    income_mean: 'Pendapatan purata',
    spending: 'Perbelanjaan isi rumah',
    income_real: 'Pendapatan (nilai 2024)',
    income_growth: 'Pertumbuhan sejak 2019',
    income_vs: 'Berbanding penengah',
    poverty: 'Kadar kemiskinan mutlak',
    gini: 'Ketaksamaan (Gini)',
    u_rate: 'Kadar pengangguran',
    copied: 'Disalin!',
    beat_path: 'Jalan kemenangan',
    beat_voters: 'Pengundi penentu',
    beat_message: 'Mesej di pintu',
    beat_ground: 'Peta lapangan',
    beat_ask: 'Tindakan',
    beat_local: 'Tempatan',
    beat_national: 'Nasional',
    talking_points: 'Isu untuk rumah ke rumah',
    tp_sub: '3 point terkuat sudah ditanda — tanda/buang pilihan, semak pratonton, salin. Dijana daripada data rasmi.',
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
  },
  en: {
    days_to_poll: 'days to polling day',
    poll_day: 'Polling day: 11 July 2026',
    early_vote: 'Early voting: 7 July 2026',
    poll_today: 'POLLING DAY — get out and vote!',
    poll_over: () => `The ${REGION_LABEL()} election has concluded. Thank you for voting!`,
    featured: 'Progressive Bloc seats (MUDA–PSM)',
    search: 'Search seat, area or parlimen…',
    gotv_title: 'Get out and vote',
    gotv_today: 'Polling day is today — go vote now!',
    gotv_early: (poll) => `Early voting has started — polling day is ${poll}.`,
    gotv_soon: (d, poll) => `${d} days to go — polling day is ${poll}.`,
    gotv_logistics: 'Know your polling centre and saluran, bring your MyKad, and bring your family along.',
    gotv_check: 'Check your voter registration',
    gotv_invite: 'Invite a friend',
    gotv_wa: (name, poll, url) => `${REGION_LABEL()} votes on ${poll}. Let’s go vote in ${name}! Check your seat and candidates: ${url}`,
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
    volunteer_title: 'Volunteer script',
    volunteer_sub: 'Find your seat, build its door-knocking script — the 3 strongest points are pre-picked, copy, ready for WhatsApp.',
    volunteer_none: 'No matching seats.',
    bloc_candidate: 'Progressive Bloc candidate',
    income_ctx: 'Income context',
    income_median: 'Median household income',
    income_mean: 'Mean income',
    spending: 'Household spending',
    income_real: 'Income (2024 ringgit)',
    income_growth: 'Growth since 2019',
    income_vs: 'Compared to median',
    poverty: 'Absolute poverty rate',
    gini: 'Inequality (Gini)',
    u_rate: 'Unemployment rate',
    copied: 'Copied to clipboard!',
    beat_path: 'Path to victory',
    beat_voters: 'The deciders',
    beat_message: 'The doorstep message',
    beat_ground: 'The ground map',
    beat_ask: 'The ask',
    beat_local: 'Local',
    beat_national: 'National',
    talking_points: 'Door-knocking talking points',
    tp_sub: 'The 3 strongest points are pre-ticked — adjust the selection, check the preview, copy. Generated from official data.',
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
const fmtPct = (v, dp = 1) => v == null ? '–' : `${Number(v).toFixed(dp)}%`
// Badge colored by the coalition AT THAT CONTEST when known (BERSATU won 2018
// as PH, GERAKAN's old wins were BN, MIPP/PEJUANG ride with PN in 2026);
// falls back to the party's own class when standing alone.
const partyBadge = (p, coalition) => {
  const cls = ['PH', 'BN', 'PN'].includes(coalition) ? coalition : esc(p)
  return `<span class="badge ${cls}">${esc(p)}</span>`
}

const BLOC_COLORS = { PH: 'var(--ph)', BN: 'var(--bn)', PN: 'var(--pn)', MUDA: 'var(--muda)', LAIN: 'var(--lain)' }

// the current electoral roll = newest demographics entry (JHR-SE-16 for Johor,
// GE-15 for Melaka until its next PRN roll is gazetted); the prior roll (for
// the "new voters since" line) is the next entry down, else null — so seat
// pages work for either state without hardcoding a roll id
const currentRoll = (seat) => seat.demographics?.[0] ?? null
const priorRoll = (seat) => seat.demographics?.[1] ?? null

// ---------- charts ----------
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
  if (!state.index) state.index = await (await fetch(`${DATA_DIR()}index.json`)).json()
  return state.index
}
async function loadSeat(slug) {
  if (!state.seats.has(slug)) state.seats.set(slug, await (await fetch(`${DATA_DIR()}seats/${slug}.json`)).json())
  return state.seats.get(slug)
}
async function loadGeo() {
  if (!state.geo) state.geo = await (await fetch(GEO_URL())).json()
  return state.geo
}
// switching states invalidates every cached dataset and returns home
function setRegion(region) {
  if (!REGIONS.includes(region) || region === state.region) return
  state.region = region
  storage.set('region', region)
  state.index = null; state.seats = new Map(); state.geo = null
  storage.set('last_seat', '') // a Johor slug must not resume under Melaka
  location.hash = '#/'
  syncStateToggle()
  route()
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
    <p><a href="#/about">${T('Tentang aplikasi ini', 'About this app')}</a></p>
    <p>${L('built')}: ${new Date(idx.built_at).toLocaleString()} · <span title="app code version">app ${BUILD}</span> · ${L('disclaimer')}</p>`
}

// Live flood-warning banner: the daily ground signal. Renders only when JPS
// has stations at alert level or above right now, dated, and (muda edition)
// paired with MUDA's documented flood-relief record — the current
// administration's live exposure next to MUDA's answer.

function countdownCard(idx) {
  // no announced polling date yet (Melaka) — show the expected window instead
  // of a broken countdown
  if (!idx.election.polling_date) {
    const exp = idx.election.expected_by
    return `<div class="card"><div class="countdown">
      <div class="label">${T('PRN belum diumumkan', 'Election not yet called')}</div>
      ${exp ? `<div class="sublabel">${T('Dijangka menjelang', 'Expected by')} ${esc(exp)}</div>` : ''}
    </div></div>`
  }
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

// "Apa MUDA kata" — MUDA's strongest statewide positions on the current
// issues, always present on the home page (muda edition). Commitment first,
// the attributed verbatim quote + source second. Never empty — this is the
// daily MUDA-first narrative surface, not a data readout.
function mudaVoiceCard(idx) {
  if (idx.edition !== 'muda') return ''
  // strongest-first ordering; take the top 4 statewide themes that carry a lead
  const order = ['cost_of_living', 'wages', 'housing', 'integrity', 'sst']
  const themes = (idx.muda_voice ?? [])
    .filter(t => t.verdict !== 'NO_VERIFIED_POSITION' && pick(t, 'stance'))
    .sort((a, b) => (order.indexOf(a.key) + 1 || 99) - (order.indexOf(b.key) + 1 || 99))
    .slice(0, 4)
  if (!themes.length) return ''
  const items = themes.map(t => {
    const lead = leadClause(pick(t, 'stance'))
    const qs = t.quotes ?? []
    const q = qs.find(x => x.lang === state.lang) ?? qs[0]
    const quote = q
      ? `<br><span style="color:var(--muted);font-size:.82rem">“${esc(q.text)}” — <strong>${esc(q.who)}</strong>, ${esc(pick(q, 'role'))} (${esc((q.date ?? '').slice(0, 4))})${q.source ? ` <a href="${esc(q.source)}" target="_blank" rel="noopener" style="color:var(--muted)">[${T('sumber', 'source')}]</a>` : ''}</span>`
      : ''
    return `<li><strong>MUDA:</strong> ${esc(lead)}${quote}</li>`
  }).join('')
  return `<div class="card accent">
    <p class="kicker" style="margin-bottom:6px">${T('Adakah hidup anda lebih baik daripada PRN lalu?', 'Are you better off than at the last election?')}</p>
    <h2>${T('Apa MUDA kata tentang isu semasa', 'What MUDA is saying on the issues')}</h2>
    <p class="sub">${T('Pendirian rasmi MUDA — setiap satu disahkan sumber', 'MUDA’s official positions — each source-verified')}</p>
    <ul class="points">${items}</ul>
  </div>`
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
  const reg = REGION_LABEL()
  if (u) stats.push(`<div style="min-width:130px"><div style="font-size:1.7rem;font-weight:800;color:var(--accent)">${fmtNum(u.total_18_20)}</div><div style="color:var(--muted);font-size:.72rem">${T(`pengundi 18–20 tahun dalam daftar pemilih ${reg} — kohort yang dibuka oleh reformasi Undi18 2019`, `voters aged 18–20 on the ${reg} roll — the cohort the 2019 Undi18 reform opened up`)}</div></div>`)
  if (m) stats.push(`<div style="min-width:130px"><div style="font-size:1.7rem;font-weight:800;color:var(--accent)">${m.won}/${m.seats_contested}</div><div style="color:var(--muted);font-size:.72rem">${T(`kerusi ${reg} dimenangi MUDA pada 2022`, `${reg} seats MUDA won in 2022`)}</div></div>`)
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
  const demo = currentRoll(seat)
  const lines = []
  const px = (v, d = 1) => v == null ? '–' : Number(v).toFixed(d) + '%'
  const nf = (v) => v == null ? '–' : Number(v).toLocaleString('en-MY')

  const e26 = seat.election2026 ?? {}
  const pollLine = e26.polling_date
    ? `Polling day: ${e26.polling_date}${e26.early_voting_date ? ` (early voting ${e26.early_voting_date})` : ''}.`
    : 'Election not yet called.'
  lines.push(`# PETA MUDA — AI Field Briefing: ${seat.code} ${seat.name} (${REGION_LABEL()} state election)`)
  lines.push(`Generated ${new Date().toISOString().slice(0, 10)} from official open data (ElectionData.MY CC0; data.gov.my/OpenDOSM CC BY 4.0). Data built: ${idx.built_at?.slice(0, 10) ?? '–'}. ${pollLine}`)
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
  lines.push(`You are the campaign field-intelligence assistant for the MUDA / Progressive Bloc team in ${seat.code} ${seat.name} at the ${REGION_LABEL()} state election. Follow these rules for every reply:

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

  // household context (no price data — the campaign message is MUDA's answers)
  if (seat.socio?.income?.length || seat.socio?.labour?.length) {
    lines.push('', '### Household context')
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
  if (jc?.undi18) {
    lines.push('', `### ${REGION_LABEL()} context`)
    lines.push(`- Undi18 footprint: ${nf(jc.undi18.total_18_20)} voters aged 18-20 statewide on the current roll${demo ? `; this seat: ${nf(demo.age.age_18_20)}` : ''}`)
  }

  lines.push('', '## DATA CAVEATS (assistant must respect these)')
  lines.push(`- Data snapshot is as of the build date above; the operator's ground reports are newer. Treat accordingly.
- MESSAGE DISCIPLINE: lead with MUDA's verified positions and commitments (the bright spot), with the local issue as context — never let the pitch become a list of national problems.
- Verify all facts before publishing campaign material. Quotes above are only usable verbatim with their source cited.`)

  return lines.join('\n')
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
    <button class="btn${vol ? ' secondary' : ''}" id="forkSearch">${T('Cari kerusi anda', 'Find your seat')}</button>
  </div>`
}

async function renderHome() {
  const idx = await loadIndex()
  const featured = idx.seats.filter(s => s.featured)

  const kicker = `${T('Pusat Data Kerusi DUN', 'Seat Data Center —')} ${REGION_LABEL()}`
  const featuredLabel = state.region === 'melaka'
    ? T('Kerusi tumpuan', 'Focus seats')
    : L('featured')
  const allLabel = `${T('Semua', 'All')} ${idx.seats.length} ${T('kerusi DUN', 'DUN seats')} ${REGION_LABEL()}`

  app.innerHTML = `
    <p class="kicker">${esc(kicker)}</p>
    ${heroFork(idx)}
    ${countdownCard(idx)}
    ${mudaHomeCard(idx)}
    ${mudaVoiceCard(idx)}

    <div class="card">
      <h2>${esc(featuredLabel)}</h2>
      <p class="sub">${esc((state.lang === 'bm' ? idx.election.name_bm : idx.election.name_en) ?? idx.election.name_bm ?? '')}</p>
      <div class="seat-grid">
        ${featured.map(s => `
          <a class="seat-card featured" href="#/seat/${s.slug}">
            <div class="code">${esc(s.code)} · ${esc(s.parlimen ?? '')}</div>
            <div class="name">${esc(s.name)}</div>
            ${s.muda_candidate ? `<div class="cand">${partyBadge(s.bloc_party)} ${esc(s.muda_candidate)}</div>` : ''}
            <div class="meta">${fmtNum(s.voters_total)} ${L('voters')} · ${fmtPct(s.youth_perc, 0)} ${L('youth')}${s.n_candidates_2026 ? ` · ${s.n_candidates_2026} ${L('candidates')}` : s.last_result?.majority_perc != null ? ` · ${T('majoriti', 'maj')} ${fmtPct(s.last_result.majority_perc, 1)}` : ''}</div>
          </a>`).join('')}
      </div>
    </div>

    <div class="card">
      <h2>${esc(allLabel)}</h2>
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
  renderFooter(idx)
}

// ---- about page (muda edition only): the two doorstep problems this app
// was built to answer, and how each feature maps to one of them. Plain
// prose, bilingual via T() — no L() keys, this content lives nowhere else.
async function renderAbout() {
  const idx = await loadIndex()
  if (idx.edition !== 'muda') { location.hash = '#/'; return }

  app.innerHTML = `
    <div class="crumbs"><a href="#/">← ${REGION_LABEL()}</a></div>
    <div class="card">
      <h2>${T('Tentang aplikasi ini', 'About this app')}</h2>
      <p class="sub">${T(
        'Peta MUDA dibina untuk dua masalah khusus di lapangan — bukan sebagai laman kempen am.',
        'Peta MUDA was built for two specific problems on the ground — not as a general campaign site.')}</p>
    </div>

    <div class="card">
      <h2>${T('Masalah 1: Sukarelawan tak cukup yakin', 'Problem 1: volunteers are willing, but not confident')}</h2>
      <ul class="points">
        <li>${T('<strong>Bukan masalah kesanggupan:</strong> MUDA ada ramai yang sanggup mengetuk pintu — yang kurang ialah orang yang rasa bersedia untuk mengetuk.', '<strong>Not a willingness problem:</strong> MUDA has plenty of people willing to knock on doors — what&rsquo;s missing is people who feel ready to.')}</li>
        <li>${T('<strong>Ujian di pintu:</strong> setiap perbualan berisiko ditanya soalan sukar di situ juga — &ldquo;apa yang salah di sini?&rdquo; atau &ldquo;apa pendirian MUDA tentang X?&rdquo; — dan perlukan jawapan benar dan khusus.', '<strong>The doorstep test:</strong> every conversation risks a hard question on the spot — &ldquo;what&rsquo;s gone wrong here?&rdquo; or &ldquo;what does MUDA think about X?&rdquo; — that needs a true, specific answer.')}</li>
        <li>${T('<strong>Tiada cara pantas untuk bersedia:</strong> tanpa fakta khusus kerusi di tangan, sukarelawan yang sanggup pun teragak-agak, kurang bersedia, atau tak turun padang.', '<strong>No fast way to prepare:</strong> without seat-specific facts on hand, willing volunteers hesitate, under-prepare, or don&rsquo;t go out at all.')}</li>
      </ul>
      <h3>${T('Cara aplikasi ini membantu', 'How the app addresses this')}</h3>
      <ul class="points">
        <li>${T('<strong>Ayat pembuka sedia ada:</strong> setiap halaman kerusi bermula dengan fakta paling tajam dan benar — majoriti tepat kerusi itu, dan berapa ramai pengundi muda melebihi majoriti itu.', '<strong>A ready opening line:</strong> every seat page leads with its sharpest true fact — the exact margin it was decided by, and how many young voters outnumber that margin.')}</li>
        <li>${T('<strong>Briefing yang dibina, bukan dihafal:</strong> setiap isu tempatan, isu kebangsaan dan babak cerita kempen bagi kerusi itu jadi senarai semak; tiga terkuat sudah ditanda, satu klik salin pilihan anda.', '<strong>A briefing you build, not memorise:</strong> every local issue, national issue, and campaign-story beat for that seat is a checklist; the three strongest are pre-selected, one tap copies your choice.')}</li>
        <li>${T('<strong>Tahu sejauh mana kukuh setiap fakta:</strong> setiap titik membawa taraf pengesahan — DISAHKAN, SEBAHAGIAN DISAHKAN, atau pengakuan jujur &ldquo;tiada pendirian disahkan&rdquo; — supaya anda tahu apa boleh dipertahankan.', '<strong>Know how solid each fact is:</strong> every point carries a verdict — VERIFIED, CONFIRMED, PARTLY CONFIRMED, or an honest &ldquo;no verified position&rdquo; — so you know what you can defend.')}</li>
        <li>${T('<strong>Persediaan lebih mendalam bila perlu:</strong> satu klik menjana briefing AI yang mengeksport dossier bersumber penuh kerusi itu untuk berlatih soalan sukar.', '<strong>Deeper prep on demand:</strong> a one-tap AI briefing exports the seat&rsquo;s full sourced dossier to rehearse tough questions.')}</li>
        <li>${T('<strong>Tiada apa perlu dihafal:</strong> semua ini ada dalam aplikasi, bukan dalam kepala anda — buka je di pintu.', '<strong>Nothing to memorise:</strong> all of this lives in the app, not in your head — open it at the door.')}</li>
      </ul>
    </div>

    <div class="card">
      <h2>${T('Masalah 2: Pengundi dah tak mahu buka pintu', 'Problem 2: voters have stopped opening the door for politics')}</h2>
      <ul class="points">
        <li>${T('<strong>Keletihan janji adalah rasional:</strong> bertahun-tahun janji parti yang tak bertahan selepas kerajaan dibentuk telah ajar orang untuk tak harap apa-apa yang baharu.', '<strong>Promise fatigue is rational:</strong> years of party promises that didn&rsquo;t survive contact with government have taught people to expect nothing new.')}</li>
        <li>${T('<strong>Refleksnya:</strong> sesiapa di pintu dianggap menjual manifesto lain yang akan berakhir sama seperti yang lepas — jadi pintu kekal tertutup.', '<strong>The reflex:</strong> whoever&rsquo;s at the door is assumed to be selling another manifesto that will age the same way as the last one — so the door stays shut.')}</li>
        <li>${T('<strong>Lebih banyak janji hanya memburukkan:</strong> walaupun ikhlas, ia cuma sahkan corak yang orang cuba elak.', '<strong>More promises make it worse:</strong> even sincere ones just confirm the exact pattern people are avoiding.')}</li>
      </ul>
      <h3>${T('Cara aplikasi ini membantu', 'How the app addresses this')}</h3>
      <ul class="points">
        <li>${T('<strong>Fakta, bukan janji:</strong> setiap kad menyatakan sesuatu yang benar-benar berlaku — potongan subsidi, banjir, angka gaji, majoriti undi — bukan janji.', '<strong>Facts, not promises:</strong> every card states something that happened — a subsidy cut, a flood, a wage figure, a vote margin — never a pledge.')}</li>
        <li>${T('<strong>Sandaran atau tiada langsung:</strong> pendirian MUDA hanya muncul dengan orang bernama, jawatan, tarikh dan sumber; jika tiada yang disahkan, aplikasi kata begitu dan bukan mereka-reka.', '<strong>Attribution or nothing:</strong> MUDA&rsquo;s position only appears with a named person, role, date, and source; where none is verified, the app says so rather than inventing one.')}</li>
        <li>${T('<strong>Kerusi ini, bukan skrip:</strong> setiap angka khusus untuk kerusi <em>ini</em> — majoritinya, sejarah banjirnya, tren pendapatannya — bukan mesej kebangsaan yang diulang di mana-mana.', '<strong>This seat, not a script:</strong> every number is specific to <em>this</em> seat — its margin, its flood history, its income trend — not a national talking point repeated everywhere.')}</li>
        <li>${T('<strong>Bukti berbanding janji:</strong> jika MUDA mengaku kredit, ia untuk sesuatu yang sudah dibuat dan boleh disahkan secara bebas, seperti dana bantuan banjir yang diaudit.', '<strong>Proof over promises:</strong> where MUDA claims credit, it&rsquo;s for something already done and independently checkable, like an audited flood-relief fund.')}</li>
        <li>${T('<strong>Logistik, bukan pujukan:</strong> kandungan keluar mengundi tentang pusat mengundi dan sedekat mana kerusi ini sebenarnya — bukan jualan.', '<strong>Logistics, not persuasion:</strong> get-out-the-vote content is about polling stations and how close the seat really is — not a sales pitch.')}</li>
      </ul>
      <h3>${T('Sebelum pintu, bukan hanya di pintu', 'Before the door, not just at it')}</h3>
      <ul class="points">
        <li>${T('<strong>Poster dengan angka sebenar:</strong> dibina untuk dikongsi di WhatsApp, tunjuk fakta kerusi itu sendiri, bukan slogan.', '<strong>A poster with real numbers:</strong> built to share on WhatsApp, showing this seat&rsquo;s own facts, not a slogan.')}</li>
        <li>${T('<strong>Dihantar oleh orang dipercayai:</strong> daripada jiran atau kawan berbanding orang asing, ia dibaca sebagai sesuatu yang seorang dipercayai pilih untuk kongsi.', '<strong>Sent by someone you trust:</strong> from a neighbour or friend rather than a stranger, it reads as something a trusted person chose to share.')}</li>
        <li>${T('<strong>Kekalkan ia peribadi:</strong> paling berkesan bila dihantar kepada orang yang sukarelawan benar-benar kenal — menyebar kepada orang asing hanya mencipta semula keletihan yang cuba dielakkan.', '<strong>Keep it personal:</strong> works best sent to people volunteers actually know — mass-forwarding to strangers just recreates the fatigue it&rsquo;s meant to avoid.')}</li>
      </ul>
    </div>

    <div class="btn-row">
      <a class="btn secondary" href="#/">← ${T('Kembali ke halaman utama', 'Back to the main page')}</a>
    </div>`

  renderFooter(idx)
}

// ---- volunteer script hub (muda edition only): find your seat, copy its
// door-knocking script in one tap — no DUN code, no digging through tabs. The
// interactive AI briefing lives on each seat's Field tab for those who want it.
async function renderVolunteer() {
  const idx = await loadIndex()
  if (idx.edition !== 'muda') { location.hash = '#/'; return }

  app.innerHTML = `
    <div class="crumbs"><a href="#/">← ${REGION_LABEL()}</a></div>
    <div class="card">
      <h2>${L('volunteer_title')}</h2>
      <p class="sub">${L('volunteer_sub')}</p>
      <input class="searchbox" id="volSearch" placeholder="${L('search')}" autocomplete="off">
      <div class="seat-list" id="volList"></div>
      <p class="sub" style="margin-top:.6rem;color:var(--muted)">${T('Nak bantuan AI? Buka tab Lapangan kerusi anda.', 'Want AI help? Open your seat’s Field tab.')}</p>
    </div>
    <div class="btn-row">
      <a class="btn secondary" href="#/">← ${T('Kembali ke halaman utama', 'Back to the main page')}</a>
    </div>`

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
          <a class="btn" href="#/seat/${esc(s.slug)}/field">${T('Bina skrip', 'Build script')}</a>
        </span>
      </div>`).join('') : `<p class="sub">${L('volunteer_none')}</p>`
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

// Render a socio series as a compact trend: v1 → v2 → v3, latest bolded.
// One point → the bolded value alone; empty → ''. Powers the income-vs-
// spending squeeze — most seats' income actually recovered by 2024, so the
// honest story is the two series climbing together, with the caption noting
// the 2025-26 fuel/SST shock landed after this data.
function socioTrend(arr, field, fmt) {
  const pts = (arr ?? []).filter(r => r?.[field] != null)
  if (!pts.length) return ''
  return pts.map((r, i) => {
    const v = fmt(r[field])
    return i === pts.length - 1 ? `<strong>${v}</strong>` : v
  }).join(' <span class="arrow">→</span> ')
}

function incomeCard(seat, idx) {
  const incArr = seat.socio.income ?? []
  const expArr = seat.socio.expenditure ?? []
  const inc = incArr.at(-1)
  const pov = seat.socio.poverty?.at(-1)
  const gin = seat.socio.inequality?.at(-1)
  const labArr = seat.socio.labour ?? []
  const lab = labArr.at(-1)
  const labPrev = labArr.length >= 2 ? labArr.at(-2) : null
  if (!inc && !lab) return ''
  const rm = (v) => `RM${fmtNum(v)}`
  const incTrend = socioTrend(incArr, 'income_median', rm)
  const expTrend = socioTrend(expArr, 'expenditure', rm)
  const yN = inc?.date?.slice(0, 4)
  const years = incArr.map(r => r.date?.slice(0, 4)).join(' \u2192 ')
  // real-terms: deflate every nominal income point into base-year ringgit (CPI,
  // idx.cpi_deflator) so the trend is apples-to-apples. Where prices outran pay
  // the real line ends below where it began — the honest 'getting worse' story.
  const def = idx.cpi_deflator
  const y0 = incArr[0]?.date?.slice(0, 4)
  const m0 = def?.mult?.[y0]
  const canReal = incArr.length >= 2 && def && m0 && inc?.income_median != null && incArr[0]?.income_median != null
  const realRow = canReal
    ? socioTrend(incArr.map(r => ({ real: Math.round(r.income_median * (def.mult[r.date?.slice(0, 4)] ?? 1)) })), 'real', rm)
    : ''
  let realNote = ''
  if (canReal) {
    const realFirst = incArr[0].income_median * m0
    const d = Math.round((inc.income_median - realFirst) / realFirst * 100)
    const cum = ((m0 - 1) * 100).toFixed(1)
    realNote = T(
      ` Selepas inflasi (CPI +${cum}% sejak ${y0}): pendapatan benar ${d > 0 ? 'naik' : 'turun'} ${Math.abs(d)}%.`,
      ` After inflation (CPI +${cum}% since ${y0}): real household income ${d > 0 ? 'up' : 'down'} ${Math.abs(d)}%.`,
      ` \u7ecf\u901a\u80c0\u8c03\u6574\uff08CPI \u81ea${y0}\u5e74 +${cum}%\uff09\uff1a\u5b9e\u8d28\u6536\u5165${d > 0 ? '\u4e0a\u5347' : '\u4e0b\u964d'} ${Math.abs(d)}%\u3002`)
  }
  // growth vs 2019 — the pre-COVID anchor. 2022 was the pandemic trough, so a
  // 2022 baseline overstates recovery as growth; 2019 is the honest comparison.
  const r2019 = incArr.find(r => r.date?.slice(0, 4) === '2019')
  let growthRow = ''
  if (r2019?.income_median != null && inc?.income_median != null && r2019 !== inc) {
    const g = Math.round((inc.income_median - r2019.income_median) / r2019.income_median * 100)
    growthRow = `${g > 0 ? '+' : ''}${g}%`
  }
  // this seat's median vs the national + state median (nearest common HIES year).
  const bm = idx.income_benchmarks
  let benchRow = ''
  if (bm && inc?.income_median != null) {
    const natB = bm.national ?? {}
    const stB = bm.state?.[state.region] ?? {}
    const common = Object.keys(natB).filter(y => stB[y] != null).map(Number)
    if (common.length) {
      const seatY = Number(yN)
      const by = common.sort((a, b) => Math.abs(a - seatY) - Math.abs(b - seatY))[0]
      const natPct = Math.round(inc.income_median / natB[by] * 100)
      const stPct = Math.round(inc.income_median / stB[by] * 100)
      const yrTag = by !== seatY ? ` (${by})` : ''
      benchRow = `${natPct}% ${T('nasional', 'national', '全国')} \u00b7 ${stPct}% ${REGION_LABEL()}${yrTag}`
    }
  }
  const note = incArr.length >= 2
    ? T(
      `HIES DOSM \u00b7 ${years} (nilai nominal). Kejutan petrol tanpa subsidi & SST melanda 2025-26 \u2014 selepas data ini.`,
      `DOSM HIES \u00b7 ${years} (nominal). The unsubsidised-fuel & SST shock hit in 2025-26 \u2014 after this data.`,
      `HIES DOSM \u00b7 ${years}\uff08\u540d\u4e49\u503c\uff09\u3002\u65e0\u6d25\u8d34\u6cb9\u4ef7\u4e0e SST \u51b2\u51fb\u53d1\u751f\u4e8e 2025-26 \u5e74 \u2014 \u5728\u6b64\u6570\u636e\u4e4b\u540e\u3002`) + realNote
    : (inc ? L('income_note', yN) : '')
  return `<div class="card">
    <h2>${L('income_ctx')}</h2>
    ${note ? `<p class="sub">${note}</p>` : ''}
    <table class="data"><tbody>
      ${incTrend ? `<tr><td>${L('income_median')}</td><td class="num">${incTrend}</td></tr>` : ''}
      ${realRow ? `<tr><td>${L('income_real')}</td><td class="num">${realRow}</td></tr>` : ''}
      ${growthRow ? `<tr><td>${L('income_growth')}</td><td class="num">${growthRow}</td></tr>` : ''}
      ${benchRow ? `<tr><td>${L('income_vs')}</td><td class="num">${benchRow}</td></tr>` : ''}
      ${expTrend ? `<tr><td>${L('spending')}</td><td class="num">${expTrend}</td></tr>` : ''}
      ${pov ? `<tr><td>${L('poverty')}</td><td class="num">${fmtPct(pov.poverty ?? pov.poverty_absolute)}</td></tr>` : ''}
      ${gin ? `<tr><td>${L('gini')}</td><td class="num">${(gin.gini ?? '\u2013')}</td></tr>` : ''}
      ${lab ? `<tr><td>${L('u_rate')} (${lab.date?.slice(0, 4)})</td><td class="num">${fmtPct(lab.u_rate)}${labPrev ? ` <span style="color:var(--muted)">(${labPrev.date?.slice(0, 4)}: ${fmtPct(labPrev.u_rate)})</span>` : ''}</td></tr>` : ''}
    </tbody></table>
  </div>`
}

// WhatsApp-ready plain-text talking points — one-tap value for volunteers who
// won't paste anything into an AI chat. Mirrors the Field card's groups and
// keeps every MUDA answer's attribution (who, role, year, source URL).
// The volunteer briefing text: header, the SELECTED points grouped under
// their section headers, seat link. selected = Set of "gi:pi" keys; null = all.
function tpText(seat, idx, selected = null) {
  const lines = [`📍 ${seat.code} ${seat.name} — ${T('skrip rumah ke rumah', 'door-knocking script', '逐户拜访要点')}`]
  talkingPoints(seat, idx).forEach((g, gi) => {
    const pts = g.pts.filter((_, pi) => !selected || selected.has(`${gi}:${pi}`))
    if (!pts.length) return
    lines.push('', `— ${g.title.toUpperCase()} —`)
    lines.push(...pts.map(p => `• ${p.text}`))
  })
  lines.push('', `${location.origin}${location.pathname}#/seat/${seat.slug}`)
  return lines.join('\n')
}

// Default pick: the lead point of each group (groups are sorted strongest-
// first), topped up in flat order until 3 — fewer only when the seat has <3.
function tpDefaultPicks(groups) {
  const picks = new Set()
  groups.forEach((g, gi) => { if (g.pts.length && picks.size < 3) picks.add(`${gi}:0`) })
  for (let gi = 0; gi < groups.length && picks.size < 3; gi++) {
    for (let pi = 0; pi < groups[gi].pts.length && picks.size < 3; pi++) picks.add(`${gi}:${pi}`)
  }
  return picks
}

// Wire the Field tab's briefing builder: checkbox changes re-render the
// preview; copy puts exactly the previewed text on the clipboard.
function bindTpBuilder(seat, idx) {
  const box = document.getElementById('tpBuilder')
  if (!box) return
  const preview = document.getElementById('tpPreview')
  const update = () => {
    const sel = new Set([...box.querySelectorAll('input[type="checkbox"]:checked')].map(i => i.dataset.k))
    preview.textContent = tpText(seat, idx, sel)
  }
  box.querySelectorAll('input[type="checkbox"]').forEach(i => i.addEventListener('change', update))
  update()
  const btn = document.getElementById('tpCopy')
  btn?.addEventListener('click', async () => {
    const ok = await copyToClipboard(preview.textContent)
    if (!ok) { window.prompt('Salin / Copy:', preview.textContent); return }
    const orig = btn.textContent
    btn.textContent = L('copied')
    setTimeout(() => { btn.textContent = orig }, 2000)
  })
}



// The conversion step right under the pitch: one tap to check your register
// entry on MySPR Semak, one tap to bring someone along. Gone once polls close.
function gotvCard(seat) {
  const e = seat.election2026
  if (!e?.polling_date) return ''
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const days = Math.round((new Date(`${e.polling_date}T00:00:00`) - today) / 86400e3)
  if (days < 0) return ''
  const early = e.early_voting_date ? new Date(`${e.early_voting_date}T00:00:00`) : null
  const pollStr = new Date(`${e.polling_date}T00:00:00`)
    .toLocaleDateString(state.lang === 'bm' ? 'ms-MY' : 'en-MY', { weekday: 'long', day: 'numeric', month: 'long' })
  let head
  if (days === 0) head = L('gotv_today')
  else if (early && today >= early) head = L('gotv_early', pollStr)
  else head = L('gotv_soon', days, pollStr)
  const waText = L('gotv_wa', seat.name, pollStr,
    `${location.origin}${location.pathname}#/seat/${seat.slug}`)
  return `<div class="card accent">
    <h2>${L('gotv_title')}</h2>
    <p class="hero-line"><strong>${esc(head)}</strong></p>
    <p class="sub">${L('gotv_logistics')}</p>
    <div class="btn-row">
      <a class="btn" href="https://mysprsemak.spr.gov.my/semakan/daftarPemilih" target="_blank" rel="noopener">${L('gotv_check')}</a>
      <a class="btn wa" href="https://wa.me/?text=${encodeURIComponent(waText)}" target="_blank" rel="noopener">${L('gotv_invite')}</a>
    </div>
  </div>`
}

// Shareable poster per seat: seat-specific where one exists, else the state
// poster — so every seat page has a one-tap WhatsApp-ready download.
const SEAT_POSTERS = {
  'n51-bukit-batu': 'bukit-batu.png',
  'n15-maharani': 'maharani.png',
  'n41-puteri-wangsa': 'puteri-wangsa.png',
}
function posterCard(seat) {
  const base = SEAT_POSTERS[seat.slug] ?? (state.region === 'melaka' ? 'melaka.png' : 'johor.png')
  // posters are pre-rendered PNGs (no live text), so the file itself must
  // match the site language — LANGS is bm/en only, EN files carry a -en suffix.
  const file = state.lang === 'en' ? base.replace('.png', '-en.png') : base
  return `<div class="card">
    <img class="poster-img" src="posters/${file}" alt="Poster ${esc(seat.name)}" loading="lazy">
    <div class="btn-row">
      <a class="btn secondary" href="posters/${file}" download>${T('Muat turun poster', 'Download poster')}</a>
    </div>
  </div>`
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
    ...(li.statewide ?? []).map(it => ({ it, scope: 'state' })),
    ...(idx?.national_issues ?? []).map(it => ({ it, scope: 'national' })),
  ]
  // each MUDA stance is attached only to the FIRST issue carrying its theme —
  // two flood stories must not repeat the identical answer word for word
  const usedThemes = new Set()
  return entries.map(({ it, scope }) => {
    const lead = leadClause(bm ? (it.issue_bm ?? it.issue_en) : (it.issue_en ?? it.issue_bm))
    const t = (seat.muda_stances ?? []).find(s => s.key === it.theme)
    let stance = null
    if (t && t.verdict !== 'NO_VERIFIED_POSITION' && !usedThemes.has(t.key)) {
      usedThemes.add(t.key)
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

// MUDA-first rendering: the point IS what MUDA is saying (attributed); the
// local issue is the context underneath it, not the headline. Issues with no
// verified MUDA position keep the old issue-led shape and sort last.
function issuePointHtml(e) {
  const q = e.stance?.quote
  const quoteHtml = q
    ? `<br>“${esc(q.text)}” — <strong>${esc(q.who)}</strong>, ${esc(q.role)} (${esc(q.year)})${q.source ? ` <a href="${esc(q.source)}" target="_blank" rel="noopener" style="color:var(--muted)">[${T('sumber', 'source', '来源')}]</a>` : ''}`
    : ''
  const tag = e.ground ? `<span class="badge" style="background:var(--lain);font-size:.6rem">${GROUND_LABEL()}</span> ` : ''
  if (e.stance) {
    return `${tag}<strong>MUDA:</strong> ${esc(e.stance.lead)}` +
      `<br><span style="color:var(--muted);font-size:.82rem">${T('Isu di sini', 'The issue here', '本地问题')}: ${esc(e.lead)}${quoteHtml}</span>`
  }
  return `${tag}${esc(e.lead)}`
}

function issuePointText(e) {
  const q = e.stance?.quote
  if (!e.stance) return e.ground ? `[${GROUND_LABEL()}] ${e.lead}` : e.lead
  let s = `MUDA: ${e.stance.lead}`
  s += `\n  ${T('Isu di sini', 'The issue here', '本地问题')}: ${e.ground ? `[${GROUND_LABEL()}] ` : ''}${e.lead}`
  if (q) s += `\n  “${q.text}” — ${q.who}, ${q.role} (${q.year})${q.source ? `\n  ${q.source}` : ''}`
  return s
}

// Door-knocking points, grouped and prioritized: what MUDA is saying about
// this seat's grounded LOCAL issues first, its NATIONAL commitments second,
// campaign targeting facts last. Points with a verified MUDA answer sort
// before issue-only points — the script sells the solution, not the problem.
// Each point is { html, text } so the Field card and WhatsApp copy stay in
// lockstep.
function talkingPoints(seat, idx) {
  const bm = state.lang === 'bm'
  const pt = (html, text) => ({ html, text: text ?? htmlToText(html) })
  const issues = issueAnswers(seat, idx)
  const withAnswerFirst = (a, b) => (b.stance ? 1 : 0) - (a.stance ? 1 : 0)
  const issuePt = (e) => pt(issuePointHtml(e), issuePointText(e))

  const local = issues.filter(e => e.scope !== 'national').sort(withAnswerFirst).map(issuePt)
  const national = issues.filter(e => e.scope === 'national').sort(withAnswerFirst).map(issuePt)

  const kempen = []
  const demo = currentRoll(seat)
  const ge15 = priorRoll(seat)
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

  const beats = storyFor(seat, idx).map(b =>
    pt(`<strong>${esc(b.title)}:</strong> ${b.text}`,
      `${b.title}: ${htmlToText(b.text.replace(/<br\s*\/?>/g, ' · '))}`))

  return [
    { title: T('Tempatan', 'Local', '本地'), pts: local },
    { title: T('Nasional', 'National', '全国'), pts: national },
    { title: T('Fakta kempen', 'Campaign facts', '竞选数据'), pts: kempen },
    { title: T('Cerita kempen', 'Campaign story', '竞选叙事'), pts: beats },
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

// The prioritized campaign narrative (up to 5 guarded beats): one story a candidate can carry, ordered
// by what wins the seat — path, people, message, ground, ask. Every number is
// pulled from the same verified data as the sections below it.
// The punchy head of a curated issue string for a one-line doorstep message:
// the clause before the first " — ", trimmed to a sentence / ~140 chars. Full
// receipts and sources stay in the AI briefing (briefingMd).
function leadClause(text) {
  if (!text) return ''
  const head = text.split(' — ')[0].trim()
  if (head.length <= 140) return head
  const m = head.match(/^.*?[.!?](?=\s|$)/)
  const sent = m ? m[0].trim() : head
  return sent.length <= 140 ? sent : head.slice(0, 137).trimEnd() + '…'
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
  const demo = currentRoll(seat)
  const ge15 = priorRoll(seat)
  if (demo) {
    const youthN = demo.age.age_18_20 + demo.age.age_21_29
    const youthP = Math.round(100 * youthN / demo.voters_total)
    const newV = ge15 && demo.voters_total > ge15.voters_total ? demo.voters_total - ge15.voters_total : null
    beats.push({
      title: L('beat_voters'),
      text: bm
        ? `<strong>${fmtNum(youthN)}</strong> pengundi bawah 30 (${youthP}% daftar semasa)${newV ? `, termasuk <strong>${fmtNum(newV)}</strong> pengundi baharu sejak PRU15` : ''}.`
        : `<strong>${fmtNum(youthN)}</strong> voters under 30 (${youthP}% of the roll)${newV ? `, including <strong>${fmtNum(newV)}</strong> new voters since GE15` : ''}.`,
    })
  }

  // 3 — the doorstep message, MUDA-first: lead with the party's attributed
  // answer, the issue as its context. Local before national. Issues with no
  // verified position fall back to the issue line alone (never a non-position).
  const localIssue = seat.local_issues?.seat?.[0] ?? seat.local_issues?.statewide?.[0] ?? null
  const nationalIssue = idx.national_issues?.[0] ?? null
  if (localIssue || nationalIssue) {
    const section = (label, issue) => {
      if (!issue) return ''
      const lead = leadClause(bm ? (issue.issue_bm ?? issue.issue_en) : (issue.issue_en ?? issue.issue_bm))
      const t = (seat.muda_stances ?? []).find(s => s.key === issue.theme)
      if (t && t.verdict !== 'NO_VERIFIED_POSITION') {
        const stanceLead = leadClause(pick(t, 'stance'))
        const qs = t.quotes ?? []
        const q = qs.find(x => x.lang === state.lang) ?? qs[0]
        const quoteHtml = q
          ? `<br><span style="color:var(--muted);font-size:.82rem">“${esc(q.text)}” — <strong>${esc(q.who)}</strong>, ${esc(pick(q, 'role'))} (${esc((q.date ?? '').slice(0, 4))})${q.source ? ` <a href="${esc(q.source)}" target="_blank" rel="noopener" style="color:var(--muted)">[${T('sumber', 'source', '来源')}]</a>` : ''}</span>`
          : ''
        return `<strong>${label} — MUDA:</strong> ${esc(stanceLead)}<br><span style="color:var(--muted);font-size:.82rem">${T('Isu di sini', 'The issue here', '本地问题')}: ${esc(lead)}</span>${quoteHtml}`
      }
      return `<strong>${label}:</strong> ${esc(lead)}`
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
        ? `Undi awal <strong>7 Julai</strong> · hari mengundi <strong>11 Julai</strong>. Setiap penyokong yang dikenal pasti di lapangan: pastikan mereka tahu pusat mengundi dan ada pengangkutan.`
        : `Early voting <strong>7 July</strong> · polling day <strong>11 July</strong>. For every supporter you've identified on the ground: make sure they know their polling centre and have a ride.`,
    })
  }
  return beats
}



function renderField(seat, idx) {
  const pts = talkingPoints(seat, idx)
  const picks = tpDefaultPicks(pts)
  return `
    ${gotvCard(seat)}
    ${posterCard(seat)}
    <div class="card" id="tpBuilder">
      <h2>${L('talking_points')}</h2>
      <p class="sub">${L('tp_sub')}</p>
      ${pts.map((g, gi) => `<h3>${esc(g.title)}</h3><ul class="points tp-pick">${g.pts.map((p, pi) => `<li><label><input type="checkbox" data-k="${gi}:${pi}" ${picks.has(`${gi}:${pi}`) ? 'checked' : ''}> <span>${p.html}</span></label></li>`).join('')}</ul>`).join('')}
      <h3>${T('Pratonton briefing anda', 'Your briefing preview', '简报预览')}</h3>
      <pre class="tp-preview" id="tpPreview"></pre>
      <div class="btn-row"><button class="btn" id="tpCopy">${T('Salin briefing', 'Copy briefing', '复制简报')}</button></div>
    </div>
    ${groundNotesCard(seat)}
    ${idx.edition === 'muda' ? `<div class="btn-row"><button class="btn" id="briefBtn">${L('brief_btn')}</button></div>` : ''}`
}

// voter demographics (analyst form factor — lives on the Analisis tab)
function demoCard(seat) {
  const demo = currentRoll(seat)
  if (!demo) return ''
  const ageBands = [['18–20', demo.age.age_18_20], ['21–29', demo.age.age_21_29], ['30–39', demo.age.age_30_39], ['40–49', demo.age.age_40_49], ['50–59', demo.age.age_50_59], ['60–69', demo.age.age_60_69], ['70+', demo.age.age_70_79 + demo.age.age_80_89 + demo.age['age_90+']]]
  const maxAge = Math.max(...ageBands.map(a => a[1]))
  // ethnicity is absent on rolls sourced from the vote-count mirror (Melaka) —
  // render the age bars alone rather than crash
  const e = demo.ethnic
  let ethHtml = ''
  if (e) {
    const eth = [[T('Melayu', 'Malay'), e.ethnic_malay], [T('Cina', 'Chinese'), e.ethnic_chinese], [T('India', 'Indian'), e.ethnic_indian], [T('Lain-lain', 'Others'), e.ethnic_bumi_sabah + e.ethnic_bumi_sarawak + e.ethnic_orang_asli + e.ethnic_other]]
    const maxEth = Math.max(...eth.map(a => a[1]))
    ethHtml = `<h3>${L('ethnic_dist')}</h3>
      ${eth.map(([lbl, v]) => barRow(lbl, 100 * v / maxEth, fmtPct(100 * v / demo.voters_total, 0))).join('')}`
  } else if (seat.census_ethnic) {
    // Melaka rolls publish no ethnicity — fall back to the DOSM census
    // population split, clearly labelled so it is never read as the roll.
    const c = seat.census_ethnic
    const eth = [[T('Bumiputera', 'Bumiputera'), c.bumi], [T('Cina', 'Chinese'), c.chinese], [T('India', 'Indian'), c.indian], [T('Lain-lain', 'Others'), c.other]]
      .filter(([, v]) => v != null)
    if (eth.length) {
      const maxEth = Math.max(...eth.map(a => a[1]))
      ethHtml = `<h3>${T(`Etnik (banci ${c.year} — penduduk, bukan daftar pemilih)`, `Ethnicity (${c.year} census — population, not the electoral roll)`, `\u65cf\u7fa4\uff08${c.year} \u5e74\u4eba\u53e3\u666e\u67e5 \u2014 \u975e\u9009\u6c11\u518c\uff09`)}</h3>
        ${eth.map(([lbl, v]) => barRow(lbl, 100 * v / maxEth, fmtPct(v, 0))).join('')}`
    }
  }
  const rollSub = `${esc(demo.election ?? '')} ${T('daftar pemilih', 'roll')} — ElectionData.MY`
  return `<div class="card">
    <h2>${L('demo_title')}</h2>
    <p class="sub">${rollSub} · ${fmtNum(demo.voters_total)} ${L('voters')} · ${fmtPct(100 * demo.sex_female / demo.voters_total, 0)} ${L('women')}</p>
    <h3>${L('age_dist')}</h3>
    ${ageBands.map(([lbl, v]) => barRow(lbl, 100 * v / maxAge, fmtPct(100 * v / demo.voters_total, 0))).join('')}
    ${ethHtml}
  </div>`
}

function renderHq(seat, idx) {
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

  return `${contestCard(seat)}${incomeCard(seat, idx)}${histHtml}${salHtml}${demoCard(seat)}
    <div class="card">
      <h2>${L('export')}</h2>
      <div class="btn-row">
        <a class="btn secondary" href="data/seats/${seat.slug}.json" download>${L('export_json')}</a>
        <button class="btn secondary" id="csvBtn">${L('export_csv')}</button>
      </div>
    </div>`
}

async function renderSeat(slug, tab = 'field') {
  if (tab === 'brief') tab = 'field' // Brief tab retired; legacy links land on Field
  let idx = await loadIndex()
  // Shared links must just work: slugs are unique across regions, so a seat
  // that isn't in the current region's index belongs to the other region —
  // switch in place (same resets as setRegion, minus the jump to home).
  if (!idx.seats.some(s => s.slug === slug)) {
    const other = state.region === 'melaka' ? 'johor' : 'melaka'
    const otherDir = other === 'melaka' ? 'data/melaka/' : 'data/'
    const otherIdx = await (await fetch(`${otherDir}index.json`)).json()
    if (!otherIdx.seats.some(s => s.slug === slug)) throw new Error(`unknown seat ${slug}`)
    state.region = other
    storage.set('region', other)
    state.index = otherIdx; state.seats = new Map(); state.geo = null
    storage.set('last_seat', '')
    syncStateToggle()
    idx = otherIdx
  }
  const seat = await loadSeat(slug)
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
        <div class="crumbs"><a href="#/">← ${REGION_LABEL()}</a> · ${esc(seat.parlimen ?? '')}</div>
        <h1><span class="monogram">${esc(seat.code)}</span> ${esc(seat.name)}</h1>
        <div class="crumbs">${fmtNum(seat.election2026?.voters_total)} ${L('voters')}</div>
      </div>
    </div>
    <div class="tabs">
      <button data-tab="field" class="${tab === 'field' ? 'active' : ''}">${L('tab_field')}</button>
      <button data-tab="hq" class="${tab === 'hq' ? 'active' : ''}">${L('tab_hq')}</button>
    </div>
    <div id="tabContent"></div>
    <div class="btn-row" style="margin-top:20px">
      <a class="btn secondary" href="#/">← ${T('Kembali ke halaman utama', 'Back to the main page')}</a>
    </div>`

  const content = document.getElementById('tabContent')
  const renderTab = () => {
    content.innerHTML = tab === 'hq' ? renderHq(seat, idx) : renderField(seat, idx)
    if (tab !== 'hq') { bindGroundNotes(seat, renderTab); bindTpBuilder(seat, idx) }
  }
  renderTab()

  document.querySelectorAll('.tabs button').forEach(btn =>
    btn.addEventListener('click', () => { location.hash = `#/seat/${slug}/${btn.dataset.tab}` }))

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
    if (m) await renderSeat(m[1], m[2] ?? 'field')
    else if (hash === '#/volunteer') await renderVolunteer()
    else if (hash === '#/about') await renderAbout()
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

// state (region) toggle: Johor ↔ Melaka
const stateToggle = document.getElementById('stateToggle')
const syncStateToggle = () => {
  stateToggle?.querySelectorAll('button').forEach(b => {
    const on = b.dataset.state === state.region
    b.classList.toggle('active', on)
    b.setAttribute('aria-pressed', on ? 'true' : 'false')
  })
}
stateToggle?.querySelectorAll('button').forEach(b =>
  b.addEventListener('click', () => setRegion(b.dataset.state)))
syncStateToggle()

window.addEventListener('hashchange', route)
route()

// ---------- PWA ----------
// We deliberately do NOT register a service worker: an earlier caching SW kept
// pinning stale builds to devices. sw.js is now a self-destruct worker that any
// device with the old SW still installed will pick up on its next update check,
// wiping itself + its caches so the app loads fresh from the network from then
// on. (A correct offline SW can be reintroduced later at a NEW path.)
