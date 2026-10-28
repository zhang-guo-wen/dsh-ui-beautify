import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Config } from '../lib/index.mjs'
import { en, zh } from '../src/client/locales.ts'
import {
  AGENT_PRESET_HEADER_ACTION_ID, HIDDEN_SETTINGS_SECTIONS, MOVED_SIDEBAR_PANELS, OPEN_DOCUMENT_ACTION_ID,
  SIDEBAR_PANEL_ROW_SELECTOR, SETTINGS_NAV_ROW_SELECTOR, applyStreamlinedUi, hiddenSectionRows,
  movedSidebarRows, navHidingCss, orderedRowNumbers, sidebarHidingCss,
} from '../src/client/streamlined-ui.ts'

/** One row registration, as its owner projects it. */
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

/** The sidebar's global panel rows as their registrants project them. */
const PANEL_LEDGER = [
  section('plugins', 0),
  section('schedules', 10),
]

/** The `main` keyed-slot entries that make a panel selectable. */
const MAIN_LEDGER = [
  { options: { key: 'plugins' } },
  { options: { key: 'schedules' } },
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
 * A client context carrying just what the switch touches: the per-slot ledgers,
 * the slot ledger writes, the effect collection, the label dictionaries, the
 * layout service, and the shared preference. `tools` absent models a host client
 * that predates that preference.
 */
function context({ ledger = [], panels = PANEL_LEDGER, main = MAIN_LEDGER, tools } = {}) {
  const ledgers = new Map([
    ['settings.section', ledger],
    ['sidebar.panellist', panels],
    ['main', main],
  ])
  const listeners = new Map()
  const registrations = []
  const effects = []
  const panelSelections = []
  const listenersOf = (key) => {
    let set = listeners.get(key)
    if (set === undefined) {
      set = new Set()
      listeners.set(key, set)
    }
    return set
  }
  const notify = (key) => {
    for (const listener of [...listenersOf(key)]) listener()
  }
  return {
    registrations,
    effects,
    panelSelections,
    listenersOf,
    names: () => registrations.map(entry => entry.options.id ?? entry.options.name),
    setLedger: (next) => {
      ledgers.set('settings.section', next)
      notify('settings.section')
    },
    setPanels: (next) => {
      ledgers.set('sidebar.panellist', next)
      notify('sidebar.panellist')
    },
    setMain: (next) => {
      ledgers.set('main', next)
      notify('main')
    },
    ctx: {
      effect(callback) {
        const dispose = callback()
        effects.push(dispose)
        return dispose
      },
      locale: { bind: () => key => en[key] },
      layout: { selectPanel(id) { panelSelections.push(id) } },
      slots: {
        entries: (key) => ledgers.get(key) ?? [],
        subscribe(key, listener) {
          const set = listenersOf(key)
          set.add(listener)
          return () => { set.delete(listener) }
        },
        inject(name, register) {
          assert.ok([
            'settings.action', 'conversation.hero.agentPreset', 'conversation.session.header.actions', 'settings.section',
          ].includes(name), name)
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

test('locates the relocated sidebar rows by the sidebar projection', () => {
  assert.deepEqual(MOVED_SIDEBAR_PANELS.map(panel => panel.panelId), ['plugins', 'schedules'])
  assert.deepEqual(movedSidebarRows(PANEL_LEDGER), [1, 2])
  // Other rows keep their place; the order decides the row number.
  assert.deepEqual(movedSidebarRows([
    section('schedules', -10),
    section('custom-panel', 5),
    section('plugins', 20),
  ]), [1, 3])
  // The shared projection sorts by order and keeps ties in registration order.
  assert.deepEqual(movedSidebarRows([section('plugins', 5), section('schedules', 5)]), [1, 2])
  // An absent order is zero, as the sidebar reads it.
  assert.deepEqual(movedSidebarRows([section('plugins'), section('custom-panel', 0)]), [1])
  // A deployment without those panels hides nothing.
  assert.deepEqual(movedSidebarRows([section('custom-panel', 0)]), [])
  assert.deepEqual(movedSidebarRows([]), [])
  // A caller may address one panel on its own.
  assert.deepEqual(movedSidebarRows(PANEL_LEDGER, ['schedules']), [2])
  // The shared projection is the one the settings navigation uses.
  assert.deepEqual(orderedRowNumbers(PANEL_LEDGER, ['plugins', 'schedules']), [1, 2])
})

test('the settings stylesheet names one row selector per position and nothing else', () => {
  assert.equal(navHidingCss([]), '')
  assert.equal(
    navHidingCss([2, 4]),
    `${SETTINGS_NAV_ROW_SELECTOR}:nth-of-type(2),\n${SETTINGS_NAV_ROW_SELECTOR}:nth-of-type(4) {\n  display: none;\n}\n`,
  )
  assert.equal(SETTINGS_NAV_ROW_SELECTOR, '[data-shortcut-modal="settings"] nav > div:nth-of-type(2) > button')
  // The rule hides rows only: it must not carry a colour, a font, or a width.
  assert.doesNotMatch(navHidingCss([1]), /#|rgb\(|hsl\(|font|width|height|opacity/)
})

test('the sidebar stylesheet hides one row selector per position and nothing else', () => {
  assert.equal(sidebarHidingCss([]), '')
  assert.equal(
    sidebarHidingCss([1, 2]),
    `${SIDEBAR_PANEL_ROW_SELECTOR}:nth-of-type(1),\n${SIDEBAR_PANEL_ROW_SELECTOR}:nth-of-type(2) {\n  display: none;\n}\n`,
  )
  assert.equal(SIDEBAR_PANEL_ROW_SELECTOR, '[data-slot="sidebar"] > div > nav > button')
  // Properties, not colours: the row is removed from layout, nothing is repainted.
  assert.doesNotMatch(sidebarHidingCss([1]), /#|rgb\(|hsl\(|font|width|height|opacity/)
})

test('the switch shadows, relocates, follows Coding Tools, and restores every host surface', (t) => {
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
  assert.deepEqual(harness.names(), [
    OPEN_DOCUMENT_ACTION_ID,
    ...MOVED_SIDEBAR_PANELS.map(panel => panel.sectionId),
  ])
  const shadow = harness.registrations[0]
  assert.equal(shadow.options.priority, -10)
  assert.equal(shadow.component(), null)
  assert.equal(fake.head.length, 2)

  // The navigation stylesheet targets the hidden settings pages.
  const navStyle = fake.head[0]
  assert.equal(navStyle.dataset.pluginCss, '@guowenzhang/dsh-ui-beautify/streamlined-ui.css')
  assert.match(navStyle.textContent, /button:nth-of-type\(3\)/)
  assert.match(navStyle.textContent, /button:nth-of-type\(4\)/)

  // The sidebar stylesheet targets the moved panel rows.
  const sidebarStyle = fake.head[1]
  assert.equal(sidebarStyle.dataset.pluginCss, '@guowenzhang/dsh-ui-beautify/sidebar-panels.css')
  assert.match(sidebarStyle.textContent, /button:nth-of-type\(1\)/)
  assert.match(sidebarStyle.textContent, /button:nth-of-type\(2\)/)

  // The relocated navigation rows carry the plugin's labels and open their page.
  const [pluginsRow, schedulesRow] = harness.registrations.slice(1)
  assert.equal(pluginsRow.options.id, 'ui-beautify-plugins')
  assert.equal(pluginsRow.options.order, 16)
  assert.equal(pluginsRow.options.label(), en.pluginsDestination)
  assert.equal(schedulesRow.options.id, 'ui-beautify-schedules')
  assert.equal(schedulesRow.options.order, 21)
  assert.equal(schedulesRow.options.label(), en.schedulesDestination)
  assert.equal(pluginsRow.options.inject().openDestination(), true)
  assert.deepEqual(harness.panelSelections, ['plugins'])
  assert.equal(schedulesRow.options.inject().openDestination(), true)
  assert.deepEqual(harness.panelSelections, ['plugins', 'schedules'])
  // A page the deployment never registered keeps the dialog open instead of throwing.
  harness.setMain([])
  assert.equal(pluginsRow.options.inject().openDestination(), false)
  assert.deepEqual(harness.panelSelections, ['plugins', 'schedules'])

  // Coding Tools are on, so the Agent entries keep their host occupants.
  tools.set(true)
  assert.deepEqual(harness.names(), [
    OPEN_DOCUMENT_ACTION_ID,
    ...MOVED_SIDEBAR_PANELS.map(panel => panel.sectionId),
  ])

  // Coding Tools off: the chip and the header label are shadowed too.
  tools.set(false)
  assert.deepEqual(harness.names(), [
    OPEN_DOCUMENT_ACTION_ID,
    ...MOVED_SIDEBAR_PANELS.map(panel => panel.sectionId),
    'conversation.hero.agentPreset',
    AGENT_PRESET_HEADER_ACTION_ID,
  ])
  assert.deepEqual(harness.registrations.filter(entry => entry.options.priority === -10).map(entry => entry.options.name ?? entry.options.id), [
    'settings.action', 'conversation.hero.agentPreset', 'conversation.session.header.actions',
  ])
  tools.set(true)
  assert.deepEqual(harness.names(), [
    OPEN_DOCUMENT_ACTION_ID,
    ...MOVED_SIDEBAR_PANELS.map(panel => panel.sectionId),
  ])

  // A ledger change renumbers the rows instead of installing a second stylesheet.
  harness.setLedger(SIGNED_IN_LEDGER)
  assert.equal(fake.head.length, 2)
  assert.match(navStyle.textContent, /button:nth-of-type\(4\)/)
  assert.match(navStyle.textContent, /button:nth-of-type\(5\)/)
  assert.doesNotMatch(navStyle.textContent, /nth-of-type\(3\)/)

  // A panel ledger change renumbers the sidebar rows the same way.
  harness.setPanels([section('custom-panel', 0), section('schedules', 10)])
  assert.equal(fake.head.length, 2)
  assert.match(sidebarStyle.textContent, /button:nth-of-type\(2\)/)
  assert.doesNotMatch(sidebarStyle.textContent, /nth-of-type\(1\)/)

  // Switching off releases every registration, both stylesheets, and every preference watch.
  scope.set({ streamlinedUiEnabled: false })
  assert.equal(harness.registrations.length, 0)
  assert.equal(fake.head.length, 0)
  assert.equal(tools.listeners.size, 0)
  assert.equal(harness.listenersOf('settings.section').size, 0)
  assert.equal(harness.listenersOf('sidebar.panellist').size, 0)

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

  // Only the surfaces this plugin owns go; nothing throws on the absent
  // preference, and the Agent entries stay because no snapshot ever said they
  // should not.
  assert.deepEqual(harness.names(), [
    OPEN_DOCUMENT_ACTION_ID,
    ...MOVED_SIDEBAR_PANELS.map(panel => panel.sectionId),
  ])
  assert.equal(fake.head.length, 2)
  for (const dispose of harness.effects) dispose()
  assert.equal(fake.head.length, 0)
})

test('the switch is a live field that defaults off', () => {
  assert.equal(Config.dict.streamlinedUiEnabled.meta.volatile, true)
  assert.equal(Config({}).streamlinedUiEnabled.get(), false)
  assert.equal(Config({ streamlinedUiEnabled: true }).streamlinedUiEnabled.get(), true)
})

test('both languages carry the group, the row copy, and the relocated labels', () => {
  for (const copy of [en, zh]) {
    for (const key of [
      'streamlinedGroup', 'streamlinedUiTitle', 'streamlinedUiDesc', 'pluginsDestination', 'schedulesDestination',
    ]) {
      assert.equal(typeof copy[key], 'string', key)
      assert.ok(copy[key].trim() !== '', key)
    }
  }
  assert.match(en.streamlinedGroup, /Streamlined/)
  assert.match(zh.streamlinedGroup, /界面精简/)
  assert.match(zh.streamlinedUiDesc, /内置插件/)
  // The relocated labels keep the sidebar entries' names in both languages.
  assert.equal(zh.pluginsDestination, '插件')
  assert.equal(zh.schedulesDestination, '自动化任务')
  assert.equal(en.pluginsDestination, 'Plugins')
  assert.equal(en.schedulesDestination, 'Automation tasks')
})

test('the built handoff carries the switch, the selectors, and the relocated rows', () => {
  const bundle = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
  for (const marker of [
    'streamlinedUiEnabled',
    // The bundle escapes the attribute's quotes, so the selectors are matched in parts.
    'data-shortcut-modal',
    'nav > div:nth-of-type(2) > button',
    'data-slot',
    'sidebar',
    'nav > button',
    'sidebar-panels.css',
    'ui-beautify-plugins',
    'ui-beautify-schedules',
    'pluginsDestination',
    'schedulesDestination',
    'sidebar.panellist',
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
