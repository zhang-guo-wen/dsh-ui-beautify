import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createMobileController } from '../src/client/mobile-layout-controller.ts'

function fixture() {
  const attrs = new Map([['data-sidebar-collapsed', 'true']])
  const frame = { hasAttribute: key => attrs.has(key), setAttribute: (key, value) => attrs.set(key, value), removeAttribute: key => attrs.delete(key), firstElementChild: { contains: target => target.inside === true } }
  const pocketAttrs = new Map()
  const pocket = { getAttribute: key => pocketAttrs.get(key) ?? null, setAttribute: (key, value) => pocketAttrs.set(key, value), removeAttribute: key => pocketAttrs.delete(key) }
  let removed = false
  const style = { dataset: {}, textContent: '', remove: () => { removed = true } }
  const events = new Map()
  const mediaEvents = new Map()
  const media = { matches: true, addEventListener: (key, fn) => mediaEvents.set(key, fn), removeEventListener: key => mediaEvents.delete(key) }
  let observe
  let toggles = 0
  const frames = new Map()
  let next = 0
  const document = { documentElement: {}, createElement: () => style, head: { appendChild() {} },
    querySelectorAll: () => [pocket], querySelector: selector => selector === '[data-shell-overlay]' ? { parentElement: frame } : null,
    addEventListener: (key, fn) => events.set(key, fn), removeEventListener: key => events.delete(key) }
  const window = { matchMedia: () => media, MutationObserver: class { constructor(fn) { observe = fn } observe() {} disconnect() {} },
    requestAnimationFrame: fn => { frames.set(++next, fn); return next }, cancelAnimationFrame: id => frames.delete(id) }
  const controller = createMobileController({ document, window, css: 'test-css', toggleSidebar: () => { toggles++; attrs.has('data-sidebar-collapsed') ? attrs.delete('data-sidebar-collapsed') : attrs.set('data-sidebar-collapsed', 'true'); observe() } })
  return { controller, attrs, pocketAttrs, media, mediaEvents, events, frames, observe: () => observe(), toggles: () => toggles, removed: () => removed }
}

test('marks phone frame, uses host toggle, hides only obsolete pocket stylesheet', () => {
  const f = fixture()
  assert.equal(f.attrs.has('data-mobile-layout-frame'), true)
  assert.equal(f.pocketAttrs.get('media'), 'not all')
  assert.deepEqual(f.controller.getSnapshot(), { mobile: true, open: false })
  f.controller.toggle()
  assert.equal(f.toggles(), 1)
  assert.equal(f.controller.getSnapshot().open, true)
  f.controller.close()
  assert.equal(f.controller.getSnapshot().open, false)
  f.controller.dispose()
  assert.equal(f.attrs.has('data-mobile-layout-frame'), false)
  assert.equal(f.pocketAttrs.has('media'), false)
  assert.equal(f.events.size, 0)
  assert.equal(f.removed(), true)
})

test('desktop resizing and native mobile host remain unmodified', () => {
  const f = fixture()
  f.media.matches = false
  f.mediaEvents.get('change')()
  assert.equal(f.attrs.has('data-mobile-layout-frame'), false)
  f.controller.toggle()
  assert.equal(f.toggles(), 0)
  f.media.matches = true
  f.attrs.set('data-mobile-sidebar', 'true')
  f.observe()
  assert.equal(f.attrs.has('data-mobile-layout-frame'), false)
  f.controller.dispose()
})

test('Escape closes, navigation closes after host event, menu actions do not', () => {
  const f = fixture()
  f.controller.toggle()
  f.events.get('keydown')({ key: 'Escape' })
  assert.equal(f.controller.getSnapshot().open, false)
  f.controller.toggle()
  const row = { inside: true, closest: selector => selector.includes('sessionRow') ? {} : null }
  f.events.get('click')({ target: row })
  assert.equal(f.controller.getSnapshot().open, true)
  for (const fn of f.frames.values()) fn()
  assert.equal(f.controller.getSnapshot().open, false)
  f.controller.dispose()
})

test('mobile rightbar keeps the host panel at the frame right edge, not offscreen', () => {
  const css = readFileSync(new URL('../src/client/mobile-layout.css', import.meta.url), 'utf8')
  assert.match(css, /\[data-mobile-layout-frame\] > \[data-rightbar-col\] \{\s*grid-column: 3 !important;\s*grid-row: 1;/)
  assert.ok(css.includes('[data-rightbar-col]:has([data-sidebar-right-open]) { z-index: 1250; }'))
})

test('phone frame isolates raised drawer and rightbar layers below body-portaled modals', () => {
  const css = readFileSync(new URL('../src/client/mobile-layout.css', import.meta.url), 'utf8')
  assert.match(css, /\[data-mobile-layout-frame\] \{[^}]*isolation: isolate;/)
  const bundle = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
  assert.match(bundle, /isolation:\s*isolate/)
})

test('phone opener joins the host leading header and matches the right opener geometry', () => {
  const source = readFileSync(new URL('../src/client/mobile-layout.tsx', import.meta.url), 'utf8')
  const css = readFileSync(new URL('../src/client/mobile-layout.css', import.meta.url), 'utf8')
  assert.ok(source.includes("document.querySelector('[data-conversation-header-leading]')"))
  assert.ok(source.includes('createPortal(toggle, leading)'))
  assert.ok(source.includes('IconPanelLeftOutlineRegular size={16}'))
  assert.match(css, /\[data-mobile-layout-toggle\]\[data-mobile-layout-header-toggle\] \{\s*position: static;\s*width: 28px;\s*height: 28px;/)
})

test('built client shadows only the three Pocket navigation cells, never root', () => {
  const source = readFileSync(new URL('../src/client/mobile-layout.tsx', import.meta.url), 'utf8')
  assert.ok(source.includes('IconPanelLeftOutlineRegular'))
  assert.ok(!source.includes('Outline16'))
  for (const id of ['mobile-nav-overlay', 'mobile-nav-toggle', 'mobile-nav-session-log']) assert.ok(source.includes(id))
  assert.equal((source.match(/priority: -10/g) ?? []).length, 3)
  assert.ok(!source.includes("name: 'root'"))
  const bundle = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
  assert.ok(bundle.includes('@guowenzhang/dsh-ui-beautify'))
  assert.ok(bundle.includes('data-mobile-layout-frame'))
})
