import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Config } from '../lib/index.mjs'
import { en, zh } from '../src/client/locales.ts'
import {
  AGENT_PRESET_HEADER_ACTION_ID, HIDDEN_SETTINGS_SECTIONS, OPEN_DOCUMENT_ACTION_ID,
  SETTINGS_NAV_ROW_SELECTOR, applyStreamlinedUi, hiddenSectionRows, navHidingCss,
} from '../src/client/streamlined-ui.ts'

/** One `settings.section` registration, as the shell projects it. */
const section = (id, order) => ({ options: { id, order } })

/** The shipped settings navigation with the branded deployment's rows in it. */
const PRODUCT_LEDGER = [
  section('general', 0),
  section('models', 10),
  section('plugins', 15),
  section('agent-presets', 20),
  section('ui-beautify', 40),
]

/** The same ledger after a stored credential adds the Account row at the front. */
const SIGNED_IN_LEDGER = [
  section('account', -10),
  ...PRODUCT_LEDGER,
]

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

/** The shared Coding Tools preference stand-in. */
function codingTools(initial) {
  const listeners = new Set()
  let enabled = initial
  return {
    listeners,
    getSnapshot: () => enabled,
    subscribe(listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    set(next) {
      enabled = next
      for (const listener of [...listeners]) listener()
    },
  }
}

/**
 * A client context carrying just what the switch touches: the section ledger,
 * the slot ledger writes, the effect collection, and the shared preference.
 * `tools` absent models a host client that predates that preference.
 */
function context({ ledger = [], tools } = {}) {
  const state = { ledger }
  const registrations = []
  const ledgerListeners = new Set()
  const effects = []
  return {
    registrations,
    effects,
    ledgerListeners,
    names: () => registrations.map(entry => entry.options.id ?? entry.options.name),
    setLedger: (next) => {
      state.ledger = next
      for (const listener of [...ledgerListeners]) listener()
    },
    ctx: {
      effect(callback) {
        const dispose = callback()
        effects.push(dispose)
        return dispose
      },
      slots: {
        entries: () => state.ledger,
        subscribe(key, listener) {
          assert.equal(key, 'settings.section')
          ledgerListeners.add(listener)
          return () => { ledgerListeners.delete(listener) }
        },
        inject(name, register) {
          assert.ok(['settings.action', 'conversation.hero.agentPreset', 'conversation.session.header.actions'].includes(name), name)
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
      configForms: tools === undefined ? {} : { developerTools: { enabled: tools } },
    },
  }
}

test('locates the hidden navigation rows by the shell projection', () => {
  assert.deepEqual(HIDDEN_SETTINGS_SECTIONS, ['plugins', 'agent-presets'])
  assert.deepEqual(hiddenSectionRows(PRODUCT_LEDGER), [3, 4])
  // `order` decides the row, not the registration sequence.
  assert.deepEqual(hiddenSectionRows([
    section('agent-presets', -10),
    section('plugins', 15),
    section('general', 0),
  ]), [1, 3])
  // Ties keep registration order, the same stable sort the shell applies.
  assert.deepEqual(hiddenSectionRows([section('plugins', 5), section('models', 5)], ['models']), [2])
  // An absent order is zero, as the shell reads it.
  assert.deepEqual(hiddenSectionRows([section('plugins'), section('general', 0)]), [1])
  // A host without those sections has nothing to hide.
  assert.deepEqual(hiddenSectionRows([section('general', 0)]), [])
  assert.deepEqual(hiddenSectionRows([]), [])
  // A caller may address one section on its own.
  assert.deepEqual(hiddenSectionRows(PRODUCT_LEDGER, ['plugins']), [3])
})

test('the stylesheet names one row selector per position and nothing else', () => {
  assert.equal(navHidingCss([]), '')
  assert.equal(
    navHidingCss([2, 4]),
    `${SETTINGS_NAV_ROW_SELECTOR}:nth-of-type(2),\n${SETTINGS_NAV_ROW_SELECTOR}:nth-of-type(4) {\n  display: none;\n}\n`,
  )
  assert.equal(SETTINGS_NAV_ROW_SELECTOR, '[data-shortcut-modal="settings"] nav > div:nth-of-type(2) > button')
  // The rule hides rows only: it must not carry a colour, a font, or a width.
  assert.doesNotMatch(navHidingCss([1]), /#|rgb\(|hsl\(|font|width|height|opacity/)
})

test('the switch shadows, follows Coding Tools, and restores every host surface', (t) => {
  const fake = fakeDocument()
  const previousDocument = globalThis.document
  globalThis.document = fake.document
  t.after(() => { globalThis.document = previousDocument })

  const tools = codingTools(true)
  const harness = context({ ledger: PRODUCT_LEDGER, tools })
  const scope = settings(undefined)
  applyStreamlinedUi(harness.ctx, scope)

  // Off by default: a document without the field (or with it false) installs nothing.
  assert.equal(harness.registrations.length, 0)
  assert.equal(fake.head.length, 0)
  scope.set({ streamlinedUiEnabled: false })
  assert.equal(harness.registrations.length, 0)
  assert.equal(fake.head.length, 0)

  scope.set({ streamlinedUiEnabled: true })
  assert.deepEqual(harness.names(), [OPEN_DOCUMENT_ACTION_ID])
  const shadow = harness.registrations[0]
  assert.equal(shadow.options.priority, -10)
  assert.equal(shadow.component(), null)
  assert.equal(fake.head.length, 1)
  const style = fake.head[0]
  assert.equal(style.dataset.pluginCss, '@guowenzhang/dsh-ui-beautify/streamlined-ui.css')
  assert.match(style.textContent, /button:nth-of-type\(3\)/)
  assert.match(style.textContent, /button:nth-of-type\(4\)/)

  // Coding Tools are on, so the Agent entries keep their host occupants.
  tools.set(true)
  assert.deepEqual(harness.names(), [OPEN_DOCUMENT_ACTION_ID])

  // Coding Tools off: the chip and the header label are shadowed too.
  tools.set(false)
  assert.deepEqual(harness.names(), [
    OPEN_DOCUMENT_ACTION_ID, 'conversation.hero.agentPreset', AGENT_PRESET_HEADER_ACTION_ID,
  ])
  assert.ok(harness.registrations.slice(1).every(entry => entry.options.priority === -10))
  tools.set(true)
  assert.deepEqual(harness.names(), [OPEN_DOCUMENT_ACTION_ID])

  // A ledger change renumbers the rows instead of installing a second stylesheet.
  harness.setLedger(SIGNED_IN_LEDGER)
  assert.equal(fake.head.length, 1)
  assert.match(style.textContent, /button:nth-of-type\(4\)/)
  assert.match(style.textContent, /button:nth-of-type\(5\)/)
  assert.doesNotMatch(style.textContent, /nth-of-type\(3\)/)

  // Switching off releases every registration, the stylesheet, and the preference watch.
  scope.set({ streamlinedUiEnabled: false })
  assert.equal(harness.registrations.length, 0)
  assert.equal(fake.head.length, 0)
  assert.equal(tools.listeners.size, 0)
  assert.equal(harness.ledgerListeners.size, 0)

  // Unloading the plugin releases the settings subscription too.
  for (const dispose of harness.effects) dispose()
  assert.equal(scope.listeners.size, 0)
})

test('a host client without the Coding Tools preference keeps the Agent surface', (t) => {
  const fake = fakeDocument()
  const previousDocument = globalThis.document
  globalThis.document = fake.document
  t.after(() => { globalThis.document = previousDocument })

  const harness = context({ ledger: PRODUCT_LEDGER })
  const scope = settings({ streamlinedUiEnabled: true })
  applyStreamlinedUi(harness.ctx, scope)

  // Only the manifest surfaces go; nothing throws on the absent preference, and
  // the Agent entries stay because no snapshot ever said they should not.
  assert.deepEqual(harness.names(), [OPEN_DOCUMENT_ACTION_ID])
  assert.equal(fake.head.length, 1)
  for (const dispose of harness.effects) dispose()
  assert.equal(fake.head.length, 0)
})

test('the switch is a live field that defaults off', () => {
  assert.equal(Config.dict.streamlinedUiEnabled.meta.volatile, true)
  assert.equal(Config({}).streamlinedUiEnabled.get(), false)
  assert.equal(Config({ streamlinedUiEnabled: true }).streamlinedUiEnabled.get(), true)
})

test('both languages carry the group and the row copy', () => {
  for (const copy of [en, zh]) {
    for (const key of ['streamlinedGroup', 'streamlinedUiTitle', 'streamlinedUiDesc']) {
      assert.equal(typeof copy[key], 'string', key)
      assert.ok(copy[key].trim() !== '', key)
    }
  }
  assert.match(en.streamlinedGroup, /Streamlined/)
  assert.match(zh.streamlinedGroup, /界面精简/)
  assert.match(zh.streamlinedUiDesc, /内置插件/)
})

test('the built handoff carries the switch and its selectors', () => {
  const bundle = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
  for (const marker of [
    'streamlinedUiEnabled',
    // The bundle escapes the attribute's quotes, so the selector is matched in parts.
    'data-shortcut-modal',
    'nav > div:nth-of-type(2) > button',
    OPEN_DOCUMENT_ACTION_ID,
    'conversation.hero.agentPreset',
    'conversation.session.header.actions',
    AGENT_PRESET_HEADER_ACTION_ID,
    'display: none',
  ]) assert.ok(bundle.includes(marker), marker)
})

test('both test chains run this file', () => {
  const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  for (const script of ['test', 'test:mobile']) {
    assert.ok(manifest.scripts[script].includes('tests/streamlined-ui.test.mjs'), script)
  }
})
