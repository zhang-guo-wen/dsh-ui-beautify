import test from 'node:test'
import assert from 'node:assert/strict'
import { Context } from '@deepseek-ai/cordis'
import { DescriptionTranslationService } from '../lib/index.mjs'

test('all registered workspace project skills plus global and current Agent skills are discovered and deduplicated',async()=>{
 const ctx=new Context(),lookups=[]
 ctx.reflect.provide('llm',{})
 ctx.reflect.provide('agentDefaultModel',{currentSelection:()=>({provider:'chatgpt',model:'example-model',reasoningEffort:'high'})})
 ctx.reflect.provide('workspaceRegistry',{list:()=>[{path:'C:/project-a'},{path:'C:/project-b'},{path:'C:/failed'},{path:'C:/project-a'}]})
 ctx.reflect.provide('pluginManager',{async listBundles(){return[
 {name:'installed',installed:true,meta:{description:'Description'}},
 {name:'official',installed:false,enabled:true,meta:{description:{en:'English',zh:'中文'}}},
 {name:'not-loaded',installed:false,enabled:false,meta:{description:'Unused'}},
 ]}})
 const global={name:'global',path:'C:/global/SKILL.md',description:'Global'}
 ctx.reflect.provide('skills',{async list(options){lookups.push(options.cwd);if(options.cwd==='C:/failed')throw Error('not readable');return options.cwd?[global,{name:'same-name',path:`${options.cwd}/SKILL.md`,description:`Project ${options.cwd}`}]:[global]}})
 ctx.reflect.provide('sessionSkillCatalog',{async list(){return{skills:[{name:'agent-only',path:'C:/preset/SKILL.md',description:'Agent skill'}]}}})
 const service=new DescriptionTranslationService(ctx)
 try{
 const catalog=await service.catalog({language:'zh',allWorkspaces:true,sessionId:'current'},new AbortController().signal)
 assert.deepEqual(lookups,[undefined,'C:/project-a','C:/project-b','C:/failed'])
 assert.equal(catalog.counts.skills,4)
 assert.equal(catalog.counts.plugins,2)
 assert.equal(catalog.progressGroups.plugins.length,2)
 assert.equal(catalog.progressGroups.skills.length,2)
 assert.equal(catalog.progressGroups.workspaceSkills.length,2)
 assert.deepEqual(catalog.progressGroups.plugins.find(group=>group.id==='official').entries,[])
 assert.equal(catalog.progressGroups.workspaceSkills.some(group=>group.id===global.path),false)
 assert.equal(catalog.counts.workspaces,3)
 assert.equal(catalog.entries.filter(e=>e.kind==='skill').length,4)
 assert.equal(catalog.skills.filter(e=>e.name==='same-name').length,2)
 assert.ok(catalog.warnings.some(w=>w.includes('C:/failed')))
 assert.deepEqual(catalog.model,{provider:'chatgpt',model:'example-model',reasoningEffort:'high'})
 assert.equal(catalog.entries.some(e=>e.id==='not-loaded'),false)
 }finally{await ctx.fiber.dispose()}
})
