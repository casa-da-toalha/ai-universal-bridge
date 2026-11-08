import {test} from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
const base=fs.mkdtempSync(path.join(os.tmpdir(),'aub-test-'));
process.env.AI_BRIDGE_WORKSPACE=path.join(base,'workspace');
process.env.AI_BRIDGE_DATA_DIR=path.join(base,'private-data');
process.env.AI_BRIDGE_OPENAI_KEY='test-not-a-real-api-key';
process.env.AI_BRIDGE_ANTHROPIC_KEY='test-anthropic-key';
const {handleRpc,runTool,tools} = await import('../server/bridge.mjs');
const {config}=await import('../server/config.mjs');
const {codexSession}=await import('../server/codex.mjs');
const rpc=async(method,params={},id=1)=>handleRpc({jsonrpc:'2.0',id,method,params});
test('MCP handshake/list/prompts/resources',async()=>{
 const init=await rpc('initialize',{protocolVersion:'2025-06-18',clientInfo:{name:'test',version:'0.1'}});
 assert.equal(init.result.protocolVersion,'2025-06-18');
 assert.equal(init.result.serverInfo.name,'ai-universal-bridge');
 const t=await rpc('tools/list');assert.ok(t.result.tools.length>=20);assert.equal(t.result.tools.length,tools.length);
 const p=await rpc('prompts/list');assert.ok(p.result.prompts.length>=3);
 const r=await rpc('resources/read',{uri:'bridge://status'});assert.ok(r.result.contents[0].text.includes('workspace'));
});
test('Status does not leak secrets; memory CRUD',async()=>{
 const status=await runTool('bridge_status');assert.equal(status.openai_api_configured,true);
 assert.ok(!JSON.stringify(status).includes('test-not-a-real-api-key'));
 await runTool('bridge_memory_put',{namespace:'projeto',key:'decisao',value:'Texto de teste importante',tags:['mcp']});
 assert.equal((await runTool('bridge_memory_get',{namespace:'projeto',key:'decisao'})).value,'Texto de teste importante');
 assert.equal((await runTool('bridge_memory_search',{query:'importante'})).length,1);
 await assert.rejects(()=>runTool('bridge_memory_delete',{namespace:'projeto',key:'decisao'}),/confirm/);
 assert.equal((await runTool('bridge_memory_delete',{namespace:'projeto',key:'decisao',confirm:true})).deleted,true);
});
test('Workspace containment and explicit write flag',async()=>{
 assert.ok(Array.isArray(await runTool('bridge_workspace_list',{path:'.'})));
 await assert.rejects(()=>runTool('bridge_workspace_write',{path:'a.txt',content:'ok',confirm:true}),/desativada/);
 config.allowWrites=true;
 await assert.rejects(()=>runTool('bridge_workspace_write',{path:'a.txt',content:'ok'}),/confirm/);
 await runTool('bridge_workspace_write',{path:'a.txt',content:'ok',confirm:true});
 assert.equal((await runTool('bridge_workspace_read',{path:'a.txt'})).content,'ok');
 await assert.rejects(()=>runTool('bridge_workspace_read',{path:'../other'}),/fora/);
 fs.symlinkSync(base,path.join(config.workspace,'outside'));
 await assert.rejects(()=>runTool('bridge_workspace_read',{path:'outside'}),/fora/);
 config.allowWrites=false;
});
test('Tasks, context, usage',async()=>{
 const t=await runTool('bridge_task_create',{title:'Revisar logs'});
 assert.ok(t.id);assert.ok((await runTool('bridge_task_list',{})).some(x=>x.id===t.id));
 await assert.rejects(()=>runTool('bridge_task_update',{id:t.id,status:'done'}),/confirm/);
 assert.equal((await runTool('bridge_task_update',{id:t.id,status:'done',confirm:true})).status,'done');
 await runTool('bridge_memory_put',{namespace:'a',key:'b',value:'Dados reutilizáveis'});
 assert.match((await runTool('bridge_context_pack',{query:'Dados'})).content,/Dados reutilizáveis/);
 assert.equal((await runTool('bridge_usage')).total_calls,0);
});
test('OpenAI and Anthropic provider HTTP bodies mocked; counts ledger',async()=>{
 const original=globalThis.fetch;
 const seen=[];
 globalThis.fetch=async(url,opts)=>{
  seen.push({url,body:JSON.parse(opts.body),headers:opts.headers});
  if(url.includes('openai'))return new Response(JSON.stringify({id:'resp_mock',model:'gpt-test',output:[{type:'message',content:[{type:'output_text',text:'Olá do GPT simulado'}]}],usage:{input_tokens:5,output_tokens:9}}),{status:200,headers:{'Content-Type':'application/json'}});
  return new Response(JSON.stringify({model:'claude-test',content:[{type:'text',text:'Olá do Claude simulado'}],usage:{input_tokens:7,output_tokens:6}}),{status:200,headers:{'Content-Type':'application/json'}});
 };
 try{
  const g=await runTool('bridge_ask_gpt',{prompt:'testar',web_search:true,code_interpreter:true});
  assert.equal(g.output,'Olá do GPT simulado');assert.ok(seen[0].body.tools.some(x=>x.type==='web_search'));assert.ok(seen[0].body.tools.some(x=>x.type==='code_interpreter'));
  assert.equal(seen[0].body.store,false);
  const c=await runTool('bridge_ask_claude_api',{prompt:'testar'});assert.equal(c.output,'Olá do Claude simulado');
  const ledger=await runTool('bridge_usage');assert.equal(ledger.total_calls,2);
  assert.ok(!JSON.stringify(seen).includes('not-a-real-api-key') || seen[0].headers.Authorization.includes('test-not-a-real-api-key'));
 }finally{globalThis.fetch=original;}
});
test('No API key exposed in MCP errors',async()=>{
 const x=await rpc('tools/call',{name:'unknown_tool',arguments:{}});
 assert.equal(x.result.isError,true);
 assert.ok(!JSON.stringify(x).includes('test-not-a-real-api-key'));
});
test('Codex app-server integration with mock binary (models/threads/run)',async()=>{
 const fake=path.join(base,'fake-codex.cjs');
 fs.writeFileSync(fake,`#!/usr/bin/env node
const rl=require('readline').createInterface({input:process.stdin});
const send=o=>process.stdout.write(JSON.stringify(o)+'\\n');
rl.on('line',line=>{const m=JSON.parse(line);if(m.method==='initialize')send({id:m.id,result:{userAgent:'mock'}});
else if(m.method==='model/list')send({id:m.id,result:{data:[{model:'gpt-mock',isDefault:true}]}});
else if(m.method==='thread/list')send({id:m.id,result:{data:[{id:'thread-mock'}]}});
else if(m.method==='thread/read')send({id:m.id,result:{thread:{id:'thread-mock',name:'Teste'}}});
else if(m.method==='thread/turns/list')send({id:m.id,result:{data:[{id:'turn-mock'}]}});
else if(m.method==='skills/list')send({id:m.id,result:{data:[{cwd:'/tmp',skills:[]}]}});
else if(m.method==='thread/start'||m.method==='thread/resume')send({id:m.id,result:{thread:{id:'thread-mock'}}});
else if(m.method==='turn/start') {send({id:m.id,result:{turn:{id:'turn-mock'}}});setTimeout(()=>{send({method:'item/agentMessage/delta',params:{delta:'Análise Codex simulada'}});send({method:'turn/completed',params:{threadId:'thread-mock',turn:{id:'turn-mock',status:'completed'}}});},25);}
});

`);
 fs.chmodSync(fake,0o755);config.codexBinary=fake;
 const models=await codexSession('models');assert.equal(models.models[0].model,'gpt-mock');
 const threads=await codexSession('threads');assert.equal(threads.threads[0].id,'thread-mock');
 const read=await codexSession('thread_read',{thread_id:'thread-mock'});assert.equal(read.thread.name,'Teste');
 const turns=await codexSession('turns',{thread_id:'thread-mock'});assert.equal(turns.turns[0].id,'turn-mock');
 const skills=await codexSession('skills',{});assert.ok(Array.isArray(skills.skills));
 const run=await codexSession('run',{task:'explicar o projeto'});assert.equal(run.thread_id,'thread-mock');assert.match(run.output,/Análise Codex/);
 await assert.rejects(()=>codexSession('run',{task:'alterar',mode:'workspace_write',confirm_write:true}),/bloqueada/);
});

