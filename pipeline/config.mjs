// Pipeline configuration: scope, target seats, geography crosswalks, basket.

export const STATE = 'Johor'

// Build edition: 'neutral' (default, the public data tool) or 'muda' (the
// pro-MUDA advocacy build). Set via `EDITION=muda node pipeline/run.mjs`.
export const EDITION = process.env.EDITION === 'muda' ? 'muda' : 'neutral'

export const ELECTION_2026 = {
  id: 'JHR-SE-16',
  name_bm: 'Pilihan Raya Negeri Johor (PRN 2026)',
  name_en: 'Johor State Election (SE-16)',
  polling_date: '2026-07-11',
  early_voting_date: '2026-07-07',
  nomination_date: '2026-06-27',
}

// MUDA-PSM Progressive Bloc target seats for SE-16 (editable in data/manual/se16.json,
// which overrides/extends this at build time).
export const TARGET_SEATS = ['N.41', 'N.13', 'N.15', 'N.51']

// Parlimen -> KPDN PriceCatcher district (Johor). KPDN districts observed live in
// lookup_premise: Pontian, Mersing, Johor Bahru, Kota Tinggi, Muar, Batu Pahat,
// Segamat, Kluang, Ledang, Tangkak. Note: KPDN has NO Kulai district; Kulai-area
// seats use Johor Bahru premises. 'Tangkak' and 'Ledang' both refer to the same
// admin district and are merged downstream.
export const PARLIMEN_TO_KPDN = {
  'P.140': ['Segamat'], // Segamat
  'P.141': ['Segamat'], // Sekijang
  'P.142': ['Segamat'], // Labis
  'P.143': ['Muar'], // Pagoh
  'P.144': ['Tangkak', 'Ledang'], // Ledang
  'P.145': ['Muar'], // Bakri
  'P.146': ['Muar'], // Muar
  'P.147': ['Batu Pahat'], // Parit Sulong
  'P.148': ['Batu Pahat'], // Ayer Hitam
  'P.149': ['Batu Pahat'], // Sri Gading
  'P.150': ['Batu Pahat'], // Batu Pahat
  'P.151': ['Kluang'], // Simpang Renggam
  'P.152': ['Kluang'], // Kluang
  'P.153': ['Kluang'], // Sembrong
  'P.154': ['Mersing'], // Mersing
  'P.155': ['Kota Tinggi'], // Tenggara
  'P.156': ['Kota Tinggi'], // Kota Tinggi
  'P.157': ['Kota Tinggi'], // Pengerang
  'P.158': ['Johor Bahru'], // Tebrau
  'P.159': ['Johor Bahru'], // Pasir Gudang
  'P.160': ['Johor Bahru'], // Johor Bahru
  'P.161': ['Johor Bahru'], // Pulai
  'P.162': ['Johor Bahru'], // Iskandar Puteri
  'P.163': ['Johor Bahru'], // Kulai (no KPDN Kulai district)
  'P.164': ['Pontian'], // Pontian
  'P.165': ['Pontian'], // Tanjung Piai
}

// DUN-level overrides where a parlimen spans KPDN districts.
export const DUN_KPDN_OVERRIDES = {
  // N.32 Endau sits in Mersing district although P.153 Sembrong is Kluang-based.
  'N.32': ['Mersing'],
}

