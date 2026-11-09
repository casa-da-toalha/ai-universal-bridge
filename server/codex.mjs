import {spawn} from 'node:child_process';
import readline from 'node:readline';
import {config,boundedText} from './config.mjs';
import {verifyCodexDir} from './workspace.mjs';

// Codex app-server: JSONL protocol, not the removed codex mcp-server.
export async function codexSession(action,{task='',thread_id='',cwd='.',mode='read_only',confirm_write=false,model='',timeout_seconds=120,limit=20}={}){
 if(!['read_only','workspace_write'].includes(mode))throw Error('mode inválido');
 if(mode==='workspace_write'&&(!config.allowCodexWrites||confirm_write!==true))throw Error('Escrita Codex bloqueada: AI_BRIDGE_ALLOW_CODEX_WRITES=true e confirm_write=true são exigidos');
 if(action==='run')boundedText(task,20000,'task');
 const dir=verifyCodexDir(cwd);
 // Codex needs the user's normal runtime environment, but it must not inherit
 // credentials collected by this bridge or unrelated API tokens from Claude.
 const codexEnv={...process.env};
 for(const name of Object.keys(codexEnv)) if(/(?:API_KEY|ACCESS_TOKEN|AUTH_TOKEN|SECRET|PASSWORD|CREDENTIAL|_KEY$|_TOKEN$)/i.test(name)) delete codexEnv[name];
 const proc=spawn(config.codexBinary,['app-server'],{cwd:dir,stdio:['pipe','pipe','pipe'],env:codexEnv,windowsHide:true});
 const rl=readline.createInterface({input:proc.stdout});
 let seq=0; const pending=new Map();let ended=false;let final=null;const textParts=[];const events=[];
 let resolveFinal,rejectFinal;
 const completion=new Promise((r,j)=>{resolveFinal=r;rejectFinal=j});
 // Sem este catch, uma rejeicao de 'completion' que nenhum caminho aguarda
 // (Codex ausente, saida precoce ou timeout antes do turn/start) derruba o
 // processo inteiro do servidor MCP por unhandled rejection no Node >=15.
 completion.catch(()=>{});
 const timer=setTimeout(()=>{rejectFinal(Error('Codex excedeu o tempo configurado'));proc.kill();},Math.max(10,Math.min(900,timeout_seconds))*1000);
 const send=msg=>{if(!proc.killed&&proc.stdin.writable)proc.stdin.write(JSON.stringify(msg)+'\n');};
 const rpc=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});send({id,method,params});});
 const finish=(error)=>{if(ended)return;ended=true;clearTimeout(timer);
  for(const p of pending.values())p.reject(error||Error('Conexão Codex encerrada'));pending.clear();
  if(error)rejectFinal(error);else resolveFinal(final);
  try{proc.stdin.end();}catch{} setTimeout(()=>{if(!proc.killed)proc.kill();},350).unref();};
 proc.on('error',e=>finish(Error(`Não foi possível executar Codex app-server: ${e.message}. Configure AI_BRIDGE_CODEX_BIN com caminho absoluto se necessário.`)));
 proc.on('exit',(code)=>{if(!ended)finish(Error(`Codex app-server encerrou antes do resultado (código ${code})`));});
 // Never write stderr to MCP stdout; do not store prompts/logs.
 proc.stderr.on('data',()=>{});
 rl.on('line',line=>{let msg;try{msg=JSON.parse(line);}catch{return;}
  if(Object.hasOwn(msg,'id')&&Object.hasOwn(msg,'method')){
   // This headless bridge does not silently approve Codex escalations.
   const method=msg.method;
   if(method==='item/commandExecution/requestApproval'||method==='item/fileChange/requestApproval')send({id:msg.id,result:{decision:'decline'}});
   else if(method==='mcpServer/elicitation/request')send({id:msg.id,result:{action:'decline',content:null}});
   else if(method==='item/permissions/requestApproval')send({id:msg.id,result:{permissions:{}}});
   else send({id:msg.id,error:{code:-32601,message:'Interação precisa de aprovação no cliente; ponte recusou por segurança'}});
   return;
  }
  if(Object.hasOwn(msg,'id')){const p=pending.get(msg.id);if(!p)return;pending.delete(msg.id);msg.error?p.reject(Error(msg.error.message||'Erro do Codex')):p.resolve(msg.result);return;}
  if(msg.method==='item/agentMessage/delta'&&msg.params?.delta)textParts.push(String(msg.params.delta));
  if(msg.method==='item/completed'){
   const it=msg.params?.item;
   if(it?.type==='agentMessage'&&it?.text){const candidate=String(it.text);if(!textParts.join('').trim())textParts.push(candidate);}
   if(it?.type==='commandExecution'||it?.type==='fileChange')events.push({type:it.type,status:it.status});
  }
  if(msg.method==='turn/completed'){
   const turn=msg.params?.turn;
   final={thread_id:msg.params?.threadId||null,turn_id:turn?.id||null,status:turn?.status||'unknown',output:textParts.join('').slice(0,80000),events:events.slice(-60),error:turn?.error||null};
   finish();
  }
 });
 try{
  await rpc('initialize',{clientInfo:{name:'ai-universal-bridge',title:'AI Universal Bridge',version:'1.2.5'}});
  send({method:'initialized',params:{}});
  if(action==='models'){
   const r=await rpc('model/list',{limit:Math.min(50,limit),includeHidden:false});final={models:r.data||r,nextCursor:r.nextCursor||null};finish();return await completion;
  }
  if(action==='threads'){
   const r=await rpc('thread/list',{limit:Math.min(50,limit)});final={threads:r.data||r,nextCursor:r.nextCursor||null};finish();return await completion;
  }
  if(action==='thread_read'||action==='turns'){
   if(!thread_id)throw Error('thread_id é obrigatório');
   const r=action==='thread_read'?await rpc('thread/read',{threadId:thread_id}):await rpc('thread/turns/list',{threadId:thread_id,limit:Math.min(50,limit),sortDirection:'desc',itemsView:'summary'});
   final={thread_id,...(action==='thread_read'?{thread:r.thread||r}:{turns:r.data||[],next_cursor:r.nextCursor||null})};finish();return await completion;
  }
  if(action==='skills'){
   const r=await rpc('skills/list',{cwds:[dir],forceReload:false});final={cwd:dir,skills:r.data||r};finish();return await completion;
  }
  let thread;
  if(thread_id){const r=await rpc('thread/resume',{threadId:thread_id});thread=r.thread;}
  else {const r=await rpc('thread/start',{cwd:dir,...(model?{model}:{})});thread=r.thread;}
  if(!thread?.id)throw Error('Codex não retornou thread.id');
  const params={threadId:thread.id,input:[{type:'text',text:task}],cwd:dir,
   approvalPolicy:'on-request',
   sandboxPolicy:mode==='workspace_write'?{type:'workspaceWrite',writableRoots:[dir],networkAccess:false}:{type:'readOnly'},
   ...model?{model}:{}};
  await rpc('turn/start',params);
  const output=await completion;output.thread_id=thread.id;
  if(output.status!=='completed')throw Error(`Codex finalizou com status ${output.status}: ${JSON.stringify(output.error||{})}`);
  return output;
 }catch(e){finish(e);throw e;}
}
