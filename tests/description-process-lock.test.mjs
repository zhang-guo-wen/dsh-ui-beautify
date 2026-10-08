import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'
import { mkdtemp, mkdir, readFile, readdir, rename, stat, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { DescriptionTranslationStore, descriptionTranslationKey } from '../src/description-translation-store.ts'

const entry = { kind: 'skill', id: '../process-test', source: 'Same source across host processes' }
const moduleUrl = new URL('../src/description-translation-store.ts', import.meta.url).href
// Retain small unique temp directories; never recursively delete unchecked paths.
const temporaryDirectory = () => mkdtemp(join(tmpdir(), 'dsh-description-process-lock-test-'))
const first = batch => batch.results[0]
const recordDirectory = dataDir => join(dataDir, 'description-translations', 'v1')
const lockDirectory = dataDir => join(recordDirectory(dataDir), `${descriptionTranslationKey(entry, 'fr')}.lock`)

function runChild(script) {
  const child = spawn(process.execPath, ['--experimental-strip-types', '--input-type=module', '--eval', script], { stdio: 'inherit' })
  return new Promise((accept, reject) => {
    const timer = setTimeout(() => { child.kill(); reject(Error('Child process exceeded test deadline')) }, 10_000)
    child.once('error', error => { clearTimeout(timer); reject(error) })
    child.once('exit', (code, signal) => {
      clearTimeout(timer)
      if (code === 0 && signal === null) accept()
      else reject(Error(`Child exited with code ${code}, signal ${signal}`))
    })
  })
}

async function waitForFile(path) {
  const deadline = Date.now() + 5000
  while (Date.now() < deadline) {
    try { await stat(path); return } catch (error) { if (error.code !== 'ENOENT') throw error }
    await delay(10)
  }
  throw Error('Child did not become ready')
}

async function raceHosts(dataDir) {
  const gate = join(dataDir, 'start')
  const count = join(dataDir, 'generation-count')
  const children = [0, 1].map(index => runChild(`
    import assert from 'node:assert/strict'
    import { appendFile, stat, writeFile } from 'node:fs/promises'
    import { setTimeout as delay } from 'node:timers/promises'
    import { DescriptionTranslationStore } from ${JSON.stringify(moduleUrl)}
    const store = new DescriptionTranslationStore({
      dataDir: ${JSON.stringify(dataDir)}, timeoutMs: 4000,
      generate: async () => {
        await appendFile(${JSON.stringify(count)}, process.pid + '\\n')
        await delay(300)
        return 'Only one process generated this translation'
      },
    })
    await writeFile(${JSON.stringify(join(dataDir, `ready-${index}`))}, '')
    while (true) {
      try { await stat(${JSON.stringify(gate)}); break } catch (error) { if (error.code !== 'ENOENT') throw error }
      await delay(10)
    }
    const result = (await store.translate([${JSON.stringify(entry)}], 'fr')).results[0]
    assert.ok(['translated', 'cached'].includes(result.status), JSON.stringify(result))
    const reuse = (await store.translate([${JSON.stringify(entry)}], 'fr')).results[0]
    assert.equal(reuse.status, 'cached')
    assert.deepEqual(reuse.record, result.record)
    await writeFile(${JSON.stringify(join(dataDir, `result-${index}.json`))}, JSON.stringify(result))
  `))
  // Install a rejection handler immediately, before waiting for readiness.
  const completed = Promise.all(children)
  completed.catch(() => {})
  await Promise.all([0, 1].map(index => waitForFile(join(dataDir, `ready-${index}`))))
  await writeFile(gate, '')
  await completed
  const results = await Promise.all([0, 1].map(async index => JSON.parse(await readFile(join(dataDir, `result-${index}.json`), 'utf8'))))
  assert.deepEqual(results.map(result => result.status).sort(), ['cached', 'translated'])
  assert.deepEqual(results[0].record, results[1].record)
  assert.equal((await readFile(count, 'utf8')).trim().split('\n').length, 1)
  assert.deepEqual(await readdir(recordDirectory(dataDir)), [`${descriptionTranslationKey(entry, 'fr')}.json`])
  return results[0].record
}

test('two independent hosts single-flight per record and reuse the winner without cache overwrite', async () => {
  const dataDir = await temporaryDirectory()
  const sourceFile = join(dataDir, 'original-source.txt')
  await writeFile(sourceFile, entry.source)
  const record = await raceHosts(dataDir)
  const store = new DescriptionTranslationStore({ dataDir, generate: async () => { throw Error('Must reuse cache') } })
  assert.deepEqual(first(await store.translate([entry], 'fr')).record, record)
  assert.equal(await readFile(sourceFile, 'utf8'), entry.source)
})

test('competing hosts recover an exact orphan PID+token lock after its owner exits', async () => {
  const dataDir = await temporaryDirectory()
  await runChild(`
    import { randomUUID } from 'node:crypto'
    import { mkdir, writeFile } from 'node:fs/promises'
    import { join } from 'node:path'
    const lock = ${JSON.stringify(lockDirectory(dataDir))}
    await mkdir(lock, { recursive: true })
    await writeFile(join(lock, process.pid + '.' + randomUUID() + '.owner'), '', { flag: 'wx' })
  `)
  const [owner] = await readdir(lockDirectory(dataDir))
  const pid = Number(owner.split('.')[0])
  assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' })
  await raceHosts(dataDir)
})

test('old live locks are never stolen; waiting respects caller abort and flight timeout', async () => {
  const dataDir = await temporaryDirectory()
  const lock = lockDirectory(dataDir)
  const owner = `${process.pid}.${randomUUID()}.owner`
  await mkdir(lock, { recursive: true })
  await writeFile(join(lock, owner), '', { flag: 'wx' })
  const old = new Date(Date.now() - 24 * 60 * 60 * 1000)
  await utimes(lock, old, old)
  await utimes(join(lock, owner), old, old)
  let calls = 0
  const store = new DescriptionTranslationStore({ dataDir, timeoutMs: 150, generate: async () => { calls++; return 'Unexpected' } })
  const controller = new AbortController()
  const started = Date.now()
  const aborted = store.translate([entry], 'fr', { signal: controller.signal })
  const otherCaller = store.translate([entry], 'fr')
  await delay(25)
  controller.abort()
  assert.equal(first(await aborted).error.code, 'aborted')
  assert.equal(first(await otherCaller).error.code, 'timeout')
  assert.ok(Date.now() - started < 2000)
  assert.equal(calls, 0)
  assert.deepEqual(await readdir(lock), [owner])
  assert.equal(await readFile(join(lock, owner), 'utf8'), '')
})

test('unknown and incomplete lock directories are preserved rather than guessed stale', async () => {
  for (const filename of [undefined, 'unknown-file.txt']) {
    const dataDir = await temporaryDirectory()
    const lock = lockDirectory(dataDir)
    await mkdir(lock, { recursive: true })
    if (filename) await writeFile(join(lock, filename), 'Do not delete this unknown file')
    const store = new DescriptionTranslationStore({ dataDir, timeoutMs: 60, generate: async () => { throw Error('Must not run') } })
    assert.equal(first(await store.translate([entry], 'fr')).error.code, 'timeout')
    assert.deepEqual(await readdir(lock), filename ? [filename] : [])
    if (filename) assert.equal(await readFile(join(lock, filename), 'utf8'), 'Do not delete this unknown file')
  }
})

test('cleanup does not remove a replacement token or unknown files', async () => {
  const dataDir = await temporaryDirectory()
  const lock = lockDirectory(dataDir)
  let finishGeneration
  let notifyStarted
  const started = new Promise(resolve => { notifyStarted = resolve })
  const output = new Promise(resolve => { finishGeneration = resolve })
  const store = new DescriptionTranslationStore({ dataDir, generate: async () => { notifyStarted(); return output } })
  const pending = store.translate([entry], 'fr')
  await started
  const [original] = await readdir(lock)
  const replacement = `${process.pid}.${randomUUID()}.owner`
  await rename(join(lock, original), join(lock, replacement))
  await writeFile(join(lock, 'unknown-file.txt'), 'Preserve me')
  finishGeneration('Translation succeeds but replacement lock is not ours')
  assert.equal(first(await pending).status, 'translated')
  assert.deepEqual((await readdir(lock)).sort(), [replacement, 'unknown-file.txt'].sort())
  assert.equal(await readFile(join(lock, 'unknown-file.txt'), 'utf8'), 'Preserve me')
})

test('timed-out ignored-abort inference retains its lock until settled and never caches late output', async () => {
  const dataDir = await temporaryDirectory()
  let resolveGeneration
  let notifyStarted
  const started = new Promise(resolve => { notifyStarted = resolve })
  const generation = new Promise(resolve => { resolveGeneration = resolve })
  let calls = 0
  const store = new DescriptionTranslationStore({ dataDir, timeoutMs: 80, generate: async () => {
    calls++
    if (calls === 1) { notifyStarted(); return generation }
    return 'Successful retry'
  } })
  const initial = store.translate([entry], 'fr')
  await started
  assert.equal(first(await initial).error.code, 'timeout')
  assert.equal(first(await store.translate([entry], 'fr')).error.code, 'timeout')
  assert.equal(calls, 1)
  assert.equal((await readdir(lockDirectory(dataDir))).length, 1)
  resolveGeneration('Late output must not persist')
  await delay(25)
  assert.equal(first(await store.lookup([entry], 'fr')).status, 'missing')
  assert.equal(first(await store.translate([entry], 'fr')).record.text, 'Successful retry')
  assert.equal(calls, 2)
  assert.deepEqual(await readdir(recordDirectory(dataDir)), [`${descriptionTranslationKey(entry, 'fr')}.json`])
})
