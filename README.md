# Peta MUDA — Seat Command Center

**English** · [Bahasa Malaysia](README.ms.md)

**Live app: https://peta-muda.petamuda-data.workers.dev**

**Constituency intelligence for the Melaka state election (PRN Melaka, date not yet announced), built 100% on open data.**

## Why this exists

This app was built for two specific problems on the ground — not as a general campaign site. It is fully bilingual (Bahasa Malaysia + English).

**Problem 1 — volunteers are willing, but not confident.** MUDA has plenty of people willing to knock on doors; what's missing is people who feel *ready* to. Every conversation risks a hard question on the spot — "what's gone wrong here?", "what does MUDA think about X?" — that needs a true, specific answer. Without seat-specific facts on hand, willing volunteers hesitate, under-prepare, or don't go out at all.

*The app's answer:* every seat page opens with a checklist of that seat's local issues, national issues, and campaign-story beats — the three strongest pre-selected, one tap to copy. Every point carries a verdict (VERIFIED / CONFIRMED / PARTLY CONFIRMED / or an honest "no verified position") so volunteers know exactly what they can defend. Nothing to memorise: it lives in the app, open at the door.

**Problem 2 — voters have stopped opening the door for politics.** Promise fatigue is rational: years of party promises that didn't survive contact with government have taught people to expect nothing new. Whoever's at the door is assumed to be selling another manifesto — so the door stays shut. More promises, even sincere ones, just confirm the pattern.

*The app's answer:* facts, not promises. Every card states something that *happened* — a subsidy cut, a flood, a wage figure, a vote margin — specific to **this seat**, never a national script. MUDA's position only appears with a named person, role, date, and source; where none is verified, the app says so rather than inventing one. Where MUDA claims credit, it's for something already done and independently checkable.

**And before the door:** each seat has a WhatsApp-ready poster showing that seat's own numbers, not slogans — meant to be sent by a neighbour or friend the voter actually trusts, so the door-knock isn't a cold open.

## How to use it — an illustrated walkthrough

The volunteer's path, start to finish. (The app is BM-first; the BM|EN toggle in the header switches everything, posters included.)

### 1. Open the app, say you're a volunteer

<img src="docs/screenshots/home.png" width="260" alt="Home: volunteer and seat-search entry points">

The home screen asks what you want to do, not what data you want. Tap **"Saya sukarelawan — beri saya poin perbualan"**. (Voters and analysts tap "Cari kerusi anda" instead and land on the same seat pages.)

### 2. Pick your seat in the volunteer hub

<img src="docs/screenshots/volunteer-hub.png" width="260" alt="Volunteer hub: every Melaka seat with a build-script button">

All 28 Melaka seats, searchable by seat, area, or parliament name. Tap **"Bina skrip"** on yours.

### 3. Build your door-knocking script

<img src="docs/screenshots/talking-points.png" width="260" alt="Talking-points checklist with the three strongest points pre-selected">

Every local issue, national issue, and campaign-story beat for that seat is a checklist — the **three strongest are already ticked**. Tick or untick any point and it's instantly added to or removed from your script below — **only what you select ends up in the final copy**, nothing more. Each point leads with what MUDA said or did, then the local issue as context.

### 4. Copy it and go

<img src="docs/screenshots/copy-script.png" width="260" alt="Live preview of the selected points with the copy button">

The preview is your exact script — MUDA-first points, a verbatim sourced quote, the seat's campaign fact. **"Salin poin perbualan"** puts it on your clipboard: paste it into WhatsApp, your notes app, wherever you'll glance at the door.

### 5. Before the walk: send the poster to people you know

<img src="docs/screenshots/poster.png" width="260" alt="Seat poster built for WhatsApp, with the field-notes card above it">

Each seat has a WhatsApp-ready poster showing **that seat's own numbers** — no slogans, no URL (it's for voters; this app is for you). Sent by a neighbour or friend, it warms the door before you knock. Jot what you hear at the doors in **Nota lapangan** (stored on your phone only — export to your admin when ready).

### 6. Deeper prep, when you want it

<img src="docs/screenshots/analysis.png" width="260" alt="Analysis tab: result history, voter profile, income benchmarks">

The **Analisis** tab has the seat's full result history, voter profile (age/ethnicity), and income vs the national and state medians. The **"Poin perbualan terpilih"** button on the Field tab exports the seat's complete sourced dossier as a file — paste it into ChatGPT/Gemini and rehearse the hard questions before your first door.

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

## Use it

**Nothing to install — just open https://peta-muda.petamuda-data.workers.dev on your phone.**
Add it to your home screen for one-tap access (Share → Add to Home Screen); data refreshes
itself daily. Developers: local build instructions are in [HANDOFF.md](HANDOFF.md).

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

- Melaka's PRN date is not yet announced — the app shows "Election not yet called"
  instead of a day count until SPR sets one.
- HIES income/poverty exists only for 2019/2022/2024; Melaka seat-level income is a
  single 2020 estimate compared against the nearest common benchmark year.
- Voter-roll ethnicity is not published for Melaka; the app falls back to labelled
  2020 census population shares (disclosed in-app as population, not roll, data).
- The in-app disclaimer asks users to verify facts before publishing campaign material.

## License & credits

Code: MIT. Data: per-source licenses above. Built with the Malaysian Election Corpus
(Thevesh Theva et al., CC0) and DOSM/JDN open data.
