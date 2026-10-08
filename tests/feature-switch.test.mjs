import test from 'node:test'
import assert from 'node:assert/strict'
import { watchFeature } from '../src/client/feature-switch.ts'

function fixture(status = 'ready', value = {}) {
  const listeners = new Set()
  let snapshot = { status, value }
  const scope = { getSnapshot: () => snapshot, subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn) } }
  return { scope, listeners, set(status, value) { snapshot = { status, value }; for (const fn of listeners) fn() } }
}

test('missing fields default on; repeated updates do not reinstall and disable releases once', () => {
  const f = fixture()
  let installed = 0, released = 0
  const off = watchFeature(f.scope, 'mobileLayoutEnabled', () => { installed++; return () => { released++ } })
  assert.equal(installed, 1)
  f.set('ready', { mobileLayoutEnabled: true })
  assert.equal(installed, 1)
  f.set('ready', { mobileLayoutEnabled: false })
  f.set('ready', { mobileLayoutEnabled: false })
  assert.equal(released, 1)
  f.set('ready', { mobileLayoutEnabled: true })
  assert.equal(installed, 2)
  off()
  assert.equal(released, 2)
  assert.equal(f.listeners.size, 0)
})

test('cold disabled profile never installs; loading cannot discard a saved disabled value', () => {
  const f = fixture('loading')
  let installed = 0
  const off = watchFeature(f.scope, 'recentSessionsEnabled', () => { installed++; return () => {} })
  assert.equal(installed, 0)
  f.set('ready', { recentSessionsEnabled: false })
  f.set('loading', undefined)
  assert.equal(installed, 0)
  f.set('ready', { recentSessionsEnabled: true })
  assert.equal(installed, 1)
  off()
})

test('phone layout and recent switches have independent lifetimes', () => {
  const f = fixture()
  const active = new Set()
  const off = ['mobileLayoutEnabled', 'recentSessionsEnabled'].map(key => watchFeature(f.scope, key, () => {
    active.add(key); return () => active.delete(key)
  }))
  f.set('ready', { mobileLayoutEnabled: false, recentSessionsEnabled: true })
  assert.deepEqual([...active], ['recentSessionsEnabled'])
  f.set('ready', { mobileLayoutEnabled: true, recentSessionsEnabled: false })
  assert.deepEqual([...active], ['mobileLayoutEnabled'])
  for (const dispose of off) dispose()
  assert.equal(active.size, 0)
})
