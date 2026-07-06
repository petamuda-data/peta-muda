# Peta MUDA — Seat Command Center

**Constituency intelligence for the 2026 Johor state election (PRN, polling 11 July 2026), built 100% on open data.**

One page per DUN seat, three depths for three audiences:

| Tab | Audience | What it shows |
|---|---|---|
| **Ringkas** (Brief) | Public / data novices | The official 2026 candidate list, local grocery prices vs Mar 2022 (the last election), income context, one-tap shareable summary |
| **Lapangan** (Field) | Candidates & volunteers | Auto-generated door-knocking talking points, 2026 voter-roll profile (age / ethnicity / Undi18 cohort), latest prices at named local markets |
| **Analisis** (Analysis) | Campaign HQ | Full result history, 2022 polling-district (saluran) breakdown with bloc shares & turnout, DOSM Kawasanku indicators, HIES/LFS series, JSON/CSV export |

What makes it more useful than any single source: the three datasets are **joined on the constituency**. The price of chicken at the pasar in Muar sits next to Maharani's median household income, the size of its under-30 electorate, and MUDA's 2022 vote share by polling district — on one phone screen.

## Data sources (all free, keyless)

| Source | What we take | License |
|---|---|---|
| [ElectionData.MY](https://electiondata.my) open data lake | Results 1955–present, 2026 nomination ballots (`result: "pending"`), saluran-level 2022 results, per-seat voter demographics **including the JHR-SE-16 roll**, boundary GeoJSON | CC0 |
| [data.gov.my](https://developer.data.gov.my) / OpenDOSM | `hh_income_dun`, `hh_poverty_dun`, `hh_inequality_dun`, `hh_expenditure_dun`, `lfs_dun`, `fuelprice`, `cpi_state_inflation`, Kawasanku scorecard, DUN GeoJSON | CC BY 4.0 |
| KPDN **PriceCatcher** (via `storage.data.gov.my`) | Daily item-level prices at 3,884 premises; we build weekly medians for a 12-item kitchen basket at national / Johor / district scope | CC BY 4.0 |
| [pasarapi.xyz](https://pasarapi.xyz) | API directory + `/health` uptime monitor for the datasets above (shown in the footer) | — |

## Run it

```bash
npm ci
node pipeline/run.mjs   # ~1 min first run (downloads + caches source files into .cache/)
node tools/serve.mjs    # serves site/ at http://localhost:8123
```

The pipeline writes `site/data/index.json`, `site/data/seats/<slug>.json` (56 seats) and
`site/data/johor_dun.geojson` (~2 MB total). The site is fully static — host it anywhere
(GitHub Pages, Cloudflare Pages, Netlify). `.github/workflows/refresh.yml` refreshes the
data nightly and deploys to GitHub Pages once the repo is pushed to GitHub with Pages
enabled (Settings → Pages → Source: GitHub Actions).

Set `PIPELINE_NO_CACHE=1` to force fresh downloads.

## Architecture

```
pipeline/
  config.mjs          scope (Johor), target seats, basket categories, parlimen->KPDN map
  run.mjs             orchestrator: assembles per-seat JSONs + index
  lib/                fetch (retry+cache), CSV parser, parquet (hyparquet)
  steps/              one module per source: seats, history, saluran,
                      demographics, kawasanku, socio, prices, geo
site/                 static app (no build step): index.html, app.js, styles.css
data/manual/se16.json editable notes per seat (candidates come from live data)
tools/serve.mjs       dev server
```

Key join facts (verified live):
- Seat strings are byte-identical across sources: `'N.15 Maharani'` + separate `state`
  column. electiondata.my dropdowns append `', Johor'` — stripped at ingest.
- DUN N-codes repeat across states — every DUN join is scoped to Johor.
- PriceCatcher premises have no coordinates; they map to seats via a hand-built
  **parlimen → KPDN district** table (`config.mjs`). KPDN has no `Kulai` district
  (Kulai-area seats use Johor Bahru premises) and uses both `Ledang` and `Tangkak`
  for one district (merged). This is a *market-catchment approximation*, disclosed in-app.

## Extending

- **Negeri Sembilan (polling 1 Aug 2026, nomination 18 Jul):** generalize `config.mjs`
  (STATE, ELECTION_2026, a NS parlimen→KPDN map), swap the saluran source to the NS
  file when the lake publishes it, and re-run. The lake's demographics parquet already
  carries every state; nomination ballots appear as `result: "pending"` rows in
  `headline_ballots.csv` right after nomination day.
- **GE16:** the same spine scales to all 222 parlimen + 600 DUN (use `hh_*_parlimen`,
  `lfs_parlimen`, GE saluran files).

## Honest limitations

- District-level prices are a catchment approximation, not seat-exact (KPDN monitors
  ~180 districts, not constituencies).
- HIES income/poverty exists only for 2019/2022/2024; LFS from 2021; both are estimates.
- Voter-roll ethnicity/age come from the SPR roll via ElectionData.MY (CC0, anonymised).
- The saluran analysis is the **2022** election — a guide to geography, not a prediction.
- The in-app disclaimer asks users to verify facts before publishing campaign material.

## License & credits

Code: MIT. Data: per-source licenses above. Built with the Malaysian Election Corpus
(Thevesh Theva et al., CC0), DOSM/JDN open data, and KPDN PriceCatcher.
