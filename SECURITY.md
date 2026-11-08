# Segurança

## Padrões de proteção

- Segredos não são gravados no repositório. Os campos de API no manifesto estão marcados como sensíveis.
- Gravação no workspace, gravação Codex e ações em MCPs externos vêm desativadas por padrão e exigem confirmação por chamada.
- O acesso a arquivos locais é limitado ao workspace configurado; caminhos com symlink que escapam do workspace são recusados.
- O Codex subprocesso não recebe variáveis de ambiente com nomes que indiquem chaves de API, tokens, segredos, senhas ou credenciais.
- O servidor HTTP exige token aleatório com pelo menos 32 bytes e escuta em localhost por padrão. HTTPS deve ser fornecido por um túnel/proxy confiável se houver acesso remoto.
- Erros e estado da ponte são limitados para evitar exibição acidental de chaves conhecidas.

## Cuidados de uso

Uma ferramenta chamada pelo modelo ainda pode enviar conteúdo a uma API externa ou alterar dados. Leia a descrição e confirme a ação específica antes de aprovar. Use servidores MCP externos de confiança e configure apenas URLs HTTPS, salvo HTTP em loopback. Nunca publique tokens, API keys, dados pessoais ou logs com conteúdo privado em issues/PRs.

## Relato de vulnerabilidade

Para relatar uma vulnerabilidade neste projeto privado, contate o mantenedor da conta pelo canal privado do GitHub. Não crie issue pública com segredos ou detalhes exploráveis.

## Escopo dos testes

Os testes são automatizados e simulam provedores e processos externos. Eles não são auditoria independente, teste de penetração, validação de contas reais ou garantia de segurança absoluta.
