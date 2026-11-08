import {config,VERSION,safeError,boundedText} from './config.mjs';
import {askGpt,askClaude,compareAgents,workflow,listApiModels,ecosystemVersions} from './providers.mjs';
import {codexSession} from './codex.mjs';
import {memoryPut,memoryGet,memorySearch,memoryDelete,usageSummary,taskCreate,taskList,taskUpdate} from './store.mjs';
import {workspaceList,workspaceRead,workspaceWrite,workspaceSearch} from './workspace.mjs';
import {mcpServers,mcpTools,mcpCall} from './mcp-client.mjs';
const str=(description)=>({type:'string',description});
const bool=(description)=>({type:'boolean',description});
const num=(description)=>({type:'integer',description});
const tool=(name,description,properties={},required=[],annotations={})=>({name,description,inputSchema:{type:'object',properties,required,additionalProperties:false},annotations});
export const tools=[
 tool('bridge_status','Diagnóstico local, recursos habilitados e condições para delegar a APIs.',{},[],{readOnlyHint:true}),
 tool('bridge_capabilities','Lista limites, arquitetura e ferramentas que a ponte implementa.',{},[],{readOnlyHint:true}),
 tool('bridge_api_models','Listar modelos disponíveis nas credenciais OpenAI ou Anthropic, sem consumir tokens de geração.',{provider:{type:'string',enum:['openai','anthropic']},limit:num('Máximo de modelos')},[],{readOnlyHint:true}),
 tool('bridge_check_updates','Verificar últimas versões publicadas de Codex, MCPB e SDK TypeScript no GitHub (apenas consulta).',{},[],{readOnlyHint:true}),
 tool('bridge_ask_gpt','PEÇA AO GPT DA API OPENAI QUE EXECUTE UMA TAREFA. Pode usar busca web e Python hospedado (cobranças adicionais podem ocorrer).',{prompt:str('Tarefa ou comando para GPT'),model:str('Modelo OpenAI opcional, ex. gpt-6-astra'),system:str('Instruções adicionais de sistema'),reasoning:{type:'string',enum:['default','minimal','low','medium','high','xhigh']},web_search:bool('Ativar busca web com custo da API'),code_interpreter:bool('Ativar Python isolado da OpenAI, pode ter custo'),max_output_tokens:num('Limite de saída 256..12000'),cache:bool('Reutilizar resposta idêntica se cache ativado nas configurações')},['prompt']),
 tool('bridge_ask_gpt_deep','Raciocínio profundo com modelo de alta capacidade; sujeito a acesso e custo próprios da API.',{prompt:str('Tarefa complexa'),model:str('Sobrescrever o modelo profundo'),web_search:bool('Ativar busca web')},['prompt']),
 tool('bridge_research','Pesquisa pela OpenAI Responses API com busca web ativada e citação pedida ao modelo.',{question:str('Pergunta de pesquisa'),model:str('Modelo de pesquisa opcional')},['question']),
 tool('bridge_code_interpreter','Delegue cálculos, análise de dados e Python a container isolado da OpenAI (não acessa arquivos locais automaticamente).',{task:str('Tarefa'),model:str('Modelo opcional')},['task']),
 tool('bridge_ask_claude_api','Chame outra instância de Claude via API Anthropic; não controla a conversa aberta no aplicativo.',{prompt:str('Tarefa'),model:str('Modelo API Anthropic'),system:str('Instruções de sistema')},['prompt']),
 tool('bridge_compare_agents','Comparar respostas independentes de GPT e Claude API; duas consultas são cobradas quando ambas ativadas.',{prompt:str('Pergunta'),include_gpt:bool('Incluir GPT, padrão true'),include_claude:bool('Incluir Claude, padrão true'),model_gpt:str('Modelo GPT'),model_claude:str('Modelo Claude')},['prompt']),
 tool('bridge_workflow','Pipeline de 1 a 4 etapas encadeadas entre GPT e Claude API, com resumo automático de contexto.',{steps:{type:'array',minItems:1,maxItems:4,items:{type:'object',properties:{provider:{type:'string',enum:['openai','anthropic']},prompt:str('Instrução da etapa'),model:str('Modelo opcional')},required:['provider','prompt'],additionalProperties:false}},context:str('Contexto inicial'),max_chars_per_step:num('Tamanho máximo do contexto para etapa seguinte')},['steps']),
 tool('bridge_codex_run','CODEx APP SERVER: inicie ou retome thread; acompanha eventos e usa sandbox. Gravação exige habilitação e confirmação.',{task:str('Tarefa para o Codex'),thread_id:str('ID de thread existente para continuar'),cwd:str('Pasta RELATIVA ao workspace autorizado'),mode:{type:'string',enum:['read_only','workspace_write']},confirm_write:bool('Aprovação explícita para workspace_write'),model:str('Modelo Codex opcional; vazio escolhe padrão da conta'),timeout_seconds:num('Tempo de 10 a 900 segundos')},['task']),
 tool('bridge_codex_models','Consultar modelos realmente disponíveis na sessão Codex instalada.',{limit:num('Limite')},[],{readOnlyHint:true}),
 tool('bridge_codex_threads','Listar conversas persistentes do Codex App Server.',{limit:num('Limite')},[],{readOnlyHint:true}),
 tool('bridge_codex_thread_read','Ler metadados de uma conversa persistida do Codex App Server.',{thread_id:str('ID de thread do Codex')},['thread_id'],{readOnlyHint:true}),
 tool('bridge_codex_turns','Listar histórico paginado de turnos de uma thread Codex sem precisar retomá-la.',{thread_id:str('ID de thread do Codex'),limit:num('Limite')},['thread_id'],{readOnlyHint:true}),
 tool('bridge_codex_skills','Listar skills disponíveis ao Codex no workspace permitido.',{cwd:str('Pasta relativa')},[],{readOnlyHint:true}),
 tool('bridge_compact_context','Resumir texto longo em contexto reutilizável com foco em fatos e decisões; usa API e também consome tokens.',{text:str('Conteúdo a compactar'),max_output_tokens:num('Tamanho do resumo'),model:str('Modelo preferido')},['text']),
 tool('bridge_memory_put','Salvar memória EXPLICITAMENTE solicitada em arquivo privado local.',{namespace:str('Área, padrão default'),key:str('Identificador da memória'),value:str('Conteúdo'),tags:{type:'array',items:{type:'string'}}},['key','value']),
 tool('bridge_memory_get','Consultar memória salva por chave.',{namespace:str('Área'),key:str('Identificador')},['key'],{readOnlyHint:true}),
 tool('bridge_memory_search','Pesquisar memória local em áreas, palavras e tags.',{namespace:str('Filtrar namespace; vazio = todos'),query:str('Texto procurado'),limit:num('Máximo de registros')},[],{readOnlyHint:true}),
 tool('bridge_memory_delete','Apagar memória local; exige confirmação explícita.',{namespace:str('Área'),key:str('Chave'),confirm:bool('Confirmação de exclusão')},['key','confirm'],{destructiveHint:true}),
 tool('bridge_context_pack','Montar pacote compacto de memórias com limite estimado de tokens.',{namespace:str('Área'),query:str('Filtro de texto'),max_estimated_tokens:num('Estimativa de tokens, não medição exata')},[],{readOnlyHint:true}),
 tool('bridge_workspace_list','Listar apenas arquivos dentro da pasta workspace autorizada.',{path:str('Caminho relativo, padrão .'),limit:num('Quantidade')},[],{readOnlyHint:true}),
 tool('bridge_workspace_read','Ler arquivo de texto limitado ao workspace autorizado.',{path:str('Caminho relativo'),max_chars:num('Limite de caracteres')},['path'],{readOnlyHint:true}),
 tool('bridge_workspace_search','Procurar texto em arquivos do workspace, com limites de profundidade/tamanho.',{query:str('Palavra/frase'),limit:num('Quantidade máxima')},['query'],{readOnlyHint:true}),
 tool('bridge_workspace_write','Gravar arquivo texto somente no workspace; DISABLED por padrão, exige confirmação e permissão.',{path:str('Caminho relativo dentro da pasta'),content:str('Conteúdo'),confirm:bool('Autoriza esta gravação'),overwrite:bool('Autoriza substituir arquivo existente')},['path','content','confirm'],{destructiveHint:true}),
 tool('bridge_task_create','Adicionar pedido à caixa local de tarefas. Não executa automaticamente.',{title:str('Título'),detail:str('Contexto'),priority:{type:'string',enum:['low','normal','high']}},['title']),
 tool('bridge_task_list','Ver tarefas da caixa local, útil na ponte inversa compartilhada.',{status:str('Filtrar status'),limit:num('Máximo')},[],{readOnlyHint:true}),
 tool('bridge_task_update','Atualizar status de tarefa; exige confirmação explícita.',{id:str('ID da tarefa'),status:{type:'string',enum:['open','in_progress','done','canceled']},confirm:bool('Confirma alteração')},['id','status','confirm']),
 tool('bridge_mcp_servers','Listar servidores MCP externos configurados localmente.',{},[],{readOnlyHint:true}),
 tool('bridge_mcp_tools','Descobrir ferramentas de servidor MCP remoto permitido no registro local.',{server:str('Nome do servidor')},['server'],{readOnlyHint:true}),
 tool('bridge_mcp_call','Usar ferramenta de um servidor MCP externo configurado, com confirmação por chamada. Atenção: pode executar ações remotas.',{server:str('Nome do servidor'),tool:str('Ferramenta'),arguments:{type:'object',description:'Parâmetros da ferramenta externa'},confirm:bool('Confirma delegação remota')},['server','tool','confirm']),
 tool('bridge_usage','Uso de API observado pela ponte, sem inventar custo nem contar sessões externas.',{},[],{readOnlyHint:true})
];
const descriptions=tools.map(x=>({name:x.name,description:x.description}));
export const instructions='AI Universal Bridge: servidor MCP para Claude Desktop e conectores remotos. A ponte delega a OpenAI API, Anthropic API e Codex App Server, mas NÃO assume controle da interface pessoal do ChatGPT/Claude. Não use ferramentas que mudem dados sem aprovação específica do usuário. Prefira leituras, especifique custos, preserve escopo do workspace, não envie dados sensíveis para provedores sem autorização. Nunca prometa que uma tarefa foi executada sem confirmação no resultado.';
export function status(){return {version:VERSION,workspace:config.workspace,openai_api_configured:!!config.openaiKey,anthropic_api_configured:!!config.anthropicKey,codex_binary:config.codexBinary,workspace_writes_enabled:config.allowWrites,codex_writes_enabled:config.allowCodexWrites,mcp_remote_actions_enabled:config.allowMcpActions,daily_api_call_limit:config.dailyApiCallLimit,cache_enabled:config.cacheEnabled,configured_mcp_servers:mcpServers().length,transports:['stdio','HTTP stateless opcional (configurar token)'],notes:['API e assinatura ChatGPT/Claude são produtos diferentes','Ainda não foi feito teste nas contas reais','O Codex usa App Server, não codex mcp-server']};}
export function capabilities(){return {tools:descriptions,count:tools.length,protocol:'MCP JSON-RPC (stdio / streamable HTTP stateless)',providers:['OpenAI Responses API','Anthropic Messages API','Codex App Server','MCP remoto configurado'],limitations:['Sem acesso nativo à conversa aberta no app ChatGPT ou Claude','Aprovações interativas do Codex são recusadas automaticamente','Conector HTTP exige um endpoint HTTPS e token para acesso remoto','Não inclui custos externos nem garante acesso a todos os modelos']};}
export async function runTool(name,args={}){
 const a=args||{};
 switch(name){
  case 'bridge_status':return status();case 'bridge_capabilities':return capabilities();
  case 'bridge_api_models':return listApiModels(a);
  case 'bridge_check_updates':return ecosystemVersions();
  case 'bridge_ask_gpt':return askGpt(a);
  case 'bridge_ask_gpt_deep':return askGpt({...a,model:a.model||config.deepModel,reasoning:'high'});
  case 'bridge_research':return askGpt({prompt:`Investigue e responda citando fontes e datas verificáveis: ${boundedText(a.question,20000,'question')}`,model:a.model||config.deepModel,web_search:true,reasoning:'high'});
  case 'bridge_code_interpreter':return askGpt({prompt:a.task,model:a.model||config.openaiModel,code_interpreter:true});
  case 'bridge_ask_claude_api':return askClaude(a);
  case 'bridge_compare_agents':return compareAgents(a);
  case 'bridge_workflow':return workflow(a);
  case 'bridge_codex_run':return codexSession('run',a);
  case 'bridge_codex_models':return codexSession('models',a);
  case 'bridge_codex_threads':return codexSession('threads',a);
  case 'bridge_codex_thread_read':return codexSession('thread_read',a);
  case 'bridge_codex_turns':return codexSession('turns',a);
  case 'bridge_codex_skills':return codexSession('skills',a);
  case 'bridge_compact_context':return askGpt({prompt:`Transforme o texto em um resumo compacto e reutilizável. Preserve dados, restrições, decisões e pendências; marque incertezas.\n\n${boundedText(a.text,60000,'text')}`,model:a.model||config.openaiModel,max_output_tokens:a.max_output_tokens||1000,reasoning:'low'});
  case 'bridge_memory_put':return memoryPut(a);case 'bridge_memory_get':return memoryGet(a);
  case 'bridge_memory_search':return memorySearch(a);case 'bridge_memory_delete':return memoryDelete(a);
  case 'bridge_context_pack':{
   const m=memorySearch({namespace:a.namespace||'',query:a.query||'',limit:100});const chars=Math.min(30000,Math.max(400,(a.max_estimated_tokens||2500)*4));
   const content=m.map(x=>`[${x.namespace}/${x.key}] ${x.value}`).join('\n\n').slice(0,chars);
   return {content,estimated_tokens:Math.ceil(content.length/4),method:'Estimativa por 4 caracteres/token; não é contagem real',source_items:m.length};}
  case 'bridge_workspace_list':return workspaceList(a);case 'bridge_workspace_read':return workspaceRead(a);
  case 'bridge_workspace_search':return workspaceSearch(a);case 'bridge_workspace_write':return workspaceWrite(a);
  case 'bridge_task_create':return taskCreate(a);case 'bridge_task_list':return taskList(a);case 'bridge_task_update':return taskUpdate(a);
  case 'bridge_mcp_servers':return mcpServers();case 'bridge_mcp_tools':return mcpTools(a);case 'bridge_mcp_call':return mcpCall(a);
  case 'bridge_usage':return usageSummary();
  default:throw Error(`Ferramenta não encontrada: ${name}`);
 }
}
const prompts=[
 {name:'delegar_gpt',description:'Pedir ao Claude que delegue um trabalho ao GPT',arguments:[{name:'tarefa',description:'O que deve executar',required:true}]},
 {name:'dupla_verificacao',description:'Comparar respostas de GPT e Claude API com divergências',arguments:[{name:'pergunta',description:'Pergunta',required:true}]},
 {name:'auditoria_seguranca',description:'Avaliar riscos e permissões antes de executar comandos',arguments:[{name:'tarefa',description:'Tarefa',required:true}]},
 {name:'economia_tokens',description:'Transformar informações em contexto compacto',arguments:[{name:'texto',description:'Texto original',required:true}]}
];
export function listPrompts(){return prompts;}
export function getPrompt({name,arguments:args={}}){
 if(!prompts.find(x=>x.name===name))throw Error('Prompt não encontrado');
 const text={delegar_gpt:`Delegue via bridge_ask_gpt e entregue o resultado verificado. Tarefa: ${args.tarefa||''}`,dupla_verificacao:`Use bridge_compare_agents e contraste pontos de concordância/dúvida. Pergunta: ${args.pergunta||''}`,auditoria_seguranca:`Antes de alterar qualquer serviço, arquivo ou repositório, identifique permissões necessárias, riscos e peça confirmação específica. Tarefa: ${args.tarefa||''}`,economia_tokens:`Use bridge_compact_context apenas se compensar custo adicional. Texto: ${args.texto||''}`}[name];
 return {description:prompts.find(x=>x.name===name).description,messages:[{role:'user',content:{type:'text',text}}]};
}
export function listResources(){return {resources:[{uri:'bridge://status',name:'Status da ponte',mimeType:'application/json'},{uri:'bridge://capabilities',name:'Recursos e limitações',mimeType:'application/json'},{uri:'bridge://usage',name:'Métricas locais de uso',mimeType:'application/json'}]};}
export function readResource(uri){const value=uri==='bridge://status'?status():uri==='bridge://capabilities'?capabilities():uri==='bridge://usage'?usageSummary():null;if(!value)throw Error('Recurso inexistente');return {contents:[{uri,mimeType:'application/json',text:JSON.stringify(value,null,2)}]};}
export async function handleRpc(msg){
 if(!msg||typeof msg!=='object')return {jsonrpc:'2.0',id:null,error:{code:-32600,message:'Invalid Request'}};
 if(!Object.hasOwn(msg,'id'))return null;
 const {id,method,params={}}=msg;
 try{
  let result;
  switch(method){
   case 'initialize':result={protocolVersion:['2025-06-18','2025-11-25','2026-07-28'].includes(params?.protocolVersion)?params.protocolVersion:'2025-06-18',capabilities:{tools:{},prompts:{},resources:{}},serverInfo:{name:'ai-universal-bridge',title:'AI Universal Bridge',version:VERSION},instructions};break;
   case 'ping':result={};break;
   case 'tools/list':result={tools};break;
   case 'tools/call':{
    try{const res=await runTool(params.name,params.arguments||{});result={content:[{type:'text',text:typeof res==='string'?res:JSON.stringify(res,null,2)}],structuredContent:{result:res===undefined?null:res},isError:false};}
    catch(e){result={content:[{type:'text',text:safeError(e)}],isError:true};}break;
   }
   case 'prompts/list':result={prompts:listPrompts()};break;
   case 'prompts/get':result=getPrompt(params);break;
   case 'resources/list':result=listResources();break;
   case 'resources/read':result=readResource(params.uri);break;
   default:return {jsonrpc:'2.0',id,error:{code:-32601,message:'Method not found'}};
  }
  return {jsonrpc:'2.0',id,result};
 }catch(e){return {jsonrpc:'2.0',id,error:{code:-32602,message:safeError(e)}};}
}
