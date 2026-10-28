import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DOCK_EDGE_MARGIN, DOCK_SIZE, DOCK_STORAGE_KEY,
  clampDockPosition, defaultDockPosition, nextConversation, parseDockPosition, serializeDockPosition,
} from '../src/client/quick-actions.ts'

const viewport = { width: 1000, height: 800 }

test('a dragged position inside the viewport is kept as it is', () => {
  assert.deepEqual(clampDockPosition({ right: 100, bottom: 200 }, viewport), { right: 100, bottom: 200 })
})

test('dragging past an edge keeps the whole button on screen', () => {
  // Pushing past the right edge drives `right` below the margin.
  assert.deepEqual(clampDockPosition({ right: -50, bottom: -20 }, viewport),
    { right: DOCK_EDGE_MARGIN, bottom: DOCK_EDGE_MARGIN })
  // Pushing across to the opposite side caps the distance at the left/top edge.
  assert.deepEqual(clampDockPosition({ right: 1000, bottom: 800 }, viewport), {
    right: viewport.width - DOCK_SIZE - DOCK_EDGE_MARGIN,
    bottom: viewport.height - DOCK_SIZE - DOCK_EDGE_MARGIN,
  })
})

test('a viewport smaller than the button still keeps the margin', () => {
  assert.deepEqual(clampDockPosition({ right: 10, bottom: 10 }, { width: 20, height: 20 }),
    { right: DOCK_EDGE_MARGIN, bottom: DOCK_EDGE_MARGIN })
})

test('non-finite coordinates fall back to the edge margin instead of parking off-screen', () => {
  const clamped = clampDockPosition({ right: Number.NaN, bottom: Number.POSITIVE_INFINITY }, viewport)
  assert.deepEqual(clamped, { right: DOCK_EDGE_MARGIN, bottom: DOCK_EDGE_MARGIN })
})

test('the resting position sits above the composer card when one is visible', () => {
  const rest = defaultDockPosition({ width: 1440, height: 900 }, { top: 700 })
  assert.equal(rest.right, 24)
  // 900 - 700 + 12: above the card, not over the send button.
  assert.equal(rest.bottom, 212)
})

test('phones rest closer to the right edge and above the phone composer', () => {
  const rest = defaultDockPosition({ width: 393, height: 844 }, { top: 700 })
  assert.equal(rest.right, 16)
  assert.equal(rest.bottom, 156)
})

test('without a composer card the resting position keeps a bottom margin', () => {
  assert.equal(defaultDockPosition({ width: 1440, height: 900 }, { top: null }).bottom, 24)
  assert.equal(defaultDockPosition({ width: 393, height: 844 }, { top: null }).bottom, 96)
})

test('a stored position is read only when both coordinates are finite numbers', () => {
  assert.deepEqual(parseDockPosition('{"right":12,"bottom":34}'), { right: 12, bottom: 34 })
  for (const raw of [null, undefined, '', 'not json', '[]', 'null', '{"right":12}', '{"right":"12","bottom":34}', '{"right":null,"bottom":34}']) {
    assert.equal(parseDockPosition(raw), null, String(raw))
  }
})

test('a stored position round-trips through storage', () => {
  const position = { right: 12.6, bottom: 34.4 }
  const stored = serializeDockPosition(position)
  assert.equal(stored, '{"right":13,"bottom":34}')
  assert.deepEqual(parseDockPosition(stored), { right: 13, bottom: 34 })
  assert.equal(DOCK_STORAGE_KEY, 'ui-beautify:quick-actions-position')
})

const sessions = {
  a: { blank: false, updatedAt: 400 },
  b: { blank: false, updatedAt: 300 },
  c: { blank: false, updatedAt: 200 },
  d: { blank: false, updatedAt: 100 },
  draft: { blank: true },
  child: { origin: 'subagent' },
  gone: undefined,
}
const unread = ids => new Map(ids.map(id => [id, { completionUnread: true }]))
const choose = options => nextConversation({
  ids: ['a', 'b', 'c', 'd'], byId: sessions, statuses: new Map(), currentId: 'a', ...options,
})

test('an unread green dot outranks a pinned conversation', () => {
  assert.equal(choose({ statuses: unread(['b']), pinnedIds: ['d'] }), 'b')
})

test('green dots walk the list order after the current conversation and wrap', () => {
  assert.equal(choose({ currentId: 'b', statuses: unread(['a', 'd']) }), 'd')
  assert.equal(choose({ currentId: 'd', statuses: unread(['a']) }), 'a')
})

test('with no green dot waiting the next pinned conversation wins', () => {
  assert.equal(choose({ pinnedIds: ['c', 'd'] }), 'c')
  assert.equal(choose({ currentId: 'd', pinnedIds: ['b'] }), 'b')
})

test('the current conversation is never a target of either tier', () => {
  assert.equal(choose({ pinnedIds: ['a', 'c'] }), 'c')
  // A green dot on the current conversation itself is not a target; the time tier takes over.\n  assert.equal(choose({ statuses: unread(['a']) }), 'b')
})

test('without green dots or pins the next older conversation by time is opened', () => {
  // Current a is the newest; b is the closest older conversation.
  assert.equal(choose({}), 'b')
  assert.equal(choose({ currentId: 'b' }), 'c')
  // The oldest wraps to the newest.
  assert.equal(choose({ currentId: 'd' }), 'a')
})

test('the time tier sorts by updatedAt, not by host list order', () => {
  const ids = ['d', 'c', 'b', 'a']
  assert.equal(nextConversation({ ids, byId: sessions, statuses: new Map(), currentId: 'b' }), 'c')
})

test('blank drafts, subagent children, archived rows, and unknown ids are skipped', () => {
  const ids = ['draft', 'child', 'gone', 'archived', 'b']
  const summaries = { ...sessions, archived: { blank: false, updatedAt: 350 } }
  assert.equal(nextConversation({
    ids, byId: summaries, statuses: new Map(), currentId: 'a',
    pinnedIds: ['archived', 'child'], archivedIds: ['archived'],
  }), 'b')
})

test('a current conversation missing from the list starts at the first candidate', () => {
  assert.equal(choose({ currentId: 'elsewhere', statuses: unread(['c']) }), 'c')
  // No current time to compare against: the newest conversation is used.
  assert.equal(nextConversation({ ids: ['c', 'd'], byId: sessions, statuses: new Map(), currentId: 'elsewhere' }), 'c')
})

test('a missing updatedAt still participates in the time tier', () => {
  assert.equal(nextConversation({
    ids: ['a', 'x'], byId: { ...sessions, x: { blank: false } }, statuses: new Map(), currentId: 'a',
  }), 'x')
})

test('nothing else to open returns null', () => {
  assert.equal(nextConversation({ ids: [], byId: sessions, statuses: new Map(), currentId: 'a' }), null)
  assert.equal(nextConversation({ ids: ['a', 'draft', 'child'], byId: sessions, statuses: new Map(), currentId: 'a' }), null)
})


