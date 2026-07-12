# Standing rules for this repo

These are hard constraints for every session working on peta-muda. Deep
context lives in `HANDOFF.md` — read it before substantial work.

## THE ACTIVE STATE IS MELAKA — JOHOR IS RETIRED

The app serves exactly ONE state: whatever `site/app.js` pins in
`state.region` (currently `melaka`). That pin is the single source of truth —
check it before writing any state name anywhere.

Johor's PRN concluded on 11 July 2026 and is FULLY retired. Do NOT mention
Johor in user-facing copy, docs, README, prompts, workflows, screenshots,
metadata, or commit messages. Only two exceptions:
1. Describing its retirement (e.g. "Johor is retired" notes in docs).
2. Its historical election results where they are genuinely the data.

Johor-era code (`pipeline/run.mjs`, `data/` root files, johor posters) stays
on disk as inert legacy — do not wire it into anything. This rule stands
until the app is deliberately re-pointed at the next election; at that point
update this file and the region pin together.

## Anonymity (repo is PUBLIC under a neutral org)

Commit ONLY as `Claude <noreply@anthropic.com>`
(`git -c user.name='Claude' -c user.email='noreply@anthropic.com' commit …`).
Never a personal name or email — not in commits, content, screenshots, or
metadata. Push directly to `main`; never open PRs from personal accounts.

## Verification gate

`node tools/smoke.mjs` must be green (exit 0) before any push that touches
the app. Deployment truth = smoke green.

## Curated-content discipline

- Every fact carries a `verdict` (VERIFIED / CONFIRMED / PARTLY_CONFIRMED /
  REPORTED / NO_VERIFIED_POSITION) plus source URLs. Two independent sources
  before CONFIRMED; single-sourced items are REPORTED or PARTLY_CONFIRMED.
- Never invent or paraphrase-as-verbatim a quote.
- Food prices, if mentioned at all: ONLY rice, cooking oil, chicken (the
  three price-ceiling items). Nothing else.
- All user-facing copy bilingual BM + EN (zh falls back to EN).
