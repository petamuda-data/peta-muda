// Results-day simulator: replay the pipeline offline against reconstructed
// source fixtures and check how the pending→results flip behaves.
//
//   node tools/sim/run.mjs                 # all scenarios
//   node tools/sim/run.mjs full-flip       # one scenario
//
// Each scenario runs the REAL pipeline (pipeline/run.mjs, unmodified) in an
// isolated .sim/<scenario>/ working dir with global fetch intercepted, then
// asserts on the emitted site/data. Exit code 1 if any scenario fails.
import { mkdir, rm, symlink, cp } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { buildFixtures } from './build-fixtures.mjs'
import { verifyScenario } from './verify.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const SCENARIOS = ['pending', 'full-flip', 'partial-flip', 'stats-lag', 'garbage', 'appended']
const wanted = process.argv.slice(2).length ? process.argv.slice(2) : SCENARIOS
for (const s of wanted) if (!SCENARIOS.includes(s)) { console.error(`unknown scenario ${s}`); process.exit(2) }

const runPipeline = (cwd, fixtures) => new Promise((resolve) => {
  const child = spawn(process.execPath, [
    '--import', pathToFileURL(path.join(ROOT, 'tools', 'sim', 'intercept.mjs')).href,
    path.join(ROOT, 'pipeline', 'run.mjs'),
  ], {
    cwd,
    env: { ...process.env, SIM_FIXTURES: fixtures, PIPELINE_NO_CACHE: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let out = ''
  child.stdout.on('data', d => { out += d })
  child.stderr.on('data', d => { out += d })
  child.on('close', code => resolve({ code, out }))
})

let anyFail = false
for (const scenario of wanted) {
  const base = path.join(ROOT, '.sim', scenario)
  const fixtures = path.join(base, 'fixtures')
  const work = path.join(base, 'work')
  await rm(base, { recursive: true, force: true })
  await mkdir(work, { recursive: true })
  await buildFixtures(scenario, fixtures, path.join(ROOT, 'site', 'data'))

  // sandbox: pipeline reads data/manual/* and now also writes the rolling
  // data/derived/price_history.json artifact — so COPY data/ (not symlink) to
  // keep each scenario's artifact isolated and out of the real repo tree
  await cp(path.join(ROOT, 'data'), path.join(work, 'data'), { recursive: true })
  await mkdir(path.join(work, 'site'), { recursive: true })
  for (const f of ['index.html', 'app.js', 'styles.css']) {
    await symlink(path.join(ROOT, 'site', f), path.join(work, 'site', f))
  }

  const t0 = Date.now()
  const { code, out } = await runPipeline(work, fixtures)
  const secs = ((Date.now() - t0) / 1000).toFixed(1)

  let failures = []
  if (code !== 0 && scenario === 'garbage') {
    // desired outcome: the pipeline refuses to publish mid-count garbage
    console.log(`✔ ${scenario} (${secs}s) — pipeline refused to publish (exit ${code})`)
    console.log(out.split('\n').filter(l => /SANITY|WARNING|Error/.test(l)).map(l => `    ${l}`).join('\n'))
    continue
  }
  if (code !== 0) {
    failures.push(`pipeline exited ${code}`)
    console.log(out.split('\n').slice(-15).map(l => `    ${l}`).join('\n'))
  } else {
    failures = await verifyScenario(scenario, path.join(work, 'site', 'data'), path.join(ROOT, 'site', 'data'))
  }

  if (failures.length) {
    anyFail = true
    console.log(`✘ ${scenario} (${secs}s) — ${failures.length} failure(s)`)
    for (const f of failures.slice(0, 30)) console.log(`    - ${f}`)
    if (failures.length > 30) console.log(`    … and ${failures.length - 30} more`)
  } else {
    console.log(`✔ ${scenario} (${secs}s)`)
  }
}
process.exit(anyFail ? 1 : 0)
