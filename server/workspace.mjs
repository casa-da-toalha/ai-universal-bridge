import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {config,boundedText} from './config.mjs';
function within(root,p){return p===root || p.startsWith(root+path.sep);}
function target(rel,{forWrite=false}={}){
 if(typeof rel!=='string'||rel.length>500||path.isAbsolute(rel)||rel.includes('\0'))throw Error('Caminho relativo inválido');
 const base=fs.realpathSync(config.workspace);const resolved=path.resolve(base,rel||'.');
 if(!within(base,resolved)) throw Error('Caminho fora do workspace');
 if(forWrite){
  const parent=fs.realpathSync(path.dirname(resolved));if(!within(base,parent))throw Error('Pasta fora do workspace (symlink)');
  if(fs.existsSync(resolved) && fs.lstatSync(resolved).isSymbolicLink())throw Error('Não escrever em symlink');
  return resolved;
 }
 const real=fs.realpathSync(resolved);if(!within(base,real))throw Error('Symlink aponta para fora do workspace');return real;
}
export function workspaceList({path:rel='.',limit=100}={}){
 const p=target(rel);if(!fs.statSync(p).isDirectory())throw Error('Caminho não é diretório');
 return fs.readdirSync(p,{withFileTypes:true}).slice(0,Math.min(200,Math.max(1,limit))).map(x=>({name:x.name,kind:x.isDirectory()?'directory':x.isSymbolicLink()?'symlink':'file'}));
}
export function workspaceRead({path:rel,max_chars=20000}){
 const p=target(rel);if(!fs.statSync(p).isFile())throw Error('Caminho não é arquivo');
 if(fs.statSync(p).size>1024*1024)throw Error('Arquivo maior que 1 MB');
 const v=fs.readFileSync(p,'utf8');if(v.includes('\0')) throw Error('Arquivo binário não permitido');return {path:rel,total_chars:v.length,content:v.slice(0,Math.min(100000,Math.max(100,max_chars)))};
}
export function workspaceWrite({path:rel,content,confirm=false,overwrite=false}){
 if(!config.allowWrites)throw Error('Escrita desativada. Ative AI_BRIDGE_ALLOW_WRITES=true nas configurações da extensão.');
 if(confirm!==true)throw Error('Exige confirm=true para gravar arquivo');boundedText(content,100000,'content');
 const p=target(rel,{forWrite:true});
 if(fs.existsSync(p)&&!overwrite)throw Error('Arquivo já existe. use overwrite=true explicitamente');
 const tmp=p+'.'+crypto.randomBytes(6).toString('hex')+'.tmp';fs.writeFileSync(tmp,content,{mode:0o600,flag:'wx'});fs.renameSync(tmp,p);
 return {saved:true,path:rel,chars:content.length};
}
export function workspaceSearch({query,limit=30}){
 boundedText(query,120,'query');const out=[],max=Math.min(100,Math.max(1,limit));let checked=0;
 const walk=(dir,depth)=>{if(depth>4||checked>300||out.length>=max)return;
 for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
  if(entry.isSymbolicLink()||entry.name.startsWith('.'))continue;
  const p=path.join(dir,entry.name);if(entry.isDirectory()){walk(p,depth+1);continue;}
  if(!entry.isFile()||!fs.statSync(p).size||fs.statSync(p).size>250000)continue;checked++;
  const content=fs.readFileSync(p,'utf8');if(content.includes('\0'))continue;
  const i=content.toLowerCase().indexOf(query.toLowerCase());if(i>=0)out.push({path:path.relative(config.workspace,p),excerpt:content.slice(Math.max(0,i-100),i+Math.min(400,query.length+150))});
  if(out.length>=max||checked>300)break;
 }};walk(config.workspace,0);return {results:out,files_examined:checked};
}
export function verifyCodexDir(rel='.'){
 const full=target(rel);if(!fs.statSync(full).isDirectory())throw Error('Codex workspace não é pasta');return full;
}
