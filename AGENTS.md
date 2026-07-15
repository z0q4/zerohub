# Regras de trabalho do ZeroHub

- Antes de qualquer alteração, leia integralmente `CONTEXTO_MESTRE_ZEROHUB.md` e confirme o estado real do repositório, incluindo branch atual, working tree, sincronização com `origin/main` e estrutura relevante para a tarefa.
- Preserve a arquitetura atual: Electron + React + TypeScript + backend Python.
- Nunca trabalhe diretamente na branch `main`.
- Não invente arquivos ou dependências; confirme a estrutura real do projeto antes de agir.
- Use caminhos completos ao mencionar ou operar sobre arquivos.
- Trabalhe uma etapa por vez.
- Não faça commit nem push sem autorização explícita.
- Antes de concluir qualquer alteração, execute o TypeScript check, o ESLint, os testes Python e `git diff --check`.
