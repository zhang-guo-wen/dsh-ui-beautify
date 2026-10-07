import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { deriveRecentSessions, recentTitle } from '../src/client/recent-sessions.ts'

test('five recent conversations keep activity order independent of selection and exclude blank/subagent', () => {
  const rows = Array.from({ length: 7 }, (_, i) => ({ id: `r${i}`, displayTitle: `第${i}条很长的会话`, updatedAt: i }))
  rows.push({ id: 'blank', displayTitle: '', updatedAt: 100, blank: true }, { id: 'child', displayTitle: 'child', updatedAt: 101, origin: 'subagent' })
  const list = { ids: rows.map(x => x.id), byId: Object.fromEntries(rows.map(x => [x.id, x])) }
  const expected = ['r6', 'r5', 'r4', 'r3', 'r2']
  for (const current of ['r0', 'r6', 'r3', 'r5']) assert.deepEqual(deriveRecentSessions(list, current).map(x => x.id), expected)
  assert.equal(recentTitle('😀你好最近对话'), '😀你好最近')
})

test('phone hides only header open-file/more and view tabs, restores requested gutters', () => {
  const css = readFileSync(new URL('../src/client/mobile-layout.css', import.meta.url), 'utf8')
  assert.ok(css.includes("[data-ui-beautify-recent-tabs] > button[role='tab'] { display: none; }"))
  assert.ok(css.includes("[data-slot='conversation.session.header.utilities'] > :has([data-open-target='directory'])"))
  assert.ok(css.includes("[data-slot='conversation.session.header.utilities'] > :has([class*='_moreButton'])"))
  assert.ok(css.includes('--dsh-composer-side-clearance: 8px'))
  assert.ok(css.includes('padding-left: 16px !important'))
  assert.ok(!css.includes("[data-slot='conversation.session.header.corner'] { padding-left: 44px; }"))
})
