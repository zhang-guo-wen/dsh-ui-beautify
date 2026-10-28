import test from 'node:test'
import assert from 'node:assert/strict'
import { Config } from '../lib/index.mjs'
import { en, zh } from '../src/client/locales.ts'
import { imageUrl } from '../src/client/image-url.ts'
import {
  REPLACED_MARK_ATTRIBUTE, RUNNING_MARK_CSS, RUNNING_ROW_SELECTOR,
  applyRunningStatus, installRunningMark, installRunningText, rewriteRunningText, splitRunningText,
} from '../src/client/running-status.ts'
import { IMAGE_FIELDS } from '../src/brand-assets.ts'

// ---------------------------------------------------------------------------
// The host's own copy, as `ui-chat` composes it: a bare phrase, and the same
// phrase followed by the elapsed reading. Pinned here because the rewrite keys
// off the marker inside the second form.
// ---------------------------------------------------------------------------
const HOST_PHRASE = '深度求索中'
const HOST_WITH_TIME = '深度求索中，用时 29秒 ···'

test('splits the elapsed reading off the host phrase', () => {
  assert.deepEqual(splitRunningText(HOST_WITH_TIME), { phrase: HOST_PHRASE, rest: '，用时 29秒 ···' })
})

test('a phrase with no elapsed reading splits into itself', () => {
  assert.deepEqual(splitRunningText(HOST_PHRASE), { phrase: HOST_PHRASE, rest: '' })
})

test('a localized duration marker is found wherever it sits', () => {
  const text = 'Deep diving for 29s ···'
  assert.deepEqual(splitRunningText(text), { phrase: text, rest: '' })
  assert.deepEqual(splitRunningText('深度求索中用时 1分02秒 ···'), { phrase: HOST_PHRASE, rest: '用时 1分02秒 ···' })
})

test('rewrites the phrase and keeps the elapsed reading', () => {
  assert.equal(rewriteRunningText(HOST_WITH_TIME, '思考中'), '思考中，用时 29秒 ···')
  assert.equal(rewriteRunningText(HOST_PHRASE, '思考中'), '思考中')
})

test('an empty phrase leaves the host text untouched', () => {
  assert.equal(rewriteRunningText(HOST_WITH_TIME, ''), HOST_WITH_TIME)
  assert.equal(rewriteRunningText(HOST_WITH_TIME, '   '), HOST_WITH_TIME)
})

test('rewriting is idempotent, so a settled row never marks itself', () => {
  const once = rewriteRunningText(HOST_WITH_TIME, '思考中')
  assert.equal(rewriteRunningText(once, '思考中'), once)
})

// ---------------------------------------------------------------------------
// A minimal document: just the element and observer surface both installers use.
// ---------------------------------------------------------------------------
function element(attributes = {}, children = []) {
  const node = {
    children,
    attributes: { ...attributes },
    textContent: '',
    setAttribute(name, value) { this.attributes[name] = value },
    getAttribute(name) { return this.attributes[name] ?? null },
    removeAttribute(name) { delete this.attributes[name] },
    appendChild(child) { this.children.push(child); child.parent = this; return child },
    // Mirror the DOM: a node removes itself from wherever it was appended.
    remove() {
      const at = this.parent?.children.indexOf(this) ?? -1
      if (at >= 0) this.parent.children.splice(at, 1)
    },
    querySelector(selector) { return find(this, selector) },
    querySelectorAll(selector) { return findAll(this, selector) },
  }
  for (const child of children) child.parent = node
  return node
}

/** Match the two selectors these installers use, by attribute and by class token. */
function matches(node, selector) {
  if (selector === RUNNING_ROW_SELECTOR) return node.attributes['data-chat-running'] !== undefined
  if (selector === 'img') return node.tag === 'img'
  const token = /^\[class\*="([^"]+)"\]$/.exec(selector)?.[1]
  return token !== undefined && (node.attributes.class ?? '').includes(token)
}

function find(node, selector) {
  const [hit] = findAll(node, selector)
  return hit ?? null
}

function findAll(node, selector) {
  const hits = []
  const walk = (current) => {
    for (const child of current.children ?? []) {
      if (matches(child, selector)) hits.push(child)
      walk(child)
    }
  }
  walk(node)
  return hits
}

