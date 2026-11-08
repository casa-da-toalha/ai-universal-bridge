# Verificação da versão 1.2.3

## O que foi inspecionado

- Pacotes recuperados da Biblioteca: `Claude_Bridge_Completo.zip` (77.029 bytes) e `Claude_Bridge_Instalacao.mcpb` (32.767 bytes).
- Conteúdo do `.mcpb`: arquivo ZIP válido com `manifest.json` na raiz, entry point presente, exemplos, documentação e código do servidor.
- Conteúdo do ZIP completo: instalador, fontes, documentação, checksums e resultado anterior dos testes.
- Manifesto e fontes foram comparados: a versão inicial tinha configurações padrão divergentes para Claude (4.6 no manifesto e 4.5 no código) e passava as variáveis de ambiente da ponte ao Codex subprocesso.

## Correções nesta release

- Unificadas as versões em 1.2.3 e os modelos padrão Claude em `claude-sonnet-4-6`.
- Definido `gpt-6-luna` como modelo padrão econômico; `gpt-6-astra` permanece como modelo avançado. O usuário pode escolher modelos habilitados para a sua chave via configuração.
- O Codex subprocesso agora recebe o ambiente normal de execução sem variáveis cujos nomes indicam chave de API, token, segredo, senha ou credencial.
- Atualizadas as instruções de instalação para o fluxo atual de extensões no Claude Desktop.
- Substituído o transporte MCP escrito à mão pelo SDK oficial TypeScript MCP v2.4.0. O servidor agora responde a `server/discover` da revisão 2026-07-28 e mantém compatibilidade com clientes do protocolo 2025.
- A correção mira o erro observado no Claude Desktop em “Cowork/Code”: falha de negociação de versão durante a descoberta. O teste local reproduz a descoberta moderna e também o handshake legado.

## Testes executados

`npm test` passou com 13 testes automatizados em Node.js. Inclui uma execução real do processo stdio com `server/discover` 2026-07-28, listagem e chamada de ferramenta, além de handshake legado. Os demais testes cobrem memória, escopo do workspace e gravação condicionada, fila de tarefas, corpos de chamadas de API simuladas, remoção de chaves de mensagens de erro, Codex App Server simulado, isolamento de credenciais para o subprocesso Codex, bloqueio padrão de ações MCP externas, limite de chamadas API e autenticação HTTP remota.

`npm audit --omit=dev` encontrou zero vulnerabilidades nas dependências de execução consultadas.

Os testes não acessam uma conta OpenAI, Anthropic, Codex ou Claude Desktop real. Eles não confirmam faturamento, disponibilidade de modelos na conta, interoperabilidade do Codex instalado, instalação do MCPB no macOS ou login no aplicativo Claude.

## Compatibilidade e validação pendente

- O `.mcpb` segue o formato MCPB manifest `0.3` e declara Claude Desktop `>=0.10.0`, macOS (`darwin`) e Node `>=18`.
- O MCPB 1.2.3 foi validado, empacotado e inspecionado com o CLI oficial MCPB 2.1.2. A extensão inclui o SDK e dependências necessários dentro de `node_modules`.
- O MCPB extraído foi iniciado pelo Node e respondeu a `server/discover` 2026-07-28. A instalação real e o funcionamento no Claude Desktop do usuário ainda precisam ser confirmados após instalar a nova versão.
- A verificação local não reproduz o host Cowork/Code do Claude Desktop. O teste confirma que o servidor fala o protocolo moderno e o legado; a validação final depende do app real.
- GPT exige chave da OpenAI API com acesso ao modelo selecionado; assinatura ChatGPT não substitui a API. Claude API exige credencial Anthropic separada.
- Codex exige CLI instalado e autenticado. Chamadas a modelos, web search, Code Interpreter e outras APIs podem ter custos e disponibilidade condicionados à conta.

## Integridade

Os hashes SHA-256 dos dois arquivos da Release estão no arquivo `SHA256SUMS.txt` anexado. O hash pode ser conferido no macOS com `shasum -a 256 nome-do-arquivo`.
