import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
export const VERSION = '1.2.2';
export const home = os.homedir();
export const config = {
  openaiKey: process.env.AI_BRIDGE_OPENAI_KEY || process.env.OPENAI_API_KEY || '',
  anthropicKey: process.env.AI_BRIDGE_ANTHROPIC_KEY || '',
  openaiModel: process.env.AI_BRIDGE_GPT_MODEL || 'gpt-6-luna',
  deepModel: process.env.AI_BRIDGE_DEEP_MODEL || 'gpt-6-astra',
  claudeModel: process.env.AI_BRIDGE_CLAUDE_MODEL || 'claude-sonnet-4-6',
  workspace: path.resolve(process.env.AI_BRIDGE_WORKSPACE || path.join(home, 'AIUniversalBridgeWorkspace')),
  dataDir: path.resolve(process.env.AI_BRIDGE_DATA_DIR || path.join(home, '.ai-universal-bridge')),
  allowWrites: process.env.AI_BRIDGE_ALLOW_WRITES === 'true',
  allowCodexWrites: process.env.AI_BRIDGE_ALLOW_CODEX_WRITES === 'true',
  allowMcpActions: process.env.AI_BRIDGE_ALLOW_REMOTE_ACTIONS === 'true',
  dailyApiCallLimit: Math.max(1, Math.min(500, Number(process.env.AI_BRIDGE_DAILY_API_CALL_LIMIT || 50))),
  cacheEnabled: process.env.AI_BRIDGE_CACHE === 'true',
  codexBinary: process.env.AI_BRIDGE_CODEX_BIN || 'codex',
  mcpRegistryPath: process.env.AI_BRIDGE_MCP_REGISTRY || '',
  maxOutputTokens: Number(process.env.AI_BRIDGE_MAX_OUTPUT_TOKENS || 3000),
};
export function initDirs(){
 for(const p of [config.workspace,config.dataDir]) { fs.mkdirSync(p,{recursive:true,mode:0o700}); }
}
export function safeError(e){
 let s = String(e?.message || e || 'Erro desconhecido');
 for(const token of [config.openaiKey, config.anthropicKey, process.env.AI_BRIDGE_REMOTE_TOKEN]) if(token && token.length>8) s=s.split(token).join('[REDACTED]');
 return s.slice(0,1000);
}
export function boundedText(x, max=30000, field='texto'){
 if(typeof x !== 'string' || !x.trim()) throw Error(`${field} deve ser texto não vazio`);
 if(x.length>max) throw Error(`${field} muito grande; limite ${max} caracteres`);
 return x;
}
