# Plano: corrigir somente pelo package.json

## Objetivo
Manter a solução restrita ao `package.json`, sem editar páginas ou outros arquivos do aplicativo.

## Alteração
- Manter `web-vitals` nas dependências do projeto. Ele já está declarado como `^6.2.1`, uma versão mais recente que a `^4.0.0` sugerida.
- Não alterar `main.tsx`, páginas, componentes ou qualquer outro arquivo.
- Não corrigir neste trabalho os erros atuais `cn is not defined` e `React is not defined`, pois isso exigiria editar componentes e contrariaria o limite escolhido.

## Verificação
- Confirmar que o `package.json` permanece válido e contém `web-vitals` em `dependencies`.
- Encerrar sem perseguir erros TypeScript ou fazer correções adicionais.
