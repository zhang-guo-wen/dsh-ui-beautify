import test from 'node:test'
import assert from 'node:assert/strict'
import { DescriptionController } from '../src/client/description-controller.ts'

const locale={getSnapshot:()=>({active:'zh'}),subscribe:()=>()=>{}}
const skill=(id,source)=>({kind:'skill',id,source})
const result=(entries,names)=>({ok:true,value:{entries,skills:names,pluginTitles:[],available:true,warnings:[],skillScope:'session'}})
function api(catalog){return{catalog,async lookup({entries,language}){return{ok:true,value:{language,results:entries.map(entry=>({entry,status:'cached',record:{...entry,language,text:`译文:${entry.source}`,createdAt:'2026-10-08T00:00:00Z'}}))}}},async translate(request){return this.lookup(request)}}}

test('authoritative names support flat files and names independent of directory; different presets stay isolated',async()=>{
  const entryA=skill('C:/a/unrelated.md','A'),entryB=skill('C:/b/other/SKILL.md','B')
  const controller=new DescriptionController(api(async request=>request.sessionId==='A'?result([entryA],[{name:'actual-name',id:entryA.id}]):result([entryB],[{name:'actual-name',id:entryB.id}])),locale)
  await controller.loadCatalog('A')
  await controller.loadCatalog('B')
  assert.equal(controller.skillDescription('actual-name','A'),'译文:A')
  assert.equal(controller.skillDescription('actual-name','B'),'译文:B')
  assert.equal(controller.skillFileDescription(entryA.id,'A'),'译文:A')
  assert.equal(controller.skillFileDescription(entryA.id,'B'),undefined)
  controller.dispose()
})

test('new source replaces membership, not file bytes or old persisted records',async()=>{
  let source='old'
  const id='C:/skill/SKILL.md'
  const controller=new DescriptionController(api(async()=>result([skill(id,source)],[{name:'skill',id}])),locale)
  await controller.loadCatalog('A')
  source='new'
  await controller.loadCatalog('A',true)
  assert.equal(controller.skillFileDescription(id,'A'),'译文:new')
  assert.equal(controller.resolve('skill','old',id),'译文:old')
  controller.dispose()
})

test('slow superseded catalogs cannot overwrite newer authoritative membership',async()=>{
  let release,first=true
  const id='C:/skill.md'
  const controller=new DescriptionController(api(async request=>{
    if(request.sessionId==='A'&&first){first=false;return new Promise(resolve=>{release=()=>resolve(result([skill(id,'old')],[{name:'skill',id}]))})}
    return result([skill(id,'new')],[{name:'skill',id}])
  }),locale)
  const old=controller.loadCatalog('A')
  await controller.loadCatalog('A',true)
  release()
  await old
  assert.equal(controller.skillDescription('skill','A'),'译文:new')
  controller.dispose()
})
