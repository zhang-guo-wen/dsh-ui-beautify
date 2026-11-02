/**
 * The blank-session slogan writes through the headline's text nodes only.
 *
 * The headline belongs to the host's Conversation plugin, which renders it
 * itself. Replacing its `textContent` deletes element children React still
 * references, and the host then throws when it unmounts or updates one of them —
 * the failure that blanked the transcript from the running indicator. These
 * tests pin the text-node write, the host text restore, and the observer that
 * reapplies the slogan after the host renders its own words.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { applyTagline } from '../src/client/tagline.ts'
import { HERO_HEADLINE_SELECTOR } from '../src/client/host-defaults.ts'

const HOST_TAGLINE = '深度求索，伴你左右'
const SLOGAN = '专注，只为更简单'

// ---------------------------------------------------------------------------
// A minimal document: the element, text, and observer surface the tagline needs.
// Assigning `textContent` drops children the way the browser does, because
// leaving the host's React tree standing is the behavior under test.
// ---------------------------------------------------------------------------
function textNode(value) {
  return {
    nodeType: 3,
    nodeValue: value,
    parent: null,
    get textContent() { return this.nodeValue },
    set textContent(next) { this.nodeValue = next },
  }
}

function element(attributes = {}, children = []) {
  const node = {
    nodeType: 1,
    attributes: { ...attributes },
    childNodes: [],
    parent: null,
    get children() { return node.childNodes.filter(child => child.nodeType === 1) },
    get textContent() { return node.childNodes.map(child => child.textContent).join('') },
    set textContent(value) {
      for (const child of node.childNodes) child.parent = null
      node.childNodes = []
      if (value !== '') node.appendChild(textNode(value))
    },
    setAttribute(name, value) { this.attributes[name] = value },
    getAttribute(name) { return this.attributes[name] ?? null },
    removeAttribute(name) { delete this.attributes[name] },
    appendChild(child) {
      child.parent?.removeChild(child)
      node.childNodes.push(child)
      child.parent = node
      return child
    },
    removeChild(child) {
      const at = node.childNodes.indexOf(child)
      if (at < 0) throw new Error('the node to be removed is not a child of this node')
      node.childNodes.splice(at, 1)
      child.parent = null
      return child
    },
    remove() { this.parent?.removeChild(this) },
  }
  for (const child of children) node.appendChild(child)
  return node
}

/** A document exposing one hero headline, plus the observers it collected. */
function fakeDocument(headlines) {
  const body = element({}, headlines)
  const observers = []
  const document = {
    body,
    querySelectorAll: selector => (selector === HERO_HEADLINE_SELECTOR ? [...headlines] : []),
  }
  globalThis.MutationObserver = class {
    constructor(callback) { this.callback = callback; observers.push(this) }
    observe() {}
    disconnect() { this.disconnected = true }
  }
  // Alert the observer the way a host re-render would, without a real event loop.
  document.flush = () => { for (const observer of observers) if (!observer.disconnected) observer.callback() }
  return { document, body }
}

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

/** The host's headline element: the text, and a badge the host also renders. */
function headline(text) {
  const textNodeInstance = textNode(text)
  const badge = element({ class: '_badge' }, [textNode('预览')])
  const span = element({ class: '_titleGroup' }, [textNodeInstance, badge])
  return { span, textNodeInstance, badge }
}

test('the slogan replaces the headline text and keeps its element children', () => {
  const { span, badge } = headline(HOST_TAGLINE)
  const { document } = fakeDocument([span])
  globalThis.document = document
  const dispose = applyTagline(settings({ tagline: SLOGAN }))
  assert.equal(span.textContent, `${SLOGAN}预览`)
  // The badge is the node the host unmounts or updates; a `textContent` write
  // would have deleted it and made that update throw.
  assert.deepEqual(span.children, [badge])
  dispose()
})

test('the observer reapplies the slogan after the host renders its own words', () => {
  const { span, textNodeInstance } = headline(HOST_TAGLINE)
  const { document } = fakeDocument([span])
  globalThis.document = document
  const dispose = applyTagline(settings({ tagline: SLOGAN }))
  textNodeInstance.nodeValue = '新的官方文案'
  document.flush()
  assert.equal(span.textContent, `${SLOGAN}预览`)
  dispose()
})

test('a host rewrite becomes the text the setting restores later', () => {
  const { span, textNodeInstance } = headline(HOST_TAGLINE)
  const { document } = fakeDocument([span])
  globalThis.document = document
  const scope = settings({ tagline: SLOGAN })
  const dispose = applyTagline(scope)
  textNodeInstance.nodeValue = '新的官方文案'
  document.flush()
  scope.set({ tagline: '' })
  assert.equal(span.textContent, '新的官方文案预览')
  dispose()
})

test('clearing the slogan restores the host text and keeps the elements', () => {
  const { span, badge } = headline(HOST_TAGLINE)
  const { document } = fakeDocument([span])
  globalThis.document = document
  const scope = settings({ tagline: SLOGAN })
  const dispose = applyTagline(scope)
  scope.set({ tagline: '' })
  assert.equal(span.textContent, `${HOST_TAGLINE}预览`)
  assert.deepEqual(span.children, [badge])
  dispose()
})

test('releasing the effect restores the host text', () => {
  const { span } = headline(HOST_TAGLINE)
  const { document } = fakeDocument([span])
  globalThis.document = document
  const dispose = applyTagline(settings({ tagline: SLOGAN }))
  assert.equal(span.textContent, `${SLOGAN}预览`)
  dispose()
  assert.equal(span.textContent, `${HOST_TAGLINE}预览`)
})

test('a headline that renders no text node is left alone', () => {
  const badge = element({ class: '_badge' }, [textNode('预览')])
  const span = element({ class: '_titleGroup' }, [badge])
  const { document } = fakeDocument([span])
  globalThis.document = document
  const dispose = applyTagline(settings({ tagline: SLOGAN }))
  // Inserting a text node would hand React a child it never rendered.
  assert.deepEqual(span.children, [badge])
  assert.equal(span.textContent, '预览')
  dispose()
})
