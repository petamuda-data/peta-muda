// Seat spine: 56 Johor DUNs from electiondata.my dropdown, with the
// DUN -> parlimen crosswalk taken from data.gov.my hh_income_dun rows
// (which embed parlimen for every DUN) and the KPDN market-district mapping.
import { fetchJson } from '../lib/fetch.mjs'
import { SOURCES, STATE, PARLIMEN_TO_KPDN, DUN_KPDN_OVERRIDES, TARGET_SEATS } from '../config.mjs'

export const seatCode = (seat) => seat.split(' ')[0] // 'N.41'
export const seatName = (seat) => seat.slice(seat.indexOf(' ') + 1) // 'Puteri Wangsa'
export const slugify = (code, name) =>
  `${code.replace('.', '')}-${name}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

export async function loadSeats(socioDunParlimen) {
  const dropdown = await fetchJson(SOURCES.seatsDropdown)
  const seats = dropdown.data
    .filter(s => s.type === 'dun' && s.seat.endsWith(`, ${STATE}`))
    .map(s => {
      const full = s.seat.slice(0, s.seat.lastIndexOf(', ')) // 'N.41 Puteri Wangsa'
      const code = seatCode(full)
      const name = seatName(full)
      const parlimen = socioDunParlimen.get(full) ?? null // 'P.158 Tebrau'
      const pCode = parlimen ? parlimen.split(' ')[0] : null
      let kpdn = DUN_KPDN_OVERRIDES[code] ?? (pCode ? PARLIMEN_TO_KPDN[pCode] : null) ?? []
      // Tangkak and Ledang are the same admin district under two KPDN labels.
      if (kpdn.includes('Tangkak') && !kpdn.includes('Ledang')) kpdn = [...kpdn, 'Ledang']
      return {
        code,
        name,
        seat: full,
        slug: slugify(code, name),
        state: STATE,
        parlimen,
        kpdn_districts: kpdn,
        featured: TARGET_SEATS.includes(code),
      }
    })
    .sort((a, b) => Number(a.code.slice(2)) - Number(b.code.slice(2)))
  if (seats.length !== 56) throw new Error(`expected 56 Johor DUN seats, got ${seats.length}`)
  const missingParlimen = seats.filter(s => !s.parlimen)
  if (missingParlimen.length) throw new Error(`seats missing parlimen crosswalk: ${missingParlimen.map(s => s.code).join(',')}`)
  return seats
}
