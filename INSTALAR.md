# Instalação rápida — AI Universal Bridge 1.2.2

Para o aplicativo **Claude Desktop** no macOS:

1. Baixe `AI-Universal-Bridge-1.2.2.mcpb` nos assets da Release GitHub.
2. Abra **Claude Desktop → Settings → Extensions → Advanced settings → Install Extension…** e selecione o arquivo. Configure as opções exibidas.
3. Selecione um workspace dedicado. Informe a chave OpenAI API se quiser usar as ferramentas GPT; essa chave é separada da assinatura ChatGPT.
4. Deixe as três opções de escrita/ação desativadas no início: workspace, Codex e servidores MCP externos.
5. Teste `bridge_status` e `bridge_workspace_list`. Teste `bridge_codex_models` somente se o Codex CLI estiver instalado e autenticado. `bridge_ask_gpt` exige chave OpenAI API válida.

Se a extensão não iniciar, veja o painel da extensão no Claude Desktop e confirme a compatibilidade com sua versão. O pacote foi inspecionado e os testes simulados passam, mas ainda não foi instalado em um Claude Desktop real.

## Não usar

Não copie chaves de API para o exemplo JSON distribuído. Não exponha o servidor HTTP diretamente na internet. Consulte `SECURITY.md` antes de habilitar gravações, Codex em escrita ou ações em MCPs remotos.