// Kitchen-basket categories. For each category the pipeline picks the candidate
// item with the widest premise coverage in Johor over the last 28 days.
// Patterns match the KPDN lookup_item `item` field (Bahasa Melayu, uppercase).
export const BASKET = [
  { key: 'ayam', label_bm: 'Ayam bersih', label_en: 'Chicken (whole, cleaned)', patterns: [/^AYAM BERSIH - STANDARD/] },
  { key: 'telur', label_bm: 'Telur ayam', label_en: 'Eggs', patterns: [/^TELUR AYAM.*GRED A\b/, /^TELUR AYAM.*GRED B\b/, /^TELUR AYAM.*GRED C\b/] },
  { key: 'ikan', label_bm: 'Ikan kembung', label_en: 'Mackerel (kembung)', patterns: [/^IKAN KEMBUNG/] },
  // Fallback excludes anything explicitly labelled IMPORT: without this, a
  // widely-stocked imported branded rice (e.g. "BERAS SUPER CAP RAMBUTAN
  // (IMPORT)") can win on premise coverage while the category is still
  // labelled "local" — misrepresenting an imported SKU as the subsidised
  // local staple (RM2.60/kg ceiling item).
  { key: 'beras', label_bm: 'Beras tempatan', label_en: 'Local white rice', patterns: [/^BERAS.*TEMPATAN/, /^BERAS(?!.*IMPORT)/] },
  { key: 'minyak', label_bm: 'Minyak masak', label_en: 'Cooking oil', patterns: [/^MINYAK MASAK.*PAKET/, /^MINYAK MASAK/] },
  { key: 'gula', label_bm: 'Gula putih', label_en: 'White sugar', patterns: [/^GULA PUTIH BERTAPIS KASAR/, /^GULA PUTIH/] },
  { key: 'tepung', label_bm: 'Tepung gandum', label_en: 'Wheat flour', patterns: [/^TEPUNG GANDUM/] },
  { key: 'bawang', label_bm: 'Bawang merah', label_en: 'Red onions', patterns: [/^BAWANG MERAH.*INDIA/, /^BAWANG MERAH/, /^BAWANG BESAR/] },
  // Provisional pattern — pending a real-data probe (dispatched refresh-data
  // run) to confirm KPDN's exact lookup_item naming for garlic. Malaysia's
  // garlic supply is almost entirely imported (mainly China), so the item
  // string may carry an origin suffix similar to the onion entries above;
  // this pattern is intentionally broad and will be tightened once verified.
  { key: 'bawang_putih', label_bm: 'Bawang putih', label_en: 'Garlic', patterns: [/^BAWANG PUTIH/] },
  { key: 'cili', label_bm: 'Cili merah', label_en: 'Red chillies', patterns: [/^CILI MERAH/] },
  { key: 'sayur', label_bm: 'Sayur hijau', label_en: 'Leafy greens', patterns: [/^SAWI/, /^KANGKUNG/, /^BAYAM/] },
  { key: 'tomato', label_bm: 'Tomato', label_en: 'Tomatoes', patterns: [/^TOMATO/] },
  { key: 'santan', label_bm: 'Santan kelapa', label_en: 'Coconut milk', patterns: [/^KELAPA PARUT/, /^SANTAN/] },
]

// How many months of PriceCatcher to load (current month first).
export const PRICE_MONTHS = 4
// Long-horizon national cost-of-living store: monthly medians kept for this many
// months in data/derived/price_history.json so the 1/3/6/12-month national price
// trend can be computed. Closed past months are immutable — only the current +
// previous month are ever refetched (the rest read from the committed artifact),
// so the full 13-month pull happens once, not every run.
export const PRICE_HISTORY_MONTHS = 13
export const PRICE_HISTORY_PATH = 'data/derived/price_history.json'
// Long-run price anchor: the month of the previous Johor election (SE-15),
// so every item can show "change since the last time Johor voted".
export const PRICE_ANCHOR_MONTH = '2022-03'
// Weekly series horizon shown in the app: 13 weekly medians = 12 intervals
// (~3 months) so nothing displayed is older than the quarter.
export const PRICE_WEEKS = 13

export const SOURCES = {
  seatsDropdown: 'https://internal.electiondata.my/seats/current/dropdown.json',
  headlineBallots: 'https://lake.electiondata.my/results_headline/headline_ballots.csv',
  headlineStats: 'https://lake.electiondata.my/results_headline/headline_stats.csv',
  saluranBallots: 'https://lake.electiondata.my/results_saluran/jhr_se15_ballots.csv',
  saluranStats: 'https://lake.electiondata.my/results_saluran/jhr_se15_stats.csv',
  demographics: 'https://lake.electiondata.my/seat_info/demographics.parquet',
  kawasanku: 'https://storage.dosm.gov.my/dashboards/kawasanku_electoral_jitter.parquet',
  dunGeojson: 'https://raw.githubusercontent.com/dosm-malaysia/data-open/main/datasets/geodata/electoral_1_dun.geojson',
  lookupPremise: 'https://storage.data.gov.my/pricecatcher/lookup_premise.csv',
  lookupItem: 'https://storage.data.gov.my/pricecatcher/lookup_item.csv',
  pricecatcherMonth: (ym) => `https://storage.data.gov.my/pricecatcher/pricecatcher_${ym}.parquet`,
  crimeDistrict: 'https://storage.data.gov.my/publicsafety/crime_district.parquet',
  dataCatalogue: (id, extra = '') => `https://api.data.gov.my/data-catalogue/?id=${id}${extra}`,
  pasarHealth: 'https://pasarapi.xyz/health',
  pasarApi: (id) => `https://pasarapi.xyz/api/apis/${id}`,
}

// Dataset ids we depend on (for the pasarapi health readout + attribution).
export const DATASET_IDS = ['hh_income_dun', 'hh_poverty_dun', 'hh_inequality_dun', 'hh_expenditure_dun', 'lfs_dun', 'fuelprice', 'cpi_state_inflation']
