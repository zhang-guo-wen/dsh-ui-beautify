import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Config } from '../lib/index.mjs'
import { en, zh } from '../src/client/locales.ts'
import {
  CONTEXT_RING_ATTRIBUTE, CONTEXT_RING_CSS, CONTEXT_RING_ENTRY_ID, CONTEXT_RING_ORDER,
  CONTEXT_RING_PERCENT_PROPERTY, CONTEXT_RING_STYLESHEET_ID, contextRingPercent, markContextRing,
} from '../src/client/context-ring.ts'

/** One button stand-in carrying the attribute and custom property the ring writes. */
function fakeButton() {
  const attributes = new Set()
  const properties = new Map()
  return {
    attributes,
    properties,
    style: {
      setProperty: (name, value) => { properties.set(name, value) },
      removeProperty: name => { properties.delete(name) },
      getPropertyValue: name => properties.get(name) ?? '',
    },
    setAttribute: name => { attributes.add(name) },
    removeAttribute: name => { attributes.delete(name) },
    hasAttribute: name => attributes.has(name),
  }
}

/** A composer root + card whose button list can be swapped the way React would. */
function fakeComposer(count = 3) {
  const order = []
  const card = { querySelectorAll: selector => selector === 'button' ? order : [] }
  const root = {
    querySelector: selector => selector === '[data-composer-card]' ? card : null,
    querySelectorAll: selector => selector === `[${CONTEXT_RING_ATTRIBUTE}]`
      ? order.filter(button => button.hasAttribute(CONTEXT_RING_ATTRIBUTE))
      : [],
  }
  for (let index = 0; index < count; index += 1) order.push(fakeButton())
  return {
    root,
    order,
    last: () => order[order.length - 1],
    /** Replace the last button, as a host re-render that remounts it would. */
    replaceLast() {
      order.pop()
      const next = fakeButton()
      order.push(next)
      return next
    },
  }
}

test('occupancy follows the host formula, with the projected figure winning', () => {
  // Nothing known yet: no numerator, no capacity.
  assert.equal(contextRingPercent(undefined), null)
  assert.equal(contextRingPercent({}), null)
  assert.equal(contextRingPercent({ pressureTokens: 500 }), null)
  assert.equal(contextRingPercent({ contextWindow: 1_000 }), null)
  assert.equal(contextRingPercent({ projectedTokens: 500 }), null)
  // The projection mirrors ui-conversation's contextOccupancy.
  assert.equal(contextRingPercent({ pressureTokens: 125, contextWindow: 1_000 }), 13)
  assert.equal(contextRingPercent({ projectedTokens: 200, pressureTokens: 900, contextWindow: 1_000 }), 20)
  // `??` rather than `||`: a projected zero is a real reading.
  assert.equal(contextRingPercent({ projectedTokens: 0, pressureTokens: 500, contextWindow: 1_000 }), 0)
  assert.equal(contextRingPercent({ pressureTokens: 0, contextWindow: 1_000 }), 0)
  // Rounded, then clamped at 100.
  assert.equal(contextRingPercent({ projectedTokens: 1, contextWindow: 3 }), 33)
  assert.equal(contextRingPercent({ projectedTokens: 1_000, contextWindow: 1_000 }), 100)
  assert.equal(contextRingPercent({ projectedTokens: 5_000, contextWindow: 1_000 }), 100)
})

