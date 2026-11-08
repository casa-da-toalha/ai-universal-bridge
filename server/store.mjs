import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {config,initDirs,boundedText} from './config.mjs';
initDirs();
function file(name){return path.join(config.dataDir,name+'.json');}
function read(name, fallback){try {return JSON.parse(fs.readFileSync(file(name),'utf8'));}catch(e){if(e.code==='ENOENT') return fallback; throw e;}}
function write(name,v){
 const p=file(name), temp=p+'.'+crypto.randomBytes(6).toString('hex')+'.tmp';
 fs.writeFileSync(temp,JSON.stringify(v,null,2),{mode:0o600,flag:'wx'});fs.renameSync(temp,p);
}
function memoryId(ns,key){return `${ns}::${key}`;}
function validId(s, field){if(typeof s!=='string'|| !/^[a-zA-Z0-9_./:\-]{1,100}$/.test(s))throw Error(`${field} deve conter letras, números, _./:- e até 100 caracteres`); return s;}
export function memoryPut({namespace='default',key,value,tags=[]}){
 validId(namespace,'namespace');validId(key,'key'); boundedText(value,20000,'value');
 if(!Array.isArray(tags) || tags.length>20) throw Error('tags inválidas');
 const m=read('memory',{});const id=memoryId(namespace,key);
 m[id]={namespace,key,value,tags:tags.map(x=>String(x).slice(0,50)),updated_at:new Date().toISOString()};
 if(Object.keys(m).length>1000) throw Error('Limite de 1000 memórias atingido');
 write('memory',m);return {saved:true,namespace,key};
}
export function memoryGet({namespace='default',key}){
 validId(namespace,'namespace');validId(key,'key');return read('memory',{})[memoryId(namespace,key)] ?? null;
}
export function memorySearch({namespace='',query='',limit=20}){
 const q=String(query).toLowerCase();const m=Object.values(read('memory',{}));
 return m.filter(x=>(!namespace||x.namespace===namespace)&&(!q||`${x.key} ${x.value} ${x.tags.join(' ')}`.toLowerCase().includes(q))).slice(0,Math.min(50,Math.max(1,limit)));
}
export function memoryDelete({namespace='default',key,confirm=false}){
 if(confirm!==true) throw Error('Exige confirm=true para excluir memória');
 const m=read('memory',{}); const id=memoryId(validId(namespace,'namespace'),validId(key,'key')); const existed=Object.hasOwn(m,id);delete m[id];write('memory',m);return {deleted:existed};
}
export function recordUsage({provider,model,usage={},cached=false}){
 const u=read('usage',{events:[]});
 u.events.push({at:new Date().toISOString(),provider,model,input_tokens:usage.input_tokens??usage.inputTokens??null,output_tokens:usage.output_tokens??usage.outputTokens??null,cached});
 u.events=u.events.slice(-2000); write('usage',u);
}
export function apiBudgetStatus(){
 const today=new Date().toISOString().slice(0,10);const all=read('usage',{events:[]}).events;
 const used=all.filter(e=>e.at.slice(0,10)===today && !e.cached && (e.provider==='openai'||e.provider==='anthropic')).length;
 return {day_utc:today,calls_used:used,limit:config.dailyApiCallLimit,remaining:Math.max(0,config.dailyApiCallLimit-used)};
}
export function assertApiBudget(){const b=apiBudgetStatus();if(b.remaining<=0) throw Error(`Limite diário de ${b.limit} chamadas API atingido (UTC). Ajuste AI_BRIDGE_DAILY_API_CALL_LIMIT conscientemente.`);}
export function usageSummary(){
 const all=read('usage',{events:[]}).events;
 const providers={};for(const e of all){const k=`${e.provider}/${e.model}`;const p=providers[k]??={calls:0,input_tokens:0,output_tokens:0,cached:0};p.calls++;p.input_tokens+=e.input_tokens||0;p.output_tokens+=e.output_tokens||0;p.cached+=e.cached?1:0;}
 return {total_calls:all.length,api_call_budget:apiBudgetStatus(),by_provider_model:providers,note:'Valores são uso reportado pelas APIs, NÃO custos calculados; uso externo não aparece aqui.'};
}
export function cacheGet(id){
 const x=read('cache',{})[id];if(!x||x.expires_at<Date.now())return null;return x.value;
}
export function cachePut(id,value,ttlMs){
 const all=read('cache',{});all[id]={expires_at:Date.now()+ttlMs,value};
 const now=Date.now();for(const [k,x] of Object.entries(all))if(x.expires_at<now)delete all[k];
 const keys=Object.keys(all);for(const k of keys.slice(0,Math.max(0,keys.length-100)))delete all[k];write('cache',all);
}
export const hash = value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function taskCreate({title,detail='',priority='normal'}){
 boundedText(title,200,'title');if(!['low','normal','high'].includes(priority))throw Error('priority inválida');
 const db=read('tasks',{}),id=crypto.randomUUID();db[id]={id,title,detail:String(detail).slice(0,6000),priority,status:'open',created_at:new Date().toISOString()};write('tasks',db);return db[id];
}
export function taskList({status='',limit=30}={}){
 return Object.values(read('tasks',{})).filter(x=>!status||x.status===status).sort((a,b)=>b.created_at.localeCompare(a.created_at)).slice(0,Math.min(100,Math.max(1,limit)));
}
export function taskUpdate({id,status,confirm=false}){
 if(confirm!==true) throw Error('Exige confirm=true para atualizar tarefas');
 if(!['open','in_progress','done','canceled'].includes(status))throw Error('status inválido');
 const db=read('tasks',{});if(!db[id])throw Error('Tarefa não encontrada');db[id].status=status;db[id].updated_at=new Date().toISOString();write('tasks',db);return db[id];
}
