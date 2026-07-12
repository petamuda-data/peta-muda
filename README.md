# Peta MUDA — Seat Command Center

**Live app: https://peta-muda.petamuda-data.workers.dev**

**Constituency intelligence for the Melaka state election (PRN Melaka, date not yet announced — expected by Feb 2027), built 100% on open data.**

One page per DUN seat, two depths for two audiences:

| Tab | Audience | What it shows |
|---|---|---|
| **Lapangan** (Field) | Candidates & volunteers | Auto-generated door-knocking talking points (local + national issues + campaign stories, MUDA-first), a shareable poster, GOTV info once polling day is set, field notes |
| **Analisis** (Analysis) | Campaign HQ | Full result history, 2026 voter-roll profile (age / ethnicity), income vs national/state benchmarks, JSON/CSV export |

A volunteer hub (`#/volunteer`) builds a per-seat door-knocking script in one tap: the three strongest points are pre-selected, adjustable, and copy straight to the clipboard.

## Data sources (all free, keyless)

| Source | What we take | License |
|---|---|---|
| [ElectionData.MY](https://electiondata.my) / [MECo](https://github.com/Thevesh/paper-meco-results) open data | Results 1955–present, per-seat voter demographics, boundary GeoJSON | CC0 |
| [data.gov.my](https://developer.data.gov.my) / OpenDOSM | `hh_income_dun`, `hh_poverty_dun`, `hh_inequality_dun`, `lfs_dun`, DUN GeoJSON, CPI | CC BY 4.0 |
| Hand-curated `data/manual/melaka/issues.json` | Fact-checked local + national campaign issues, each carrying a sourced verdict (VERIFIED / CONFIRMED / PARTLY_CONFIRMED / REPORTED / NO_VERIFIED_POSITION) | — |

Johor's PRN (polling 11 July 2026) is fully retired: nothing Johor-related runs in CI anymore, and its legacy pipeline (`pipeline/run.mjs`) exists only as inert code in the repo. Curated content is kept fresh by a daily automated news sweep (10:00 MYT) that fact-checks and pushes under the verdict rules.

## Run it

```bash
npm ci
PIPELINE_STATE=Melaka EDITION=muda node pipeline/run_melaka.mjs   # writes site/data/melaka/
node tools/serve.mjs                                              # serves site/ at http://localhost:8123
node tools/smoke.mjs                                               # headless end-to-end check
```

The site is fully static (`site/`) — Cloudflare Workers Builds auto-deploys on every push
to `main`. `.github/workflows/refresh.yml` rebuilds the Melaka data daily (10:30 MYT) and
on any push touching `pipeline/**` or `data/manual/**`.

## Architecture

```
pipeline/
  config.mjs             STATE/EDITION scope, target seats
  run_melaka.mjs          Melaka orchestrator (MECo mirrors + DOSM socio data)
  run.mjs                 legacy Johor orchestrator
  lib/                    fetch (retry+cache), CSV parser, parquet (hyparquet)
  steps/                  one module per source: seats, history, geo, alerts
site/                     static app (no build step): index.html, app.js, styles.css
data/manual/               editable, sourced notes: melaka/issues.json, income_benchmarks.json,
                            muda_stances.json, national_issues.json, muda_record.json
tools/serve.mjs            dev server
tools/smoke.mjs            headless Playwright regression suite (~76 checks)
tools/poster/               poster PNG generation (bilingual, per-seat + statewide)
```

## Honest limitations

- Melaka's PRN date is not yet announced — the countdown card shows the expected window
  instead of a day count until it's set.
- HIES income/poverty exists only for 2019/2022/2024; Melaka seat-level income is a
  single 2020 estimate compared against the nearest common benchmark year.
- Voter-roll ethnicity is not published for Melaka; the app falls back to labelled
  2020 census population shares (disclosed in-app as population, not roll, data).
- The in-app disclaimer asks users to verify facts before publishing campaign material.

## License & credits

Code: MIT. Data: per-source licenses above. Built with the Malaysian Election Corpus
(Thevesh Theva et al., CC0) and DOSM/JDN open data.
