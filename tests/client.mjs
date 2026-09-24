// Client-half check: load the built handoff bundle exactly the way the browser
// loader does — `window.__ModuleLoader__.load({ id, factory })` — then drive
// `apply()` against a fake client context and a small DOM shim. Nothing renders
// React here; what this covers is the part that would take the GUI down or
// silently point at the wrong file: module evaluation, the two row
// registrations, the stylesheet links and token overrides per role, and the text
// each row produces.
// Run with `node tests/client.mjs` (after `npm run build`).
import { readFileSync } from 'node:fs'
import { runInThisContext } from 'node:vm'
import {
  CACHE_ROUTE, CODE_FACES, CODE_FONT_CHOICES, FONT_CHOICES, FONT_FACES, FONTS_ROUTE,
  FONT_SETTINGS_NS, SYSTEM_FONT_ID,
} from '../lib/index.mjs'

const failures = []
const check = (label, ok, detail = '') => {
  if (ok) {
    console.log(`  ok   ${label}`)
    return
  }
  failures.push(label)
  console.log(`  FAIL ${label}${detail === '' ? '' : ` — ${detail}`}`)
}

const bundle = new URL('../lib/client.js', import.meta.url)

console.log('module evaluation')
const head = []
/** A <link> or <style> stand-in that knows how to remove itself from the head. */
const makeElement = tag => ({
  tag,
  rel: '',
  href: '',
  dataset: {},
  textContent: '',
  remove() {
    const at = head.indexOf(this)
    if (at >= 0) head.splice(at, 1)
  },
})
globalThis.document = {
  head: { appendChild(element) { head.push(element) } },
  querySelector: () => null,
  createElement: tag => makeElement(tag),
}

// Every bare specifier the bundle requires has to be answered here. A new
// import in the client half fails this test with the name it needs.
const stores = []
// React is stubbed down to a call recorder, so a render can be inspected as the
// element tree it produced rather than as HTML. A function element is invoked
// as well as recorded — the registered rows wrap a shared picker, and what the
// assertions describe is what that picker produces.
const elements = []
const record = (type, props) => {
  const element = { type, props }
  elements.push(element)
  return typeof type === 'function' ? type(props) : element
}
const Menu = () => null
const IconChevronDownOutlineRegular = () => null
const externals = {
  react: {
    // A row refreshes its cache reading from an effect; running it here is what
    // a mount does.
    useEffect: (effect) => { effect() },
    useState: value => [value, () => {}],
  },
  'react/jsx-runtime': { jsx: record, jsxs: record, Fragment: 'Fragment' },
  '@deepseek-ai/dsh-client-ui-primitives': { Menu, IconChevronDownOutlineRegular, Tag: () => null },
  '@deepseek-ai/dsh-client-store': {
    createSnapshotStore: (initial) => {
      let current = initial
      const store = { get: () => current, set: (value) => { current = value }, subscribe: () => () => {} }
      stores.push(store)
      return store
    },
  },
}

// The Host answers the cache read-out; the plugin body only ever reads it.
const cacheRequests = []
globalThis.fetch = async (url) => {
  cacheRequests.push(String(url))
  return {
    ok: true,
    json: async () => ({ faces: { 'lxgw-wenkai': { bytes: 4_500_000, shardsCached: 12, shardsTotal: 194 } } }),
  }
}

let handoffId
let plugin
globalThis.window = {
  __ModuleLoader__: {
    load({ id, factory }) {
      handoffId = id
      plugin = factory(name => {
        if (!(name in externals)) throw new Error(`unstubbed require: ${name}`)
        return externals[name]
      })
    },
  },
}
runInThisContext(readFileSync(bundle, 'utf8'), { filename: bundle.pathname })

check('registers under the plugin id', handoffId === '@guowenzhang/dsh-ui-beautify', String(handoffId))
check('exports an apply', typeof plugin?.apply === 'function')
check(
  'injects the services it reads',
  ['theme', 'slots', 'locale', 'configForms'].every(service => plugin.inject.includes(service)),
  plugin?.inject?.join(','),
)

console.log('registration and application')
let stored = { font: 'lxgw-wenkai', codeFont: SYSTEM_FONT_ID }
const subscribers = []
const disposers = []
const registrations = []
let tokens
let released = 0
const scope = {
  getSnapshot: () => ({ status: 'ready', writable: true, value: stored }),
  subscribe: (listener) => { subscribers.push(listener); return () => {} },
  set: async (key, value) => { stored = { ...stored, [key]: value } },
}
plugin.apply({
  effect(fn) {
    const dispose = fn()
    if (typeof dispose === 'function') disposers.push(dispose)
    return dispose
  },
  locale: { register: () => () => {}, bind: () => key => key },
  configForms: { get: () => scope },
  theme: {
    overrideTokens(id, table) {
      tokens = { id, table }
      return () => { released += 1 }
    },
  },
  slots: {
    inject: (_slot, register) => register(),
    register(definition, component) { registrations.push({ definition, component }); return () => {} },
  },
})
const bodyRow = registrations.find(entry => entry.definition.id === 'ui-beautify')
const codeRow = registrations.find(entry => entry.definition.id === 'ui-beautify-code')
const links = () => head.filter(element => element.rel === 'stylesheet')
const hrefs = () => links().map(link => link.href)
const setStored = (values) => {
  stored = { ...stored, ...values }
  for (const notify of subscribers) notify()
}
const snapshot = () => stores.at(-1)?.get()
const settle = () => new Promise(resolve => { setTimeout(resolve, 10) })

