// Peta MUDA ops — hidden intake admin page (BM-first, mobile-first).
// Volunteers WhatsApp stories to admins; admins paste them here; the crawler
// drops news drafts into the same queue. Approving an item publishes it on
// the next site rebuild, auto-paired with MUDA's stance via its theme.
import { THEME_KEYWORDS, suggestTheme, buildSeatMatcher } from './ops-match.mjs'

const OPS = window.OPS ?? {}
const root = document.getElementById('ops')
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const pass = () => localStorage.getItem('ops_pass') ?? ''

const THEME_OPTIONS = THEME_KEYWORDS.map(([k]) => k)
let seats = []
let suggestSeats = () => []

async function rpc(fn, args) {
  const r = await fetch(`${OPS.url.replace(/\/$/, '')}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: OPS.anonKey, Authorization: `Bearer ${OPS.anonKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  })
  if (!r.ok) throw new Error(`${fn}: ${(await r.text()).slice(0, 180)}`)
  const text = await r.text()
  return text ? JSON.parse(text) : null
}

const themeSelect = (id, value) => `<select id="${id}">
  <option value="">— tiada tema (tiada padanan MUDA) —</option>
  ${THEME_OPTIONS.map(k => `<option value="${k}"${k === value ? ' selected' : ''}>${k}</option>`).join('')}
</select>`

const seatOptions = (selected = []) => seats.map(s =>
  `<option value="${esc(s.code)}"${selected.includes(s.code) ? ' selected' : ''}>${esc(s.code)} ${esc(s.name)}</option>`).join('')

function loginView(msg = '') {
  root.innerHTML = `<div class="card">
    <h2>Peta MUDA — Ops</h2>
    <p class="sub">Halaman admin. Masukkan kata laluan pasukan.</p>
    ${msg ? `<p class="err">${esc(msg)}</p>` : ''}
    <input type="password" id="pw" placeholder="Kata laluan">
    <div class="btn-row"><button class="btn" id="loginBtn">Masuk</button></div>
  </div>`
  document.getElementById('loginBtn').addEventListener('click', async () => {
    localStorage.setItem('ops_pass', document.getElementById('pw').value.trim())
    try { await rpc('intake_list', { p_pass: pass(), p_status: 'draft' }); main('pending') }
    catch { loginView('Kata laluan salah atau sambungan gagal.') }
  })
}

async function pendingView(el) {
  el.innerHTML = '<p class="sub">Memuatkan…</p>'
  let rows
  try { rows = await rpc('intake_list', { p_pass: pass(), p_status: 'draft' }) }
  catch (e) { el.innerHTML = `<p class="err">${esc(e.message)}</p>`; return }
  if (!rows.length) { el.innerHTML = '<p class="sub">Tiada cerita menunggu. Semua sudah disemak ✓</p>'; return }
  el.innerHTML = rows.map(r => `
    <div class="card" data-id="${esc(r.id)}">
      <span class="badge ${r.kind === 'news' ? 'kind-news' : 'kind-ground'}">${r.kind === 'news' ? 'BERITA' : 'LAPANGAN'}</span>
      <span style="color:var(--muted);font-size:.72rem"> ${esc((r.created_at ?? '').slice(0, 16).replace('T', ' '))}</span>
      <p class="item-text">${esc(r.text_bm)}</p>
      ${r.source_url ? `<p style="font-size:.75rem"><a href="${esc(r.source_url)}" target="_blank" rel="noopener">${esc(r.source_name ?? r.source_url)}</a></p>` : ''}
      <label>Tema (padanan jawapan MUDA)</label>
      ${themeSelect(`theme-${r.id}`, r.theme)}
      <label>Kerusi (kosong = seluruh Johor)</label>
      <select id="seats-${r.id}" multiple size="4">${seatOptions(r.seat_codes ?? [])}</select>
      <div class="btn-row">
        <button class="btn" data-approve="${esc(r.id)}">✓ Lulus &amp; siarkan</button>
        <button class="btn secondary" data-reject="${esc(r.id)}">✗ Tolak</button>
      </div>
    </div>`).join('')
  el.querySelectorAll('[data-approve]').forEach(b => b.addEventListener('click', () => setStatus(b.dataset.approve, 'approved', b)))
  el.querySelectorAll('[data-reject]').forEach(b => b.addEventListener('click', () => setStatus(b.dataset.reject, 'rejected', b)))
}

async function setStatus(id, status, btn) {
  btn.disabled = true
  const theme = document.getElementById(`theme-${id}`)?.value || null
  const seatsSel = [...(document.getElementById(`seats-${id}`)?.selectedOptions ?? [])].map(o => o.value)
  try {
    await rpc('intake_set_status', { p_pass: pass(), p_id: id, p_status: status, p_theme: theme, p_seat_codes: seatsSel })
    const card = document.querySelector(`[data-id="${id}"]`)
    card.innerHTML = `<p class="${status === 'approved' ? 'ok' : 'sub'}">${status === 'approved' ? '✓ Diluluskan — akan tersiar pada kemas kini berikutnya (dalam ~4 jam).' : 'Ditolak.'}</p>`
  } catch (e) { btn.disabled = false; alert(e.message) }
}

