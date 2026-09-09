---
name: Proteção do banned_until via trigger
description: Trigger BEFORE UPDATE em profiles bloqueia alteração de banned_until por não-admins (incluindo o próprio usuário)
type: feature
---
Trigger `protect_banned_until_trigger` na tabela `profiles` (BEFORE UPDATE) chama a função `public.protect_banned_until()` que:
- Compara `OLD.banned_until` com `NEW.banned_until`.
- Se mudou, exige `public.is_admin()` true; senão lança exception com SQLSTATE 42501 ("Apenas administradores podem alterar o status de banimento").

Isso fecha a brecha onde gerentes/atendentes/moderadores ou o próprio usuário banido poderiam editar a coluna direto via API. O fluxo legítimo continua sendo `/desktop/moderacao` (admin only).
