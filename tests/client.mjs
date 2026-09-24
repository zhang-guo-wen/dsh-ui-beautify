// Client-half check: load the built handoff bundle exactly the way the browser
// loader does — `window.__ModuleLoader__.load({ id, factory })` — then drive
// `apply()` against a fake client context and a small DOM shim. Nothing renders
// React here; what this covers is the part that would take the GUI down or
// silently point at the wrong file: module evaluation, the section
// registration, the stylesheet links per face, and the token override.
// Run with `node tests/client.mjs` (after `npm run build`).
import { readFileSync } from 'node:fs'
import { runInThisContext } from 'node:vm'
import { CACHE_ROUTE, FONT_CHOICES, FONT_FACES, FONTS_ROUTE, FONT_SETTINGS_NS, SYSTEM_FONT_ID } from '../lib/index.mjs'

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
// React is stubbed down to a call recorder, so the section's render can be
// inspected as the element tree it produced rather than as HTML.
const elements = []
const record = (type, props) => {
  const element = { type, props }
  elements.push(element)
  return element
}
const externals = {
  react: {
    // The section refreshes its cache reading from an effect; running it here
    // is what a mount does.
    useEffect: (effect) => { effect() },
    useState: value => [value, () => {}],
  },
  'react/jsx-runtime': { jsx: record, jsxs: record, Fragment: 'Fragment' },
  '@deepseek-ai/dsh-client-ui-primitives': { Tag: () => null },
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
let stored = { font: 'lxgw-wenkai' }
const subscribers = []
const disposers = []
let tokens
let released = 0
let section
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
    register(definition, component) { section = { definition, component }; return () => {} },
  },
})
const links = () => head.filter(element => element.rel === 'stylesheet')
const setFont = (font) => {
  stored = { font }
  for (const notify of subscribers) notify()
}
const snapshot = () => stores.at(-1)?.get()
const settle = () => new Promise(resolve => { setTimeout(resolve, 10) })

check('registers the settings section', section?.definition?.id === FONT_SETTINGS_NS && section.definition.order === 12)
check('the section renders a component', typeof section?.component === 'function')

const multiSheet = FONT_FACES.find(face => face.source.sheets.length > 1)
const singleSheet = FONT_FACES.find(face => face.source.sheets.length === 1)
check('the catalogue has both sheet layouts to exercise', multiSheet !== undefined && singleSheet !== undefined)

check('one link per sheet of the applied face', links().length === 2, String(links().length))
check(
  'each link points at its package-relative sheet',
  links().map(link => link.href).join(',')
    === [multiSheet.source.sheets[0], multiSheet.source.sheets[1]]
      .map(sheet => `${FONTS_ROUTE}/${multiSheet.id}/${sheet}`).join(','),
  links().map(link => link.href).join(','),
)
check('each link is tagged as the plugin owns it', links().every(link => link.dataset.plugin === handoffId))
check(
  'rebinds --dsw-font-family to the applied family',
  tokens?.table['--dsw-font-family'].light.startsWith(`'${multiSheet.family}', `),
  String(tokens?.table['--dsw-font-family']?.light?.slice(0, 40)),
)
check('overrides both colour schemes', tokens?.table['--dsw-font-family'].dark === tokens?.table['--dsw-font-family'].light)

setFont(SYSTEM_FONT_ID)
check('the system default removes every stylesheet', links().length === 0, String(links().length))
check('and releases the token layer', released === 1, String(released))

setFont(singleSheet.id)
check('a single-sheet face links one stylesheet', links().length === 1, String(links().length))
check(
  'at its own route',
  links()[0]?.href === `${FONTS_ROUTE}/${singleSheet.id}/${singleSheet.source.sheets[0]}`,
  String(links()[0]?.href),
)

setFont('not-a-face')
check(
  'an unknown stored value falls back to the default face',
  links()[0]?.href === `${FONTS_ROUTE}/noto-sans-sc/index.css`,
  String(links()[0]?.href),
)

console.log('cache read-out')
const sectionFace = section.definition.inject()
check('the section can ask for a fresh reading', typeof sectionFace.refreshCache === 'function')
check('the reading starts empty', JSON.stringify(snapshot()?.cache) === '{}', JSON.stringify(snapshot()?.cache))
sectionFace.refreshCache()
await settle()
check('the Host is asked on the plugin\'s own route', cacheRequests.every(url => url === CACHE_ROUTE), cacheRequests.join(','))
check(
  'the answer reaches the snapshot the cards render',
  snapshot()?.cache['lxgw-wenkai']?.shardsTotal === 194 && snapshot()?.cache['lxgw-wenkai']?.bytes === 4_500_000,
  JSON.stringify(snapshot()?.cache),
)
check('a reading is not a choice', snapshot()?.font === 'noto-sans-sc', String(snapshot()?.font))

console.log('rendered cards')
let refreshes = 0
// CSS Modules hash every local name, so a class is matched by its `_<local>`
// suffix: a substring match would count `cardHead` as a `card`.
const byClass = name => elements.filter(element =>
  String(element.props?.className ?? '').split(/\s+/).some(token => token.endsWith(`_${name}`)))
section.component({
  // The dictionary is the locale service's; what this checks is which keys and
  // which values the component asks it for.
  t: (key, params) => params === undefined ? key : `${key}(${JSON.stringify(params)})`,
  useFontSettings: selector => selector(snapshot()),
  choose: () => {},
  refreshCache: () => { refreshes += 1 },
})
check('mounting the section asks for a reading', refreshes === 1, String(refreshes))
check(
  'presents the system default and both writing systems',
  byClass('groupLabel').map(element => element.props.children).join(',') === 'groupSystem,groupCjk,groupLatin',
  byClass('groupLabel').map(element => element.props.children).join(','),
)
check('one card per choice', byClass('card').length === FONT_CHOICES.length, String(byClass('card').length))
const cacheLines = byClass('cardMeta').map(element => element.props.children)
check('the system default carries no cache line', cacheLines.length === FONT_FACES.length, String(cacheLines.length))
check(
  'a face with a reading shows its size and shard count',
  cacheLines.includes('cachePresent({"size":"4.3 unitMb","cached":12,"total":194})'),
  cacheLines.find(line => line.startsWith('cachePresent(')) ?? cacheLines[0],
)
check(
  'a face without a reading says it is not downloaded',
  cacheLines.filter(line => line === 'cacheAbsent').length === FONT_FACES.length - 1,
  cacheLines.filter(line => line === 'cacheAbsent').length + '',
)

for (const dispose of disposers) dispose()

if (failures.length > 0) {
  console.error(`\n${failures.length} check(s) failed`)
  process.exit(1)
}
console.log('\nall checks passed')
