import {test} from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import net from 'node:net';
function freePort(){return new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});}
test('Remote MCP rejects unauthorized access and supports authenticated JSON-RPC',async()=>{
 const port=await freePort();const token='a'.repeat(40);
 const child=spawn(process.execPath,['server/remote.mjs'],{cwd:path.resolve(''),env:{...process.env,AI_BRIDGE_REMOTE_TOKEN:token,AI_BRIDGE_REMOTE_PORT:String(port),AI_BRIDGE_REMOTE_HOST:'127.0.0.1',AI_BRIDGE_DATA_DIR:fs.mkdtempSync(path.join(os.tmpdir(),'aub-remote-'))},stdio:['ignore','ignore','pipe']});
 try{
  for(let i=0;i<40;i++){try{const r=await fetch(`http://127.0.0.1:${port}/mcp`);if(r.status===401)break;}catch{} await new Promise(r=>setTimeout(r,60));}
  const u=await fetch(`http://127.0.0.1:${port}/mcp`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'initialize',params:{}})});assert.equal(u.status,401);
  const ok=await fetch(`http://127.0.0.1:${port}/mcp`,{method:'POST',headers:{'content-type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify({jsonrpc:'2.0',id:2,method:'tools/list',params:{}})});
  assert.equal(ok.status,200);const data=await ok.json();assert.ok(data.result.tools.length>=20);
 }finally{child.kill();}
});
