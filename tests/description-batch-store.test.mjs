import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { DescriptionTranslationStore, descriptionTranslationKey } from '../src/description-translation-store.ts'

const entry = (id, kind = 'skill') => ({ kind, id, source: `Description for ${id}` })
const entries = [entry('first'), entry('second', 'plugin'), entry('third')]
const deferred = () => {
  let resolve
  const promise = new Promise(accept => { resolve = accept })
  return { promise, resolve }
}
// Retain unique small temp directories instead of recursively deleting unchecked paths.
const temporaryDirectory = () => mkdtemp(join(tmpdir(), 'dsh-description-batch-store-test-'))
const createStore = async (options = {}) => new DescriptionTranslationStore({
  dataDir: await temporaryDirectory(), generate: async () => { throw Error('Per-item generator must not run') }, ...options,
})
const statuses = batch => batch.results.map(result => result.status)
const jsonFiles = async store => (await readdir(store.recordDir)).filter(name => name.endsWith('.json'))
const texts = received => received.map(e => `Translated ${e.id}`)

test('multiple unique descriptions use exactly one callback and preserve request order and identities', async () => {
  const store = await createStore()
  let calls = 0
  const input = [entries[2], entries[0], entries[1]]
  const batch = await store.translateBatch(input, 'ZH-cn', async (received, language, signal) => {
    calls++
    assert.deepEqual(received, input)
    assert.equal(language, 'zh-CN')
    assert.ok(signal instanceof AbortSignal)
    const output = texts(received)
    received.reverse()
    received[0].source = 'Provider mutation cannot alter cache identity'
    return output.map(text => `  ${text}  `)
  })
  assert.equal(calls, 1)
  assert.deepEqual(statuses(batch), ['translated', 'translated', 'translated'])
  assert.deepEqual(batch.results.map(result => result.entry), input)
  assert.deepEqual(batch.results.map(result => result.record.text), texts(input))
  assert.deepEqual(batch.results.map(result => result.record.source), input.map(e => e.source))
  assert.equal((await jsonFiles(store)).length, 3)
  assert.deepEqual(statuses(await store.lookup(input, 'zh-CN')), ['cached', 'cached', 'cached'])
})

test('duplicates get one generated record; cached entries and empty requests never invoke the callback', async () => {
  const store = await createStore()
  const warm = await store.translateBatch([entries[0]], 'en', async () => ['Already cached'])
  let calls = 0
  const callback = async received => {
    calls++
    assert.deepEqual(received, [entries[1], entries[2]])
    return texts(received)
  }
  const input = [entries[0], entries[1], entries[0], entries[2], entries[1]]
  const batch = await store.translateBatch(input, 'en', callback)
  assert.equal(calls, 1)
  assert.deepEqual(statuses(batch), ['cached', 'translated', 'cached', 'translated', 'translated'])
  assert.deepEqual(batch.results[0].record, warm.results[0].record)
  assert.deepEqual(batch.results[1].record, batch.results[4].record)
  assert.deepEqual(statuses(await store.translateBatch(input, 'en', callback)), input.map(() => 'cached'))
  assert.deepEqual(await store.translateBatch([], 'en', callback), { language: 'en', results: [] })
  assert.equal(calls, 1)
  assert.equal((await jsonFiles(store)).length, 3)
})

test('overlapping reverse-order batches re-read locks and generate only remaining unique misses', async () => {
  const store = await createStore()
  const other = await createStore({ dataDir: store.dataDir })
  const gate = deferred()
  const started = deferred()
  const generated = []
  const first = store.translateBatch([entries[0], entries[1]], 'fr', async received => {
    generated.push(...received)
    started.resolve()
    await gate.promise
    return texts(received)
  })
  await started.promise
  const second = other.translateBatch([entries[1], entries[0], entries[2], entries[1]], 'fr', async received => {
    assert.deepEqual(received, [entries[2]])
    generated.push(...received)
    return texts(received)
  })
  gate.resolve()
  const [a, b] = await Promise.all([first, second])
  assert.deepEqual(statuses(a), ['translated', 'translated'])
  assert.deepEqual(statuses(b), ['cached', 'cached', 'translated', 'cached'])
  assert.equal(generated.length, 3)
  assert.deepEqual(b.results[0].record, a.results[1].record)
  assert.deepEqual(b.results[1].record, a.results[0].record)
  assert.equal((await jsonFiles(store)).length, 3)
})

test('simultaneous same-set batches with reversed ordering cannot deadlock or duplicate generation', async () => {
  const store = await createStore({ timeoutMs: 2000 })
  let calls = 0
  const callback = async received => { calls++; await delay(30); return texts(received) }
  const [first, second] = await Promise.all([
    store.translateBatch(entries, 'de', callback),
    store.translateBatch([...entries].reverse(), 'de', callback),
  ])
  assert.equal(calls, 1)
  assert.deepEqual([statuses(first)[0], statuses(second)[0]].sort(), ['cached', 'translated'])
  assert.deepEqual(second.results.map(result => result.record.text), texts([...entries].reverse()))
})

