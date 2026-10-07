// Client-half check: load the built handoff bundle exactly the way the browser
// loader does — `window.__ModuleLoader__.load({ id, factory })` — then drive
// `apply()` against a fake client context and a small DOM shim. React is stubbed
// down to a call recorder rather than rendered; what this covers is the part
// that would take the GUI down or silently point at the wrong file: module
// evaluation, the row and dock registrations, the stylesheet links and token
// overrides per role, the text each row produces, and the composer lane's motion.
// Run with `node tests/client.mjs` (after `npm run build`).
import { readFileSync } from 'node:fs'
import { runInThisContext } from 'node:vm'
import {
  BRAND_ROUTE, CACHE_ROUTE, CODE_FACES, CODE_FONT_CHOICES, FONT_CHOICES, FONT_FACES, FONTS_ROUTE,
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
const headline = { textContent: '探索未至之境' }
let headlineObserver
globalThis.MutationObserver = class {
  constructor(callback) { this.callback = callback; headlineObserver = this }
  observe() {}
  disconnect() {}
  notify() { this.callback() }
}
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
  body: {},
  documentElement: {},
  addEventListener() {},
  removeEventListener() {},
  head: { appendChild(element) { head.push(element) } },
  querySelector: () => null,
  querySelectorAll: selector => selector === '[class*="_headline"] [class*="_titleGroup"] > span:first-child' ? [headline] : [],
  createElement: tag => makeElement(tag),
}

// Every bare specifier the bundle requires has to be answered here. A new
// import in the client half fails this test with the name it needs.
const stores = []
// React is stubbed down to a call recorder, so a render can be inspected as the
// element tree it produced rather than as HTML. A function element is invoked
// as well as recorded — the registered rows wrap a shared picker, and what the
// assertions describe is what that picker produces.
//
// The composer lane drives its motion from an animation frame over host nodes,
// so the stub models the three things that depends on: host refs, effects that
// run after commit, and a clock the assertions can advance frame by frame.
const elements = []
/** Lane width the frame loop measures; the real value comes from layout. */
const LANE_WIDTH = 800
/**
 * Rendered width of the cyclist, mirroring `BIKE_WIDTH_PX` in BikeLane.tsx.
 *
 * The traverse is this much longer than the lane at each end, so the tests that
 * reason about where the figure is on screen need the same number.
 */
const BIKE_WIDTH = 36
/** Host-node stand-in: enough for the frame loop to write to and be read back. */
const makeNode = tag => ({
  tag,
  style: {},
  clientWidth: LANE_WIDTH,
  attributes: {},
  setAttribute(name, value) { this.attributes[name] = value },
})
const record = (type, props) => {
  const element = { type, props }
  elements.push(element)
  if (typeof type === 'function') return type(props)
  // React attaches a host ref when the node mounts and keeps that same node
  // across re-renders, while the frame loop closes over it.
  if (props?.ref !== undefined && props.ref.current === null) props.ref.current = makeNode(type)
  return element
}
const Menu = () => null
const IconChevronDownOutlineRegular = () => null
// The quick replies' tag is a primitive: recorded as its own element type so the
// assertions can read the props (the click handler, the label) the primitive
// would have turned into a button.
const Pill = props => record('pill', props)
const Switch = props => record('switch', props)

/** Hook slots of each mounted component, kept in call order across re-renders. */
const instances = new Map()
let hooks = []
let cursor = 0
let due = []
/** Whether an effect's dependencies moved since the same slot last ran. */
const depsMoved = (previous, next) => previous === undefined || next === undefined
  || previous.length !== next.length
  || previous.some((dep, at) => !Object.is(dep, next[at]))
const reactStub = {
  // Memoization is a render-count optimization, which this recorder does not
  // model; identity keeps the memoized component callable like any other.
  memo: component => component,
  useEffect: (effect, deps) => {
    const at = cursor++
    if (!depsMoved(hooks[at], deps)) return
    hooks[at] = deps
    due.push(effect)
  },
  useRef: (initial) => {
    const at = cursor++
    hooks[at] ??= { current: initial }
    return hooks[at]
  },
  useState: (initial) => {
    // State survives across mounts of the same instance, like React's does, so a
    // handler that sets state plus a following mount models a re-render. The
    // setter records the value and returns; the assertions drive the next mount.
    const at = cursor++
    hooks[at] ??= { value: typeof initial === 'function' ? initial() : initial }
    return [hooks[at].value, (next) => {
      hooks[at].value = typeof next === 'function' ? next(hooks[at].value) : next
    }]
  },
}
/**
 * Render one registered component the way the renderer would: a fresh element
 * tree, hooks carried over from this instance's previous render, then the
 * effects React runs after commit.
 */
const mount = (key, component, props) => {
  elements.length = 0
  hooks = instances.get(key) ?? []
  instances.set(key, hooks)
  cursor = 0
  due = []
  component(props)
  const pending = due
  due = []
  for (const effect of pending) effect()
}

