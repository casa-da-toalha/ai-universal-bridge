# AI Universal Bridge

Ponte MCP local para conectar o Claude Desktop a modelos da OpenAI API, ao Codex App Server e a servidores MCP configurados pelo usuário.

**Versão verificada:** 1.2.2  
**Estado:** testes automatizados locais aprovados; instalação ainda não validada no Claude Desktop real.

## Capacidades implementadas

- 34 ferramentas MCP, quatro prompts e três resources. Claude pode chamar GPT pela OpenAI Responses API; o resultado volta como resposta da ferramenta.
- Controle do `codex app-server` instalado localmente: consultar modelos, listar e retomar threads, ler turnos e delegar tarefas.
- Chamadas opcionais à Anthropic Messages API, comparação de respostas e fluxos sequenciais entre provedores.
- Memória local persistente, compactação de contexto, fila manual de tarefas e leitura/pesquisa de arquivos numa pasta escolhida.
- Transporte MCP local por `stdio`; servidor HTTP opcional e cliente para servidores MCP configurados.
- Limites de chamadas, cache opcional e confirmações para operações que gravam arquivos ou chamam ferramentas externas.

## Limites que devem ser entendidos

- OpenAI API **não é controle da sua conta pessoal do ChatGPT**. Não acessa conversas ou ferramentas exclusivas da sua conta. Uso da API pode ser cobrado separadamente da assinatura ChatGPT.
- A API Anthropic é separada do aplicativo Claude Desktop e da assinatura Claude.
- O Codex é iniciado como `codex app-server` usando a instalação local. O bridge não controla a interface do Codex. Solicitações interativas de aprovação do processo Codex são recusadas pela integração.
- O servidor remoto é opcional, vinculado a `127.0.0.1` por padrão e protegido por token. Para acesso fora do Mac, configure um túnel seguro com HTTPS; o servidor não implementa TLS.
- Acesso a MCPs externos pode produzir alterações em serviços conectados. Essas chamadas ficam desativadas por padrão e exigem confirmação individual.
- Gravações no workspace e gravações do Codex vêm desativadas por padrão. Manter as opções desativadas é adequado para começar.
- Os testes usam respostas simuladas. Não usamos chaves reais, contas reais ou uma instalação do Claude Desktop para validar a Release.

## Instalação no Claude Desktop para macOS

1. Baixe `AI-Universal-Bridge-1.2.2.mcpb` na página **Releases** deste repositório privado.
2. Abra o Claude Desktop e vá para **Settings → Extensions → Advanced settings → Install Extension…**. Escolha o arquivo `.mcpb` baixado e siga a configuração.
3. Se o Claude Desktop não abrir o instalador ao clicar no arquivo, use **Install Extension…** e selecione o arquivo manualmente.
4. Selecione uma pasta de workspace dedicada. Configure a chave da OpenAI API somente se quiser chamar GPT. A chave Anthropic é opcional.
5. Deixe escrita no workspace, escrita pelo Codex e ações MCP remotas desativadas no primeiro uso.
6. No Claude Desktop, experimente `bridge_status`, depois `bridge_workspace_list`. Se tiver o Codex CLI instalado e autenticado, tente `bridge_codex_models`. Chame `bridge_ask_gpt` somente depois de configurar uma chave de API.

Os nomes dos menus podem variar conforme a versão do Claude Desktop. Consulte o guia oficial Anthropic de instalação de servidores MCP locais: <https://support.anthropic.com/en/articles/10949351-getting-started-with-local-mcp-servers-on-claude-desktop>.

## Configuração manual / desenvolvimento

Requer Node.js 18 ou superior. Clone o repositório privado e rode:

```sh
npm test
node server/index.mjs
```

Para uso como MCP local, configure o Claude Desktop para iniciar `node` com o caminho absoluto de `server/index.mjs`, usando [examples/claude_desktop_config.example.json](examples/claude_desktop_config.example.json). Defina as credenciais nas variáveis de ambiente do processo; não grave chaves em arquivos de configuração compartilhados.

Para testar o transporte HTTP opcional localmente, crie um token aleatório de pelo menos 32 bytes e defina `AI_BRIDGE_REMOTE_TOKEN` antes de executar `npm run remote`. O servidor ouve somente em `127.0.0.1` por padrão. Não exponha a porta sem túnel HTTPS e controles de acesso.

## Ferramentas e confirmações

A lista completa fica em `manifest.json` e é disponibilizada pelo servidor em `tools/list`. As ferramentas cobrem delegação, consulta/retomada Codex, memória, workspace, tarefas, configuração de MCP externo e auditoria local. A autorização do Claude Desktop é uma camada adicional; ela não substitui os controles internos.

Variáveis de segurança importantes:

- `AI_BRIDGE_ALLOW_WRITES=true`: habilita gravações locais; cada chamada ainda precisa `confirm=true`.
- `AI_BRIDGE_ALLOW_CODEX_WRITES=true`: habilita sandbox `workspaceWrite`; cada execução ainda precisa `confirm_write=true`.
- `AI_BRIDGE_ALLOW_REMOTE_ACTIONS=true`: habilita chamadas MCP externas; cada chamada ainda precisa `confirm=true`.
- `AI_BRIDGE_DAILY_API_CALL_LIMIT`: limita chamadas a APIs por dia UTC; não é limite de custo.

Veja [SECURITY.md](SECURITY.md), [ARQUITETURA.md](ARQUITETURA.md), [INSTALAR.md](INSTALAR.md) e [docs/VERIFICACAO.md](docs/VERIFICACAO.md).