check('registers two General-settings rows', registrations.length === 2, String(registrations.length))
check(
  'the body row sits under the interface font size',
  bodyRow?.definition.name === 'settings.general.item'
    && bodyRow.definition.order === 11.5,
  JSON.stringify(bodyRow?.definition),
)
check(
  'the code row sits directly under it',
  codeRow?.definition.name === 'settings.general.item'
    && codeRow.definition.order === 11.6,
  JSON.stringify(codeRow?.definition),
)
check('each row renders a component', typeof bodyRow?.component === 'function' && typeof codeRow?.component === 'function')

const multiSheet = FONT_FACES.find(face => face.source.sheets.length > 1)
check('the catalogue has a multi-sheet face to exercise', multiSheet !== undefined)
check('one link per sheet of the applied body face', links().length === 2, String(links().length))
check(
  'each link points at its package-relative sheet',
  hrefs().join(',')
    === multiSheet.source.sheets.map(sheet => `${FONTS_ROUTE}/${multiSheet.id}/${sheet}`).join(','),
  hrefs().join(','),
)
check('each link is tagged as the plugin owns it', links().every(link => link.dataset.plugin === handoffId))
check(
  'rebinds --dsw-font-family to the body family',
  tokens?.table['--dsw-font-family'].light.startsWith(`'${multiSheet.family}', `),
  String(tokens?.table['--dsw-font-family']?.light?.slice(0, 40)),
)
check('overrides both colour schemes', tokens?.table['--dsw-font-family'].dark === tokens?.table['--dsw-font-family'].light)
check(
  'the code default installs no token of its own',
  tokens?.table['--ds-font-family-code'] === undefined && tokens?.table['--dsw-font-mono'] === undefined,
  Object.keys(tokens?.table ?? {}).join(','),
)
check('the link and the token swap together', Object.keys(tokens?.table ?? {}).join(',') === '--dsw-font-family')

setStored({ font: SYSTEM_FONT_ID })
check('the body default removes every stylesheet', links().length === 0, String(links().length))
check('and releases the token layer', released === 1, String(released))

const singleSheet = FONT_FACES.find(face => face.source.sheets.length === 1)
setStored({ font: singleSheet.id })
check('a single-sheet body face links one stylesheet', links().length === 1, String(links().length))
check(
  'at its own route',
  hrefs()[0] === `${FONTS_ROUTE}/${singleSheet.id}/${singleSheet.source.sheets[0]}`,
  String(hrefs()[0]),
)

console.log('the code role is configured on its own')
const codeFace = CODE_FACES[0]
setStored({ codeFont: codeFace.id })
check(
  'choosing a code face links its sheet without touching the body link',
  hrefs().join(',') === [
    `${FONTS_ROUTE}/${singleSheet.id}/${singleSheet.source.sheets[0]}`,
    `${FONTS_ROUTE}/${codeFace.id}/${codeFace.source.sheets[0]}`,
  ].join(','),
  hrefs().join(','),
)
check(
  'rebinds the code token',
  tokens?.table['--ds-font-family-code'].light.startsWith(`'${codeFace.family}', `),
  String(tokens?.table['--ds-font-family-code']?.light?.slice(0, 40)),
)
check(
  'and the undefined mono token four components read',
  tokens?.table['--dsw-font-mono'].light === tokens?.table['--ds-font-family-code'].light,
)
check(
  'installing both roles takes one layer, not two',
  Object.keys(tokens?.table ?? {}).sort().join(',') === '--ds-font-family-code,--dsw-font-family,--dsw-font-mono',
  Object.keys(tokens?.table ?? {}).join(','),
)

setStored({ codeFont: SYSTEM_FONT_ID })
check('the code default drops only the code link', hrefs().join(',') === `${FONTS_ROUTE}/${singleSheet.id}/${singleSheet.source.sheets[0]}`, hrefs().join(','))
check('and leaves the body token in place', tokens?.table['--dsw-font-family'] !== undefined)

