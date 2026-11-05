import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Config } from '../lib/index.mjs'
import { en, zh } from '../src/client/locales.ts'
import { SIDEBAR_BRAND_SELECTOR, applySidebarBrand, sidebarBrandCss } from '../src/client/sidebar-brand.ts'

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

/** A client context that only has to collect the effects the switch installs. */
function context() {
  const effects = []
  return {
    effects,
    ctx: {
      effect(callback) {
        const dispose = callback()
        effects.push(dispose)
        return dispose
      },
    },
  }
}

test('the stylesheet hides only the sidebar brand container', () => {
  assert.equal(SIDEBAR_BRAND_SELECTOR, '[data-slot="sidebar"] [class*="_logoRow"] > [class*="_brand"]')
  assert.equal(sidebarBrandCss(), `${SIDEBAR_BRAND_SELECTOR} {\n  display: none;\n}\n`)
  // One rule, one declaration: no colour, size, font, or second selector that
  // could take away something the switch does not own (the toggle in the same
  // row, the New Session button below it).
  const css = sidebarBrandCss()
  assert.equal((css.match(/\{/g) ?? []).length, 1)
  assert.equal((css.match(/display: none;/g) ?? []).length, 1)
  assert.doesNotMatch(css, /#|rgb\(|hsl\(|font|width|height|opacity|visibility|nth-/u)
})

test('the switch installs one stylesheet, then releases it', (t) => {
  const fake = fakeDocument()
  const previousDocument = globalThis.document
  globalThis.document = fake.document
  t.after(() => { globalThis.document = previousDocument })

  const harness = context()
  const scope = settings(undefined)
  applySidebarBrand(harness.ctx, scope)

  // Off by default: an answerless or false document installs nothing.
  assert.equal(fake.head.length, 0)
  scope.set({ hideSidebarBrand: false })
  assert.equal(fake.head.length, 0)

  scope.set({ hideSidebarBrand: true })
  assert.equal(fake.head.length, 1)
  const style = fake.head[0]
  assert.equal(style.tag, 'style')
  assert.equal(style.dataset.pluginCss, '@guowenzhang/dsh-ui-beautify/sidebar-brand.css')
  assert.equal(style.textContent, sidebarBrandCss())

  // Asking again while it is already on does not stack a second stylesheet.
  scope.set({ hideSidebarBrand: true })
  assert.equal(fake.head.length, 1)

  // Off releases the stylesheet, restoring the host's own mark and name.
  scope.set({ hideSidebarBrand: false })
  assert.equal(fake.head.length, 0)

  // Unloading while on releases it too, and drops the settings subscription.
  scope.set({ hideSidebarBrand: true })
  assert.equal(fake.head.length, 1)
  for (const dispose of harness.effects) dispose()
  assert.equal(fake.head.length, 0)
  assert.equal(scope.listeners.size, 0)
})

test('the switch is a live field that defaults off', () => {
  assert.equal(Config.dict.hideSidebarBrand.meta.volatile, true)
  assert.equal(Config({}).hideSidebarBrand.get(), false)
  assert.equal(Config({ hideSidebarBrand: true }).hideSidebarBrand.get(), true)
})

test('both languages carry the row copy', () => {
  for (const copy of [en, zh]) {
    for (const key of ['hideSidebarBrandTitle', 'hideSidebarBrandDesc']) {
      assert.equal(typeof copy[key], 'string', key)
      assert.ok(copy[key].trim() !== '', key)
    }
  }
  assert.equal(zh.hideSidebarBrandTitle, '隐藏侧栏标志与名称')
  assert.match(en.hideSidebarBrandTitle, /sidebar/i)
  assert.match(zh.hideSidebarBrandDesc, /标志/)
  assert.match(zh.hideSidebarBrandDesc, /名称/)
})

test('the built handoff carries the switch, the stylesheet and its selector', () => {
  const bundle = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
  for (const marker of [
    'hideSidebarBrand',
    'sidebar-brand.css',
    // The bundle escapes the attribute's quotes, so the selector is matched in parts.
    'data-slot=',
    '_logoRow',
    '_brand',
  ]) assert.ok(bundle.includes(marker), marker)
})

test('both test chains run this file', () => {
  const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  for (const script of ['test', 'test:mobile']) {
    assert.ok(manifest.scripts[script].includes('tests/hide-sidebar-brand.test.mjs'), script)
  }
})