function addView(el) {
  el.innerHTML = `<div class="card">
    <p class="sub">Tampal cerita daripada WhatsApp sukarelawan. Tema dan kerusi dicadang automatik — betulkan jika perlu.</p>
    <label>Cerita (BM)</label>
    <textarea id="story" placeholder="Contoh: Penduduk Taman Universiti mengadu bekalan air terputus 3 hari…"></textarea>
    <label>Tema</label>
    <div id="themeBox">${themeSelect('theme-new', null)}</div>
    <label>Kerusi (boleh pilih lebih satu; kosong = seluruh Johor)</label>
    <select id="seats-new" multiple size="5">${seatOptions()}</select>
    <label>Pautan sumber (jika ada)</label>
    <input type="text" id="src" placeholder="https://…">
    <div class="btn-row" style="margin-top:14px">
      <button class="btn" id="submitDraft">Hantar ke senarai semakan</button>
      <button class="btn secondary" id="submitNow">Lulus terus</button>
    </div>
    <p id="addMsg"></p>
  </div>`
  const story = document.getElementById('story')
  story.addEventListener('input', () => {
    const t = suggestTheme(story.value)
    document.getElementById('themeBox').innerHTML = themeSelect('theme-new', t)
    const codes = suggestSeats(story.value)
    const sel = document.getElementById('seats-new')
    ;[...sel.options].forEach(o => { o.selected = codes.includes(o.value) })
  })
  const submit = async (direct) => {
    const text = story.value.trim()
    const msg = document.getElementById('addMsg')
    if (text.length < 20) { msg.className = 'err'; msg.textContent = 'Cerita terlalu pendek.'; return }
    const args = {
      p_pass: pass(), p_kind: 'ground',
      p_text_bm: text,
      p_theme: document.getElementById('theme-new').value || null,
      p_seat_codes: [...document.getElementById('seats-new').selectedOptions].map(o => o.value),
      p_source_url: document.getElementById('src').value.trim() || null,
      p_status: direct ? 'approved' : 'draft',
    }
    try {
      await rpc('intake_submit', args)
      msg.className = 'ok'
      msg.textContent = direct ? '✓ Diluluskan terus — tersiar pada kemas kini berikutnya.' : '✓ Dihantar — sila semak di tab Menunggu.'
      story.value = ''
    } catch (e) { msg.className = 'err'; msg.textContent = e.message }
  }
  document.getElementById('submitDraft').addEventListener('click', () => submit(false))
  document.getElementById('submitNow').addEventListener('click', () => submit(true))
}

async function approvedView(el) {
  el.innerHTML = '<p class="sub">Memuatkan…</p>'
  let rows
  try { rows = await rpc('intake_list', { p_pass: pass(), p_status: 'approved' }) }
  catch (e) { el.innerHTML = `<p class="err">${esc(e.message)}</p>`; return }
  el.innerHTML = rows.length ? rows.map(r => `
    <div class="card" data-id="${esc(r.id)}">
      <span class="badge ${r.kind === 'news' ? 'kind-news' : 'kind-ground'}">${r.kind === 'news' ? 'BERITA' : 'LAPANGAN'}</span>
      <span style="color:var(--muted);font-size:.72rem"> tema: ${esc(r.theme ?? '–')} · ${esc((r.seat_codes ?? []).join(', ') || 'seluruh Johor')}</span>
      <p class="item-text">${esc(r.text_bm)}</p>
      <div class="btn-row"><button class="btn secondary" data-pull="${esc(r.id)}">Tarik balik</button></div>
    </div>`).join('') : '<p class="sub">Belum ada yang diluluskan.</p>'
  el.querySelectorAll('[data-pull]').forEach(b => b.addEventListener('click', async () => {
    b.disabled = true
    try {
      await rpc('intake_set_status', { p_pass: pass(), p_id: b.dataset.pull, p_status: 'rejected', p_theme: null, p_seat_codes: null })
      document.querySelector(`[data-id="${b.dataset.pull}"]`).innerHTML = '<p class="sub">Ditarik balik — hilang dari laman pada kemas kini berikutnya.</p>'
    } catch (e) { b.disabled = false; alert(e.message) }
  }))
}

function main(tab = 'pending') {
  root.innerHTML = `
    <h2 style="margin:8px 0 2px">Peta MUDA — Ops</h2>
    <p class="sub">Cerita diluluskan tersiar pada kemas kini berikutnya dan dipadankan dengan jawapan MUDA secara automatik.</p>
    <div class="ops-tabs">
      <button class="btn ${tab === 'pending' ? '' : 'secondary'}" data-tab="pending">Menunggu</button>
      <button class="btn ${tab === 'add' ? '' : 'secondary'}" data-tab="add">+ Tambah cerita</button>
      <button class="btn ${tab === 'approved' ? '' : 'secondary'}" data-tab="approved">Diluluskan</button>
    </div>
    <div id="tabBody"></div>`
  root.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => main(b.dataset.tab)))
  const body = document.getElementById('tabBody')
  if (tab === 'pending') pendingView(body)
  else if (tab === 'add') addView(body)
  else approvedView(body)
}

async function boot() {
  if (!OPS.url || !OPS.anonKey) {
    root.innerHTML = '<div class="card"><p class="err">Konfigurasi belum lengkap — isi site/ops-config.js selepas Supabase disediakan.</p></div>'
    return
  }
  try {
    const idx = await (await fetch('data/index.json')).json()
    seats = idx.seats.map(s => ({ code: s.code, name: s.name, parlimen: s.parlimen, kpdn_district: s.kpdn_district }))
    suggestSeats = buildSeatMatcher(seats)
  } catch { /* seat picker degrades to empty; page still works */ }
  if (!pass()) { loginView(); return }
  try { await rpc('intake_list', { p_pass: pass(), p_status: 'draft' }); main('pending') }
  catch { loginView() }
}
boot()
