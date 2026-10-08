import test from 'node:test'
import assert from 'node:assert/strict'
import { DescriptionController } from '../src/client/description-controller.ts'

const plugin = { kind: 'plugin', id: '@example/plugin', source: 'Plugin description' }
const skill = { kind: 'skill', id: 'C:/workspace/my-skill/SKILL.md', source: 'Skill description' }
function fixture(entries = [plugin, skill]) {
  let active = 'zh', writes = 0, calls = 0
  const listeners = new Set(), cache = new Map()
  const locale = { getSnapshot: () => ({ active }), subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener) } }
  const key = (entry, language) => JSON.stringify([entry, language])
  const api = {
    async catalog(request) { return { ok: true, value: { entries, skills: entries.filter(entry => entry.kind === 'skill').map(entry => ({ name: 'my-skill', id: entry.id })), pluginTitles: [], progressGroups:{plugins:[{id:plugin.id,entries:[JSON.stringify([plugin.kind,plugin.id,plugin.source])]}],skills:[{id:skill.id,entries:[JSON.stringify([skill.kind,skill.id,skill.source])]}],workspaceSkills:[]}, model: {provider:'fixture',model:'default'}, counts:{plugins:1,skills:1,workspaces:0,descriptions:entries.length}, maxBatchBytes:16384, available: true, warnings: [], skillScope: request.sessionId ? 'session' : 'global' } } },
    async lookup({ entries, language }) { return { ok: true, value: { language, results: entries.map(entry => cache.has(key(entry, language))
      ? { entry, status: 'cached', record: cache.get(key(entry, language)) } : { entry, status: 'missing' }) } } },
    async translate({ entries, language }) { calls++; return { ok: true, value: { language, results: entries.map(entry => {
      if (cache.has(key(entry, language))) return { entry, status: 'cached', record: cache.get(key(entry, language)) }
      writes++
      const record = { ...entry, language, text: `${language}:${entry.source}`, createdAt: new Date().toISOString() }
      cache.set(key(entry, language), record)
      return { entry, status: 'translated', record }
    }) } } },
  }
  return { locale, api, get writes() { return writes }, get calls() { return calls }, switch(language) { active = language; for (const listener of listeners) listener() } }
}

test('reads never translate; click caches, repeat click reuses and source inputs stay unchanged', async () => {
  const f = fixture(), controller = new DescriptionController(f.api, f.locale)
  await controller.loadCatalog()
  assert.equal(f.writes, 0)
  assert.equal(controller.resolve('plugin', plugin.source), plugin.source)
  await controller.run()
  assert.equal(f.writes, 2)
  assert.equal(f.calls, 1) // One RPC/model batch contains both descriptions.
  assert.equal(controller.getSnapshot().progress.plugins.completed, 1)
  assert.equal(controller.resolve('plugin', plugin.source), 'zh:Plugin description')
  assert.equal(controller.resolveSkillCandidate('仅用户 · Skill description'), '仅用户 · zh:Skill description')
  assert.equal(controller.skillFileDescription(skill.id), 'zh:Skill description')
  assert.equal(controller.skillDescription('my-skill'), 'zh:Skill description')
  assert.equal(controller.resolve('plugin', 'Changed description'), 'Changed description')
  await controller.run()
  assert.equal(f.writes, 2)
  assert.equal(controller.getSnapshot().cached, 2)
  assert.equal(skill.source, 'Skill description')
  controller.dispose()
})

test('locale switching and fresh UI controller reuse per-language persisted results without auto inference', async () => {
  const f = fixture(), controller = new DescriptionController(f.api, f.locale)
  await controller.run()
  f.switch('en')
  await controller.loadCatalog()
  assert.equal(f.writes, 2)
  assert.equal(controller.resolve('plugin', plugin.source), plugin.source)
  await controller.run()
  assert.equal(f.writes, 4)
  controller.dispose()
  f.switch('zh')
  const fresh = new DescriptionController(f.api, f.locale)
  await fresh.loadCatalog()
  assert.equal(f.writes, 4)
  assert.equal(fresh.resolve('plugin', plugin.source), 'zh:Plugin description')
  fresh.dispose()
})

test('old backend without model/counts cannot silently execute per-item translation', async () => {
  const f = fixture()
  f.api.catalog = async () => ({ok:true,value:{entries:[plugin],skills:[],pluginTitles:[],available:true,warnings:[],skillScope:'global'}})
  const controller = new DescriptionController(f.api, f.locale)
  await controller.loadCatalog()
  assert.equal(controller.getSnapshot().phase, 'unavailable')
  assert.equal(controller.getSnapshot().pluginCount, 0)
  await controller.run()
  assert.equal(f.calls, 0)
  controller.dispose()
})

test('explicit generation is single-flight and a missing service leaves UI unavailable', async () => {
  const f = fixture(), controller = new DescriptionController(f.api, f.locale)
  const first = controller.run(), second = controller.run()
  assert.equal(first, second)
  await first
  assert.equal(f.writes, 2)
  controller.dispose()
  const unavailable = new DescriptionController(undefined, f.locale)
  assert.equal(unavailable.getSnapshot().phase, 'unavailable')
  await unavailable.run()
  assert.equal(f.writes, 2)
  unavailable.dispose()
})
