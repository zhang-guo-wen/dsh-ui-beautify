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
//
// The composer lane drives its motion from an animation frame over host nodes,
// so the stub models the three things that depends on: host refs, effects that
// run after commit, and a clock the assertions can advance frame by frame.
const elements = []
/** Lane width the frame loop measures; the real value comes from layout. */
const LANE_WIDTH = 800
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
    cursor++
    return [initial, () => {}]
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
  matchMedia: () => ({ matches: reducedMotion }),
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
const makeCtx = (into) => ({
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
    register(definition, component) { into.push({ definition, component }); return () => {} },
  },
})
plugin.apply(makeCtx(registrations))
const bodyRow = registrations.find(entry => entry.definition.id === 'ui-beautify')
const codeRow = registrations.find(entry => entry.definition.id === 'ui-beautify-code')
const laneEntry = registrations.find(entry => entry.definition.id === 'ui-beautify-lane')
const links = () => head.filter(element => element.rel === 'stylesheet')
const hrefs = () => links().map(link => link.href)
const setStored = (values) => {
  stored = { ...stored, ...values }
  for (const notify of subscribers) notify()
}
const snapshot = () => stores.at(-1)?.get()
const settle = () => new Promise(resolve => { setTimeout(resolve, 10) })

check(
  'registers two General-settings rows and the composer lane',
  registrations.filter(entry => entry.definition.name === 'settings.general.item').length === 2
    && laneEntry !== undefined,
  String(registrations.length),
)
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
  mount(`row-${entry.definition.id}`, entry.component, {
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
/** Lane-relative x the frame loop last wrote, in pixels. */
const travelOf = node => Number(/translate3d\((-?[\d.]+)px/.exec(node.style.transform ?? '')?.[1] ?? Number.NaN)
/** Wheel angle the frame loop last wrote, in degrees. */
const turnOf = node => Number(/rotate\(([-\d.]+)/.exec(node.attributes.transform ?? '')?.[1] ?? Number.NaN)

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
    mount(key, laneEntry.component, { useChat: chatWith })
    advance(16)
  }
}

clock.time = 0
step.text = ''
mount('lane', laneEntry.component, { useChat: chatWith })
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
check('loops even with nothing streaming', idleTravel > 0, String(idleTravel))
check('rolling its wheels by the ground it covers', idleTurn > 0, String(idleTurn))
check(
  'and keeping both wheels on the lane',
  byClass('wheel').every(wheel => Number.isFinite(turnOf(wheel.props.ref.current))),
)

// The same frames against a stream have to cover more ground and spin the
// wheels faster — that mapping is the whole point of reading the output rate.
clock.time = 0
step.text = ''
mount('sprint', laneEntry.component, { useChat: chatWith })
const sprintRider = byClass('rider')[0].props.ref.current
const sprintWheel = byClass('wheel')[0].props.ref.current
streamInto('sprint', 12)
const sprintTravel = travelled(sprintRider, 8)
const sprintTurn = turnedPerFrame(sprintWheel)
check('faster output covers more ground', sprintTravel > idleTravel * 2, `${sprintTravel} vs ${idleTravel}`)
check('and spins the wheels faster', sprintTurn > idleTurn * 2, `${sprintTurn} vs ${idleTurn}`)

// A closed step takes the in-flight accumulator with it; the lane has to fall
// back to its cruise rather than read the drop as negative speed.
clock.time = 0
step.text = ''
mount('settled', laneEntry.component, { useChat: chatWith })
const settledRider = byClass('rider')[0].props.ref.current
streamInto('settled', 12)
step.text = ''
mount('settled', laneEntry.component, { useChat: chatWith })
const settledTravel = travelled(settledRider, 8)
check(
  'a closed step settles back to the cruise',
  settledTravel > 0 && settledTravel < idleTravel * 1.5,
  `${settledTravel} vs ${idleTravel}`,
)

console.log('a browser asking for no motion')
reducedMotion = true
const quiet = []
plugin.apply(makeCtx(quiet))
check(
  'leaves the strip empty',
  quiet.every(entry => entry.definition.id !== 'ui-beautify-lane'),
  JSON.stringify(quiet.map(entry => entry.definition.id)),
)
check(
  'while still registering both font rows',
  quiet.filter(entry => entry.definition.name === 'settings.general.item').length === 2,
  String(quiet.length),
)

for (const dispose of disposers) dispose()

if (failures.length > 0) {
  console.error(`\n${failures.length} check(s) failed`)
  process.exit(1)
}
console.log('\nall checks passed')
