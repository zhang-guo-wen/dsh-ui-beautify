import test from 'node:test'
import assert from 'node:assert/strict'
import { DescriptionController } from '../src/client/description-controller.ts'
import { descriptionEntryIdentity } from '../src/description-translations.ts'
const locale={getSnapshot:()=>({active:'zh'}),subscribe:()=>()=>{}}
const entries=[{kind:'plugin',id:'p',source:'Plugin'},{kind:'skill',id:'g',source:'Global skill'},{kind:'skill',id:'w',source:'Project skill'}]
const key=descriptionEntryIdentity
const groups={plugins:[{id:'p',entries:[key(entries[0])]}],skills:[{id:'g',entries:[key(entries[1])]}],workspaceSkills:[{id:'w',entries:[key(entries[2])]}]}
const record=entry=>({...entry,language:'zh',text:'译文',createdAt:new Date().toISOString()})

test('cancel aborts actual RPC signal, retains completed progress, and retry uses existing cached translations',async()=>{
 let calls=0,abortSeen=false,enteredResolve
 const entered=new Promise(resolve=>enteredResolve=resolve),cache=new Map([[key(entries[0]),record(entries[0])]])
 const api={
 async catalog(){return{ok:true,value:{entries,skills:[],pluginTitles:[],progressGroups:groups,counts:{plugins:1,skills:2,workspaces:1,descriptions:3},model:{provider:'p',model:'m'},maxBatchBytes:16384,available:true,warnings:[],skillScope:'all-workspaces'}}},
 async lookup({entries,language}){return{ok:true,value:{language,results:entries.map(entry=>cache.has(key(entry))?{entry,status:'cached',record:cache.get(key(entry))}:{entry,status:'missing'})}}},
 async translate({entries,language},signal){calls++;if(calls===1){enteredResolve();return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>{abortSeen=true;reject(new DOMException('cancel','AbortError'))},{once:true}))}
 return{ok:true,value:{language,results:entries.map(entry=>{const result=record(entry);cache.set(key(entry),result);return{entry,status:'translated',record:result}})}}},
 }
 const controller=new DescriptionController(api,locale)
 await controller.loadCatalog()
 assert.deepEqual(controller.getSnapshot().progress,{plugins:{completed:1,total:1},skills:{completed:0,total:1},workspaceSkills:{completed:0,total:1}})
 const run=controller.run();await entered
 controller.cancel()
 assert.equal(controller.getSnapshot().phase,'cancelled')
 await run
 assert.equal(abortSeen,true)
 assert.equal(cache.size,1)
 assert.equal(controller.getSnapshot().progress.plugins.completed,1)
 await controller.run()
 assert.equal(calls,2)
 assert.deepEqual(controller.getSnapshot().progress,{plugins:{completed:1,total:1},skills:{completed:1,total:1},workspaceSkills:{completed:1,total:1}})
 controller.dispose()
})

test('plugin is complete only when every component description is saved; failed descriptions remain incomplete',async()=>{
 const component={kind:'plugin',id:'component',source:'Component'}
 const all=[entries[0],component]
 const api={async catalog(){return{ok:true,value:{entries:all,skills:[],pluginTitles:[],progressGroups:{plugins:[{id:'p',entries:all.map(key)}],skills:[],workspaceSkills:[]},counts:{plugins:1,skills:0,workspaces:0,descriptions:2},model:{provider:'p',model:'m'},maxBatchBytes:16384,available:true,warnings:[],skillScope:'global'}}},
 async lookup({entries,language}){return{ok:true,value:{language,results:entries.map(entry=>({entry,status:'missing'}))}}},
 async translate({language}){return{ok:true,value:{language,results:[{entry:all[0],status:'translated',record:record(all[0])},{entry:component,status:'error',error:{code:'generation-failed',message:'failed'}}]}}}}
 const controller=new DescriptionController(api,locale);await controller.run()
 assert.equal(controller.getSnapshot().completed,1)
 assert.equal(controller.getSnapshot().progress.plugins.completed,0)
 assert.equal(controller.getSnapshot().failed,1)
 controller.dispose()
})
