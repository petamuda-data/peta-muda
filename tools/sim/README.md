# Results-day simulator

Replays the **real** pipeline (`pipeline/run.mjs`, unmodified) against
reconstructed source fixtures to prove how the `pending → results` flip behaves
on election night (polling 2026-07-11) — before it happens, and without network.

```bash
npm run sim              # all scenarios
npm run sim full-flip    # one scenario
```

## How it works

- `build-fixtures.mjs` rebuilds every remote source (lake CSVs, DOSM/kawasanku
  parquets, data.gov.my APIs, PriceCatcher) from the committed `site/data`, then
  rewrites the 2026 contest rows per scenario.
- `intercept.mjs` (loaded via `node --import`) replaces global `fetch` so the
  pipeline reads only fixtures — HEAD + Range requests included, so hyparquet
  works. Any unmapped URL throws, so a run can never touch the network.
- `run.mjs` runs the pipeline in an isolated `.sim/<scenario>/work/` dir and
  `verify.mjs` asserts on the emitted `site/data`.

## Scenarios

| Scenario | What it models | Expected |
|---|---|---|
| `pending` | today's data verbatim | pipeline reproduces committed output (fidelity baseline) |
| `full-flip` | all 56 seats resulted | contests move to history, results cards render, bloc identity survives |
| `partial-flip` | N.01–N.28 resulted, rest pending | resolved seats show results, pending seats keep ballots |
| `stats-lag` | ballots resulted, `headline_stats` missing | results render with `–` for majority/turnout, no crash |
| `garbage` | 5 seats mid-count (`result` blank, votes 0) | **not** published as official results — kept as pending |
| `appended` | lake appends result rows beside stale pending rows | de-duped, contest still completes |

`.sim/` is git-ignored. Add a scenario in `build-fixtures.mjs` (`scenario2026`)
and its assertions in `verify.mjs`.
