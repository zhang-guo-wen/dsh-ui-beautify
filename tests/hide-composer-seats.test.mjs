import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Config } from '../lib/index.mjs'
import { en, zh } from '../src/client/locales.ts'
import {
  ACCESS_MODE_SEAT_SLOT, MODEL_SEAT_SLOT, SEAT_SHADOW_PRIORITY, applyHiddenSeats, shadowComposerSeat,
} from '../src/client/composer-seats.ts'

/** The `ui-beautify` configuration form stand-in: a ready snapshot with listeners. */
function settings(value) {
  const listeners = new Set()
  let snapshot = { status: 'ready', value }
  return {
    listeners,
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    set(next) {
      snapshot = { status: 'ready', value: next }
      for (const listener of [...listeners]) listener()
    },
  }
}

/** A client context carrying both seat ledgers and the effect collection. */
function context() {
  const registrations = []
  const effects = []
  return {
    registrations,
    effects,
    ctx: {
      effect(callback) {
        const dispose = callback()
        effects.push(dispose)
        return dispose
      },
      slots: {
        inject(name, register) {
          assert.ok(name === MODEL_SEAT_SLOT || name === ACCESS_MODE_SEAT_SLOT, name)
          return register()
        },
        register(options, component) {
          const entry = { options, component }
          registrations.push(entry)
          return () => {
            const at = registrations.indexOf(entry)
            if (at >= 0) registrations.splice(at, 1)
          }
        },
      },
    },
  }
}

test('the two seats are the host single slots and the shadow wins the cell', () => {
  assert.equal(MODEL_SEAT_SLOT, 'conversation.input.model')
  assert.equal(ACCESS_MODE_SEAT_SLOT, 'conversation.input.permission')
  // Single slots allow one registration per priority and render the lowest, so
  // the shadow must sit below every host seat's default priority 0.
  assert.ok(SEAT_SHADOW_PRIORITY < 0)
})

test('both switches default off, so a cold profile keeps both seats', () => {
  const harness = context()
  const scope = settings(undefined)
  applyHiddenSeats(harness.ctx, scope)
  assert.equal(harness.registrations.length, 0)
  // Turning both rows on is what installs the shadows; the default must not.
  scope.set({ hideModelSelector: true, hideAccessMode: true })
  assert.deepEqual(harness.registrations.map(entry => entry.options.name), ['conversation.input.model', 'conversation.input.permission'])
  assert.deepEqual(harness.registrations.map(entry => entry.options.priority), [-10, -10])
  for (const entry of harness.registrations) assert.equal(entry.component(), null)
})

test('a cold document is waited for and a missing field stays off', () => {
  const harness = context()
  const scope = settings(undefined)
  let status = 'loading'
  const cold = {
    subscribe: scope.subscribe,
    getSnapshot: () => status === 'loading' ? { status, value: undefined } : scope.getSnapshot(),
    set(next) {
      status = 'ready'
      scope.set(next)
    },
  }
  applyHiddenSeats(harness.ctx, cold)
  assert.equal(harness.registrations.length, 0)
  cold.set(undefined)
  assert.equal(harness.registrations.length, 0)
  cold.set({ hideModelSelector: true, hideAccessMode: true })
  assert.equal(harness.registrations.length, 2)
})

test('each switch releases only its own seat and restores it on re-enable', () => {
  const harness = context()
  const scope = settings(undefined)
  applyHiddenSeats(harness.ctx, scope)

  scope.set({ hideModelSelector: true, hideAccessMode: false })
  assert.deepEqual(harness.registrations.map(entry => entry.options.name), ['conversation.input.model'])

  scope.set({ hideModelSelector: true })
  assert.deepEqual(harness.registrations.map(entry => entry.options.name), ['conversation.input.model'])

  scope.set({ hideModelSelector: false, hideAccessMode: true })
  assert.deepEqual(harness.registrations.map(entry => entry.options.name), ['conversation.input.permission'])

  scope.set({ hideModelSelector: true, hideAccessMode: true })
  // Registration order follows install order, not the field order: compare as a set.
  assert.deepEqual(harness.registrations.map(entry => entry.options.name).sort(), ['conversation.input.model', 'conversation.input.permission'].sort())
  for (const entry of harness.registrations) assert.equal(entry.component(), null)

  scope.set({})
  assert.equal(harness.registrations.length, 0)
})

test('unloading releases both shadows and drops the settings subscription', () => {
  const harness = context()
  const scope = settings(undefined)
  applyHiddenSeats(harness.ctx, scope)
  scope.set({ hideModelSelector: true, hideAccessMode: true })
  assert.equal(harness.registrations.length, 2)
  for (const dispose of harness.effects) dispose()
  assert.equal(harness.registrations.length, 0)
  assert.equal(scope.listeners.size, 0)
})

test('one seat can be shadowed on its own without touching the other', () => {
  const harness = context()
  const release = shadowComposerSeat(harness.ctx, MODEL_SEAT_SLOT)
  assert.deepEqual(harness.registrations.map(entry => entry.options.name), ['conversation.input.model'])
  release()
  assert.equal(harness.registrations.length, 0)
})

test('both switches are live fields that default off', () => {
  for (const field of ['hideModelSelector', 'hideAccessMode']) {
    assert.equal(Config.dict[field].meta.volatile, true, field)
    assert.equal(Config({})[field].get(), false, field)
    assert.equal(Config({ [field]: true })[field].get(), true, field)
  }
})

test('both languages carry the two rows copy', () => {
  for (const copy of [en, zh]) {
    for (const key of ['hideModelSelectorTitle', 'hideModelSelectorDesc', 'hideAccessModeTitle', 'hideAccessModeDesc']) {
      assert.equal(typeof copy[key], 'string', key)
      assert.ok(copy[key].trim() !== '', key)
    }
  }
  assert.equal(zh.hideModelSelectorTitle, '隐藏模型选择')
  assert.equal(zh.hideAccessModeTitle, '隐藏访问模式')
  assert.match(zh.hideModelSelectorDesc, /\/model/)
  assert.match(zh.hideAccessModeDesc, /\/permission/)
  assert.match(zh.hideAccessModeDesc, /权限/)
  assert.match(en.hideModelSelectorTitle, /model/i)
  assert.match(en.hideAccessModeTitle, /access mode/i)
})

test('the built handoff carries both switches and both seat keys', () => {
  const bundle = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
  for (const marker of [
    'hideModelSelector',
    'hideAccessMode',
    'conversation.input.model',
    'conversation.input.permission',
    'hideModelSelectorTitle',
    'hideAccessModeTitle',
  ]) {
    assert.ok(bundle.includes(marker), marker)
  }
})
