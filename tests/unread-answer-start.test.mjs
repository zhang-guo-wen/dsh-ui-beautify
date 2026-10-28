import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ANSWER_ROW_SELECTOR, ANSWER_TOP_INSET, answerLanding, answerScrollerOf, landAnswer, lastVisibleAnswer,
} from '../src/client/answer-start.ts'
import { openedFromUnread } from '../src/client/unread-entry.ts'
import {
  createUnreadAnswerStart, LANDING_WINDOW_MS, SETTLE_FRAMES,
} from '../src/client/unread-answer-start.ts'
import { READING_INSET, START_CHIP_LINE_SELECTOR, readableTopOf } from '../src/client/reading-top.ts'

const status = (running, completionUnread) => ({ running, completionUnread })

test('the baseline publication is not a read', () => {
  assert.deepEqual(openedFromUnread(undefined, new Map([['a', status(false, true)]])), [])
})

test('a stopped Session losing the unread flag is the reader opening it', () => {
  const previous = new Map([['a', status(false, true)]])
  const next = new Map([['a', status(false, false)]])
  assert.deepEqual(openedFromUnread(previous, next), ['a'])
})

test('a run starting clears the same flag and is not a read', () => {
  const previous = new Map([['a', status(false, true)]])
  const next = new Map([['a', status(true, false)]])
  assert.deepEqual(openedFromUnread(previous, next), [])
})

test('sessions that stay unread, stay unread', () => {
  const previous = new Map([['a', status(false, true)]])
  assert.deepEqual(openedFromUnread(previous, new Map([['a', status(false, true)]])), [])
})

test('a Session dropping out of the publication is not a read', () => {
  const previous = new Map([['a', status(false, true)], ['b', status(false, false)]])
  assert.deepEqual(openedFromUnread(previous, new Map([['b', status(false, false)]])), [])
})

test('every opened Session is reported in publication order', () => {
  const previous = new Map([['a', status(false, true)], ['b', status(false, true)], ['c', status(false, true)]])
  const next = new Map([['a', status(false, false)], ['b', status(false, true)], ['c', status(false, false)]])
  assert.deepEqual(openedFromUnread(previous, next), ['a', 'c'])
})

const row = (top, { hidden = false, mounted = true, height = 200 } = {}) => ({
  closest: () => hidden ? {} : null,
  getClientRects: () => mounted ? [{}] : [],
  getBoundingClientRect: () => ({ top, height }),
})

/**
 * The chat DOM: one scrollport, one Chat flow, and a mutable "chip height" so a
 * test can make the floating start chip appear at the moment it chooses.
 */
const geometry = ({ rows = [], standalone = false, scrollTop = 1000, onScroll } = {}) => {
  const calls = []
  const events = []
  const chip = { height: 0 }
  const chipLine = {
    getBoundingClientRect: () => ({ top: 100, bottom: 100 + chip.height, height: chip.height }),
  }
  const content = {
    querySelector: (selector) => {
      assert.equal(selector, START_CHIP_LINE_SELECTOR)
      return chip.height > 0 ? chipLine : null
    },
  }
  const scroller = {
    scrollTop,
    getBoundingClientRect: () => ({ top: 100 }),
    scrollTo(options) {
      calls.push(options)
      this.scrollTop = options.top
      onScroll?.()
    },
    dispatchEvent(event) { events.push(event.type) },
  }
  const flow = {
    parentElement: scroller,
    closest: (selector) => {
      if (selector === '[data-conversation-scroll]') return standalone ? null : scroller
      if (selector === '[data-conversation-content]') return content
      assert.fail(`unexpected selector ${selector}`)
    },
    querySelectorAll: (selector) => {
      assert.equal(selector, ANSWER_ROW_SELECTOR)
      return rows
    },
  }
  return { flow, scroller, rows, chip, calls, events }
}

/** A row whose page position is fixed, so the measured offset follows the scroller. */
const liveRow = (pageTop, scroller, height = 200) => ({
  closest: () => null,
  getClientRects: () => [{}],
  getBoundingClientRect: () => ({ top: pageTop - scroller.scrollTop, height }),
})

test('the scroller is the conversation body when one wraps the chat', () => {
  const { flow, scroller } = geometry()
  assert.equal(answerScrollerOf(flow), scroller)
})

