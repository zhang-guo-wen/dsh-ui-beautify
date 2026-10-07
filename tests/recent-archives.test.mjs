import test from 'node:test'
import assert from 'node:assert/strict'
import { deriveRecentSessions } from '../src/client/recent-sessions.ts'
const catalog = rows => ({ ids: rows.map(x => x.id), byId: Object.fromEntries(rows.map(x => [x.id, x])) })
const rows = Array.from({ length: 7 }, (_, i) => ({ id: `r${i}`, displayTitle: `对话${i}`, updatedAt: i }))

test('archived current and latest rows are excluded before limiting', () => {
  assert.deepEqual(deriveRecentSessions(catalog(rows), 'r0', ['r0', 'r6']).map(x => x.id), ['r5', 'r4', 'r3', 'r2', 'r1'])
})
test('one or two eligible rows are not padded; no eligible rows returns empty', () => {
  assert.equal(deriveRecentSessions(catalog(rows.slice(0, 2)), 'r0').length, 2)
  assert.equal(deriveRecentSessions(catalog(rows.slice(0, 2)), 'r0', ['r1']).length, 1)
  assert.deepEqual(deriveRecentSessions(catalog(rows.slice(0, 2)), 'r0', ['r1', 'r0']), [])
})
test('archive/unarchive catalog refresh removes/restores without changing timestamps', () => {
  const list = catalog(rows.slice(0, 2))
  assert.deepEqual(deriveRecentSessions(list, 'r0', []).map(x => x.id), ['r1', 'r0'])
  assert.deepEqual(deriveRecentSessions(list, 'r0', ['r0']).map(x => x.id), ['r1'])
  assert.deepEqual(deriveRecentSessions(list, 'r0', []).map(x => x.id), ['r1', 'r0'])
})
