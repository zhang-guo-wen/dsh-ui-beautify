import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Config } from '../lib/index.mjs'
import { en, zh } from '../src/client/locales.ts'
import {
  COMPOSER_STATS_PILL_IDS, CONTEXT_METER_SELECTOR, applyComposerStats, composerStatsCss,
} from '../src/client/composer-stats.ts'

/** A `<style>` stand-in that knows how to remove itself from the head. */
function fakeDocument() {
  const head = []
  return {
    head,
    document: {
      createElement: tag => ({
        tag,
        dataset: {},
        textContent: '',
        remove() {
          const at = head.indexOf(this)
          if (at >= 0) head.splice(at, 1)
        },
      }),
      head: { appendChild: element => head.push(element) },
    },
  }
}

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

/** A client context carrying the composer dock ledger and the effect collection. */
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
          assert.equal(name, 'conversation.composer.dock')
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

test('the stylesheet hides only the context ring in the composer dock', () => {
  assert.deepEqual(COMPOSER_STATS_PILL_IDS, ['activity', 'usage'])
  assert.equal(
    CONTEXT_METER_SELECTOR,
    '[data-composer-dock] > span:has(> button[aria-haspopup="dialog"] svg circle)',
  )
  assert.equal(composerStatsCss(), `${CONTEXT_METER_SELECTOR} {\n  display: none;\n}\n`)
  // One rule, one declaration: the stylesheet may not carry a colour, size, font,
  // or any second selector that could hide something the switch does not own.
  const css = composerStatsCss()
  assert.equal((css.match(/\{/g) ?? []).length, 1)
  assert.equal((css.match(/display: none;/g) ?? []).length, 1)
  assert.doesNotMatch(css, /#|rgb\(|hsl\(|font|width|height|opacity|nth-|> span >/u)
})

test('the switch shadows both pills and the ring, then restores them', (t) => {
  const fake = fakeDocument()
  const previousDocument = globalThis.document
  globalThis.document = fake.document
  t.after(() => { globalThis.document = previousDocument })

  const harness = context()
  const scope = settings(undefined)
  applyComposerStats(harness.ctx, scope)

  // Off by default: an answerless or false document installs nothing.
  assert.equal(harness.registrations.length, 0)
  assert.equal(fake.head.length, 0)
  scope.set({ hideComposerStats: false })
  assert.equal(harness.registrations.length, 0)

  scope.set({ hideComposerStats: true })
  assert.deepEqual(harness.registrations.map(entry => entry.options.id), ['activity', 'usage'])
  for (const entry of harness.registrations) {
    assert.equal(entry.options.name, 'conversation.composer.dock')
    assert.equal(entry.options.priority, -10)
    assert.equal(entry.component(), null)
  }
  assert.equal(fake.head.length, 1)
  const style = fake.head[0]
  assert.equal(style.dataset.pluginCss, '@guowenzhang/dsh-ui-beautify/composer-stats.css')
  assert.equal(style.textContent, composerStatsCss())

  // Off releases both shadows and the stylesheet.
  scope.set({ hideComposerStats: false })
  assert.equal(harness.registrations.length, 0)
  assert.equal(fake.head.length, 0)

  // Unloading while on releases them too, and drops the settings subscription.
  scope.set({ hideComposerStats: true })
  assert.equal(harness.registrations.length, 2)
  for (const dispose of harness.effects) dispose()
  assert.equal(harness.registrations.length, 0)
  assert.equal(fake.head.length, 0)
  assert.equal(scope.listeners.size, 0)
})

test('the switch is a live field that defaults off', () => {
  assert.equal(Config.dict.hideComposerStats.meta.volatile, true)
  assert.equal(Config({}).hideComposerStats.get(), false)
  assert.equal(Config({ hideComposerStats: true }).hideComposerStats.get(), true)
})

test('both languages carry the row copy', () => {
  for (const copy of [en, zh]) {
    for (const key of ['hideComposerStatsTitle', 'hideComposerStatsDesc']) {
      assert.equal(typeof copy[key], 'string', key)
      assert.ok(copy[key].trim() !== '', key)
    }
  }
  assert.equal(zh.hideComposerStatsTitle, '隐藏输入框下方的统计')
  assert.match(en.hideComposerStatsTitle, /statistics/i)
  assert.match(zh.hideComposerStatsDesc, /轮次/)
  assert.match(zh.hideComposerStatsDesc, /Token/)
  assert.match(zh.hideComposerStatsDesc, /上下文/)
})

test('the built handoff carries the switch, the pills and the ring selector', () => {
  const bundle = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
  for (const marker of [
    'hideComposerStats',
    'composer-stats.css',
    'data-composer-dock',
    // The bundle escapes the attribute's quotes, so the selector is matched in parts.
    'svg circle',
    'aria-haspopup',
    '"activity"',
    '"usage"',
  ]) assert.ok(bundle.includes(marker), marker)
})

test('both test chains run this file', () => {
  const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  for (const script of ['test', 'test:mobile']) {
    assert.ok(manifest.scripts[script].includes('tests/composer-stats.test.mjs'), script)
  }
})
