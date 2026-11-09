import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {once} from 'node:events';
import test from 'node:test';
import assert from 'node:assert/strict';

const entry = new URL('../server/index.mjs', import.meta.url);

function startServer() {
  const child = spawn(process.execPath, [entry.pathname], {stdio: ['pipe', 'pipe', 'pipe']});
  const lines = createInterface({input: child.stdout});
  const iterator = lines[Symbol.asyncIterator]();
  return {
    async send(message) {
      child.stdin.write(JSON.stringify(message) + '\n');
      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('MCP response timed out')), 4000));
      const next = await Promise.race([iterator.next(), timeout]);
      assert.equal(next.done, false, 'server closed stdout before replying');
      return JSON.parse(next.value);
    },
    notify(message) {
      child.stdin.write(JSON.stringify(message) + '\n');
    },
    async close() {
      child.kill('SIGTERM');
      await Promise.race([once(child, 'exit'), new Promise(resolve => setTimeout(resolve, 1000))]);
      lines.close();
    }
  };
}

test('stdio supports modern discovery and tool calls', async () => {
  const server = startServer();
  try {
    const meta = {
      'io.modelcontextprotocol/protocolVersion': '2026-07-28',
      'io.modelcontextprotocol/clientInfo': {name: 'bridge-stdio-test', version: '1'},
      'io.modelcontextprotocol/clientCapabilities': {}
    };
    const discover = await server.send({
      jsonrpc: '2.0', id: 'discover-test', method: 'server/discover', params: {_meta: meta}
    });
    assert.equal(discover.result.resultType, 'complete');
    assert.ok(discover.result.supportedVersions.includes('2026-07-28'));

    const list = await server.send({
      jsonrpc: '2.0', id: 'list-test', method: 'tools/list', params: {_meta: meta}
    });
    assert.equal(list.result.resultType, 'complete');
    assert.equal(list.result.tools.length, 34);

    const status = await server.send({
      jsonrpc: '2.0', id: 'status-test', method: 'tools/call',
      params: {name: 'bridge_status', arguments: {}, _meta: meta}
    });
    assert.equal(status.result.resultType, 'complete');
    assert.equal(status.result.structuredContent.result.version, '1.2.5');
  } finally {
    await server.close();
  }
});

test('stdio keeps compatibility with legacy initialize clients', async () => {
  const server = startServer();
  try {
    const initialized = await server.send({
      jsonrpc: '2.0', id: 0, method: 'initialize',
      params: {
        protocolVersion: '2025-11-25',
        capabilities: {},
        clientInfo: {name: 'legacy-stdio-test', version: '1'}
      }
    });
    assert.equal(initialized.result.protocolVersion, '2025-11-25');
    server.notify({jsonrpc: '2.0', method: 'notifications/initialized'});
    const list = await server.send({
      jsonrpc: '2.0', id: 1, method: 'tools/list', params: {}
    });
    assert.equal(list.result.tools.length, 34);
  } finally {
    await server.close();
  }
});
