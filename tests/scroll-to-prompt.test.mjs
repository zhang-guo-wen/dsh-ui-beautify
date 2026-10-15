import test from 'node:test'
import assert from 'node:assert/strict'
import {
  nearestPromptAbove, promptPreviewText, promptScrollerOf, scrollToPrompt, PROMPT_SELECTOR,
} from '../src/client/scroll-to-prompt.ts'

function fixture({ standalone = false, rows = [] } = {}) {
  const events = []
  const jumps = []
  const scroller = {
    scrollTop: 1000,
    getBoundingClientRect: () => ({ top: 80 }),
    scrollTo(options) { jumps.push(options); this.scrollTop = options.top },
    dispatchEvent(event) { events.push(event.type) },
  }
  const flow = {
    parentElement: scroller,
    closest: selector => { assert.equal(selector, '[data-conversation-scroll]'); return standalone ? null : scroller },
    querySelectorAll: selector => { assert.equal(selector, PROMPT_SELECTOR); return rows },
  }
  return { flow, scroller, jumps, events }
}
const row = (top, { hidden = false, mounted = true } = {}) => ({
  closest: () => hidden ? {} : null,
  getClientRects: () => mounted ? [{}] : [],
  getBoundingClientRect: () => ({ top }),
})

test('the scroller is the conversation body when one wraps the chat', () => {
  const { flow, scroller } = fixture({ rows: [] })
  assert.equal(promptScrollerOf(flow), scroller)
})
test('a standalone chat reports its own list as the scroller', () => {
  const { flow } = fixture({ standalone: true, rows: [] })
  assert.equal(promptScrollerOf(flow), flow.parentElement)
})

test('the nearest prompt above the viewport is the round the reader is inside', () => {
  const earlier = row(-500)
  const round = row(-220)
  const latest = row(140)
  const { flow, scroller } = fixture({ rows: [earlier, round, latest] })
  assert.equal(nearestPromptAbove(flow, scroller), round)
})
test('hidden and unmounted rows never become the target', () => {
  const visible = row(-300)
  const { flow, scroller } = fixture({ rows: [row(-500, { hidden: true }), visible, row(-100, { mounted: false })] })
  assert.equal(nearestPromptAbove(flow, scroller), visible)
})
test('nothing sits above the reader once every sent input is in view', () => {
  const { flow, scroller } = fixture({ rows: [row(120), row(300)] })
  assert.equal(nearestPromptAbove(flow, scroller), null)
})

test('the up button walks back one round per press instead of always the latest', () => {
  const earlier = row(-500)
  const latest = row(140)
  const { flow, jumps, events } = fixture({ rows: [earlier, latest] })
  assert.equal(scrollToPrompt(flow), true)
  // 1000 + (-500 - 80) - 24: the round above, never the prompt already in view.
  assert.deepEqual(jumps, [{ top: 396, behavior: 'instant' }])
  assert.deepEqual(events, ['scroll', 'scrollend'])
})
test('lands above the round start and settles host reading rather than following output', () => {
  const { flow, jumps, events } = fixture({ rows: [row(-500), row(-220)] })
  assert.equal(scrollToPrompt(flow), true)
  assert.deepEqual(jumps, [{ top: 676, behavior: 'instant' }])
  assert.deepEqual(events, ['scroll', 'scrollend'])
})
test('standalone chat scrolls its own list and clamps to the top', () => {
  const { flow, jumps } = fixture({ standalone: true, rows: [row(-2000)] })
  assert.equal(scrollToPrompt(flow), true)
  assert.equal(jumps[0].top, 0)
})
test('empty transcript or nothing above the reader scrolls nowhere', () => {
  for (const rows of [[], [row(120)]]) {
    const { flow, jumps, events } = fixture({ rows })
    assert.equal(scrollToPrompt(flow), false)
    assert.deepEqual(jumps, [])
    assert.deepEqual(events, [])
  }
})
test('a detached flow has no scroller and never scans, let alone scrolls', () => {
  const flow = {
    parentElement: null,
    closest: () => null,
    querySelectorAll: () => { throw new Error('scrollToPrompt must not scan a flow it cannot scroll') },
  }
  assert.equal(scrollToPrompt(flow), false)
})

test('preview text keeps the message and drops clock and attachment chrome', () => {
  const segments = [
    { text: '14:32', chrome: true, remove() { this.removed = true }, querySelectorAll: () => [] },
    { text: '先读一下', chrome: false },
    { text: '设计稿.png', chrome: true, remove() { this.removed = true }, querySelectorAll: () => [] },
    { text: '  再写测试 ', chrome: false },
  ]
  const source = {
    cloneNode() {
      return {
        querySelectorAll: selector => {
          assert.equal(selector, '[data-clock], [data-message-attachments]')
          return segments.filter(segment => segment.chrome).map(segment => {
            segment.removed = true
            return segment
          })
        },
        get textContent() {
          return segments.filter(segment => !segment.removed).map(segment => segment.text).join('')
        },
      }
    },
  }
  assert.equal(promptPreviewText(source), '先读一下 再写测试')
})
test('a message with no text of its own previews its attachment names', () => {
  const source = {
    cloneNode() {
      return {
        querySelectorAll: selector => {
          assert.equal(selector, '[data-clock], [data-message-attachments]')
          return [{
            remove() {},
            querySelectorAll: inner => {
              assert.equal(inner, '[title], [alt]')
              return [
                { getAttribute: name => name === 'title' ? '设计稿.png' : null },
                { getAttribute: name => name === 'alt' ? '截图.jpg' : null },
                { getAttribute: () => null },
              ]
            },
          }]
        },
        textContent: '  ',
      }
    },
  }
  assert.equal(promptPreviewText(source), '设计稿.png 截图.jpg')
})
test('a long prompt truncates on code points, not on UTF-16 units', () => {
  const source = { cloneNode: () => ({ querySelectorAll: () => [], textContent: '一二三四五六七' }) }
  assert.equal(promptPreviewText(source, 5), '一二三四五…')
  assert.equal(promptPreviewText(source, 7), '一二三四五六七')
})
