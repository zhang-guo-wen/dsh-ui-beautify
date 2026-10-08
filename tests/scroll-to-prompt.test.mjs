import test from 'node:test'
import assert from 'node:assert/strict'
import { latestPrompt, scrollToPrompt, PROMPT_SELECTOR } from '../src/client/scroll-to-prompt.ts'

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

test('returns the latest visible sent input, ignoring retained hidden rows', () => {
  const last = row(200)
  const { flow } = fixture({ rows: [row(100), last, row(300, { hidden: true }), row(400, { mounted: false })] })
  assert.equal(latestPrompt(flow), last)
})
test('lands above latest prompt in the conversation, settles host reading rather than following output', () => {
  const { flow, jumps, events } = fixture({ rows: [row(-500), row(-220)] })
  assert.equal(scrollToPrompt(flow), true)
  assert.deepEqual(jumps, [{ top: 676, behavior: 'instant' }])
  assert.deepEqual(events, ['scroll', 'scrollend'])
})
test('standalone Chat scrolls its own list and clamps to the top', () => {
  const { flow, jumps } = fixture({ standalone: true, rows: [row(-2000)] })
  assert.equal(scrollToPrompt(flow), true)
  assert.equal(jumps[0].top, 0)
})
test('empty or hidden-only transcript does not scroll anywhere', () => {
  for (const rows of [[], [row(0, { hidden: true })]]) {
    const { flow, jumps, events } = fixture({ rows })
    assert.equal(scrollToPrompt(flow), false)
    assert.deepEqual(jumps, [])
    assert.deepEqual(events, [])
  }
})
