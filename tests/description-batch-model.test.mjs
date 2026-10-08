import test from 'node:test'
import assert from 'node:assert/strict'
import { translateDescriptionBatchWithModel } from '../lib/index.mjs'
import { splitDescriptionBatches, descriptionBatchBytes, DESCRIPTION_BATCH_MAX_BYTES } from '../src/description-batches.ts'
const entries=[{kind:'plugin',id:'a',source:'First description'},{kind:'skill',id:'b',source:'Second description'}]
const model={provider:'fixture',model:'default-model',reasoningEffort:'high'}
function runtime(output,observe=()=>{},reason={kind:'stop'}) {return{async *stream(request){observe(request);yield{type:'text-delta',index:0,text:output};yield{type:'finish',reason}}}}

test('many descriptions are sent in ONE default-model request and reordered IDs map correctly',async()=>{
 let calls=0
 const result=await translateDescriptionBatchWithModel(runtime(JSON.stringify({translations:[{id:1,text:'第二条'},{id:0,text:'第一条'}]}),request=>{
 calls++;assert.equal(request.model,'default-model');assert.equal(request.reasoningEffort,'high');assert.equal(request.tools,undefined)
 const payload=JSON.parse(request.messages[0].content[0].text)
 assert.deepEqual(payload.descriptions,[{id:0,description:'First description'},{id:1,description:'Second description'}])
 }),model,entries,'zh',new AbortController().signal)
 assert.deepEqual(result,['第一条','第二条']);assert.equal(calls,1)
})
test('rejects missing duplicate unknown IDs, malformed or truncated output before any mapping',async()=>{
 for(const output of ['not JSON',JSON.stringify({translations:[{id:0,text:'x'}]}),JSON.stringify({translations:[{id:0,text:'x'},{id:0,text:'y'}]}),JSON.stringify({translations:[{id:0,text:'x'},{id:3,text:'y'}]})])
 await assert.rejects(translateDescriptionBatchWithModel(runtime(output),model,entries,'zh',new AbortController().signal))
 await assert.rejects(translateDescriptionBatchWithModel(runtime('{}',()=>{},{kind:'max-tokens'}),model,entries,'zh',new AbortController().signal))
})
test('UTF-8 cap includes JSON escaping and prompt; fits many items then splits only when needed',()=>{
 assert.equal(splitDescriptionBatches(entries,'zh').length,1)
 const many=Array.from({length:40},(_,id)=>({kind:'skill',id:String(id),source:'中\\"'.repeat(300)}))
 const batches=splitDescriptionBatches(many,'zh')
 assert.ok(batches.length>1)
 assert.deepEqual(batches.flat(),many)
 for(const batch of batches)assert.ok(descriptionBatchBytes(batch,'zh')<=DESCRIPTION_BATCH_MAX_BYTES)
 assert.throws(()=>splitDescriptionBatches(entries,'zh',1))
})