test('wrong counts and any malformed batch text invalidate every miss before any record write', async () => {
  const invalid = [
    ['Valid first'],
    ['Valid first', 'Valid second', 'Extra'],
    ['Valid first', ''],
    ['Valid first', ' \n'],
    ['Valid first', 42],
    ['Valid first', {}],
    ['Valid first', 'bad\0text'],
    ['Valid first', 'x'.repeat(8001)],
    Object.assign(Array(2), { 0: 'Valid first' }),
    { 0: 'Valid first', 1: 'Valid second', length: 2 },
    null,
  ]
  for (const output of invalid) {
    const store = await createStore()
    const warm = await store.translateBatch([entries[2]], 'en', async () => ['Keep cached result'])
    const batch = await store.translateBatch(entries, 'en', async () => output)
    assert.deepEqual(statuses(batch), ['error', 'error', 'cached'])
    assert.ok(batch.results.slice(0, 2).every(result => result.error.code === 'invalid-output'))
    assert.deepEqual(batch.results[2].record, warm.results[0].record)
    assert.deepEqual(statuses(await store.lookup(entries, 'en')), ['missing', 'missing', 'cached'])
    assert.equal((await jsonFiles(store)).length, 1)
    assert.ok((await store.translateBatch(entries, 'en', async received => texts(received))).results.every(result => ['cached', 'translated'].includes(result.status)))
  }
})

test('callback failures return safe errors for misses while preserving cached results and retryability', async () => {
  const store = await createStore()
  await store.translateBatch([entries[0]], 'en', async () => ['Cached'])
  const batch = await store.translateBatch(entries, 'en', async () => { throw Error('Secret provider credential') })
  assert.deepEqual(statuses(batch), ['cached', 'error', 'error'])
  assert.ok(batch.results.slice(1).every(result => result.error.code === 'generation-failed'))
  assert.doesNotMatch(JSON.stringify(batch), /Secret provider credential/u)
  assert.equal((await jsonFiles(store)).length, 1)
  assert.deepEqual(statuses(await store.translateBatch(entries, 'en', async received => texts(received))), ['cached', 'translated', 'translated'])
})

test('per-record storage errors do not discard another valid persisted result', async () => {
  const store = await createStore()
  const badTarget = join(store.recordDir, `${descriptionTranslationKey(entries[0], 'en')}.json`)
  const batch = await store.translateBatch(entries.slice(0, 2), 'en', async received => {
    // A directory is an invalid record destination; read/rename errors stay per-entry.
    await mkdir(badTarget)
    return texts(received)
  })
  assert.deepEqual(statuses(batch), ['error', 'translated'])
  assert.equal(batch.results[0].error.code, 'storage-failed')
  assert.equal((await store.lookup([entries[1]], 'en')).results[0].status, 'cached')
  assert.ok((await readdir(store.recordDir)).every(name => !name.endsWith('.tmp') && !name.endsWith('.lock')))
})

test('pre-aborted requests never generate or create records and malformed requests fail before I/O', async () => {
  const store = await createStore()
  let calls = 0
  const callback = async received => { calls++; return texts(received) }
  const batch = await store.translateBatch(entries, 'en', callback, { signal: AbortSignal.abort() })
  assert.ok(batch.results.every(result => result.error.code === 'aborted'))
  assert.equal(calls, 0)
  await assert.rejects(stat(store.recordDir), { code: 'ENOENT' })
  await assert.rejects(store.translateBatch([entries[0], { ...entries[1], source: '' }], 'en', callback), TypeError)
  await assert.rejects(store.translateBatch(entries, 'en', undefined), TypeError)
  assert.equal(calls, 0)
})