test('a standalone chat reports its own list as the scroller', () => {
  const { flow } = geometry({ standalone: true })
  assert.equal(answerScrollerOf(flow), flow.parentElement)
})

test('the last visible answer is the newest answer the reader can see', () => {
  const first = row(-900)
  const last = row(120)
  const { flow } = geometry({ rows: [first, last] })
  assert.equal(lastVisibleAnswer(flow), last)
})

test('collapsed, unmounted, and zero-height rows never become the target', () => {
  const visible = row(-300)
  const { flow } = geometry({ rows: [
    visible,
    row(-100, { hidden: true }),
    row(0, { mounted: false }),
    row(40, { height: 0 }),
  ] })
  assert.equal(lastVisibleAnswer(flow), visible)
})

test('a transcript with no visible answer has no target', () => {
  const { flow } = geometry({ rows: [row(120, { hidden: true })] })
  assert.equal(lastVisibleAnswer(flow), null)
})

test('the landing measures the current offset and lands at the reading inset', () => {
  const { flow, scroller, calls, events } = geometry({ rows: [row(1400 - 1000)] })
  const landing = answerLanding(flow)
  assert.equal(landing?.scroller, scroller)
  assert.equal(landing?.offset, 300)
  // 1000 + 300 - 24.
  assert.equal(landing?.target, 1276)
  assert.equal(landAnswer(flow), true)
  assert.deepEqual(calls, [{ top: 1276, behavior: 'instant' }])
  assert.deepEqual(events, ['scroll', 'scrollend'])
})

test('a short transcript clamps the landing at the top', () => {
  const { flow, calls } = geometry({ rows: [row(0)], scrollTop: 100 })
  // 100 + (0 - 100) - 24 is below zero.
  assert.equal(answerLanding(flow)?.target, 0)
  landAnswer(flow)
  assert.equal(calls[0].top, 0)
})

test('no answer or no scroller lands nowhere', () => {
  for (const options of [{ rows: [] }, { standalone: true, rows: [row(0)] }]) {
    const { flow, calls, events } = geometry(options)
    if (options.standalone) {
      assert.equal(landAnswer(flow), true)
      assert.equal(calls.length, 1)
      continue
    }
    assert.equal(landAnswer(flow), false)
    assert.deepEqual(calls, [])
    assert.deepEqual(events, [])
  }
})

test('the reading inset is the one the up controls use', () => {
  assert.equal(ANSWER_TOP_INSET, 24)
  assert.equal(READING_INSET, 24)
})

test('the readable top is the scrollport edge without a floating chip', () => {
  const { flow, scroller } = geometry()
  assert.equal(readableTopOf(flow, scroller), 100)
})

test('the floating start chip moves the readable top below its line', () => {
  const { flow, scroller, chip } = geometry()
  chip.height = 33
  assert.equal(readableTopOf(flow, scroller), 133)
})

test('a chip that does not hang over the scrollport is ignored', () => {
  for (const lineRect of [
    { top: 40, bottom: 90, height: 50 },
    { top: 100, bottom: 100, height: 0 },
  ]) {
    const scroller = { getBoundingClientRect: () => ({ top: 100 }) }
    const line = { getBoundingClientRect: () => lineRect }
    const flow = {
      closest: (selector) => {
        assert.equal(selector, '[data-conversation-content]')
        return { querySelector: (inner) => { assert.equal(inner, START_CHIP_LINE_SELECTOR); return line } }
      },
    }
    assert.equal(readableTopOf(flow, scroller), 100)
  }
})

test('an answer lands below the floating start chip, never behind it', () => {
  const { flow, scroller, rows, calls, chip } = geometry()
  chip.height = 33
  rows.push(liveRow(1400, scroller))
  const landing = answerLanding(flow)
  // Visible top is the chip's bottom at 133: offset 400 - 133, target 1000 + 267 - 24.
  assert.equal(landing?.offset, 267)
  assert.equal(landing?.target, 1243)
  landAnswer(flow)
  assert.deepEqual(calls, [{ top: 1243, behavior: 'instant' }])
})

/**
 * A host under this test's control: status publications, a clock, a frame queue,
 * and a document whose contents the test mounts when it wants them.
 */
