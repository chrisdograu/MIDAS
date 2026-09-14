---
name: Seed de dados de teste
description: Edge Function seed-test-users (idempotente) que cria 4 clientes de teste e popula marketplace/forum/denúncias/certificados
type: feature
---
A Edge Function `seed-test-users` cria os usuários `cliente1@teste.com`, `cliente2@teste.com`, `cliente3@teste.com` e `banido@teste.com` (banido por 7 dias) com a senha `Teste@123`, e popula 6 anúncios, 4 posts de fórum + respostas, 3 denúncias pendentes, 2 certificados (1 pendente + 1 ativo), 5 favoritos e mensagens de exemplo.
A função é **idempotente** (verifica existência antes de inserir).

**Status atual:** o seed já foi executado uma vez. O botão "Popular dados de teste" foi REMOVIDO da UI de `/desktop/configuracoes` (não é mais necessário). A função permanece deployada e pode ser invocada manualmente via `supabase.functions.invoke('seed-test-users')` se precisar repopular.

Documentação completa em `GUIA_DE_TESTES.md` na raiz do projeto.