// The animation frame is captured rather than run, so the lane can be stepped on
// a clock the assertions own. `performance.now()` is that same clock: the frame
// loop and the output samples have to agree on what time it is.
const clock = { time: 0, frame: null }
Object.defineProperty(globalThis, 'performance', { configurable: true, value: { now: () => clock.time } })
globalThis.requestAnimationFrame = (callback) => { clock.frame = callback; return 1 }
globalThis.cancelAnimationFrame = () => { clock.frame = null }

const externals = {
  react: reactStub,
  'react/jsx-runtime': { jsx: record, jsxs: record, Fragment: 'Fragment' },
  'react-dom': { createPortal: node => node },
  '@deepseek-ai/dsh-client-ui-primitives': { Menu, IconChevronDownOutlineRegular, IconPanelLeftOutlineRegular: () => null, Button: props => record('button', props), StateDot: props => record('state-dot', props), Pill, Switch, Tag: () => null },
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
  if (String(url).startsWith(`${BRAND_ROUTE}/upload/`)) return {
    ok: true,
    json: async () => ({ url: `${BRAND_ROUTE}/assets/${'a'.repeat(64)}.png` }),
  }
  cacheRequests.push(String(url))
  return {
    ok: true,
    json: async () => ({ faces: { 'lxgw-wenkai': { bytes: 4_500_000, shardsCached: 12, shardsTotal: 194 } } }),
  }
}

// `prefers-reduced-motion` is read once, when the plugin body runs; the last
// section flips it and applies the plugin again.
let reducedMotion = false
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
  matchMedia: () => ({ matches: reducedMotion, addEventListener() {}, removeEventListener() {} }),
  MutationObserver: globalThis.MutationObserver,
  requestAnimationFrame: globalThis.requestAnimationFrame,
  cancelAnimationFrame: globalThis.cancelAnimationFrame,
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
let stored = { font: 'lxgw-wenkai', codeFont: SYSTEM_FONT_ID, logo: '', brandIcon: '', brandName: '', tagline: '' }
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
const makeCtx = (into) => ({
  get(name) { return name === 'remote' ? { $host: { isLoopback: true } } : undefined },
  inject(_names, callback) { callback({ get: () => ({ openSession() {} }) }) },
  effect(fn) {
    const dispose = fn()
    if (typeof dispose === 'function') disposers.push(dispose)
    return dispose
  },
  locale: { register: () => () => {}, bind: () => key => key },
  configForms: { get: () => scope },
  layout: { toggleSidebar() {} },
  theme: {
    overrideTokens(id, table) {
      tokens = { id, table }
      return () => { released += 1 }
    },
  },
  slots: {
    inject: (_slot, register) => register(),
    register(definition, component) {
      const entry = { definition, component }
      into.push(entry)
      return () => { const index = into.indexOf(entry); if (index >= 0) into.splice(index, 1) }
    },
  },
})
await plugin.apply(makeCtx(registrations))
const pageEntry = registrations.find(entry => entry.definition.name === 'settings.section')
const laneEntry = registrations.find(entry => entry.definition.id === 'ui-beautify-lane')
const repliesEntry = registrations.find(entry => entry.definition.id === 'ui-beautify-replies')
const links = () => head.filter(element => element.rel === 'stylesheet')
const hrefs = () => links().map(link => link.href)
const setStored = (values) => {
  stored = { ...stored, ...values }
  for (const notify of subscribers) notify()
}
const snapshot = () => stores.at(-1)?.get()
const settle = () => new Promise(resolve => { setTimeout(resolve, 10) })
mount('beautify-page', pageEntry.component, {
  t: key => key,
  useBeautify: selector => selector(snapshot()),
  choose: () => {}, refreshCache: () => {}, close: () => {},
})
const pageComponents = new Map(elements.filter(element => typeof element.type === 'function')
  .map(element => [element.type.name, element.type]))
const row = (name, id) => ({ definition: { id }, component: pageComponents.get(name) })
const bodyRow = row('FontRow', 'ui-beautify-font')
const codeRow = row('CodeFontRow', 'ui-beautify-code')
const motionRow = row('MotionRow', 'ui-beautify-motion')

check(
  'registers one settings page, the quick replies, and the composer lane',
  registrations.filter(entry => entry.definition.name === 'settings.section').length === 1
    && registrations.every(entry => entry.definition.name !== 'settings.general.item')
    && laneEntry !== undefined
    && repliesEntry !== undefined,
  String(registrations.length),
)
check(
  'the plugin owns its own navigation entry',
  pageEntry?.definition.id === 'ui-beautify' && pageEntry.definition.label() === 'nav'
    && pageEntry.definition.locale === 'settings.uiBeautify',
  JSON.stringify(pageEntry?.definition),
)
check(
  'the page includes both font controls and the lane control',
  [bodyRow, codeRow, motionRow].every(entry => typeof entry.component === 'function'),
)
check(
  'the page includes the four branding controls',
  ['LogoRow', 'BrandIconRow', 'BrandNameRow', 'TaglineRow'].every(name => pageComponents.has(name)),
)
check('the built-in tagline stays untouched by default', headline.textContent === '探索未至之境')
setStored({ tagline: '探索未知之境' })
check('the configured tagline appears on the blank conversation page', headline.textContent === '探索未知之境')
headline.textContent = 'Into the Unknown'
headlineObserver?.notify()
check('the custom tagline survives a locale rerender', headline.textContent === '探索未知之境')
setStored({ tagline: '' })
check('clearing the tagline restores the current host text', headline.textContent === 'Into the Unknown')
check('default brand leaves the host slots free', !registrations.some(entry =>
  ['conversation.hero.brand.mark', 'sidebar.brand.mark', 'sidebar.brand.name'].includes(entry.definition.name)))
