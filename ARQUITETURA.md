# Arquitetura e próximos módulos — AI Universal Bridge 1.2.2

```
Claude Desktop (app)
     | MCPB / stdio / JSON-RPC
     v
AI Universal Bridge 1.2.2
     |-- OpenAI Responses API (GPT + web_search + Code Interpreter)
     |-- Codex App Server (threads, models, skills, turns, read-only by default)
     |-- Anthropic Messages API (Claude separado do app)
     |-- MCP Client HTTP (registro local, OFF por padrão)
     |-- Workspace (pasta restrita; escrita OFF por padrão)
     |-- Memory + Tasks + Usage + Cache (arquivos privados locais)
     `-- HTTP stateless opcional (Bearer + loopback; proxy/tunnel recomendado)

ChatGPT compatível com MCP remoto <-- HTTPS/tunnel + autenticação <-- HTTP bridge
```

## Capacidades validadas localmente

1. Protocolo MCP: handshake, listagem, chamada, prompts, resources.
2. APIs GPT/Claude: requisição autenticada e extração de resposta testadas com **mock HTTP**, sem cobranças.
3. Codex App Server: handshake, listagem de modelos/threads, leitura de thread/turnos/skills e chamada de turno testados com **mock Codex**.
4. Arquivos: prevenção de travessia de diretório e de leitura de symlink fora do workspace; escrita com bloqueio duplo.
5. Ponte remota HTTP: recusa token ausente e responde JSON-RPC autenticado em localhost.
6. Memória, tarefas e limite de chamadas por dia; uso salvo apenas após resposta da API.

## Ainda não implementado (não confundir com pronto)

- OAuth dinâmico + refresh, acesso seguro remoto pronto para produção e SSE de longa duração.
- Interface própria com aprovações humanas individuais e audit trail assinado.
- Streaming vivo de tokens/itens Codex até o cliente MCP; versão atual reúne o resumo após o turno.
- Notificações bidirecionais automáticas entre aplicativos pessoais, jobs em segundo plano persistentes e controle da interface ChatGPT.
- Adaptadores nativos instalados para cada serviço (Shopify, WhatsApp, Gmail, GitHub etc.); é possível conectar serviços que ofereçam um servidor MCP remoto, caso configurados pelo usuário.
- Plugin ChatGPT publicado/instalado, extensão Claude instalada, ou autenticação nas contas do usuário.
- Validação de compatibilidade com qualquer versão do aplicativo Claude Desktop ou com qualquer SKU GPT.

## Política de segurança atual

- GPT e Claude API podem receber texto enviado explicitamente nas ferramentas de delegação. Não envie dados sensíveis sem autorização.
- `bridge_mcp_call` exige `AI_BRIDGE_ALLOW_REMOTE_ACTIONS=true` e `confirm=true`. O sinal `confirm=true` **não é uma prova criptográfica de autorização humana**: use a confirmação do Claude/Desktop também.
- `bridge_codex_run` usa `read_only` por padrão. Operações de escrita exigem habilitação e confirmação, e aprovações extras do app-server serão recusadas automaticamente.
- Não há shell irrestrito exposto pela ponte. Codex pode executar comandos no sandbox quando permitido pelo runtime.
- HTTP remoto só escuta localmente; para uso externo, autenticação, TLS, auditoria e controle de acesso precisam ser tratados no ambiente de implantação.

## Evolução proposta

- V2: pacote com serviços remotos seguros, OAuth, SSE/streaming, painel de aprovações, logs auditáveis e assistente de configuração.
- V3: jobs persistentes, workflows DAG, conectores oficiais de terceiros, permissões por projeto e avaliação/roteamento de modelos baseado em benchmarks e custos reais.

Priorizar testes reais **sem modificar sistemas externos** antes de ativar ações de escrita.
