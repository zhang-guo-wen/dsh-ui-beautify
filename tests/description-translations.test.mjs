import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, readdir, writeFile, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import {
  canonicalDescriptionLanguage,
  descriptionEntryIdentity,
  descriptionTranslationIdentity,
  MAX_DESCRIPTION_ENTRIES,
  MAX_DESCRIPTION_LENGTH,
  MAX_TRANSLATION_LENGTH,
  validateDescriptionEntry,
  validateDescriptionTranslationRequest,
} from '../src/description-translations.ts'
import { DescriptionTranslationStore, descriptionTranslationKey } from '../src/description-translation-store.ts'

const entry = (source = 'Translate this description.', id = 'test-skill', kind = 'skill') => ({ kind, id, source })
const deferred = () => {
  let resolve, reject
  const promise = new Promise((accept, fail) => { resolve = accept; reject = fail })
  return { promise, resolve, reject }
}
// Intentionally retain small uniquely named OS temp directories: never recursively delete an unchecked path.
const temporaryDirectory = () => mkdtemp(join(tmpdir(), 'dsh-description-translations-test-'))
const store = async (generate = async () => 'Translated text', options = {}) => new DescriptionTranslationStore({ dataDir: await temporaryDirectory(), generate, ...options })
const result = batch => batch.results[0]