test('Codex child process does not inherit API keys or tokens',async()=>{
 const fake=path.join(base,'env-codex.cjs');const output=path.join(base,'codex-env.json');
 process.env.AI_BRIDGE_REMOTE_TOKEN='test-remote-token';process.env.OPENAI_API_KEY='test-openai-key';
 fs.writeFileSync(fake,`#!/usr/bin/env node
const fs=require('fs');fs.writeFileSync(${JSON.stringify(output)},JSON.stringify({apiKey:process.env.AI_BRIDGE_OPENAI_KEY,anthropic:process.env.AI_BRIDGE_ANTHROPIC_KEY,token:process.env.AI_BRIDGE_REMOTE_TOKEN,openai:process.env.OPENAI_API_KEY,path:!!process.env.PATH}));
const rl=require('readline').createInterface({input:process.stdin});
rl.on('line',line=>{const m=JSON.parse(line);if(m.method==='initialize')process.stdout.write(JSON.stringify({id:m.id,result:{userAgent:'mock'}})+'\\n');else if(m.method==='model/list')process.stdout.write(JSON.stringify({id:m.id,result:{data:[]}})+'\\n');});
`);
 fs.chmodSync(fake,0o755);config.codexBinary=fake;
 await codexSession('models');const env=JSON.parse(fs.readFileSync(output,'utf8'));
 assert.equal(env.apiKey,undefined);assert.equal(env.anthropic,undefined);assert.equal(env.token,undefined);assert.equal(env.openai,undefined);assert.equal(env.path,true);
});

test('MCP external tools are blocked by default',async()=>{
 await assert.rejects(()=>runTool('bridge_mcp_call',{server:'not-there',tool:'act',confirm:true}),/bloqueadas/);
});
test('API call limit can stop additional paid calls before request',async()=>{
 const {config}=await import('../server/config.mjs');
 const old=config.dailyApiCallLimit;config.dailyApiCallLimit=1;
 let called=false;const orig=globalThis.fetch;globalThis.fetch=()=>{called=true;throw Error('A API foi chamada indevidamente')};
 try{await assert.rejects(()=>runTool('bridge_ask_gpt',{prompt:'não deve chamar'}),/Limite diário/);assert.equal(called,false);}
 finally{config.dailyApiCallLimit=old;globalThis.fetch=orig;}
});