function fixture({ contents = [] } = {}) {
  const clock = { time: 0 }
  const frames = new Map()
  let nextFrame = 0
  let statuses = new Map()
  const statusListeners = new Set()
  const documentListeners = new Map()
  const source = {
    getSnapshot: () => statuses,
    subscribe(listener) {
      statusListeners.add(listener)
      return () => { statusListeners.delete(listener) }
    },
  }
  const host = {
    document: {
      querySelectorAll(selector) {
        assert.equal(selector, '[data-conversation-content]')
        return contents
      },
      addEventListener(type, listener) { documentListeners.set(type, listener) },
      removeEventListener(type) { documentListeners.delete(type) },
    },
    now: () => clock.time,
    requestFrame(callback) {
      nextFrame += 1
      frames.set(nextFrame, callback)
      return nextFrame
    },
    cancelFrame(handle) { frames.delete(handle) },
  }
  const publish = next => {
    statuses = next
    for (const listener of [...statusListeners]) listener()
  }
  const frame = () => {
    clock.time += 16
    const entry = frames.entries().next().value
    if (entry === undefined) return false
    frames.delete(entry[0])
    entry[1]()
    return true
  }
  const intent = (type, event) => {
    const listener = documentListeners.get(type)
    assert.ok(listener, `no ${type} listener installed`)
    listener(event)
  }
  return { clock, frames, source, host, contents, publish, frame, intent, statusListeners, documentListeners }
}

const contentFor = (sessionId, flow) => ({
  getAttribute: name => name === 'data-conversation-session' ? sessionId : null,
  getClientRects: () => [{}],
  querySelector: selector => {
    assert.equal(selector, '[data-chat-flow]')
    return flow
  },
})

test('opening an unread conversation waits for its body, then lands on the answer', () => {
  const { source, host, contents, publish, frame } = fixture()
  const dispose = createUnreadAnswerStart(source, host)
  publish(new Map([['a', status(false, false)], ['b', status(false, true)]]))
  publish(new Map([['a', status(false, false)], ['b', status(false, false)]]))
  // No conversation body mounted yet: the landing waits.
  assert.equal(frame(), true)
  assert.equal(frame(), true)
  const { flow, scroller, rows, calls } = geometry()
  rows.push(liveRow(1400, scroller))
  contents.push(contentFor('b', flow))
  for (let index = 0; index <= SETTLE_FRAMES; index += 1) frame()
  assert.deepEqual(calls, [{ top: 1276, behavior: 'instant' }])
  // Settled: the loop stops scheduling frames.
  assert.equal(frame(), false)
  assert.equal(scroller.scrollTop, 1276)
  dispose()
})

test('an already rendered body lands on the next frame', () => {
  const { source, host, contents, publish, frame } = fixture()
  const dispose = createUnreadAnswerStart(source, host)
  const { flow, calls } = geometry({ rows: [row(400)] })
  contents.push(contentFor('a', flow))
  publish(new Map([['a', status(false, true)]]))
  publish(new Map([['a', status(false, false)]]))
  frame()
  assert.equal(calls.length, 1)
  dispose()
})

test('the publish that starts a run is not an open', () => {
  const { source, host, contents, publish, frame } = fixture()
  const dispose = createUnreadAnswerStart(source, host)
  const { flow, calls } = geometry({ rows: [row(0)] })
  contents.push(contentFor('a', flow))
  publish(new Map([['a', status(false, false)]]))
  publish(new Map([['a', status(false, true)]]))
  publish(new Map([['a', status(true, false)]]))
  frame()
  assert.deepEqual(calls, [])
  dispose()
})

test('a conversation that never renders is abandoned at the deadline', () => {
  const { clock, source, host, publish, frame } = fixture()
  const dispose = createUnreadAnswerStart(source, host)
  publish(new Map([['a', status(false, true)]]))
  publish(new Map([['a', status(false, false)]]))
  clock.time = LANDING_WINDOW_MS + 1
  frame()
  assert.equal(frame(), false)
  dispose()
})