test('the stylesheet draws a 2px ring in host tokens only', () => {
  const css = CONTEXT_RING_CSS
  assert.ok(css.includes(`button[${CONTEXT_RING_ATTRIBUTE}]`))
  assert.match(css, /position:\s*relative/)
  assert.match(css, /inset:\s*-3px/)
  assert.match(css, /border:\s*2px solid transparent/)
  assert.match(css, /border-radius:\s*999px/)
  assert.match(css, /conic-gradient/)
  assert.ok(css.includes('var(--dsw-alias-state-business-primary)'))
  assert.ok(css.includes('var(--dsw-alias-border-l3)'))
  assert.ok(css.includes(`var(${CONTEXT_RING_PERCENT_PROPERTY}`))
  // The cutout is written for both mask dialects.
  assert.ok(css.includes('-webkit-mask:'))
  assert.match(css, /^\s*mask:/m)
  assert.ok(css.includes('-webkit-mask-composite: xor'))
  assert.ok(css.includes('mask-composite: exclude'))
  assert.match(css, /pointer-events:\s*none/)
  // No painted colour of the plugin's own: the only literal is the mask stencil.
  assert.equal((css.match(/#[0-9a-f]{3,8}/gi) ?? []).every(match => match === '#000'), true)
  assert.doesNotMatch(css, /rgb\(|hsl\(|oklch\(/i)
})

test('marking follows the card\'s last button and releases the old one', () => {
  const composer = fakeComposer()
  const first = composer.last()
  assert.equal(markContextRing(composer.root, 42), first)
  assert.ok(first.hasAttribute(CONTEXT_RING_ATTRIBUTE))
  assert.equal(first.style.getPropertyValue(CONTEXT_RING_PERCENT_PROPERTY), '42')

  // A repeat of the same value writes nothing new; a moved value rewrites it.
  assert.equal(markContextRing(composer.root, 42), first)
  assert.equal(markContextRing(composer.root, 43), first)
  assert.equal(first.style.getPropertyValue(CONTEXT_RING_PERCENT_PROPERTY), '43')

  // A host re-render replaced the button: the new node is marked and the card
  // still shows exactly one ring. (The detached old node is unreachable and needs
  // no cleanup — it is not rendered anywhere.)
  const replacement = composer.replaceLast()
  assert.equal(markContextRing(composer.root, 44), replacement)
  assert.ok(replacement.hasAttribute(CONTEXT_RING_ATTRIBUTE))
  assert.equal(replacement.style.getPropertyValue(CONTEXT_RING_PERCENT_PROPERTY), '44')
  assert.equal(composer.order.filter(button => button.hasAttribute(CONTEXT_RING_ATTRIBUTE)).length, 1)

  // A button that is still mounted but no longer the last one — the card grew a
  // control after the primary — loses the mark instead of keeping a stale ring.
  const after = fakeButton()
  composer.order.push(after)
  assert.equal(markContextRing(composer.root, 45), after)
  assert.equal(replacement.hasAttribute(CONTEXT_RING_ATTRIBUTE), false)
  assert.equal(replacement.style.getPropertyValue(CONTEXT_RING_PERCENT_PROPERTY), '')

  // No reading (or no composer) removes the ring entirely.
  assert.equal(markContextRing(composer.root, null), null)
  assert.equal(composer.order.some(button => button.hasAttribute(CONTEXT_RING_ATTRIBUTE)), false)
  assert.equal(after.style.getPropertyValue(CONTEXT_RING_PERCENT_PROPERTY), '')
  assert.equal(markContextRing(null, 50), null)
  assert.equal(markContextRing(null, null), null)
})

test('the entry registers into the composer dock and loads its stylesheet', () => {
  const source = readFileSync(new URL('../src/client/ContextRing.tsx', import.meta.url), 'utf8')
  assert.ok(source.includes("ctx.slots.inject('conversation.composer.dock'"))
  assert.ok(source.includes('id: CONTEXT_RING_ENTRY_ID'))
  assert.ok(source.includes('order: CONTEXT_RING_ORDER'))
  assert.ok(source.includes('style.dataset.pluginCss = CONTEXT_RING_STYLESHEET_ID'))
  assert.ok(source.includes('style.textContent = CONTEXT_RING_CSS'))
  assert.ok(source.includes("watchFeature(scope, 'contextRingEnabled', () => installContextRing(ctx))"))
  // The ring is additive: nothing is shadowed and no host surface is claimed.
  assert.equal(source.includes('priority'), false)
  assert.equal(CONTEXT_RING_ENTRY_ID, 'ui-beautify-context-ring')
  assert.equal(CONTEXT_RING_ORDER, 2)
  assert.equal(CONTEXT_RING_STYLESHEET_ID, '@guowenzhang/dsh-ui-beautify/context-ring.css')
})

test('the switch is a live field that defaults on', () => {
  assert.equal(Config.dict.contextRingEnabled.meta.volatile, true)
  assert.equal(Config({}).contextRingEnabled.get(), true)
  assert.equal(Config({ contextRingEnabled: false }).contextRingEnabled.get(), false)
})

test('both languages carry the row copy', () => {
  for (const copy of [en, zh]) {
    for (const key of ['contextRingTitle', 'contextRingDesc']) {
      assert.equal(typeof copy[key], 'string', key)
      assert.ok(copy[key].trim() !== '', key)
    }
  }
  assert.equal(zh.contextRingTitle, '发送按钮的上下文进度圈')
  assert.match(en.contextRingTitle, /context/i)
  assert.match(zh.contextRingDesc, /上下文/)
  assert.match(en.contextRingDesc, /context occupancy/i)
  assert.ok(zh.contextRingDesc.includes('发送') || zh.contextRingDesc.includes('按钮'))
})

test('the built handoff carries the ring, its selector and its property', () => {
  const bundle = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
  for (const marker of [
    'contextRingEnabled',
    'ui-beautify-context-ring',
    'data-ui-beautify-context-ring',
    CONTEXT_RING_PERCENT_PROPERTY,
    'conic-gradient',
    'mask-composite',
  ]) assert.ok(bundle.includes(marker), marker)
})

test('both test chains run this file', () => {
  const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  for (const script of ['test', 'test:mobile']) {
    assert.ok(manifest.scripts[script].includes('tests/context-ring.test.mjs'), script)
  }
})
