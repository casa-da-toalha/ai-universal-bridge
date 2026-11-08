import http from 'node:http';
import crypto from 'node:crypto';
import {handleRpc} from './bridge.mjs';
const secret=process.env.AI_BRIDGE_REMOTE_TOKEN||'';
if(Buffer.byteLength(secret)<32){console.error('Configure AI_BRIDGE_REMOTE_TOKEN com pelo menos 32 caracteres aleatórios.');process.exit(1);}
const host=process.env.AI_BRIDGE_REMOTE_HOST||'127.0.0.1';
const port=Number(process.env.AI_BRIDGE_REMOTE_PORT||8765);
const auth=req=>{
 const provided=req.headers.authorization||'';const expected='Bearer '+secret;
 const a=Buffer.from(provided),b=Buffer.from(expected);
 return a.length===b.length && crypto.timingSafeEqual(a,b);
};
const server=http.createServer(async(req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 if(req.url!=='/mcp'){res.writeHead(404);res.end();return;}
 if(!auth(req)){res.writeHead(401,{'WWW-Authenticate':'Bearer'});res.end();return;}
 if(req.method!=='POST'){res.writeHead(405,{'Allow':'POST'});res.end();return;}
 if(!(req.headers['content-type']||'').includes('application/json')){res.writeHead(415);res.end();return;}
 let body='';try{
  for await (const chunk of req){body+=chunk.toString('utf8');if(body.length>1_000_000){res.writeHead(413);res.end();return;}}
  const msg=JSON.parse(body);
  const result=await handleRpc(msg);
  if(result===null){res.writeHead(202);res.end();return;}
  res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','MCP-Protocol-Version':'2025-06-18'});
  res.end(JSON.stringify(result));
 }catch{if(!res.headersSent)res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({jsonrpc:'2.0',id:null,error:{code:-32700,message:'Bad request'}}));}
});
server.listen(port,host,()=>console.error(`AI Universal Bridge HTTP ouvindo em ${host}:${port}/mcp. Configure HTTPS + autenticação antes de acessar de fora.`));