console.log('cache read-out')
const bodyFace = bodyRow.definition.inject()
check('a row can ask for a fresh reading', typeof bodyFace.refreshCache === 'function')
bodyFace.refreshCache()
await settle()
check('the Host is asked on the plugin\'s own route', cacheRequests.every(url => url === CACHE_ROUTE), cacheRequests.join(','))
check(
  'the answer reaches the snapshot the rows render',
  snapshot()?.cache['lxgw-wenkai']?.shardsTotal === 194 && snapshot()?.cache['lxgw-wenkai']?.bytes === 4_500_000,
  JSON.stringify(snapshot()?.cache),
)
check('a reading is not a choice', snapshot()?.font === singleSheet.id, String(snapshot()?.font))

console.log('rendered rows')
// CSS Modules hash every local name, so a class is matched by its `_<local>`
// suffix: a substring match would count `rowText` as a `row`.
const byClass = name => elements.filter(element =>
  String(element.props?.className ?? '').split(/\s+/).some(token => token.endsWith(`_${name}`)))
// The dictionary is the locale service's; what this checks is which keys and
// which values each row asks it for.
const t = (key, params) => params === undefined ? key : `${key}(${JSON.stringify(params)})`
const render = (entry) => {
  elements.length = 0
  entry.component({
    t,
    useFontSettings: selector => selector(snapshot()),
    choose: () => {},
    refreshCache: () => {},
  })
  return {
    titles: byClass('title').map(element => element.props.children),
    descs: byClass('desc').map(element => element.props.children),
    metas: byClass('meta').map(element => element.props.children),
    selector: byClass('selector')[0],
    menu: elements.find(element => element.type === Menu),
  }
}

setStored({ font: 'lxgw-wenkai', codeFont: 'fira-code' })
const body = render(bodyRow)
check('the body row names itself', body.titles[0] === 'title', String(body.titles[0]))
check('and describes the chosen body face', body.descs[0] === 'fontLxgwWenkaiDesc', String(body.descs[0]))
check(
  'reporting its shard count and how to refresh it',
  body.metas[0] === 'cachePresent({"size":"4.3 unitMb","cached":12,"total":194}) · cacheHint',
  String(body.metas[0]),
)
check('showing it on the selector', body.selector?.props.children[0] === 'fontLxgwWenkai', JSON.stringify(body.selector?.props.children))
check('opening a menu marked with the stored choice', body.menu?.props.selectedId === 'lxgw-wenkai', String(body.menu?.props.selectedId))
check(
  'offering every body choice, grouped by writing system',
  body.menu?.props.items.filter(item => item.type === 'label').map(item => item.text).join(',') === 'groupSystem,groupCjk,groupLatin'
    && body.menu?.props.items.filter(item => item.type === undefined).length === FONT_CHOICES.length,
  String(body.menu?.props.items.filter(item => item.type === undefined).length),
)
check(
  'labelling a cached face with what it holds',
  body.menu?.props.items.find(item => item.id === 'lxgw-wenkai')?.label === 'fontLxgwWenkai · cacheCached({"size":"4.3 unitMb"})',
  String(body.menu?.props.items.find(item => item.id === 'lxgw-wenkai')?.label),
)
check(
  'offering no body face on the code row',
  body.menu?.props.items.some(item => item.id === 'jetbrains-mono') === false,
)

const code = render(codeRow)
check('the code row names itself', code.titles[0] === 'codeTitle', String(code.titles[0]))
check('and describes the chosen code face', code.descs[0] === 'codeFontFiraCodeDesc', String(code.descs[0]))
check('showing it on the selector', code.selector?.props.children[0] === 'codeFontFiraCode', JSON.stringify(code.selector?.props.children))
check(
  'offering every code choice and no body face',
  code.menu?.props.items.filter(item => item.type === undefined).length === CODE_FONT_CHOICES.length
    && code.menu?.props.items.some(item => item.id === 'noto-sans-sc') === false,
  String(code.menu?.props.items.filter(item => item.type === undefined).length),
)
check(
  'keeping the system choice named for the code stack',
  code.menu?.props.items.find(item => item.id === SYSTEM_FONT_ID)?.label === 'codeFontSystem',
  String(code.menu?.props.items.find(item => item.id === SYSTEM_FONT_ID)?.label),
)
check(
  'labelling an untouched code face as not downloaded',
  code.menu?.props.items.find(item => item.id === 'maple-mono-cn')?.label === 'codeFontMapleMonoCn · cacheAbsent',
  String(code.menu?.props.items.find(item => item.id === 'maple-mono-cn')?.label),
)
check('the code default carries no cache line', code.metas[0] === 'cacheAbsent · cacheHint' || code.metas[0] === '', String(code.metas[0]))

setStored({ font: 'not-a-face', codeFont: 'not-a-code-face' })
check(
  'unknown stored values fall back per role',
  snapshot()?.font === 'noto-sans-sc' && snapshot()?.codeFont === SYSTEM_FONT_ID,
  `${String(snapshot()?.font)} / ${String(snapshot()?.codeFont)}`,
)

for (const dispose of disposers) dispose()

if (failures.length > 0) {
  console.error(`\n${failures.length} check(s) failed`)
  process.exit(1)
}
console.log('\nall checks passed')
