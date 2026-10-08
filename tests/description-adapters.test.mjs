import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInThisContext } from 'node:vm'
import { Context, Service } from '@deepseek-ai/cordis'

let adapter
const react = { createElement: (component, props) => ({ component, props }), useEffect() {}, useMemo: f => f(), useSyncExternalStore: (_s, g) => g() }
globalThis.window = { __ModuleLoader__: { load({ factory }) { adapter = factory(name => {
  if (name === 'react') return react
  if (name === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) }
  return {}
}) } } }
globalThis.document = { querySelector: () => ({}), head: { appendChild() {} } }
runInThisContext(readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8'))

function slotsFixture() {
  const roster = new Map(), listeners = new Map()
  const notify = key => { for (const fn of listeners.get(key) ?? []) fn() }
  return {
    entries: key => roster.get(key) ?? [],
    entriesOfSlot: key => {
      const entries = roster.get(key) ?? [], cells = new Map()
      for (const entry of entries.toSorted((a,b) => (a.options.priority ?? 0) - (b.options.priority ?? 0))) {
        const cell = entry.options.id ?? entry.options.key
        if (!cells.has(cell)) cells.set(cell, entry)
      }
      return [...cells.values()]
    },
    subscribe(key, fn) { const set = listeners.get(key) ?? new Set(); set.add(fn); listeners.set(key,set); return () => set.delete(fn) },
    inject(_key, fn) { return fn() },
    register(options, component) {
      const entry = { component, options, inject: options.inject, locale: options.locale, registrant: 'ui-beautify' }
      const key = options.name
      roster.set(key, [...(roster.get(key) ?? []), entry]); notify(key)
      return () => { roster.set(key,(roster.get(key) ?? []).filter(e=>e!==entry)); notify(key) }
    },
    add(key, entry) { roster.set(key,[...(roster.get(key) ?? []), entry]); notify(key) },
  }
}
const descriptionSnapshot = { language: 'zh' }
const controller = {
  getSnapshot: () => descriptionSnapshot, subscribe: () => () => {},
  resolve: (_kind,source) => source === 'Description' ? '中文描述' : source,
  resolveSkillCandidate: source => source === 'Description' ? '中文描述' : source,
  observeSession() {}, skillDescription() {}, skillFileDescription() {},
}

test('stable read-only menu projection changes skill descriptions only; upstream identity and picks stay untouched', () => {
  const items = [{name:'skill-id',description:'Description',value:'original'}]
  const state = { open:true, highlight:{source:'skill',index:0}, groups:[{source:'skill',items},{source:'command',items}] }
  const source = { getSnapshot:()=>state,subscribe:()=>()=>{} }
  const view = adapter.descriptionProjection(source,controller,value=>adapter.translateSkillMenu(value,controller))
  assert.equal(view.getSnapshot(),view.getSnapshot())
  assert.equal(view.getSnapshot().groups[0].items[0].description,'中文描述')
  assert.equal(view.getSnapshot().groups[1].items,items)
  assert.equal(view.getSnapshot().groups[0].items[0].name,'skill-id')
  assert.equal(state.groups[0].items[0].description,'Description')
  assert.equal(view.set,undefined)
})

test('known child-free slots shadow lazily, retain original inject, and unload restores originals', () => {
  const slots=slotsFixture(), locale={getSnapshot:()=>({active:'zh'}),subscribe:()=>()=>{},resolveText:x=>typeof x==='string'?x:x.en,register:()=>()=>{}}
  const ctx={get:key=>key==='slots'?slots:locale}
  const off=adapter.installDescriptionAdapters(ctx,controller)
  function Original() {}
  const injected=()=>({menu:{getSnapshot:()=>({groups:[]}),subscribe:()=>()=>{}},onPick(){}})
  const original={component:Original,options:{id:'slash-menu',order:0},inject:injected,locale:'slash.menu',registrant:'@deepseek-ai/dsh-client-ui-input-trigger'}
  slots.add('conversation.input.overlay',original)
  const winner=slots.entriesOfSlot('conversation.input.overlay').find(e=>e.options.id==='slash-menu')
  assert.notEqual(winner.component,Original)
  assert.equal(winner.inject,injected)
  off()
  assert.equal(slots.entriesOfSlot('conversation.input.overlay')[0],original)
  assert.equal(locale.resolveText('Description'),'Description')
})

test('does not shadow foreign or child-owning occupants', () => {
  for (const original of [{registrant:'foreign',children:undefined},{registrant:'ui-input-trigger',children:{nested:{}}}]) {
    const slots=slotsFixture(),locale={getSnapshot:()=>({active:'zh'}),subscribe:()=>()=>{},register:()=>()=>{}}
    const entry={...original,component:()=>null,options:{id:'slash-menu'}}
    slots.add('conversation.input.overlay',entry)
    const off=adapter.installDescriptionAdapters({get:key=>key==='slots'?slots:locale},controller)
    assert.equal(slots.entriesOfSlot('conversation.input.overlay').find(e=>e.options.id==='slash-menu'),entry)
    off()
  }
})

test('generic locale resolver and titles are never decorated', async () => {
  class Locale extends Service { constructor(ctx){super(ctx,'locale')} resolveText(text){return text} register(){return()=>{}} }
  const ctx=new Context(), locale=new Locale(ctx), slots=slotsFixture()
  const scoped=ctx.extend()
  scoped.reflect.provide('slots',slots)
  const off=adapter.installDescriptionAdapters(scoped,controller)
  assert.equal(scoped.get('locale').resolveText('Description'),'Description')
  assert.equal(Object.getOwnPropertyDescriptor(locale,'resolveText'),undefined)
  off()
  assert.equal(Object.getOwnPropertyDescriptor(locale,'resolveText'),undefined)
  await ctx.fiber.dispose()
})