/** A document whose body holds the rows, with observers collected for the test. */
function fakeDocument(rows) {
  const body = element({}, rows)
  const head = []
  const observers = []
  const document = {
    body,
    head: { appendChild: node => head.push(node) },
    createElement: (tag) => {
      const node = element({})
      node.tag = tag
      node.dataset = {}
      // Mirror the DOM: a created node removes itself from whichever collection
      // it was appended to — the head, for a stylesheet, or a parent, for the mark.
      node.remove = function () {
        const fromHead = head.indexOf(this)
        if (fromHead >= 0) { head.splice(fromHead, 1); return }
        const at = this.parent?.children.indexOf(this) ?? -1
        if (at >= 0) this.parent.children.splice(at, 1)
      }
      return node
    },
    querySelectorAll: selector => findAll(body, selector),
  }
  globalThis.MutationObserver = class {
    constructor(callback) { this.callback = callback; observers.push(this) }
    observe() {}
    disconnect() { this.disconnected = true }
  }
  // Alert the observer the way a host re-render would, without a real event loop.
  document.flush = () => { for (const observer of observers) if (!observer.disconnected) observer.callback() }
  return { document, body, head, observers }
}

/** A status row shaped like the host's: an icon span, then the text span. */
function runningRow(text) {
  const icon = element({ class: 'runningIcon_x1' })
  const textSpan = element({ class: 'runningText_x2' })
  textSpan.textContent = text
  const content = element({ class: 'runningContent_x3' }, [icon, textSpan])
  return { row: element({ class: 'running_x4', 'data-chat-running': '' }, [content]), icon, textSpan }
}

test('the phrase is written over the host text', () => {
  const { row, textSpan } = runningRow(HOST_WITH_TIME)
  const { document } = fakeDocument([row])
  const dispose = installRunningText(document, () => '思考中')
  assert.equal(textSpan.textContent, '思考中，用时 29秒 ···')
  dispose()
})

test('a redraw of the host text is rewritten again', () => {
  const { row, textSpan } = runningRow(HOST_WITH_TIME)
  const { document } = fakeDocument([row])
  const dispose = installRunningText(document, () => '思考中')
  // The host's clock rewrites its own string every second.
  textSpan.textContent = '深度求索中，用时 30秒 ···'
  document.flush()
  assert.equal(textSpan.textContent, '思考中，用时 30秒 ···')
  dispose()
})

test('the observer stops rewriting once released', () => {
  const { row, textSpan } = runningRow(HOST_WITH_TIME)
  const { document, observers } = fakeDocument([row])
  installRunningText(document, () => '思考中')()
  assert.equal(observers[0].disconnected, true)
})

test('no stored phrase leaves the host text alone', () => {
  const { row, textSpan } = runningRow(HOST_WITH_TIME)
  const { document } = fakeDocument([row])
  const dispose = installRunningText(document, () => '')
  assert.equal(textSpan.textContent, HOST_WITH_TIME)
  dispose()
})

// ---------------------------------------------------------------------------
// The mark.
// ---------------------------------------------------------------------------
test('the built-in mark hides the host icon and carries its own animation', () => {
  const { row, icon } = runningRow(HOST_PHRASE)
  const { document, head } = fakeDocument([row])
  const dispose = installRunningMark(document, () => '')
  assert.equal(icon.attributes[REPLACED_MARK_ATTRIBUTE], '')
  assert.equal(icon.children.length, 0)
  assert.equal(head.length, 1)
  assert.match(head[0].textContent, /dsh-beautify-running-spin/)
  assert.match(RUNNING_MARK_CSS, /prefers-reduced-motion: reduce/)
  // The host also renders a static SVG fallback beside the animated span, and
  // reduced motion or forced colors show it. The mark must hide every non-image
  // child, otherwise the whale stays visible under the built-in ring.
  assert.match(RUNNING_MARK_CSS, /> :not\(img\)/)
  dispose()
})

test('a stored image replaces the mark and follows a change', () => {
  const { row, icon } = runningRow(HOST_PHRASE)
  const { document } = fakeDocument([row])
  let url = '/plugins/dsh-ui-beautify/brand/assets/a.png'
  const dispose = installRunningMark(document, () => url)
  const image = icon.children.find(child => child.tag === 'img')
  assert.equal(image.getAttribute('src'), url)
  assert.equal(image.getAttribute('aria-hidden'), 'true')
  // A second sweep with the same URL reuses the element rather than stacking one.
  url = '/plugins/dsh-ui-beautify/brand/assets/b.webp'
  document.flush()
  assert.equal(icon.children.filter(child => child.tag === 'img').length, 1)
  assert.equal(icon.children.find(child => child.tag === 'img').getAttribute('src'), url)
  dispose()
})

