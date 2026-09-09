# Web · Central de Privacidade (/privacidade)

## Propósito
LGPD-compliance: exportar dados, excluir conta, gerenciar `privacy_grants`.

## Achados P0
- **Exportar dados** hoje só gera JSON de `profiles` — falta biblioteca, pedidos, mensagens, avaliações. Criar edge function `export-user-data` completa.
- **Excluir conta** não faz soft-delete de mensagens públicas (fórum) — deveria anonimizar autor_id ao invés de cascade.
- Sem confirmação por email para exclusão.