test('browser-safe helpers canonicalize language and include exact kind/id/source in identity', async () => {
  assert.equal(canonicalDescriptionLanguage('ZH-hans-cn'), 'zh-Hans-CN')
  assert.equal(canonicalDescriptionLanguage('iw'), 'he')
  assert.equal(canonicalDescriptionLanguage('en-us'), 'en-US')
  assert.notEqual(descriptionEntryIdentity(entry('a|b', 'c')), descriptionEntryIdentity(entry('b', 'c|a')))
  assert.notEqual(descriptionEntryIdentity(entry()), descriptionEntryIdentity(entry(undefined, undefined, 'plugin')))
  assert.notEqual(descriptionEntryIdentity(entry()), descriptionEntryIdentity(entry('Changed.')))
  assert.equal(descriptionTranslationIdentity(entry(), 'en-us'), descriptionTranslationIdentity(entry(), 'en-US'))
  assert.equal(descriptionTranslationKey(entry(), 'en-us'), descriptionTranslationKey(entry(), 'en-US'))
  assert.match(descriptionTranslationKey(entry(), 'zh'), /^[a-f0-9]{64}$/u)
  assert.notEqual(descriptionTranslationKey(entry('\ud800'), 'en'), descriptionTranslationKey(entry('\ud801'), 'en'))
  const shared = await readFile(new URL('../src/description-translations.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(shared, /from ['"]node:|\brequire\(|\beval\(|new Function/u)
})

test('request validation is bounded, copies known fields and preserves source exactly', async () => {
  const source = ` ${'x'.repeat(MAX_DESCRIPTION_LENGTH - 2)} `
  assert.deepEqual(validateDescriptionEntry({ ...entry(source), unexpected: 'ignored' }), entry(source))
  assert.equal(validateDescriptionTranslationRequest({ entries: Array.from({ length: MAX_DESCRIPTION_ENTRIES }, () => entry()), language: 'ZH-cn' }).entries.length, 200)
  assert.deepEqual(validateDescriptionTranslationRequest({ entries: [], language: 'en' }), { entries: [], language: 'en' })
  for (const language of [undefined, null, 2, '', ' en', 'en ', 'en_US', '../en', 'a'.repeat(65), 'English please']) {
    assert.throws(() => canonicalDescriptionLanguage(language), TypeError)
  }
  for (const invalid of [null, [], {}, { ...entry(), kind: 'agent' }, { ...entry(), id: '' }, entry(undefined, 'x'.repeat(513)), entry(undefined, 'x\0y'), entry(''), entry(' \n'), entry('x'.repeat(4001)), { ...entry(), source: 1 }]) {
    assert.throws(() => validateDescriptionEntry(invalid), TypeError)
  }
  for (const request of [null, [], {}, { entries: {}, language: 'en' }, { entries: Array(201).fill(entry()), language: 'en' }, { entries: Array(2), language: 'en' }]) {
    assert.throws(() => validateDescriptionTranslationRequest(request), TypeError)
  }
  let calls = 0
  const s = await store(async () => { calls++; return 'ok' })
  await assert.rejects(s.translate([entry(), entry('')], 'en'), TypeError)
  await assert.rejects(s.lookup([entry()], 'en_US'), TypeError)
  assert.equal(calls, 0)
  await assert.rejects(stat(s.recordDir), { code: 'ENOENT' })
})

test('lookup never generates or creates directories; successful records survive restart and preserve originals', async () => {
  let calls = 0
  const s = await store(async (received, language, signal) => {
    calls++
    assert.deepEqual(received, original)
    assert.equal(language, 'zh-CN')
    assert.ok(signal instanceof AbortSignal)
    received.source = 'generator mutation must not alter identity'
    return '  翻译后的说明  '
  })
  const original = entry('console.log("this source is not executed")', '../path-like-id')
  const originalFile = join(s.dataDir, 'original-skill.txt')
  await writeFile(originalFile, original.source)
  assert.equal(result(await s.lookup([original], 'zh-cn')).status, 'missing')
  assert.equal(calls, 0)
  await assert.rejects(stat(s.recordDir), { code: 'ENOENT' })
  const translated = result(await s.translate([original], 'zh-cn'))
  assert.equal(translated.status, 'translated')
  assert.equal(translated.record.text, '翻译后的说明')
  assert.equal(translated.record.source, original.source)
  assert.equal(new Date(translated.record.createdAt).toISOString(), translated.record.createdAt)
  assert.equal(result(await s.translate([original], 'zh-CN')).status, 'cached')
  assert.equal(calls, 1)
  const restarted = new DescriptionTranslationStore({ dataDir: s.dataDir, generate: async () => { throw Error('must not run after upgrade') } })
  assert.deepEqual(result(await restarted.lookup([original], 'zh-CN')).record, translated.record)
  assert.equal(result(await restarted.translate([original], 'zh-CN')).status, 'cached')
  assert.equal(await readFile(originalFile, 'utf8'), original.source)
  const files = await readdir(s.recordDir)
  assert.deepEqual(files, [`${descriptionTranslationKey(original, 'zh-CN')}.json`])
  assert.deepEqual(JSON.parse(await readFile(join(s.recordDir, files[0]), 'utf8')), translated.record)
})

test('disk cache survives a fresh Node process, without relying on in-memory single-flight state', async () => {
  const s = await store()
  const e = entry('Persist across process restarts')
  const saved = result(await s.translate([e], 'en'))
  const moduleUrl = new URL('../src/description-translation-store.ts', import.meta.url).href
  const script = `
    import { DescriptionTranslationStore } from ${JSON.stringify(moduleUrl)}
    const s = new DescriptionTranslationStore({ dataDir: ${JSON.stringify(s.dataDir)}, generate: async () => { throw Error('generation should never happen') } })
    const batch = await s.translate([${JSON.stringify(e)}], 'en')
    const r = batch.results[0]
    if (r.status !== 'cached' || r.record.text !== ${JSON.stringify(saved.record.text)} || r.record.createdAt !== ${JSON.stringify(saved.record.createdAt)}) process.exit(1)
  `
  // Inherit stdio instead of opening sandbox-incompatible capture pipes.
  const child = spawnSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '--eval', script], { stdio: 'inherit', timeout: 5000 })
  assert.equal(child.error, undefined)
  assert.equal(child.status, 0)
})

