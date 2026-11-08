import {config,boundedText,safeError} from './config.mjs';
import {cacheGet,cachePut,hash,recordUsage,assertApiBudget} from './store.mjs';

async function post(url,headers,body,timeoutMs=120000){
 const res=await fetch(url,{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify(body),signal:AbortSignal.timeout(timeoutMs)});
 const raw=await res.text(); let json;try{json=JSON.parse(raw);}catch{throw Error(`Resposta HTTP ${res.status} não é JSON: ${raw.slice(0,200)}`);}
 if(!res.ok)throw Error(`HTTP ${res.status}: ${String(json.error?.message||json.error?.type||raw).slice(0,400)}`);
 return json;
}
export async function askGpt({prompt,model,system='',web_search=false,code_interpreter=false,reasoning='medium',max_output_tokens,cache=false,previous_response_id}={}){
 if(!config.openaiKey) throw Error('Configure AI_BRIDGE_OPENAI_KEY. A assinatura do ChatGPT não substitui automaticamente a chave da API.');
 boundedText(prompt,40000,'prompt'); if(system)boundedText(system,8000,'system');
 const chosen=model||config.openaiModel;
 const max=Math.min(12000,Math.max(256,Number(max_output_tokens||config.maxOutputTokens)));
 const body={model:chosen,input:prompt,max_output_tokens:max,store:false};
 if(system)body.instructions=system;
 if(reasoning && reasoning!=='default')body.reasoning={effort:reasoning};
 if(previous_response_id) body.previous_response_id=previous_response_id;
 const tools=[]; if(web_search)tools.push({type:'web_search'});if(code_interpreter)tools.push({type:'code_interpreter',container:{type:'auto'}});
 if(tools.length)body.tools=tools;
 // Never cache time-sensitive searches, previous response chains or actions.
 const id=hash({provider:'openai',body});const eligible=config.cacheEnabled&&cache===true&&!web_search&&!code_interpreter&&!previous_response_id;
 if(eligible){const found=cacheGet(id);if(found){recordUsage({provider:'openai',model:chosen,cached:true});return {...found,cached:true};}}
 assertApiBudget();
 const data=await post('https://api.openai.com/v1/responses',{'Authorization':`Bearer ${config.openaiKey}`},body,150000);
 const output=typeof data.output_text==='string'?data.output_text:(data.output||[]).filter(x=>x.type==='message').flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text).join('\n');
 const result={provider:'OpenAI Responses API',model:data.model||chosen,response_id:data.id||null,output:output||'[A resposta não continha texto; pode ter gerado outra modalidade de saída.]',usage:data.usage||{},tools_used:(data.output||[]).filter(x=>x.type?.endsWith('_call')).map(x=>x.type),cached:false};
 recordUsage({provider:'openai',model:result.model,usage:data.usage});if(eligible)cachePut(id,result,10*60*1000);return result;
}
export async function askClaude({prompt,model,system='',max_tokens=2500}={}){
 if(!config.anthropicKey)throw Error('Configure AI_BRIDGE_ANTHROPIC_KEY; este recurso usa a API Anthropic separada do aplicativo Claude.');
 boundedText(prompt,40000,'prompt');const chosen=model||config.claudeModel;
 const body={model:chosen,max_tokens:Math.min(8192,Math.max(256,max_tokens)),messages:[{role:'user',content:prompt}]};if(system)body.system=boundedText(system,8000,'system');
 assertApiBudget();
 const data=await post('https://api.anthropic.com/v1/messages',{'x-api-key':config.anthropicKey,'anthropic-version':'2023-06-01'},body,120000);
 const output=(data.content||[]).filter(x=>x.type==='text').map(x=>x.text).join('\n');
 recordUsage({provider:'anthropic',model:data.model||chosen,usage:data.usage||{}});
 return {provider:'Anthropic Messages API',model:data.model||chosen,output,usage:data.usage||{}};
}
export async function compareAgents({prompt,include_gpt=true,include_claude=true,model_gpt,model_claude}={}){
 boundedText(prompt,20000,'prompt');if(!include_gpt&&!include_claude)throw Error('Selecione pelo menos um modelo');
 const jobs=[];if(include_gpt)jobs.push(['gpt',askGpt({prompt,model:model_gpt,reasoning:'medium'})]);if(include_claude)jobs.push(['claude',askClaude({prompt,model:model_claude})]);
 const settled=await Promise.allSettled(jobs.map(x=>x[1]));const results={};
 for(let i=0;i<jobs.length;i++)results[jobs[i][0]]=settled[i].status==='fulfilled'?settled[i].value:{error:safeError(settled[i].reason)};
 return {results,note:'Duas consultas separadas geram custos separados quando ambas são ativadas.'};
}
export async function workflow({steps,context='',max_chars_per_step=6000}={}){
 if(!Array.isArray(steps)||steps.length<1||steps.length>4)throw Error('Workflow aceita de 1 a 4 etapas');
 let running=String(context).slice(0,10000);const result=[];
 for(const s of steps){
  const task=boundedText(s.prompt,15000,'step.prompt');const input=`${task}\n\nCONTEXTO ANTERIOR:\n${running}`;
  const output=s.provider==='anthropic'?await askClaude({prompt:input,model:s.model}):s.provider==='openai'?await askGpt({prompt:input,model:s.model,reasoning:'medium'}):null;
  if(!output)throw Error('provider deve ser openai ou anthropic');
  result.push({provider:s.provider,model:output.model,output:output.output});
  running=output.output.slice(0,Math.max(500,Math.min(12000,max_chars_per_step)));
 }
 return {steps:result,final:running,note:'O contexto entre etapas é truncado para controlar tokens. Cada etapa consome API.'};
}

