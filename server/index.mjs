import {fromJsonSchema, McpServer} from '@modelcontextprotocol/server';
import {serveStdio} from '@modelcontextprotocol/server/stdio';
import {getPrompt, listPrompts, listResources, readResource, runTool, tools} from './bridge.mjs';
import {safeError, VERSION} from './config.mjs';

function createServer() {
  const server = new McpServer(
    {name: 'ai-universal-bridge', title: 'AI Universal Bridge', version: VERSION},
    {capabilities: {tools: {}, prompts: {}, resources: {}}}
  );

  for (const definition of tools) {
    server.registerTool(
      definition.name,
      {
        title: definition.title || definition.name,
        description: definition.description,
        inputSchema: fromJsonSchema(definition.inputSchema),
        annotations: definition.annotations
      },
      async (args) => {
        try {
          const value = await runTool(definition.name, args);
          return {
            content: [{type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2)}],
            structuredContent: {result: value === undefined ? null : value}
          };
        } catch (error) {
          return {content: [{type: 'text', text: safeError(error)}], isError: true};
        }
      }
    );
  }

  for (const prompt of listPrompts()) {
    const properties = Object.fromEntries(prompt.arguments.map(argument => [
      argument.name,
      {type: 'string', description: argument.description}
    ]));
    const required = prompt.arguments.filter(argument => argument.required).map(argument => argument.name);
    server.registerPrompt(
      prompt.name,
      {
        title: prompt.name,
        description: prompt.description,
        argsSchema: fromJsonSchema({type: 'object', properties, required, additionalProperties: false})
      },
      args => getPrompt({name: prompt.name, arguments: args})
    );
  }

  for (const resource of listResources().resources) {
    server.registerResource(
      resource.name,
      resource.uri,
      {title: resource.name, description: resource.name, mimeType: resource.mimeType},
      async uri => readResource(uri.href)
    );
  }

  return server;
}

// The official MCP SDK handles the 2026 discovery probe and falls back to
// the legacy initialize handshake for older MCP clients.
serveStdio(createServer);