test('changed source, kind, id and language each get separate reusable records', async () => {
  let calls = 0
  const s = await store(async (e, language) => { calls++; return `${language}:${e.kind}:${e.id}:${e.source}` })
  const entries = [entry('First'), entry('Second'), entry('First', 'other'), entry('First', 'test-skill', 'plugin')]
  assert.ok((await s.translate(entries, 'fr')).results.every(r => r.status === 'translated'))
  assert.equal(result(await s.lookup([entries[0]], 'de')).status, 'missing')
  assert.equal(result(await s.translate([entries[0]], 'de')).status, 'translated')
  assert.equal(calls, 5)
  assert.ok((await s.translate(entries, 'fr')).results.every(r => r.status === 'cached'))
  assert.equal(calls, 5)
  assert.equal((await readdir(s.recordDir)).length, 5)
})

test('duplicates and concurrent requests across instances single-flight once per key', async () => {
  const gate = deferred()
  const started = deferred()
  let calls = 0
  const s = await store(async () => { calls++; started.resolve(); return gate.promise })
  const other = new DescriptionTranslationStore({ dataDir: s.dataDir, generate: async () => { calls++; return 'wrong generator' } })
  const first = s.translate([entry(), entry()], 'zh')
  await started.promise
  const second = other.translate([entry(), entry()], 'zh')
  assert.equal(result(await s.lookup([entry()], 'zh')).status, 'missing')
  gate.resolve('共享翻译')
  const batches = await Promise.all([first, second])
  assert.equal(calls, 1)
  for (const batch of batches) {
    assert.equal(batch.results.length, 2)
    assert.ok(batch.results.every(r => r.status === 'translated'))
    assert.deepEqual(batch.results[0].record, batch.results[1].record)
  }
})

test('generator failures and invalid outputs are not cached; batch preserves partial successes and retry', async () => {
  let valid = false
  let calls = 0
  const outputs = { empty: '', space: ' \n', big: 'x'.repeat(MAX_TRANSLATION_LENGTH + 1), nul: 'a\0b', number: 42, object: {} }
  const entries = [entry('safe', 'good'), ...Object.keys(outputs).map(id => entry(id, id)), entry('throws', 'throws')]
  const s = await store(async e => {
    calls++
    if (valid || e.id === 'good') return 'Valid translation'
    if (e.id === 'throws') throw Error('secret credential must not leak')
    return outputs[e.id]
  })
  const batch = await s.translate(entries, 'en')
  assert.equal(batch.results[0].status, 'translated')
  assert.ok(batch.results.slice(1, -1).every(r => r.status === 'error' && r.error.code === 'invalid-output'))
  assert.equal(batch.results.at(-1).error.code, 'generation-failed')
  assert.doesNotMatch(JSON.stringify(batch), /secret credential/u)
  assert.equal((await readdir(s.recordDir)).length, 1)
  assert.ok((await s.lookup(entries.slice(1), 'en')).results.every(r => r.status === 'missing'))
  valid = true
  const retry = await s.translate(entries, 'en')
  assert.equal(retry.results[0].status, 'cached')
  assert.ok(retry.results.slice(1).every(r => r.status === 'translated'))
  assert.equal(calls, entries.length * 2 - 1)
})

test('timeouts are bounded when generator ignores abort; late output is never persisted; retry succeeds', async () => {
  let capturedSignal
  let calls = 0
  const gate = deferred()
  const s = await store(async (_e, _l, signal) => {
    capturedSignal = signal
    if (++calls === 1) return gate.promise
    return 'Retry successful'
  }, { timeoutMs: 30 })
  const timedOut = result(await s.translate([entry()], 'en'))
  assert.equal(timedOut.error.code, 'timeout')
  assert.equal(capturedSignal.aborted, true)
  assert.equal(result(await s.lookup([entry()], 'en')).status, 'missing')
  gate.resolve('Late output')
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(result(await s.lookup([entry()], 'en')).status, 'missing')
  assert.equal(result(await s.translate([entry()], 'en')).record.text, 'Retry successful')
})

