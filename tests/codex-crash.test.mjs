import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

// Regressao: chamar uma ferramenta Codex sem o binario disponivel nao pode
// derrubar o servidor MCP. Antes da correcao o processo saia com codigo 1 e
// todas as chamadas seguintes da sessao ficavam sem resposta.
test('ferramenta Codex sem binario nao derruba o servidor', async () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-crash-'));
  const entry = new URL('../server/index.mjs', import.meta.url).pathname;
  const child = spawn(process.execPath, [entry], {
    stdio: ['pipe', 'pipe', 'ignore'],
    env: {
      ...process.env,
      AI_BRIDGE_WORKSPACE: path.join(base, 'ws'),
      AI_BRIDGE_DATA_DIR: path.join(base, 'data'),
      AI_BRIDGE_CODEX_BIN: path.join(base, 'codex-que-nao-existe')
    }
  });
  const answered = new Set();
  let exitCode = null;
  child.on('exit', code => { exitCode = code; });
  let buffer = '';
  child.stdout.on('data', chunk => {
    buffer += chunk;
    let index;
    while ((index = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, index).trim();
      buffer = buffer.slice(index + 1);
      if (!line) continue;
      try { const message = JSON.parse(line); if (message.id !== undefined) answered.add(message.id); } catch {}
    }
  });
  const send = message => child.stdin.write(JSON.stringify(message) + '\n');
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

  send({jsonrpc: '2.0', id: 1, method: 'initialize', params: {protocolVersion: '2025-06-18', capabilities: {}, clientInfo: {name: 'regressao', version: '1'}}});
  await wait(700);
  send({jsonrpc: '2.0', method: 'notifications/initialized', params: {}});
  send({jsonrpc: '2.0', id: 2, method: 'tools/call', params: {name: 'bridge_codex_models', arguments: {}}});
  await wait(1500);
  send({jsonrpc: '2.0', id: 3, method: 'tools/call', params: {name: 'bridge_status', arguments: {}}});
  await wait(1200);

  try {
    assert.equal(exitCode, null, 'o servidor MCP nao deve encerrar depois de uma falha do Codex');
    assert.ok(answered.has(2), 'a chamada Codex deve responder com erro de ferramenta');
    assert.ok(answered.has(3), 'o servidor deve continuar atendendo chamadas depois da falha');
  } finally {
    child.kill();
    fs.rmSync(base, {recursive: true, force: true});
  }
});
