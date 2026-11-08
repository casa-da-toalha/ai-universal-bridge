# Verificação da versão 1.2.1

## O que foi inspecionado

- Pacotes recuperados da Biblioteca: `Claude_Bridge_Completo.zip` (77.029 bytes) e `Claude_Bridge_Instalacao.mcpb` (32.767 bytes).
- Conteúdo do `.mcpb`: arquivo ZIP válido com `manifest.json` na raiz, entry point presente, exemplos, documentação e código do servidor.
- Conteúdo do ZIP completo: instalador, fontes, documentação, checksums e resultado anterior dos testes.
- Manifesto e fontes foram comparados: a versão inicial tinha configurações padrão divergentes para Claude (4.6 no manifesto e 4.5 no código) e passava as variáveis de ambiente da ponte ao Codex subprocesso.

## Correções nesta release

- Unificadas as versões em 1.2.1 e os modelos padrão Claude em `claude-sonnet-4-6`.
- Definido `gpt-6-luna` como modelo padrão econômico; `gpt-6-astra` permanece como modelo avançado. O usuário pode escolher modelos habilitados para a sua chave via configuração.
- O Codex subprocesso agora recebe o ambiente normal de execução sem variáveis cujos nomes indicam chave de API, token, segredo, senha ou credencial.
- Atualizadas as instruções de instalação para o fluxo atual de extensões no Claude Desktop.

## Testes executados

`npm test` passou com 11 testes automatizados em Node.js. `npx @anthropic-ai/mcpb validate manifest.json` passou com o validador oficial MCPB 2.1.2; `mcpb pack` gerou o instalador e `mcpb info` reconheceu versão, manifesto e arquivos esperados. Eles cobrem handshake/listagem MCP, memória, escopo do workspace e gravação condicionada, fila de tarefas, corpos de chamadas de API simuladas, remoção de chaves de mensagens de erro, Codex App Server simulado, isolamento de credenciais para o subprocesso Codex, bloqueio padrão de ações MCP externas, limite de chamadas API e autenticação HTTP remota.

Os testes não acessam uma conta OpenAI, Anthropic, Codex ou Claude Desktop real. Eles não confirmam faturamento, disponibilidade de modelos na conta, interoperabilidade do Codex instalado, instalação do MCPB no macOS ou login no aplicativo Claude.

## Compatibilidade e validação pendente

- O `.mcpb` segue o formato MCPB manifest `0.3` e declara Claude Desktop `>=0.10.0`, macOS (`darwin`) e Node `>=18`.
- O arquivo foi criado como ZIP com o manifesto na raiz, e seus caminhos foram comparados com os arquivos do código-fonte. O pacote foi gerado pelo CLI oficial MCPB 2.1.2 e conferido com `mcpb info`; não foi possível confirmar a aceitação pelo instalador de um Claude Desktop real.
- A instalação e um teste funcional no Mac do usuário ainda precisam ser feitos localmente.
- GPT exige chave da OpenAI API com acesso ao modelo selecionado; assinatura ChatGPT não substitui a API. Claude API exige credencial Anthropic separada.
- Codex exige CLI instalado e autenticado. Chamadas a modelos, web search, Code Interpreter e outras APIs podem ter custos e disponibilidade condicionados à conta.

## Integridade

Os hashes SHA-256 dos dois arquivos da Release estão no arquivo `SHA256SUMS.txt` anexado. O hash pode ser conferido no macOS com `shasum -a 256 nome-do-arquivo`.
