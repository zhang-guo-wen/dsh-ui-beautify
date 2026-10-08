import test from 'node:test'
import assert from 'node:assert/strict'
import { en, zh } from '../src/client/locales.ts'

test('enhancement descriptions stay concise without default/disable instructions', () => {
  for (const copy of [zh, en]) {
    for (const key of ['mobileLayoutDesc', 'recentSessionsDesc', 'remoteSettingsDesc', 'scrollToPromptDesc']) {
      assert.doesNotMatch(copy[key], /默认开启|关闭后|独立开关|请在本机修改|重新开启|写权限|Enabled by default|Turn off|controlled separately|re-enabling|write permissions/)
    }
    assert.doesNotMatch(copy.fontNotoSansScDesc, /可变字体|分片|variable file|shard/)
    assert.equal('cachePresent' in copy, false)
    assert.equal('cacheHint' in copy, false)
  }
  assert.match(zh.remoteSettingsDesc, /解决某些配置在手机端不生效问题/)
  assert.equal(zh.namePlaceholder, '当前名称：DeepSeek Harness')
  assert.equal(en.namePlaceholder, 'Current name: DeepSeek Harness')
})
