import readline from 'node:readline';
import {handleRpc} from './bridge.mjs';
// Pure line-delimited JSON-RPC on stdout. Diagnostics only on stderr.
const rl=readline.createInterface({input:process.stdin,crlfDelay:Infinity});
rl.on('line',async line=>{
 try{
  if(line.length>1_000_000)throw Error('Request too large');
  const answer=await handleRpc(JSON.parse(line));
  if(answer!==null)process.stdout.write(JSON.stringify(answer)+'\n');
 }catch(e){process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:null,error:{code:-32700,message:'Parse error'}})+'\n');}
});