export async function listApiModels({provider='openai',limit=100}={}){
 const isOpenai=provider==='openai';if(!isOpenai&&provider!=='anthropic')throw Error('provider deve ser openai ou anthropic');
 const key=isOpenai?config.openaiKey:config.anthropicKey;if(!key)throw Error(`Chave da API ${provider} não configurada`);
 const url=isOpenai?'https://api.openai.com/v1/models':'https://api.anthropic.com/v1/models';
 const headers=isOpenai?{'Authorization':`Bearer ${key}`}:{'x-api-key':key,'anthropic-version':'2023-06-01'};
 const res=await fetch(url,{headers,signal:AbortSignal.timeout(30000)});
 const json=await res.json();if(!res.ok)throw Error(`${provider} models HTTP ${res.status}: ${String(json.error?.message||'Falha').slice(0,200)}`);
 return {provider,models:(json.data||[]).slice(0,Math.min(250,Math.max(1,limit))).map(x=>({id:x.id,display_name:x.display_name||x.id})),next_page:json.has_more?json.last_id:null,note:'Lista consultada na API com a credencial configurada; modelos disponíveis podem variar por conta.'};
}
export async function ecosystemVersions(){
 const repositories=['openai/codex','modelcontextprotocol/mcpb','modelcontextprotocol/typescript-sdk'];
 const results=await Promise.all(repositories.map(async repo=>{
  try{const r=await fetch(`https://api.github.com/repos/${repo}/releases/latest`,{headers:{'User-Agent':'ai-universal-bridge','Accept':'application/vnd.github+json'},signal:AbortSignal.timeout(10000)});
   if(!r.ok)throw Error(`HTTP ${r.status}`);const j=await r.json();return {repository:repo,latest_release:j.tag_name,published_at:j.published_at,url:j.html_url};
  }catch(e){return {repository:repo,error:safeError(e)};}
 }));return {checked_at:new Date().toISOString(),results,disclaimer:'Consulta apenas tags públicas no GitHub. Não garante compatibilidade nem instala atualizações.'};
}
