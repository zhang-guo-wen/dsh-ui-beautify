import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { recentSessionStatus } from '../src/client/recent-session-status.ts'

const row = { id: 'parent', displayTitle: 'parent', updatedAt: 1, running: true }
const list = { ids: ['parent'], byId: { parent: row, child: { id: 'child', running: true } },
  projectionsBySession: { parent: { values: { subagentCatalog: [{ id: 'child' }] } } } }
const derive = status => recentSessionStatus(row, list, new Map([['parent', status], ['child', { running: false }]]))

test('recent dots match sidebar attention > running > unread completion > idle priority', () => {
  for (const kind of ['approval', 'plan-review', 'question']) {
    assert.equal(derive({ pendingInteraction: { kind }, running: true, completionUnread: true }), kind)
  }
  assert.equal(derive({ running: true, completionUnread: true }), 'running')
  assert.equal(derive({ running: false, completionUnread: true }), 'completed')
  assert.equal(derive({ running: false, completionUnread: false }), 'idle')
  assert.equal(derive({ pendingInteraction: { kind: 'not-a-sidebar-interaction' }, running: false }), 'idle')
  assert.equal(derive({}), 'running', 'catalog running fallback')
})

test('running child activity outranks completion and uses catalog fallback until status arrives', () => {
  assert.equal(recentSessionStatus(row, list, new Map([['parent', { running: false, completionUnread: true }]])), 'subagents')
  assert.equal(derive({ running: false, completionUnread: true }), 'completed', 'status false overrides stale catalog true')
  assert.equal(recentSessionStatus(row, { ids: ['parent'], byId: { parent: row } }, new Map([['parent', { running: false }]])), 'idle')
})

test('recent tab subscribes to live host statuses and reuses StateDot without truncating it', () => {
  const source = readFileSync(new URL('../src/client/MobileRecentSessions.tsx', import.meta.url), 'utf8')
  const css = readFileSync(new URL('../src/client/recent-sessions.css', import.meta.url), 'utf8')
  assert.ok(source.includes('useSessionStatus(state => state)'))
  assert.ok(source.includes('<StateDot state={state} />'))
  assert.ok(source.includes("state !== 'idle'"), 'sidebar idle rows have no dot')
  assert.match(css, /\[data-recent-session-title\] \{ max-width: 5em;/)
  assert.doesNotMatch(css, /\[data-mobile-recent-sessions\] button \{[^}]*max-width: 5em/)
})