setStored({ logo: 'https://example.com/logo.png', brandIcon: '/images/icon.svg', brandName: 'My DSH' })
for (const slot of ['conversation.hero.brand.mark', 'sidebar.brand.mark', 'sidebar.brand.name']) {
  check(`custom ${slot} shadows the built-in occupant`, registrations.some(entry =>
    entry.definition.name === slot && entry.definition.priority === -1))
}
const customHero = registrations.find(entry => entry.definition.name === 'conversation.hero.brand.mark')
mount('custom-hero', customHero.component, { size: 34, className: 'hero-mark' })
check('welcome logo uses its configured image and host geometry', elements.some(element =>
  element.type === 'img' && element.props.src === 'https://example.com/logo.png'
    && element.props.className === 'hero-mark' && element.props.style.width === 34))
const customIcon = registrations.find(entry => entry.definition.name === 'sidebar.brand.mark')
mount('custom-icon', customIcon.component, { size: 24 })
check('sidebar icon uses its configured image at the requested size', elements.some(element =>
  element.type === 'img' && element.props.src === '/images/icon.svg' && element.props.style.width === 24))
const customName = registrations.find(entry => entry.definition.name === 'sidebar.brand.name')
mount('custom-name', customName.component, {})
check('sidebar name shows the configured text', elements.some(element =>
  element.type === 'span' && element.props.children === 'My DSH'))
setStored({ logo: '', brandIcon: '', brandName: '' })
check('clearing the brand restores the host slots', !registrations.some(entry =>
  ['conversation.hero.brand.mark', 'sidebar.brand.mark', 'sidebar.brand.name'].includes(entry.definition.name)))
setStored({ logo: 'javascript:alert(1)', brandIcon: 'file:///secret.png' })
check('unsafe image URLs are not registered', !registrations.some(entry =>
  ['conversation.hero.brand.mark', 'sidebar.brand.mark'].includes(entry.definition.name)))
