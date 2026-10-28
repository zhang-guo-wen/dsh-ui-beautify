import test from 'node:test'
import assert from 'node:assert/strict'
import { en, zh } from '../src/client/locales.ts'

test('enhancement descriptions stay concise without default/disable instructions', () => {
  for (const copy of [zh, en]) {
    for (const key of ['mobileLayoutDesc', 'recentSessionsDesc', 'remoteSettingsDesc', 'scrollToPromptDesc', 'sessionStartChipDesc', 'unreadAnswerStartDesc', 'quickActionsDesc', 'hideComposerStatsDesc', 'hideModelSelectorDesc', 'hideAccessModeDesc', 'contextRingDesc']) {
      assert.doesNotMatch(copy[key], /默认开启|关闭后|独立开关|请在本机修改|重新开启|写权限|Enabled by default|Turn off|controlled separately|re-enabling|write permissions/)
    }
    assert.doesNotMatch(copy.fontNotoSansScDesc, /可变字体|分片|variable file|shard/)
    assert.equal('cachePresent' in copy, false)
    assert.equal('cacheHint' in copy, false)
  }
  assert.match(zh.mobileLayoutDesc, /设置页布局/)
  assert.match(en.mobileLayoutDesc, /settings layout/)
  assert.match(zh.remoteSettingsDesc, /解决某些配置在手机端不生效问题/)
  assert.equal(zh.namePlaceholder, '当前名称：{name}')
  assert.equal(en.namePlaceholder, 'Current name: {name}')
  // The tagline hint is host text, not product copy: no static default may remain.
  assert.equal('taglinePlaceholder' in zh, false)
  assert.equal('taglinePlaceholder' in en, false)
})

test('the quick-actions copy names every menu action on both surfaces', () => {
  for (const copy of [zh, en]) {
    for (const key of ['quickActionsMenuArchive', 'quickActionsMenuPin', 'quickActionsMenuUnpin', 'quickActionsMenuNext',
      'quickActionsArchiveRunning', 'quickActionsNoNext', 'quickActionsArchiveFailed', 'quickActionsPinFailed', 'quickActionsNextFailed']) {
      assert.ok(copy[key].trim().length > 0, key)
    }
    assert.notEqual(copy.quickActionsMenuPin, copy.quickActionsMenuUnpin)
  }
  assert.match(zh.quickActionsDesc, /右下角/)
  assert.match(zh.quickActionsDesc, /可拖动/)
  assert.match(zh.quickActionsDesc, /绿点/)
  assert.match(zh.quickActionsDesc, /收藏/)
  assert.match(zh.quickActionsDesc, /对话时间/)
  assert.match(en.quickActionsDesc, /bottom-right/)
  assert.match(en.quickActionsDesc, /draggable/)
  assert.match(en.quickActionsDesc, /green dot/)
  assert.match(en.quickActionsDesc, /pinned/)
  assert.match(en.quickActionsDesc, /conversation time/)
  assert.match(zh.quickActionsMenuNext, /下一个会话/)
  assert.match(en.quickActionsMenuNext, /Next conversation/)
  assert.match(zh.quickActionsLabel, /快捷操作/)
  assert.match(en.quickActionsLabel, /Quick actions/)
})
