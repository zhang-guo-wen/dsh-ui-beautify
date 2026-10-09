// PDF Worker compatibility: the shim's behaviour in a realm that lacks the
// newest typed-array APIs, and the Blob/Worker interception that puts it in
// front of the PDF Worker the Harness builds.
//
// Runs against the built handoff bundle, like the other client-side checks:
// `npm run build` first, then `node --test tests/pdf-worker-compat.test.mjs`.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { createContext, runInContext, runInThisContext } from 'node:vm'

let plugin
// Every bare specifier the client handoff requires has to be answered; nothing
// here renders, so a callable stand-in for each export is enough to evaluate it.
globalThis.window = {
  __ModuleLoader__: {
    load({ factory }) {
      plugin = factory(() => new Proxy({}, { get: () => () => undefined, has: () => true }))
    },
  },
}
runInThisContext(readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8'), { filename: 'lib/client.js' })

/** A realm with the ECMAScript built-ins but none of the newest APIs PDF.js calls. */
function bareRealm() {
  const realm = createContext({})
  runInContext(`
delete Uint8Array.prototype.toHex
delete Uint8Array.prototype.toBase64
delete Uint8Array.fromBase64
delete Math.sumPrecise
delete Promise.try
delete Map.prototype.getOrInsert
delete Map.prototype.getOrInsertComputed
delete WeakMap.prototype.getOrInsert
delete WeakMap.prototype.getOrInsertComputed
`, realm)
  return realm
}

/**
 * A stand-in page: a realm that lacks the APIs, plus the recording globals the
 * interruption has to patch.
 * @returns the scope, the Blob URLs it handed out, and the native functions.
 */
function makeHarness() {
  const blobs = new Map()
  let serial = 0
  const nativeWorker = class NativeWorker {
    constructor(url, options) {
      this.url = url
      this.options = options
    }
  }
  const nativeCreate = (input) => {
    const url = `blob:test/${serial++}`
    blobs.set(url, input)
    return url
  }
  const nativeRevoke = (url) => { blobs.delete(url) }
  const realm = bareRealm()
  const scope = {
    Uint8Array: runInContext('Uint8Array', realm),
    Math: runInContext('Math', realm),
    Promise: runInContext('Promise', realm),
    Map: runInContext('Map', realm),
    WeakMap: runInContext('WeakMap', realm),
    Blob,
    URL: { createObjectURL: nativeCreate, revokeObjectURL: nativeRevoke },
    Worker: nativeWorker,
  }
  return { scope, realm, blobs, nativeWorker, nativeCreate, nativeRevoke }
}

test('the handoff exports the patch and its shim text', () => {
  assert.equal(typeof plugin.installPdfWorkerCompat, 'function')
  assert.equal(typeof plugin.pdfWorkerCompatSource, 'function')
  assert.match(plugin.pdfWorkerCompatSource(), /^;\(function/)
})

test('the shipped shim completes a realm that lacks the newest APIs', async () => {
  const realm = bareRealm()
  const before = runInContext(`[
    typeof Uint8Array.prototype.toHex, typeof Uint8Array.prototype.toBase64,
    typeof Uint8Array.fromBase64, typeof Math.sumPrecise, typeof Promise.try,
    typeof Map.prototype.getOrInsertComputed, typeof WeakMap.prototype.getOrInsert,
  ].join(',')`, realm)
  assert.equal(before, 'undefined,undefined,undefined,undefined,undefined,undefined,undefined')

  runInContext(plugin.pdfWorkerCompatSource(), realm)

  // The exact call that used to fail every preview: the fingerprint of a document.
  assert.equal(runInContext('new Uint8Array([255, 0, 15]).toHex()', realm), 'ff000f')
  assert.equal(runInContext('new Uint8Array([]).toHex()', realm), '')
  assert.equal(runInContext('new Uint8Array([0, 1, 2, 250, 251, 252]).toBase64()', realm), 'AAEC+vv8')
  assert.equal(runInContext('new Uint8Array([0, 1, 2, 250, 251, 252]).toBase64({ alphabet: "base64url" })', realm), 'AAEC-vv8')
  assert.equal(runInContext('new Uint8Array([1]).toBase64({ omitPadding: true })', realm), 'AQ')
  assert.equal(runInContext('new Uint8Array([1]).toBase64()', realm), 'AQ==')
  assert.equal(runInContext('Array.from(Uint8Array.fromBase64("AAEC+vv8")).join(",")', realm), '0,1,2,250,251,252')
  assert.equal(runInContext('Array.from(Uint8Array.fromBase64("AQ==")).join(",")', realm), '1')
  assert.throws(() => runInContext('Uint8Array.fromBase64("AQ!!")', realm), /Invalid base64/)
  // A compensated sum keeps Math.sumPrecise as accurate as the proposal.
  assert.equal(runInContext('Math.sumPrecise([0.1, 0.2, 0.3])', realm), 0.6)
  assert.equal(runInContext('Math.sumPrecise([])', realm), 0)
  assert.equal(await runInContext('Promise.try(() => 7)', realm), 7)
  assert.equal(
    await runInContext('Promise.try(() => { throw new Error("boom") }).then(() => "resolved", error => error.message)', realm),
    'boom',
  )

  // The upsert pair the transport memoizes worker calls with: 5th failure in the
  // field, after the typed-array APIs were already shimmed.
  assert.equal(
    runInContext('(() => { const map = new Map(); return [map.getOrInsert("k", 1), map.getOrInsert("k", 2), map.get("k")].join(",") })()', realm),
    '1,1,1',
  )
  assert.equal(
    runInContext(`(() => {
      const map = new Map()
      let calls = 0
      const first = map.getOrInsertComputed('k', () => { calls += 1; return 'v' })
      const second = map.getOrInsertComputed('k', () => { calls += 1; return 'other' })
      return [first, second, calls, map.get('k')].join(',')
    })()`, realm),
    'v,v,1,v',
  )
  assert.equal(runInContext('(() => { const map = new Map(); let seen; map.getOrInsertComputed("k", key => { seen = key }); return seen })()', realm), 'k')
  assert.equal(runInContext('(() => { const map = new Map(); try { map.getOrInsertComputed("k", () => { throw new Error("no") }) } catch {} return map.has("k") })()', realm), false)
  assert.equal(runInContext('(() => { const weak = new WeakMap(); const key = {}; return [weak.getOrInsert(key, 1), weak.getOrInsert(key, 2)].join(",") })()', realm), '1,1')
  assert.equal(runInContext('typeof WeakMap.prototype.getOrInsertComputed', realm), 'function')
})

test('URL.parse returns null where the URL constructor throws', () => {
  const realm = bareRealm()
  runInContext(`
globalThis.URL = class URL {
  constructor(input, base) {
    const absolute = value => /^https?:/u.test(String(value))
    if (base === undefined) {
      if (!absolute(input)) throw new TypeError('invalid URL')
      this.href = String(input)
      return
    }
    if (!absolute(base)) throw new TypeError('invalid base')
    this.href = String(base) + String(input)
  }
}
`, realm)
  runInContext(plugin.pdfWorkerCompatSource(), realm)
  assert.equal(runInContext('URL.parse("https://a/b").href', realm), 'https://a/b')
  assert.equal(runInContext('URL.parse("./b", "https://a/").href', realm), 'https://a/./b')
  assert.equal(runInContext('URL.parse("nope")', realm), null)
  assert.equal(runInContext('URL.parse("nope", "also not absolute")', realm), null)
})

test('an implementation the realm already provides is never replaced', () => {
  const realm = bareRealm()
  runInContext(`
Uint8Array.prototype.toHex = () => 'kept'
Uint8Array.fromBase64 = () => 'kept'
Math.sumPrecise = () => 42
Promise.try = () => 'kept'
Map.prototype.getOrInsertComputed = () => 'kept'
WeakMap.prototype.getOrInsert = () => 'kept'
`, realm)
  runInContext(plugin.pdfWorkerCompatSource(), realm)
  assert.equal(runInContext('new Uint8Array([1]).toHex()', realm), 'kept')
  assert.equal(runInContext('Uint8Array.fromBase64("x")', realm), 'kept')
  assert.equal(runInContext('Math.sumPrecise([])', realm), 42)
  assert.equal(runInContext('Promise.try(() => 0)', realm), 'kept')
  assert.equal(runInContext('new Map().getOrInsertComputed("k", () => 0)', realm), 'kept')
  assert.equal(runInContext('new WeakMap().getOrInsert({}, 0)', realm), 'kept')
})

test('only a module Worker built from a JavaScript Blob receives the shim', async () => {
  const harness = makeHarness()
  const dispose = plugin.installPdfWorkerCompat(harness.scope)
  assert.equal(runInContext('typeof Uint8Array.prototype.toHex', harness.realm), 'function')
  assert.equal(runInContext('typeof Map.prototype.getOrInsertComputed', harness.realm), 'function')

  // What the Harness does for a PDF: a text/javascript Blob, then a module Worker.
  const pdfUrl = harness.scope.URL.createObjectURL(new Blob(['export const WorkerMessageHandler = {}'], { type: 'text/javascript' }))
  const pdfWorker = new harness.scope.Worker(pdfUrl, { type: 'module', name: 'dsh-pdf' })
  assert.notEqual(pdfWorker.url, pdfUrl, 'the Worker must be built from a shim-carrying Blob')
  const patched = await harness.blobs.get(pdfWorker.url).text()
  assert.ok(patched.indexOf('function installPdfApis') >= 0, 'the shim is prepended')
  assert.ok(patched.indexOf('function installPdfApis') < patched.indexOf('WorkerMessageHandler'), 'and stays in front of the Worker source')

  // The spreadsheet parser shares the Blob type but is not a module Worker.
  const excelUrl = harness.scope.URL.createObjectURL(new Blob(['self.onmessage = () => {}'], { type: 'text/javascript' }))
  assert.equal(new harness.scope.Worker(excelUrl, { name: 'dsh-excel' }).url, excelUrl)

  // Nothing else that becomes a Blob URL is remembered, either.
  const htmlUrl = harness.scope.URL.createObjectURL(new Blob(['<p></p>'], { type: 'text/html' }))
  assert.equal(new harness.scope.Worker(htmlUrl, { type: 'module' }).url, htmlUrl)

  // The Blob URL the Harness created is the one it revokes; the patched one goes with it.
  harness.scope.URL.revokeObjectURL(pdfUrl)
  assert.equal(harness.blobs.has(pdfWorker.url), false, 'no shim Blob may outlive its Worker')

  const patchedWorker = harness.scope.Worker
  dispose()
  assert.equal(harness.scope.URL.createObjectURL, harness.nativeCreate)
  assert.equal(harness.scope.URL.revokeObjectURL, harness.nativeRevoke)
  assert.equal(harness.scope.Worker, harness.nativeWorker)
  assert.notEqual(patchedWorker, harness.nativeWorker)
})

test('a second install without a dispose wraps nothing twice, and a reinstall after a dispose works again', async () => {
  const harness = makeHarness()
  const firstDispose = plugin.installPdfWorkerCompat(harness.scope)
  const first = harness.scope.Worker
  const second = plugin.installPdfWorkerCompat(harness.scope)
  assert.equal(harness.scope.Worker, first, 'the Worker constructor stays the one already installed')

  const url = harness.scope.URL.createObjectURL(new Blob(['const marker = 1'], { type: 'text/javascript' }))
  const worker = new harness.scope.Worker(url, { type: 'module' })
  const patched = await harness.blobs.get(worker.url).text()
  assert.equal(patched.match(/function installPdfApis/gu)?.length, 1, 'exactly one shim')

  second()
  assert.equal(harness.scope.Worker, first, 'the no-op disposer leaves the working patch in place')

  // A plugin reload disposes and applies again: the page realm now has the APIs,
  // but the engine was born without them and the Worker still needs the shim.
  firstDispose()
  assert.equal(harness.scope.Worker, harness.nativeWorker, 'the dispose restores the globals')
  plugin.installPdfWorkerCompat(harness.scope)
  assert.notEqual(harness.scope.Worker, harness.nativeWorker, 'the reinstall patches again')
  const again = harness.scope.URL.createObjectURL(new Blob(['const marker = 2'], { type: 'text/javascript' }))
  const rewrapped = new harness.scope.Worker(again, { type: 'module' })
  assert.notEqual(rewrapped.url, again)
  assert.match(await harness.blobs.get(rewrapped.url).text(), /function installPdfApis/)
})

test('a page that already has every shimmed API is left untouched', () => {
  const harness = makeHarness()
  runInContext(`
Uint8Array.prototype.toHex = () => ''
Uint8Array.prototype.toBase64 = () => ''
Uint8Array.fromBase64 = () => new Uint8Array(0)
Math.sumPrecise = () => 0
Promise.try = () => Promise.resolve()
Map.prototype.getOrInsert = () => ''
Map.prototype.getOrInsertComputed = () => ''
WeakMap.prototype.getOrInsert = () => ''
WeakMap.prototype.getOrInsertComputed = () => ''
`, harness.realm)
  const dispose = plugin.installPdfWorkerCompat(harness.scope)
  assert.equal(harness.scope.Worker, harness.nativeWorker, 'no global is wrapped')
  assert.equal(harness.scope.URL.createObjectURL, harness.nativeCreate)
  dispose()
})
