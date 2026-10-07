import test from 'node:test'
import assert from 'node:assert/strict'
import { createRemoteSettingsReader } from '../src/client/remote-settings-reader.ts'
import { installRemoteSettings } from '../src/client/remote-settings.ts'

const describe = (revision = 1) => ({ writable: true, hasDocument: true, namespaces: [
  { ns: 'ui-beautify', value: { codeFont: 'jetbrains-mono', motion: 'off' }, base: {}, user: {}, revision },
  { ns: 'another-plugin', value: { enabled: true }, schema: {}, revision },
] })

test('one redacted read supplies all forms with stable read-only snapshots', async () => {
  let reads = 0
  const r = createRemoteSettingsReader(async () => { reads++; return describe() })
  await r.ensure()
  assert.equal(reads, 1)
  assert.deepEqual(r.formSnapshot('ui-beautify').value, { codeFont: 'jetbrains-mono', motion: 'off' })
  assert.equal(r.formSnapshot('ui-beautify'), r.formSnapshot('ui-beautify'))
  assert.equal(r.formSnapshot('another-plugin').writable, false)
  assert.equal(r.getSnapshot().view.hasDocument, false)
  assert.equal(r.getSnapshot().view.writable, false)
  assert.equal(r.formSnapshot('missing').status, 'unavailable')
  r.dispose()
})

test('invalidation during a read is coalesced and failure preserves last values', async () => {
  let resolve
  let calls = 0
  let fail = false
  const r = createRemoteSettingsReader(async () => {
    if (fail) throw Error('offline')
    calls++
    if (calls === 1) return await new Promise(done => { resolve = done })
    return describe(calls)
  })
  const initial = r.ensure()
  const next = r.refresh()
  resolve(describe(1))
  await initial; await next
  assert.equal(calls, 2)
  assert.equal(r.formSnapshot('ui-beautify').revision, 2)
  fail = true
  await r.refresh()
  assert.equal(r.formSnapshot('ui-beautify').revision, 2)
  assert.equal(r.getSnapshot().error, 'offline')
  r.dispose()
})

function context(loopback = false) {
  let writeCalls = 0
  let revision = 1
  let reads = 0
  const events = new Map()
  const domEvents = new Map()
  globalThis.document = { visibilityState: 'visible', addEventListener: (key, fn) => domEvents.set(key, fn), removeEventListener: key => domEvents.delete(key) }
  const forms = new Map()
  const owner = { get(ns) {
    if (!forms.has(ns)) forms.set(ns, { getSnapshot: () => ({status:'unavailable',value:undefined}), subscribe: () => () => {},
      set: async () => {writeCalls++;return true}, unset: async () => {writeCalls++;return true}, mutate: async () => {writeCalls++;return true} })
    return forms.get(ns)
  }, describe: () => ({old:true}), whileServed: () => () => {} }
  const remote = { $host:{isLoopback:loopback}, $on: (key, fn) => {events.set(key,fn);return()=>events.delete(key)} }
  const ctx = {get:key=>key==='remote'?remote:key==='remote.settings'?{describe:async()=>{reads++;return{ok:true,value:describe(revision)}}}:key==='configForms'?owner:undefined,
    on:(key,fn)=>{events.set(key,fn);return()=>events.delete(key)} }
  return {ctx,owner,forms,remote,events,domEvents,writes:()=>writeCalls,reads:()=>reads,setRevision:n=>{revision=n}}
}

test('shared public forms are decorated but identity/permissions stay remote; dispose restores methods', async () => {
  const f = context()
  const oldGet = f.owner.get
  const cached = f.owner.get('another-plugin')
  const oldSnapshot = cached.getSnapshot
  const bridge = installRemoteSettings(f.ctx)
  await bridge.ready
  assert.equal(f.remote.$host.isLoopback, false)
  assert.equal(cached.getSnapshot().writable, false)
  assert.equal(cached.getSnapshot().value.enabled, true)
  assert.equal(await cached.set('enabled',false), false)
  assert.equal(await cached.unset('enabled'), false)
  assert.equal(await cached.mutate([]), false)
  assert.equal(f.writes(), 0)
  f.setRevision(2)
  f.events.get('settings/document-updated')()
  await f.owner.describe().ensure()
  await new Promise(resolve=>setTimeout(resolve,0))
  assert.equal(cached.getSnapshot().revision, 2)
  bridge.dispose()
  assert.equal(f.owner.get, oldGet)
  assert.equal(cached.getSnapshot, oldSnapshot)
  assert.equal(f.events.size, 0)
  assert.equal(f.domEvents.size, 0)
})

test('loopback host forms and write path are not touched', () => {
  const f = context(true)
  const original = f.owner.get
  assert.equal(installRemoteSettings(f.ctx), undefined)
  assert.equal(f.owner.get, original)
  assert.equal(f.reads(), 0)
})
