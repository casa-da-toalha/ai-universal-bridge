import fs from 'node:fs';
import path from 'node:path';
import {config} from './config.mjs';
const registryFile=()=>config.mcpRegistryPath||path.join(config.dataDir,'mcp-servers.json');
export function getServers(){
 try{
  const doc=JSON.parse(fs.readFileSync(registryFile(),'utf8'));const input=doc.servers||{};
  return Object.fromEntries(Object.entries(input).filter(([name,s])=>/^[a-zA-Z0-9_-]{1,60}$/.test(name)&&typeof s?.url==='string'));
 }catch(e){if(e.code==='ENOENT')return {};throw e;}
}
function endpoint(name){
 const server=getServers()[name];if(!server)throw Error(`Servidor MCP '${name}' não configurado em ${registryFile()}`);
 const url=new URL(server.url);
 if(url.username||url.password||url.hash)throw Error('URL do servidor MCP inválida');
 if(url.protocol!=='https:'&&!(url.protocol==='http:'&&['localhost','127.0.0.1','::1'].includes(url.hostname)))throw Error('Servidores MCP remotos exigem HTTPS (HTTP só localhost)');
 return {server,url:url.toString()};
}
let nextId=1;
export async function mcpRequest(name,method,params={}){
 const {server,url}=endpoint(name);const token=server.token_env?process.env[server.token_env]:undefined;
 if(server.token_env&&!token)throw Error(`Variável de ambiente ${server.token_env} não configurada`);
 const headers={'content-type':'application/json','accept':'application/json, text/event-stream','mcp-protocol-version':'2025-06-18',...(token?{authorization:`Bearer ${token}`}:{})};
 const request=async(message,session='')=>{
  const res=await fetch(url,{method:'POST',headers:{...headers,...(session?{'mcp-session-id':session}:{})},body:JSON.stringify(message),redirect:'error',signal:AbortSignal.timeout(30000)});
  const raw=await res.text();if(!res.ok)throw Error(`MCP HTTP ${res.status}: ${raw.slice(0,240)}`);
  const sessionId=res.headers.get('mcp-session-id')||session;
  if(!raw.trim())return {data:null,sessionId};
  let data;
  if((res.headers.get('content-type')||'').includes('text/event-stream')){
   const candidates=raw.split(/\r?\n/).filter(x=>x.startsWith('data:')).map(x=>x.slice(5).trim());
   const matched=candidates.map(x=>{try{return JSON.parse(x)}catch{return null}}).find(x=>x&&x.id===message.id);
   data=matched||null;
  }else data=JSON.parse(raw);
  return {data,sessionId};
 };
 const hello=await request({jsonrpc:'2.0',id:nextId++,method:'initialize',params:{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'ai-universal-bridge',version:'1.0.0'}}});
 if(hello.data?.error)throw Error(hello.data.error.message||'MCP init falhou');
 await request({jsonrpc:'2.0',method:'notifications/initialized',params:{}},hello.sessionId);
 const result=await request({jsonrpc:'2.0',id:nextId++,method,params},hello.sessionId);
 if(result.data?.error)throw Error(result.data.error.message||'MCP externo retornou erro');
 return result.data?.result??null;
}
export function mcpServers(){return Object.entries(getServers()).map(([name,s])=>({name,url:new URL(s.url).origin,auth_configured:!s.token_env||!!process.env[s.token_env]}));}
export async function mcpTools({server}){const r=await mcpRequest(server,'tools/list',{});return {server,tools:(r?.tools||[]).map(x=>({name:x.name,description:x.description,inputSchema:x.inputSchema}))};}
export async function mcpCall({server,tool,arguments:args={},confirm=false}){
 if(!config.allowMcpActions)throw Error('Chamadas MCP externas estão bloqueadas. Ative AI_BRIDGE_ALLOW_REMOTE_ACTIONS=true nas configurações apenas para servidores confiáveis.');
 if(confirm!==true)throw Error('Chamadas a MCP externo requerem confirm=true, pois ferramentas podem alterar serviços conectados.');
 if(typeof tool!=='string'||tool.length>150)throw Error('Nome da ferramenta inválido');
 return {server,tool,result:await mcpRequest(server,'tools/call',{name:tool,arguments:args||{}})};
}