setStored({ logo: '', brandIcon: '' })

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
const bodyFace = pageEntry.definition.inject()
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
  mount(`row-${entry.definition.id}`, entry.component, {
    t,
    useBeautify: selector => selector(snapshot()),
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

console.log('brand settings rows')
const writes = []
const brandRows = [
  ['LogoRow', 'logo', 'logoTitle'],
  ['BrandIconRow', 'brandIcon', 'brandIconTitle'],
]
for (const [componentName, field, title] of brandRows) {
  mount(`row-${field}`, pageComponents.get(componentName), {
    t,
    useBeautify: selector => selector(snapshot()),
    choose: (key, value) => { writes.push([key, value]) },
  })
  const input = elements.find(element => element.type === 'input')
  check(`${field} opens a labelled image picker`, input?.props.type === 'file'
    && input?.props['aria-label'] === title && input?.props.disabled === false)
  input?.props.onChange({ currentTarget: { files: [{ size: 1024, type: 'image/png' }], value: 'chosen.png' } })
  await settle()
  check(`${field} saves the uploaded URL`, writes.at(-1)?.join(':') ===
    `${field}:${BRAND_ROUTE}/assets/${'a'.repeat(64)}.png`)
}
mount('row-brand-name', pageComponents.get('BrandNameRow'), {
  t, useBeautify: selector => selector(snapshot()),
  choose: (key, value) => { writes.push([key, value]) },
})
const nameInput = elements.find(element => element.type === 'input')
check('the sidebar name remains a text field', nameInput?.props.type === 'text')
nameInput?.props.onBlur({ currentTarget: { value: '  New name  ' } })
check('the sidebar name saves trimmed text', writes.at(-1)?.join(':') === 'brandName:New name')
mount('row-tagline', pageComponents.get('TaglineRow'), {
  t, useBeautify: selector => selector(snapshot()),
  choose: (key, value) => { writes.push([key, value]) },
})
const taglineInput = elements.find(element => element.type === 'input')
check('the welcome tagline remains a text field', taglineInput?.props.type === 'text')
taglineInput?.props.onBlur({ currentTarget: { value: '  探索未知之境  ' } })
check('the welcome tagline saves trimmed text', writes.at(-1)?.join(':') === 'tagline:探索未知之境')
setStored({ logo: 'javascript:alert(1)' })
const badLogoRow = render(row('LogoRow', 'ui-beautify-logo'))
check('an invalid image address is explained in its row', badLogoRow.metas[0] === 'invalidImageUrl')
setStored({ logo: '' })

setStored({ font: 'not-a-face', codeFont: 'not-a-code-face' })
check(
  'unknown stored values fall back per role',
  snapshot()?.font === 'noto-sans-sc' && snapshot()?.codeFont === SYSTEM_FONT_ID,
  `${String(snapshot()?.font)} / ${String(snapshot()?.codeFont)}`,
)

console.log('a Host that predates a field')
// The running Host imports the plugin once per process, so its schema can lack
// a field this bundle knows about. What a row must not do then is look live:
// the write would be refused and nothing would happen.
const fullValue = stored
stored = { font: fullValue.font }
for (const notify of subscribers) notify()
const staleCode = render(codeRow)
check('the code row reports the stale Host', staleCode.metas[0] === 'stale', String(staleCode.metas[0]))
check('and disables its selector', staleCode.selector?.props.disabled === true)
const liveBody = render(bodyRow)
check('the row whose field does exist stays usable', liveBody.metas[0] !== 'stale' && liveBody.selector?.props.disabled === false, String(liveBody.metas[0]))

stored = fullValue
for (const notify of subscribers) notify()
const restored = render(codeRow)
check('and goes back to normal once the Host exposes the field', restored.metas[0] !== 'stale', String(restored.metas[0]))

console.log('the composer lane')
check(
  'rides in the strip above the composer card',
  laneEntry?.definition.name === 'conversation.input.dock',
  JSON.stringify(laneEntry?.definition),
)
check(
  'behind the shipped docks, so it sits against the card',
  laneEntry?.definition.order === 100,
  JSON.stringify(laneEntry?.definition),
)
check('and renders a component', typeof laneEntry?.component === 'function')

/** Step the captured animation frames on the shared clock. */
const advance = (milliseconds, frames = 1) => {
  for (let index = 0; index < frames; index += 1) {
    clock.time += milliseconds
    const callback = clock.frame
    clock.frame = null
    callback?.(clock.time)
  }
}
/**
 * Lane-relative x the frame loop last wrote, in pixels.
 *
 * A stopped lane writes nothing at all, so an unwritten transform means the
 * figure is still parked at the lane's leading edge — x 0, not "unknown".
 */
const travelOf = (node) => {
  const written = /translate3d\((-?[\d.]+)px/.exec(node.style.transform ?? '')
  return written === null ? 0 : Number(written[1])
}
/** Wheel angle the frame loop last wrote, in degrees; 0 while it writes none. */
const turnOf = (node) => {
  const written = /rotate\(([-\d.]+)/.exec(node.attributes.transform ?? '')
  return written === null ? 0 : Number(written[1])
}

// An assistant step in flight: one text block growing as streamed chunks land.
const step = { text: '' }
const chatWith = selector => selector({
  legacy: {
    partial: step.text === ''
      ? null
      : { turn: 1, step: 1, blocks: [{ kind: 'text', text: step.text }] },
  },
})
/**
 * Ground the cyclist covers over a window of frames.
 *
 * A delta, because x wraps at the end of the lane; every window used here is far
 * shorter than one crossing, so it cannot wrap inside a window.
 */
const travelled = (rider, frames) => {
  advance(16)
  const from = travelOf(rider)
  advance(16, frames)
  return travelOf(rider) - from
}
/**
 * Wheel rotation across one frame, modulo a full turn.
 *
 * One frame is the whole point: the angle wraps at 360°, and the fastest this
 * geometry goes is roughly 55° per frame, so a single frame cannot wrap more
 * than once and the modulo recovers the rotation exactly.
 */
const turnedPerFrame = (wheel) => {
  const from = turnOf(wheel)
  advance(16)
  return ((turnOf(wheel) - from) % 360 + 360) % 360
}
/** Stream chunks into a mounted lane, one render and one frame each. */
const streamInto = (key, chunks) => {
  for (let chunk = 0; chunk < chunks; chunk += 1) {
    step.text += 'x'.repeat(60)
    mount(key, laneEntry.component, laneProps())
    advance(16)
  }
}

/**
 * Props for one lane render: the live Chat snapshot plus the shared settings
 * snapshot the lane reads its motion answer from.
 */
function laneProps() {
  return { useChat: chatWith, useBeautify: selector => selector(snapshot()) }
}

// The stored answer is what decides, so the lane runs under `always` here and
// the browser preference is left out of it until the last section.
setStored({ motion: 'always' })
clock.time = 0
step.text = ''
mount('lane', laneEntry.component, laneProps())
check('draws one lane', byClass('lane').length === 1)
check('that assistive technology is told to skip', byClass('lane')[0]?.props['aria-hidden'] === 'true')
check(
  'with a cyclist, two wheels, and a pair of legs',
  byClass('rider').length === 1 && byClass('wheel').length === 2 && byClass('leg').length === 2,
  `${byClass('rider').length}/${byClass('wheel').length}/${byClass('leg').length}`,
)
const idleRider = byClass('rider')[0].props.ref.current
const idleWheel = byClass('wheel')[0].props.ref.current
const idleTravel = travelled(idleRider, 8)
const idleTurn = turnedPerFrame(idleWheel)
check('stands still with nothing streaming', idleTravel === 0, String(idleTravel))
check('with its wheels stopped', idleTurn === 0, String(idleTurn))
check(
  'and both wheels on the lane',
  byClass('wheel').every(wheel => Number.isFinite(turnOf(wheel.props.ref.current))),
)

// The same frames against a stream have to cover ground and spin the wheels —
// that mapping is the whole point of reading the output rate.
clock.time = 0
step.text = ''
mount('sprint', laneEntry.component, laneProps())
const sprintRider = byClass('rider')[0].props.ref.current
const sprintWheel = byClass('wheel')[0].props.ref.current
streamInto('sprint', 12)
const sprintTravel = travelled(sprintRider, 8)
const sprintTurn = turnedPerFrame(sprintWheel)
check('a stream sets it moving', sprintTravel > 0, String(sprintTravel))
check('and turns the wheels', sprintTurn > 0, String(sprintTurn))

// A closed step takes the in-flight accumulator with it. The figure keeps the
// speed it was carrying and bleeds it off over eight seconds, so it is still
// rolling well after the writing stopped and only then comes to rest.
clock.time = 0
step.text = ''
mount('settled', laneEntry.component, laneProps())
const settledRider = byClass('rider')[0].props.ref.current
const settledWheel = byClass('wheel')[0].props.ref.current
streamInto('settled', 12)
step.text = ''
mount('settled', laneEntry.component, laneProps())
// 2s of no output: still coasting, over a distance a stopped figure cannot cover.
const coasting = travelled(settledRider, 120)
check('keeps rolling after the writing stops', coasting > 0, String(coasting))
// Past the roll-out it is at rest, with the wheels stopped too.
advance(16, 400)
check(
  'and comes to rest once the roll-out is spent',
  travelled(settledRider, 8) === 0 && turnedPerFrame(settledWheel) === 0,
  String(travelled(settledRider, 8)),
)

// A long ride must not jump back to the start while the figure is on the lane.
// The traverse is a bike width longer than the lane at each end, so the wrap
// happens with the figure outside both edges; a large move is only legitimate
// when neither end of it shows most of the figure, which is what this measures.
clock.time = 0
step.text = ''
mount('ride', laneEntry.component, laneProps())
const rideRider = byClass('rider')[0].props.ref.current
streamInto('ride', 6)
const xs = []
for (let frame = 0; frame < 400; frame += 1) {
  if (frame % 4 === 0) {
    step.text += 'x'.repeat(60)
    mount('ride', laneEntry.component, laneProps())
  }
  advance(16)
  xs.push(travelOf(rideRider))
}
/** Whether at least half of a figure whose left edge is at `x` is inside the lane. */
const mostlyOnLane = x => x > -BIKE_WIDTH / 2 && x < LANE_WIDTH - BIKE_WIDTH / 2
const biggestVisibleStep = Math.max(...xs.map((x, at) => {
  if (at === 0) return 0
  const from = xs[at - 1]
  return mostlyOnLane(from) && mostlyOnLane(x) ? Math.abs(x - from) : 0
}))
check(
  'never jumps back to the start while it is on the lane',
  biggestVisibleStep < 20,
  `largest on-lane move ${biggestVisibleStep.toFixed(1)}px`,
)
check(
  'and completes the traverse',
  Math.max(...xs) > LANE_WIDTH - BIKE_WIDTH && Math.min(...xs) < 0,
  `${Math.min(...xs).toFixed(0)}..${Math.max(...xs).toFixed(0)}`,
)

console.log('the lane row owns the answer')
reducedMotion = true
setStored({ motion: 'system' })
const laneRow = render(motionRow)
check('the row names itself', laneRow.titles[0] === 'motionTitle', String(laneRow.titles[0]))
check(
  'offering all three answers',
  laneRow.menu?.props.items.map(item => item.id).join(',') === 'system,always,off',
  String(laneRow.menu?.props.items.length),
)
check(
  'naming the reason the strip is empty',
  laneRow.metas[0] === 'motionBlocked',
  String(laneRow.metas[0]),
)
reducedMotion = false
setStored({ motion: 'off' })
check(
  'and saying so when it is switched off here',
  render(motionRow).metas[0] === 'motionOffNote',
  String(render(motionRow).metas[0]),
)

console.log('a browser asking for no motion')
// The default follows the browser: nothing renders and no frame is requested.
setStored({ motion: 'system' })
reducedMotion = true
clock.frame = null
mount('quiet', laneEntry.component, laneProps())
check('follows the browser by default and draws nothing', byClass('lane').length === 0, String(byClass('lane').length))
check('without asking for a frame', clock.frame === null, String(clock.frame))
check(
  'while the entry itself is still registered, so the cause is discoverable',
  registrations.some(entry => entry.definition.id === 'ui-beautify-lane'),
)

// The stored answer is the only thing that overrules it.
setStored({ motion: 'always' })
step.text = ''
mount('override', laneEntry.component, laneProps())
check(
  'and plays anyway once the user says so',
  byClass('lane').length === 1 && clock.frame !== null,
  `${byClass('lane').length}/${String(clock.frame)}`,
)
const overrideRider = byClass('rider')[0].props.ref.current
streamInto('override', 12)
check('actually moving', travelled(overrideRider, 4) > 0)

setStored({ motion: 'off' })
reducedMotion = false
clock.frame = null
mount('off', laneEntry.component, laneProps())
check('switched off here draws nothing either', byClass('lane').length === 0 && clock.frame === null)

console.log('quick replies below the composer')
check(
  'sit in the strip under the composer card',
  repliesEntry?.definition.name === 'conversation.composer.dock',
  JSON.stringify(repliesEntry?.definition),
)
check(
  'directly after the shipped stats pills',
  repliesEntry?.definition.order === 1,
  String(repliesEntry?.definition.order),
)
check('and render a component', typeof repliesEntry?.component === 'function')

/** Every phrase the tags typed, in order, with the span it claimed. */
const typed = []
let submissions = 0
const inputActions = {
  captureInsertion: () => 'caret-span',
  insertText: (text, span) => { typed.push({ text, span }); return true },
  submit: () => { submissions += 1 },
}
/** Mount the row against one input phase and return its tags. */
const renderReplies = (key, phase, actions) => {
  mount(key, repliesEntry.component, {
    t,
    useInput: selector => selector({ phase }),
    useBeautify: selector => selector(snapshot()),
    inputActions: actions,
  })
  return elements.filter(element => element.type === 'pill')
}
check('older profiles keep desktop quick replies enabled', snapshot().quickRepliesEnabled === true)
setStored({ quickRepliesEnabled: false })
check('switching off removes every quick reply and its row',
  renderReplies('replies-off', 'plain', inputActions).length === 0 && byClass('row').length === 0)
check('switching off keeps the dock registered', registrations.includes(repliesEntry))
setStored({ quickRepliesEnabled: true })
const tags = renderReplies('replies', 'plain', inputActions)
check(
  'offering every built-in phrase as its own tag',
  tags.map(tag => tag.props.children).join(',')
    === 'quickContinue,quickOk,quickNoUnderstand,quickStatus',
  tags.map(tag => tag.props.children).join(','),
)
check(
  'labelled as the group they answer for',
  byClass('row')[0]?.props.role === 'group' && byClass('row')[0]?.props['aria-label'] === 'quickTitle',
  String(byClass('row')[0]?.props['aria-label']),
)
check(
  'each naming the message it sends',
  tags[0].props['aria-label'] === 'quickSend({"text":"quickContinue"})',
  String(tags[0].props['aria-label']),
)
check('usable while the draft is editable', tags.every(tag => tag.props.disabled === false))

tags[0].props.onClick()
check(
  'a click types the phrase into the draft at its caret',
  typed.at(-1)?.text === 'quickContinue' && typed.at(-1)?.span === 'caret-span',
  JSON.stringify(typed.at(-1)),
)
check('and submits it in the same click', submissions === 1, String(submissions))

// A locked editor refuses the insertion. Submitting anyway would send whatever
// the draft already held — the one thing a click on a phrase must not do.
const refusals = {
  captureInsertion: () => 'caret-span',
  insertText: () => false,
  submit: () => { submissions += 1 },
}
renderReplies('refused', 'plain', refusals)[1].props.onClick()
check('a refused insertion sends nothing', submissions === 1, String(submissions))

check(
  'closed while a submission is in flight',
  renderReplies('busy', 'submitting', inputActions).every(tag => tag.props.disabled === true),
)

console.log('desktop quick-reply toggle')
check('the page includes only visibility, not phrase editing',
  pageComponents.has('QuickReplyToggleRow') && !pageComponents.has('QuickReplyRow'))
const toggleWrites = []
const renderToggle = (overrides = {}) => {
  mount('reply-toggle', pageComponents.get('QuickReplyToggleRow'), {
    t,
    useBeautify: selector => selector({ ...snapshot(), ...overrides }),
    choose: (key, value) => { toggleWrites.push([key, value]) },
  })
  return elements.find(element => element.type === 'switch')
}
const toggle = renderToggle()
check('uses the host switch with a localized label', toggle.props.label === 'quickTitle')
check('shows the saved enabled state', toggle.props.checked === true && toggle.props.disabled === false)
toggle.props.onChange(false)
check('the switch writes a boolean without editing phrases',
  JSON.stringify(toggleWrites.at(-1)) === JSON.stringify(['quickRepliesEnabled', false]))
setStored({ quickRepliesEnabled: false })
check('the switch reflects the disabled state', renderToggle().props.checked === false)
setStored({ quickRepliesEnabled: undefined })
check('an older host disables the new setting with an explanation',
  renderToggle().props.disabled === true && byClass('meta')[0].props.children === 'stale')
setStored({ quickRepliesEnabled: true })
check('read-only settings disable the toggle', renderToggle({ writable: false }).props.disabled === true)
check('unavailable settings disable the toggle', renderToggle({ available: false }).props.disabled === true)
const face = pageEntry.definition.inject()
face.choose('quickRepliesEnabled', false)
await settle()
check('the shared writer persists false rather than treating it as an array', stored.quickRepliesEnabled === false)
setStored({ quickRepliesEnabled: true })
const replyCss = readFileSync(new URL('../src/client/QuickReplies.module.css', import.meta.url), 'utf8')
const rowCss = readFileSync(new URL('../src/client/SettingRow.module.css', import.meta.url), 'utf8')
check('phones hide the send controls at the host breakpoint',
  /@media\s*\(max-width:\s*600px\)\s*\{\s*\.row\s*\{\s*display:\s*none/.test(replyCss))
check('phones also hide the desktop-only setting',
  /@media\s*\(max-width:\s*600px\)\s*\{\s*\.desktopOnly\s*\{\s*display:\s*none/.test(rowCss))

console.log('custom quick replies')
setStored({ quickReplies: [' 甲 ', '乙'] })
const customTags = renderReplies('custom', 'plain', inputActions)
check(
  'the stored phrases replace the built-in row',
  customTags.map(tag => tag.props.children).join(',') === '甲,乙',
  customTags.map(tag => tag.props.children).join(','),
)
check(
  'and each tag still names the message it sends',
  customTags[1].props['aria-label'] === 'quickSend({"text":"乙"})',
  String(customTags[1].props['aria-label']),
)
customTags[1].props.onClick()
check(
  'so a customized phrase is what a click types',
  typed.at(-1)?.text === '乙',
  JSON.stringify(typed.at(-1)),
)

// The document is hand-editable: a fifth phrase and a blank slot are both real
// inputs, and neither may produce a tag the dock cannot show.
setStored({ quickReplies: ['一', '', '三', '四', '五'] })
const cappedTags = renderReplies('capped', 'plain', inputActions).map(tag => tag.props.children)
check(
  'a blank slot shows no tag and an over-long list is capped',
  cappedTags.join(',') === '一,三,四',
  cappedTags.join(','),
)
setStored({ quickReplies: ['', '   '] })
const blankTags = renderReplies('blank', 'plain', inputActions).map(tag => tag.props.children)
check(
  'an all-blank list keeps the built-in phrases',
  blankTags.join(',') === 'quickContinue,quickOk,quickNoUnderstand,quickStatus',
  blankTags.join(','),
)

// The quick-reply row is parked: BeautifySection no longer mounts it, so this
// block is skipped — and re-runs untouched the moment the page mounts the row
// again, which is also when this file stops saying that it is parked.
if (pageComponents.has('QuickReplyRow')) {
  console.log('the quick-reply settings row')
  const replyRow = row('QuickReplyRow', 'ui-beautify-reply')
  check('the page includes the quick-reply row', typeof replyRow.component === 'function')
  /** Every write this row commits, as [field, value] pairs. */
  const replyWrites = []
  const chooseReply = (key, value) => { replyWrites.push([key, value]) }
  /** Whether a tag carries the grey "this slot is off" style. */
  const isGhost = tag => String(tag.props.className).split(/\s+/).some(token => token.endsWith('_replyTagGhost'))
  /**
   * Render — or, with the same key, re-render — the row over the stored value and
   * return what it produced. Re-rendering is how a click's state change is
   * observed: the stub's setter records the value, this call reads it back.
   */
  const showReplies = key => {
    mount(key, replyRow.component, {
      t, useBeautify: selector => selector(snapshot()), choose: chooseReply,
    })
    return {
      tags: byClass('replyTag'),
      ghosts: byClass('replyTagGhost'),
      fields: byClass('replyInput'),
      reset: byClass('reset')[0],
    }
  }

  setStored({ quickReplies: [] })
  const off = showReplies('row-replies')
  check('offering one tag per slot', off.tags.length === 4, String(off.tags.length))
  check(
    'each carrying the built-in phrase that slot would switch on',
    off.tags.map(tag => tag.props.children).join(',')
      === 'quickContinue,quickOk,quickNoUnderstand,quickStatus',
    off.tags.map(tag => tag.props.children).join(','),
  )
  check('every one of them grey while no slot is on', off.ghosts.length === 4, String(off.ghosts.length))
  check(
    'each named for the phrase clicking it edits',
    off.tags[1]?.props['aria-label'] === 'quickReplyTag({"text":"quickOk"})',
    String(off.tags[1]?.props['aria-label']),
  )
  check('no editor open', off.fields.length === 0, String(off.fields.length))
  check('and nothing to reset yet', off.reset === undefined, String(off.reset?.props.children))

  // One click both switches the phrase on and opens it for editing, which is why
  // the row can show a tag per slot without a separate "add" control.
  off.tags[1]?.props.onClick()
  check(
    'clicking a grey tag switches that built-in phrase on',
    JSON.stringify(replyWrites.at(-1)) === JSON.stringify(['quickReplies', ['', 'quickOk']]),
    JSON.stringify(replyWrites.at(-1)),
  )
  setStored({ quickReplies: ['', 'quickOk'] })
  const opened = showReplies('row-replies')
  check(
    'and opens that slot as a field, pre-filled with the phrase',
    opened.fields.length === 1 && opened.fields[0]?.props.defaultValue === 'quickOk'
      && opened.fields[0]?.props.placeholder === 'quickOk' && opened.fields[0]?.props.autoFocus === true,
    JSON.stringify(opened.fields[0]?.props.defaultValue),
  )
  check(
    'labelled as the phrase it edits',
    opened.fields[0]?.props['aria-label'] === 'quickReplyInput',
    String(opened.fields[0]?.props['aria-label']),
  )
  check(
    'while the other three stay grey tags',
    opened.tags.length === 3 && opened.ghosts.length === 3,
    `${opened.tags.length}/${opened.ghosts.length}`,
  )
  opened.fields[0]?.props.onBlur({ currentTarget: { value: '  没有理解  ' } })
  check(
    'a blur saves the typed phrase into that slot',
    JSON.stringify(replyWrites.at(-1)) === JSON.stringify(['quickReplies', ['', '没有理解']]),
    JSON.stringify(replyWrites.at(-1)),
  )
  setStored({ quickReplies: ['', '没有理解'] })
  const saved = showReplies('row-replies')
  check(
    'and the tag returns solid in place of the field',
    saved.fields.length === 0 && saved.tags.filter(tag => !isGhost(tag))
      .map(tag => tag.props.children).join(',') === '没有理解',
    saved.tags.map(tag => tag.props.children).join(','),
  )

  setStored({ quickReplies: ['甲'] })
  const filled = showReplies('row-replies-clear')
  const writesBefore = replyWrites.length
  filled.tags[0]?.props.onClick()
  check('editing a filled tag commits nothing by itself', replyWrites.length === writesBefore)
  const filledField = showReplies('row-replies-clear').fields[0]
  check('it opens holding the stored phrase', filledField?.props.defaultValue === '甲', String(filledField?.props.defaultValue))
  filledField?.props.onBlur({ currentTarget: { value: '   ' } })
  check(
    'clearing it switches the slot off again',
    JSON.stringify(replyWrites.at(-1)) === JSON.stringify(['quickReplies', []]),
    JSON.stringify(replyWrites.at(-1)),
  )

  setStored({ quickReplies: [] })
  const escapeCase = showReplies('row-replies-escape')
  escapeCase.tags[0]?.props.onClick()
  showReplies('row-replies-escape').fields[0]?.props.onKeyDown({ key: 'Escape', currentTarget: { value: 'typed' } })
  check(
    'Escape switches the just-clicked slot back off',
    JSON.stringify(replyWrites.at(-1)) === JSON.stringify(['quickReplies', []]),
    JSON.stringify(replyWrites.at(-1)),
  )
  const escaped = showReplies('row-replies-escape')
  check(
    'and closes the field',
    escaped.fields.length === 0 && escaped.ghosts.length === 4,
    `${escaped.fields.length}/${escaped.ghosts.length}`,
  )

  // Cancelling leaves a guard set in case the browser blur arrives late; the next
  // edit has to clear it, or its own first blur would be swallowed as if it were
  // that late one.
  setStored({ quickReplies: ['甲'] })
  const afterEscape = showReplies('row-replies-escape-leak')
  afterEscape.tags[0]?.props.onClick()
  showReplies('row-replies-escape-leak').fields[0]?.props.onKeyDown({ key: 'Escape', currentTarget: { value: 'typed' } })
  showReplies('row-replies-escape-leak').tags[0]?.props.onClick()
  showReplies('row-replies-escape-leak').fields[0]?.props.onBlur({ currentTarget: { value: '乙' } })
  check(
    'an edit after an Escape still saves on blur',
    JSON.stringify(replyWrites.at(-1)) === JSON.stringify(['quickReplies', ['乙']]),
    JSON.stringify(replyWrites.at(-1)),
  )

  setStored({ quickReplies: ['一', '二', '三', '四', '五'] })
  const full = showReplies('row-replies-full')
  check(
    'a hand-edited list beyond the offered slots shows the first four, none grey',
    full.tags.length === 4 && full.ghosts.length === 0,
    `${full.tags.length}/${full.ghosts.length}`,
  )
  check(
    'once customized there is a way back to the built-in phrases',
    full.reset?.props.children === 'restoreDefault',
    String(full.reset?.props.children),
  )
  full.reset?.props.onClick()
  check(
    'which clears the stored list',
    JSON.stringify(replyWrites.at(-1)) === JSON.stringify(['quickReplies', []]),
    JSON.stringify(replyWrites.at(-1)),
  )

  setStored({ quickReplies: undefined })
  const stale = showReplies('row-replies-stale')
  check(
    'a Host whose schema predates the field says so',
    byClass('meta')[0]?.props.children === 'stale',
    String(byClass('meta')[0]?.props.children),
  )
  check(
    'and closes its tags',
    stale.tags.length === 4 && stale.tags.every(tag => tag.props.disabled === true),
    String(stale.tags.length),
  )
} else {
  console.log('the quick-reply settings row (parked: the page does not mount it)')
}

for (const dispose of disposers) dispose()

if (failures.length > 0) {
  console.error(`\n${failures.length} check(s) failed`)
  process.exit(1)
}
console.log('\nall checks passed')