test('abort affects only its caller when another waiter still needs the shared generation', async () => {
  const gate = deferred()
  const started = deferred()
  let generatorSignal
  const s = await store(async (_e, _l, signal) => { generatorSignal = signal; started.resolve(); return gate.promise })
  const controller = new AbortController()
  const first = s.translate([entry()], 'en', { signal: controller.signal })
  await started.promise
  const second = s.translate([entry()], 'en')
  controller.abort()
  assert.equal(result(await first).error.code, 'aborted')
  assert.equal(generatorSignal.aborted, false)
  gate.resolve('Other caller still gets the result')
  assert.equal(result(await second).status, 'translated')
  assert.equal(result(await s.lookup([entry()], 'en')).status, 'cached')
})

test('all callers abort generation, skip pre-aborted callbacks, and never cache abandoned output', async () => {
  const gate = deferred()
  const started = deferred()
  let calls = 0
  let generatorSignal
  const s = await store(async (_e, _l, signal) => { calls++; generatorSignal = signal; started.resolve(); return gate.promise })
  const already = AbortSignal.abort()
  assert.equal(result(await s.translate([entry()], 'en', { signal: already })).error.code, 'aborted')
  assert.equal(calls, 0)
  const controller = new AbortController()
  const abandoned = s.translate([entry()], 'en', { signal: controller.signal })
  await started.promise
  controller.abort()
  assert.equal(result(await abandoned).error.code, 'aborted')
  assert.equal(generatorSignal.aborted, true)
  gate.resolve('Abandoned text')
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(result(await s.lookup([entry()], 'en')).status, 'missing')
})

test('generation concurrency is bounded and queued work also times out', async () => {
  let active = 0, peak = 0
  const s = await store(async () => {
    active++
    peak = Math.max(peak, active)
    await new Promise(resolve => setTimeout(resolve, 5))
    active--
    return 'ok'
  }, { maxConcurrentGenerations: 2 })
  const entries = Array.from({ length: 12 }, (_, i) => entry('description', `id-${i}`))
  assert.ok((await s.translate(entries, 'en')).results.every(r => r.status === 'translated'))
  assert.equal(peak, 2)
  let calls = 0
  const stuck = await store(async () => { calls++; return new Promise(() => {}) }, { timeoutMs: 20, maxConcurrentGenerations: 1 })
  assert.ok((await stuck.translate(entries, 'en')).results.every(r => r.error.code === 'timeout'))
  assert.ok(calls < entries.length, 'expired queued calls must not all invoke the generator')
})

test('corrupt, oversized and mismatched disk records are misses and repairable without source execution', async () => {
  const s = await store()
  const e = entry()
  const first = result(await s.translate([e], 'en'))
  const target = join(s.recordDir, `${descriptionTranslationKey(e, 'en')}.json`)
  for (const contents of ['{broken', 'x'.repeat(128 * 1024 + 1), JSON.stringify({ ...first.record, source: 'mismatch' }), JSON.stringify({ ...first.record, language: 'fr' }), JSON.stringify({ ...first.record, createdAt: 'bad timestamp' }), JSON.stringify({ ...first.record, text: '' })]) {
    await writeFile(target, contents)
    assert.equal(result(await s.lookup([e], 'en')).status, 'missing')
  }
  assert.equal(result(await s.translate([e], 'en')).status, 'translated')
  assert.equal((await readdir(s.recordDir)).filter(name => name.endsWith('.tmp')).length, 0)
})

test('storage errors return partial error metadata and constructor rejects unbounded options', async () => {
  const s = await store()
  await writeFile(join(s.dataDir, 'description-translations'), 'not a directory')
  assert.equal(result(await s.translate([entry()], 'en')).error.code, 'storage-failed')
  const lookup = result(await s.lookup([entry()], 'en'))
  // Windows may report ENOENT for a path beneath a regular file; POSIX reports ENOTDIR.
  assert.ok(lookup.status === 'missing' || lookup.error?.code === 'storage-failed')
  for (const options of [{ timeoutMs: 0 }, { timeoutMs: 120001 }, { timeoutMs: Infinity }, { maxConcurrentGenerations: 0 }, { maxConcurrentGenerations: 17 }]) {
    assert.throws(() => new DescriptionTranslationStore({ dataDir: s.dataDir, generate: async () => 'ok', ...options }), TypeError)
  }
})