for (const cancellation of ['abort', 'timeout']) {
  test(`${cancellation} bounds the caller and retains all ignored-abort locks until generation settles without caching`, async () => {
    const store = await createStore({ timeoutMs: cancellation === 'timeout' ? 100 : 1000 })
    const gate = deferred()
    const started = deferred()
    const controller = new AbortController()
    let generatedSignal
    let calls = 0
    const pending = store.translateBatch(entries, 'en', async (_received, _language, signal) => {
      calls++
      generatedSignal = signal
      started.resolve()
      return gate.promise
    }, { signal: controller.signal })
    await started.promise
    if (cancellation === 'abort') controller.abort()
    const batch = await pending
    assert.ok(batch.results.every(result => result.error.code === (cancellation === 'abort' ? 'aborted' : 'timeout')))
    assert.equal(generatedSignal.aborted, true)
    assert.deepEqual(statuses(await store.lookup(entries, 'en')), entries.map(() => 'missing'))
    const locks = (await readdir(store.recordDir)).filter(name => name.endsWith('.lock'))
    assert.equal(locks.length, entries.length)
    const blocked = await createStore({ dataDir: store.dataDir, timeoutMs: 50 })
    const retryBeforeSettle = await blocked.translateBatch([...entries].reverse(), 'en', async received => { calls++; return texts(received) })
    assert.ok(retryBeforeSettle.results.every(result => result.error.code === 'timeout'))
    assert.equal(calls, 1)
    gate.resolve(texts(entries))
    // A retry waits for asynchronous safe lock cleanup, without trusting arbitrary delays.
    const retry = await store.translateBatch(entries, 'en', async received => {
      calls++
      assert.equal((await jsonFiles(store)).length, 0, 'abandoned output must never persist')
      return texts(received)
    })
    assert.deepEqual(statuses(retry), entries.map(() => 'translated'))
    assert.equal(calls, 2)
    assert.equal((await jsonFiles(store)).length, entries.length)
    assert.ok((await readdir(store.recordDir)).every(name => name.endsWith('.json')))
  })
}

test('batch locks also coordinate the original per-item translate API', async () => {
  const store = await createStore()
  const other = await createStore({ dataDir: store.dataDir, generate: async () => { throw Error('Must reuse batch cache') } })
  const gate = deferred()
  const started = deferred()
  const pending = store.translateBatch(entries, 'en', async received => { started.resolve(); await gate.promise; return texts(received) })
  await started.promise
  const legacy = other.translate(entries, 'en')
  gate.resolve()
  const [batch, reused] = await Promise.all([pending, legacy])
  assert.deepEqual(statuses(reused), entries.map(() => 'cached'))
  assert.deepEqual(reused.results.map(result => result.record), batch.results.map(result => result.record))
})

function runChild(script) {
  const child = spawn(process.execPath, ['--experimental-strip-types', '--input-type=module', '--eval', script], { stdio: 'inherit' })
  return new Promise((accept, reject) => {
    const timer = setTimeout(() => { child.kill(); reject(Error('Child exceeded test deadline')) }, 10_000)
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

test('independent processes acquire reverse-order batch locks without duplicate inference or overwrite', async () => {
  const dataDir = await temporaryDirectory()
  const count = join(dataDir, 'calls')
  const gate = join(dataDir, 'start')
  const moduleUrl = new URL('../src/description-translation-store.ts', import.meta.url).href
  const children = [0, 1].map(index => runChild(`
    import assert from 'node:assert/strict'
    import { appendFile, stat, writeFile } from 'node:fs/promises'
    import { setTimeout as delay } from 'node:timers/promises'
    import { DescriptionTranslationStore } from ${JSON.stringify(moduleUrl)}
    const store = new DescriptionTranslationStore({ dataDir: ${JSON.stringify(dataDir)}, timeoutMs: 4000, generate: async () => { throw Error('No per-item calls') } })
    const entries = ${JSON.stringify(index ? [...entries].reverse() : entries)}
    await writeFile(${JSON.stringify(join(dataDir, `ready-${index}`))}, '')
    while (true) {
      try { await stat(${JSON.stringify(gate)}); break } catch (error) { if (error.code !== 'ENOENT') throw error }
      await delay(10)
    }
    const batch = await store.translateBatch(entries, 'fr', async received => {
      await appendFile(${JSON.stringify(count)}, JSON.stringify(received) + '\\n')
      await delay(100)
      return received.map(entry => 'Translated ' + entry.id)
    })
    assert.ok(batch.results.every(result => ['translated', 'cached'].includes(result.status)), JSON.stringify(batch))
    assert.deepEqual(batch.results.map(result => result.record.text), entries.map(entry => 'Translated ' + entry.id))
    await writeFile(${JSON.stringify(join(dataDir, `result-${index}.json`))}, JSON.stringify(batch))
  `))
  const completed = Promise.all(children)
  completed.catch(() => {})
  await Promise.all([0, 1].map(index => waitForFile(join(dataDir, `ready-${index}`))))
  await writeFile(gate, '')
  await completed
  assert.equal((await readFile(count, 'utf8')).trim().split('\n').length, 1)
  const batches = await Promise.all([0, 1].map(async index => JSON.parse(await readFile(join(dataDir, `result-${index}.json`), 'utf8'))))
  assert.deepEqual(batches.map(batch => batch.results[0].status).sort(), ['cached', 'translated'])
  for (const e of entries) {
    assert.deepEqual(batches[0].results.find(result => result.entry.id === e.id).record, batches[1].results.find(result => result.entry.id === e.id).record)
  }
  assert.equal((await readdir(join(dataDir, 'description-translations', 'v1'))).length, entries.length)
})
