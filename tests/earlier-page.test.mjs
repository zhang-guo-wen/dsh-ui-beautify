import test from 'node:test'
import assert from 'node:assert/strict'
import {
  EARLIER_PAGE_SETTLE_FRAMES, EARLIER_PAGE_TIMEOUT_MS, earlierPageButtonOf, requestEarlierPage,
} from '../src/client/earlier-page.ts'
import { FLOW_ROW_SELECTOR, PROMPT_SELECTOR } from '../src/client/scroll-to-prompt.ts'

/** Scrollport geometry every stand-in below shares: its top edge on screen. */
const SCROLLER_TOP = 120

// The plugin releases the host's paging anchor with a synthesized reading intent.
// Node has no PointerEvent, so the stand-in only needs to carry the type through.
globalThis.PointerEvent ??= class extends Event {
  constructor(type, init) { super(type, init) }
}

/** One host control stand-in; `click` is what the request must call exactly once. */
const control = ({ disabled = false } = {}) => ({
  tagName: 'BUTTON',
  disabled,
  clicks: 0,
  click() { this.clicks += 1 },
})
/** The wrapper the host renders around its older-page button. */
const wrapperOf = element => ({ hasAttribute: () => false, childElementCount: 1, firstElementChild: element })
/** A message row: present in the flow, never a single button. */
const rowOf = () => ({ hasAttribute: name => name === 'data-chat-flow-kind', childElementCount: 3, firstElementChild: {} })

/**
 * A scrollport that clamps like a real one and records what settled it.
 *
 * `anchored` models the host's paging anchor: after a prepend it keeps writing the
 * preserved position back over any programmatic scroll until a reader intent —
 * one of its own reading-intent listeners — releases it.
 */
function makeScroller({ scrollTop = 0, max = Infinity, anchored = false, anchorTop = 614 } = {}) {
  const events = []
  const scroller = {
    scrollTop,
    max,
    anchored,
    anchorTop,
    getBoundingClientRect: () => ({ top: SCROLLER_TOP }),
    scrollTo(options) {
      const target = Math.max(0, Math.min(scroller.max, options.top))
      scroller.scrollTop = scroller.anchored ? scroller.anchorTop : target
    },
    dispatchEvent(event) {
      events.push(event.type)
      if (event.type === 'pointerdown') scroller.anchored = false
    },
  }
  return { scroller, events }
}
/** A prompt row at `offset` pixels below the flow's origin. */
const promptRow = (scroller, offset) => ({
  closest: () => null,
  getClientRects: () => [{}],
  getBoundingClientRect() { return { top: SCROLLER_TOP + offset - scroller.scrollTop } },
})

/** A Chat flow whose own scrollport is the fake above. */
function scrolledFlow(options = {}) {
  const { scroller, events } = makeScroller(options)
  const flow = {
    rows: [],
    children: options.children ?? [],
    closest: selector => selector === '[data-conversation-scroll]' ? scroller : null,
    querySelector(selector) {
      assert.equal(selector, FLOW_ROW_SELECTOR)
      return flow.rows[0] ?? null
    },
    querySelectorAll(selector) {
      assert.equal(selector, PROMPT_SELECTOR)
      return flow.rows
    },
  }
  return { flow, scroller, events }
}
/** A flow with no scroller at all, for the structural checks. */
function structuralFlow(children) {
  return { children, closest: () => null, querySelector: () => null, querySelectorAll: () => [] }
}

/** A frame scheduler the assertions step frame by frame. */
function makeHost() {
  const queued = new Map()
  let serial = 0
  const host = {
    time: 0,
    now: () => host.time,
    requestFrame(callback) {
      serial += 1
      queued.set(serial, callback)
      return serial
    },
    cancelFrame(handle) { queued.delete(handle) },
    /** Run every callback queued for the next frame. */
    frame() {
      const due = [...queued.values()]
      queued.clear()
      for (const callback of due) callback()
    },
    /** Step frames until the request stops scheduling. */
    run(limit = 40) {
      let count = 0
      while (queued.size > 0 && count < limit) {
        host.frame()
        count += 1
      }
      return count
    },
    get pending() { return queued.size },
  }
  return host
}

test('the older-page control is the flow leading wrapper holding one button', () => {
  const button = control()
  // The history-loading hint is not the control: it holds no element children.
  const hint = { hasAttribute: () => false, childElementCount: 0, firstElementChild: null }
  assert.equal(earlierPageButtonOf(structuralFlow([hint, wrapperOf(button)])), button)
})
test('a message row ends the scan so a row button is never the older-page control', () => {
  const button = control()
  assert.equal(earlierPageButtonOf(structuralFlow([rowOf(), wrapperOf(button)])), null)
})
test('every loaded page and a wrapper with extra children both read as no control', () => {
  assert.equal(earlierPageButtonOf(structuralFlow([])), null)
  assert.equal(earlierPageButtonOf(structuralFlow([
    { hasAttribute: () => false, childElementCount: 2, firstElementChild: control() },
  ])), null)
  assert.equal(earlierPageButtonOf({}), null)
})
test('a page already in flight still reads as the host control', () => {
  const button = control({ disabled: true })
  assert.equal(earlierPageButtonOf(structuralFlow([wrapperOf(button)])), button)
  assert.equal(earlierPageButtonOf(structuralFlow([])), null)
})

