import test from 'node:test'
import assert from 'node:assert/strict'
import { Context } from '@deepseek-ai/cordis'
import Gateway from '@deepseek-ai/dsh-api-gateway'
import { apply as connectionPlugin } from '@deepseek-ai/dsh-client-connection'
import { DescriptionTranslationService } from '../lib/index.mjs'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'node:http'

// Empty public Typert directory exercises the Gateway's actual source-discovery path.
const typert = { local: {get(){},hasSeen(){return false}},lookups:{definitions:()=>[]},contexts:{getHost(){}} }

test('actual authenticated Connection/Gateway discovers built Remote, rejects anonymous calls and validates before inference', async () => {
  const ctx = new Context(), routes=[]
  let modelCalls=0
  const dataHome=await mkdtemp(join(tmpdir(),'beautify-description-rpc-'))
  const oldHome=process.env.DSH_HOME
  process.env.DSH_HOME=dataHome
  const records=new Map()
  ctx.reflect.provide('credentials',{async modifyRecord(key,mutate){const next=await mutate(records.get(key));if(next!==undefined)records.set(key,next);return next??records.get(key)}})
  ctx.reflect.provide('typert',typert)
  ctx.reflect.provide('webServer',{port:0,tapIndex:()=>()=>{},registerUpgrade:()=>()=>{},register(route){routes.push(route);return()=>routes.splice(routes.indexOf(route),1)}})
  ctx.reflect.provide('llm',{async *stream(request){modelCalls++;const payload=JSON.parse(request.messages[0].content[0].text);yield {type:'text-delta',index:0,text:JSON.stringify({translations:payload.descriptions.map(item=>({id:item.id,text:'中文描述'}))})};yield {type:'finish',reason:{kind:'stop'}}}})
  ctx.reflect.provide('agentDefaultModel',{currentSelection:()=>({provider:'fixture',model:'fixture-model'})})
  ctx.reflect.provide('pluginManager',{async listBundles(){return[{name:'@fixture/example',meta:{description:'Example description'}}]}})
  ctx.reflect.provide('skills',{async list(){return[]}})
  const connectionFiber=ctx.plugin({inject:['credentials'],apply:connectionPlugin})
  await connectionFiber
  const gatewayFiber=ctx.plugin(Gateway)
  await gatewayFiber
  const serviceFiber=ctx.plugin(DescriptionTranslationService)
  await serviceFiber
  const server=createServer((req,res)=>{const route=routes.find(route=>route.path==='/api');if(route)void route.handler(req,res);else res.writeHead(404).end()})
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
  const origin=`http://127.0.0.1:${server.address().port}`
  const target=new URL(ctx.get('connection').authenticatedUrl(origin))
  let cookie
  ctx.get('connection').authorizeIndex({method:'GET',url:target.pathname+target.search,headers:{host:target.host}},
    {writeHead(_status,headers){cookie=headers?.['set-cookie']?.split(';')[0]},end(){}})
  assert.ok(cookie)
  const call=(method,request,headers={})=>fetch(`${origin}/api/uiBeautifyDescriptions/${method}`,{method:'POST',headers:{'content-type':'application/json',origin,...headers},body:JSON.stringify({type:'client-request',rpcId:'fixture-call',method:`uiBeautifyDescriptions/${method}`,payload:{args:{request}}})})
  try {
    assert.equal((await call('translate',{language:'zh',entries:[]})).status,401)
    assert.equal((await call('translate',{language:'zh',entries:[]},{cookie,origin:'https://evil.example'})).status,403)
    assert.equal(modelCalls,0)
    const catalogResponse=await call('catalog',{language:'zh'},{cookie})
    assert.equal(catalogResponse.status,200)
    const catalog=await catalogResponse.json()
    assert.equal(catalog.type,'server-response')
    assert.equal(catalog.result.ok,true,JSON.stringify(catalog))
    assert.equal(catalog.result.value.entries[0].source,'Example description')
    const request={language:'zh',entries:catalog.result.value.entries}
    const translated=await (await call('translate',request,{cookie})).json()
    assert.equal(translated.result.ok,true)
    assert.equal(translated.result.value.results[0].record.text,'中文描述')
    assert.equal(modelCalls,1)
    const reused=await (await call('translate',request,{cookie})).json()
    assert.equal(reused.result.value.results[0].status,'cached')
    assert.equal(modelCalls,1)
    const invalid=await (await call('translate',{language:'zh',entries:[{kind:'skill',id:'x',source:'x'.repeat(4001)}]},{cookie})).json()
    assert.equal(invalid.result.ok,false)
    assert.equal(modelCalls,1)
    await serviceFiber.dispose()
    assert.equal((await call('catalog',{language:'zh'},{cookie})).status,404)
  } finally {
    await new Promise(resolve=>server.close(resolve))
    await ctx.fiber.dispose()
    if(oldHome===undefined)delete process.env.DSH_HOME;else process.env.DSH_HOME=oldHome
  }
})