test('clearing the image falls back to the built-in animation', () => {
  const { row, icon } = runningRow(HOST_PHRASE)
  const { document } = fakeDocument([row])
  let url = '/a.png'
  const dispose = installRunningMark(document, () => url)
  url = ''
  document.flush()
  assert.equal(icon.children.length, 0)
  assert.equal(icon.attributes['data-beautify-running-image'], undefined)
  dispose()
})

test('a rejected URL is treated as no image', () => {
  const { row, icon } = runningRow(HOST_PHRASE)
  const { document } = fakeDocument([row])
  const dispose = installRunningMark(document, () => 'javascript:alert(1)')
  assert.equal(icon.children.length, 0)
  dispose()
})

test('releasing the mark restores the host icon', () => {
  const { row, icon } = runningRow(HOST_PHRASE)
  const { document, head } = fakeDocument([row])
  const dispose = installRunningMark(document, () => '/a.png')
  dispose()
  assert.equal(icon.attributes[REPLACED_MARK_ATTRIBUTE], undefined)
  assert.equal(icon.children.length, 0)
  assert.equal(head.length, 0)
})

// ---------------------------------------------------------------------------
// Wiring, schema, and copy.
// ---------------------------------------------------------------------------
/** The `ui-beautify` configuration form stand-in. */
function settings(value) {
  const listeners = new Set()
  let snapshot = { status: 'ready', value }
  return {
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

test('the phrase follows a settings write without a reload', () => {
  const { row, textSpan } = runningRow(HOST_WITH_TIME)
  const { document } = fakeDocument([row])
  globalThis.document = document
  const scope = settings({})
  const effects = []
  applyRunningStatus({ effect: (callback) => { const d = callback(); effects.push(d); return d } }, scope)
  assert.equal(textSpan.textContent, HOST_WITH_TIME)
  scope.set({ runningStatusText: '思考中' })
  document.flush()
  assert.equal(textSpan.textContent, '思考中，用时 29秒 ···')
  for (const dispose of effects) dispose()
})

test('the mark stays the host\'s until the switch is on', () => {
  const { row, icon } = runningRow(HOST_PHRASE)
  const { document } = fakeDocument([row])
  globalThis.document = document
  const scope = settings({ runningStatusText: '', replaceRunningIcon: false })
  const effects = []
  applyRunningStatus({ effect: (callback) => { const d = callback(); effects.push(d); return d } }, scope)
  assert.equal(icon.attributes[REPLACED_MARK_ATTRIBUTE], undefined)
  scope.set({ runningStatusText: '', replaceRunningIcon: true })
  assert.equal(icon.attributes[REPLACED_MARK_ATTRIBUTE], '')
  scope.set({ runningStatusText: '', replaceRunningIcon: false })
  assert.equal(icon.attributes[REPLACED_MARK_ATTRIBUTE], undefined)
  for (const dispose of effects) dispose()
})

test('the schema ships the three fields live with the documented defaults', () => {
  for (const field of ['runningStatusText', 'runningStatusIcon', 'replaceRunningIcon']) {
    assert.equal(Config.dict[field].meta.volatile, true, `${field} is live`)
  }
  assert.equal(Config.dict.runningStatusText.meta.default, '')
  assert.equal(Config.dict.runningStatusIcon.meta.default, '')
  assert.equal(Config.dict.replaceRunningIcon.meta.default, false)
})

test('both dictionaries carry every running-indicator key', () => {
  const keys = [
    'runningGroup', 'runningStatusTextTitle', 'runningStatusTextDesc', 'runningStatusTextPlaceholder',
    'replaceRunningIconTitle', 'replaceRunningIconDesc', 'runningStatusIconTitle', 'runningStatusIconDesc',
  ]
  for (const key of keys) {
    assert.equal(typeof en[key], 'string', `en.${key}`)
    assert.equal(typeof zh[key], 'string', `zh.${key}`)
    assert.notEqual(en[key], '')
    assert.notEqual(zh[key], '')
  }
  assert.notEqual(en.runningStatusTextTitle, zh.runningStatusTextTitle)
})

test('the upload route accepts the running marker', () => {
  assert.equal(IMAGE_FIELDS.includes('runningStatusIcon'), true)
  assert.equal(imageUrl('/plugins/x.png'), '/plugins/x.png')
})