test('one press loads the page and lands the newest round it added', () => {
  const button = control()
  const { flow, scroller, events } = scrolledFlow({ scrollTop: 614, children: [wrapperOf(button)] })
  const older = promptRow(scroller, 500)
  const inView = promptRow(scroller, 2000)
  flow.rows = [inView]
  let settled = 0
  const host = makeHost()
  requestEarlierPage(flow, host, () => { settled += 1 })
  assert.equal(button.clicks, 1)
  // The host flips its own control to disabled while the page is in flight…
  button.disabled = true
  host.frame()
  // …then commits it: a round above the reader becomes the flow's first row.
  button.disabled = false
  flow.rows = [older, inView]
  assert.ok(host.run() >= EARLIER_PAGE_SETTLE_FRAMES)
  assert.equal(settled, 1)
  // 614 + (6 - 120) - 24: the prepended round sits 24px below the readable top.
  assert.equal(scroller.scrollTop, 476)
  assert.equal(older.getBoundingClientRect().top, SCROLLER_TOP + 24)
  assert.deepEqual(events, ['pointerdown', 'scroll', 'scrollend'])
})
test('a paging anchor that writes its position back every frame is released first', () => {
  const button = control()
  const { flow, scroller, events } = scrolledFlow({
    scrollTop: 614, anchored: true, children: [wrapperOf(button)],
  })
  const older = promptRow(scroller, 500)
  const inView = promptRow(scroller, 2000)
  flow.rows = [inView]
  let settled = 0
  const host = makeHost()
  requestEarlierPage(flow, host, () => { settled += 1 })
  button.disabled = true
  host.frame()
  button.disabled = false
  flow.rows = [older, inView]
  host.run()
  // Without the reader intent every landing is written back to 614 on the spot,
  // so the press would give up with the reader still on the old boundary.
  assert.equal(settled, 1)
  assert.equal(scroller.anchored, false)
  assert.equal(events[0], 'pointerdown')
  assert.equal(scroller.scrollTop, 476)
  assert.equal(older.getBoundingClientRect().top, SCROLLER_TOP + 24)
})
test('a landing the scrollport cannot take ends the press instead of spinning', () => {
  const button = control()
  const { flow } = scrolledFlow({ scrollTop: 0, max: 0, children: [wrapperOf(button)] })
  const oldest = promptRow({ scrollTop: 0 }, 300)
  flow.rows = [oldest]
  let settled = 0
  const host = makeHost()
  requestEarlierPage(flow, host, () => { settled += 1 })
  button.disabled = true
  host.frame()
  button.disabled = false
  // The prepared page's round starts above the scrollport, but the history begins
  // there too: the landing cannot move the reader up any further.
  flow.rows = [promptRow({ scrollTop: 0 }, -50), oldest]
  host.run()
  assert.equal(settled, 1)
})
test('output appended below never counts as the older page', () => {
  const button = control()
  const { flow } = scrolledFlow({ children: [wrapperOf(button)] })
  flow.rows = [promptRow({ scrollTop: 0 }, 2000)]
  const host = makeHost()
  let settled = 0
  requestEarlierPage(flow, host, () => { settled += 1 })
  button.disabled = true
  host.frame()
  button.disabled = false
  // A new row appears at the end while the host's request is still pending.
  flow.rows = [flow.rows[0], promptRow({ scrollTop: 0 }, 2600)]
  host.frame()
  host.frame()
  assert.equal(settled, 0)
  assert.ok(host.pending > 0)
  host.time = EARLIER_PAGE_TIMEOUT_MS + 1
  host.frame()
  assert.equal(settled, 1)
})
test('cancelling releases the frames without reporting a settle', () => {
  const { flow } = scrolledFlow({ children: [wrapperOf(control())] })
  const host = makeHost()
  let settled = 0
  const cancel = requestEarlierPage(flow, host, () => { settled += 1 })
  cancel()
  assert.equal(host.pending, 0)
  host.frame()
  assert.equal(settled, 0)
})
test('a press with nothing to load starts no request', () => {
  for (const children of [[], [wrapperOf(control({ disabled: true }))]]) {
    const { flow } = scrolledFlow({ children })
    assert.equal(requestEarlierPage(flow, makeHost(), () => {
      assert.fail('nothing to load must not report a settle')
    }), null)
  }
})
