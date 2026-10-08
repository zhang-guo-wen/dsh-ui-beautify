import test from 'node:test'
import assert from 'node:assert/strict'
import { Context, Service } from '@deepseek-ai/cordis'
import { projectPluginResponse, installPluginDescriptionAdapter } from '../src/client/description-plugin-adapter.ts'

const controller={getSnapshot:()=>({language:'zh',revision:1}),subscribe:()=>()=>{},resolve:(_kind,source,id)=>id==='@example/plugin'?`中文:${source}`:source}

test('description-only metadata projection preserves colliding titles, package identity and official dictionaries',()=>{
  const pkg={name:'@example/plugin',meta:{title:'Description',description:'Description'},rows:[]}
  const result={ok:true,value:[pkg]}
  const translated=projectPluginResponse(result,true,controller)
  assert.equal(translated.value[0].meta.title,'Description')
  assert.equal(translated.value[0].meta.description.zh,'中文:Description')
  assert.equal(translated.value[0].name,pkg.name)
  assert.equal(pkg.meta.description,'Description')
  const official={...pkg,meta:{title:'Title',description:{en:'Description',zh:'官方中文'}}}
  assert.equal(projectPluginResponse({ok:true,value:[official]},true,controller).value[0].meta,official.meta)
  const other={...pkg,name:'@other/plugin'}
  assert.equal(projectPluginResponse({ok:true,value:[other]},true,controller).value[0].meta,other.meta)
})

test('real Cordis Remote proxy restoration uses descriptors, not unstable function proxies',async()=>{
  class Directory extends Service {constructor(ctx){super(ctx,'remote.pluginManager')}async listBundles(){return{ok:true,value:[{name:'@example/plugin',meta:{description:'Description'},rows:[]}]}}}
  const ctx=new Context(),directory=new Directory(ctx)
  ctx.reflect.provide('slots',{entries:()=>[]})
  installPluginDescriptionAdapter(ctx,controller)
  await new Promise(resolve=>setTimeout(resolve,0))
  assert.equal((await ctx.get('remote.pluginManager').listBundles()).value[0].meta.description.zh,'中文:Description')
  assert.ok(Object.getOwnPropertyDescriptor(directory,'listBundles'))
  await ctx.fiber.dispose()
  assert.equal(Object.getOwnPropertyDescriptor(directory,'listBundles'),undefined)
  assert.equal((await directory.listBundles()).value[0].meta.description,'Description')
})