test('a reading gesture hands the viewport back to the reader', () => {
  for (const [type, event] of [
    ['wheel', { type: 'wheel', target: null }],
    ['keydown', { type: 'keydown', key: 'PageUp' }],
    ['keydown', { type: 'keydown', key: 'End' }],
    ['pointerdown', { type: 'pointerdown', target: { closest: selector => selector === '[data-conversation-scroll]' ? {} : null } }],
    ['touchstart', { type: 'touchstart', target: { closest: selector => selector === '[data-conversation-scroll]' ? {} : null } }],
  ]) {
    const { source, host, contents, publish, frame, intent } = fixture()
    const dispose = createUnreadAnswerStart(source, host)
    const { flow, calls } = geometry({ rows: [row(0)] })
    contents.push(contentFor('a', flow))
    publish(new Map([['a', status(false, true)]]))
    publish(new Map([['a', status(false, false)]]))
    intent(type, event)
    assert.equal(frame(), false, `${type} should cancel the pending landing`)
    assert.deepEqual(calls, [])
    dispose()
  }
})

test('gestures that cannot scroll the transcript leave the landing alone', () => {
  for (const [type, event] of [
    ['keydown', { type: 'keydown', key: 'a' }],
    ['pointerdown', { type: 'pointerdown', target: { closest: () => null } }],
  ]) {
    const { source, host, contents, publish, frame, intent } = fixture()
    const dispose = createUnreadAnswerStart(source, host)
    const { flow, calls } = geometry({ rows: [row(400)] })
    contents.push(contentFor('a', flow))
    publish(new Map([['a', status(false, true)]]))
    publish(new Map([['a', status(false, false)]]))
    intent(type, event)
    frame()
    assert.equal(calls.length, 1, `${type} must not cancel the landing`)
    dispose()
  }
})

test('disposing stops the landing, the subscription, and the listeners', () => {
  const { source, host, contents, publish, frame, documentListeners } = fixture()
  const dispose = createUnreadAnswerStart(source, host)
  const { flow, calls } = geometry({ rows: [row(0)] })
  contents.push(contentFor('a', flow))
  publish(new Map([['a', status(false, true)]]))
  publish(new Map([['a', status(false, false)]]))
  dispose()
  assert.equal(frame(), false)
  assert.deepEqual(calls, [])
  assert.equal(documentListeners.size, 0)
  publish(new Map([['a', status(false, true)]]))
  publish(new Map([['a', status(false, false)]]))
  assert.equal(frame(), false)
})

test('settling takes a few frames of held position', () => {
  const { source, host, contents, publish, frame } = fixture()
  const dispose = createUnreadAnswerStart(source, host)
  const { flow, scroller, rows } = geometry()
  rows.push(liveRow(1400, scroller))
  contents.push(contentFor('a', flow))
  publish(new Map([['a', status(false, true)]]))
  publish(new Map([['a', status(false, false)]]))
  // First frame applies the landing; the following frames only confirm it.
  for (let index = 0; index <= SETTLE_FRAMES; index += 1) assert.equal(frame(), true)
  assert.equal(frame(), false)
  dispose()
})

test('a landing with the floating chip already visible starts below it', () => {
  const { source, host, contents, publish, frame } = fixture()
  const dispose = createUnreadAnswerStart(source, host)
  const { flow, scroller, rows, calls, chip } = geometry()
  chip.height = 33
  rows.push(liveRow(1400, scroller))
  contents.push(contentFor('a', flow))
  publish(new Map([['a', status(false, true)]]))
  publish(new Map([['a', status(false, false)]]))
  for (let index = 0; index <= SETTLE_FRAMES; index += 1) frame()
  assert.deepEqual(calls, [{ top: 1243, behavior: 'instant' }])
  assert.equal(scroller.scrollTop, 1243)
  dispose()
})

test('a chip that appears because of the landing is cleared by the next frame', () => {
  const { source, host, contents, publish, frame } = fixture()
  const dispose = createUnreadAnswerStart(source, host)
  const { flow, scroller, rows, calls, chip } = geometry({ onScroll: () => { chip.height = 33 } })
  rows.push(liveRow(1400, scroller))
  contents.push(contentFor('a', flow))
  publish(new Map([['a', status(false, true)]]))
  publish(new Map([['a', status(false, false)]]))
  for (let index = 0; index <= SETTLE_FRAMES + 1; index += 1) frame()
  // Frame one lands at 1276 as if there were no chip; the chip then appears, so
  // the next frame moves the answer below it and the position holds there.
  assert.deepEqual(calls.map((call) => call.top), [1276, 1243])
  assert.equal(scroller.scrollTop, 1243)
  dispose()
})
