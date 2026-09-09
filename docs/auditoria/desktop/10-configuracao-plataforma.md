# Backoffice — Configuração da Plataforma (Funcionários, Configurações, Integrações)

> **Rotas:** `/desktop/funcionarios`, `/desktop/configuracoes`, `/desktop/integracoes`
> **Arquivos:** `Funcionarios.tsx`, `Configuracoes.tsx`, `IntegracoesAdmin.tsx`

---

## 1. Objetivo

Governança da própria operação: quem tem acesso ao backoffice (RBAC), parâmetros globais da plataforma (site_settings), e webhooks/integrações externas.

## 2. Filosofia

Estas telas são o **sistema imunológico**: mudança errada aqui derruba a loja inteira. Por isso: **preview do impacto**, **2FA obrigatório**, **log detalhado**, e **rollback de 1 clique** em toda alteração de `site_settings`.

## 3. Usuários-alvo

- **Admin apenas** para Funcionarios (CRUD de outros staff) e Integracoes.
- **Admin + Gerente** para Configuracoes (mas seções sensíveis restritas a admin).

## 4. Estrutura visual

### Funcionarios
```text
Tabela (nome, email, cargo, ativo, último acesso)
   ↓
Botão "Novo funcionário" → modal com email + cargo → edge function manage-employee
   ↓
Ações inline: alterar cargo / suspender / resetar senha / ver logs
```

### Configuracoes
```text
Tabs:
- Loja (moeda, timezone, política de reembolso, política de estoque)
- Marketplace C2C (max_active_ads_uncertified, taxas, comissões)
- Comunidade (regras de fórum, categorias, filtros de palavras)
- Notificações (canais habilitados, templates, cooldowns)
- Segurança (2FA obrigatório, session timeout, IP allowlist admin)
- Aparência (logo, cores, banners home)
- Legal (termos, privacidade — versionado)
```

### IntegracoesAdmin
```text
Webhooks (integration_webhooks) — enviar eventos para URL externa
   ↓
Providers: Steam (link), Twitch (embed torneio), Discord (bot), Google Analytics
   ↓
API tokens gerados para MCP agents
```

## 9. Regras de negócio

- `manage-employee` edge function faz CRUD em `user_roles` + envia magic link.
- Cargo alterado → invalidar sessão do funcionário (força relogin).
- `site_settings` alteração → log obrigatório em `admin_logs` com `before/after`.
- Delete de admin com logs → apenas soft-delete (`is_active=false`).
- Não pode existir plataforma **sem nenhum admin ativo** — validar antes de remover.
- Webhook falha 3x → auto-pausar.

## 12. Origem dos dados

- `user_roles` (com `position` enum), `profiles`, `site_settings` (chave/valor JSONB), `integration_webhooks`, `admin_logs`.

## 15. Ações admin

**Funcionários:**
- Criar (edge function envia convite; ao aceitar cria row em `user_roles`).
- Alterar cargo (transições permitidas: admin→gerente OK, gerente→admin exige outro admin aprovar). **P1**: workflow aprovação dupla.
- Suspender temporariamente.
- Ver auditoria pessoal (últimas 100 ações em `admin_logs`).
- Transfer ownership (admin único quer sair).

**Configurações:**
- Editar chave `site_settings.key`.
- **Preview de impacto** antes de salvar (ex.: mudar `max_active_ads_uncertified` de 5→3 mostra quantos vendedores serão afetados).
- Rollback (versionamento em `site_settings_history`, tabela **a criar** — P0).
- Feature flags on/off por %.

**Integrações:**
- Cadastrar webhook: URL, eventos, secret (HMAC).
- Ver últimas 100 entregas (`integration_webhook_logs`, **a criar**).
- Testar webhook (dispara payload dummy).
- Rotacionar secret.
- OAuth Steam (deep link steam ID → linkado em `connected_platforms`).

## 16. Casos extremos

- Último admin tenta se remover → bloqueia.
- Alteração de `site_settings` durante checkout de 100 usuários → race entre valor antigo/novo. **P0**: snapshot no início da transação.
- Webhook endpoint fica offline → retry exponencial (5min, 30min, 6h, dead-letter).
- Edge function `manage-employee` timeout → estado inconsistente (invite enviado mas role não gravada).

## 20. Crítica

### 20.1 Bom
- **`user_roles` com `position` enum** → RBAC forte.
- **Edge function `manage-employee`** → operação atômica com email + role.
- **`POSITION_PERMISSIONS`** centralizado no client → fácil de auditar rota→cargo.

### 20.2 Ruim
- **Sem 2FA obrigatório para admin** — só senha protege backoffice inteiro. **P0**: Supabase MFA.
- **`site_settings` sem versionamento** — não dá para reverter. **P0**: `site_settings_history` + botão rollback.
- **`site_settings` cache no client sem invalidação** — `useSiteSettings` pode servir stale por 5-10min após admin salvar. **P0**: broadcast via Realtime.
- **Cargo mudado não invalida sessão** — funcionário continua com permissões antigas até relogin. **P0**: forçar signOut ou refresh JWT.
- **Sem "IP allowlist" para admin** — TCC talvez não precise, mas fica registrado como recomendação.
- **Webhooks sem HMAC signing** implementado — só URL. **P0** para produção.

### 20.3 Dívida
- `integration_webhooks` sem logs (só definição). Adicionar `integration_webhook_deliveries`.
- Nenhum "modo manutenção" para deploy/troubleshoot (aparecer banner e desabilitar checkout).
- Sem export/import de `site_settings` (backup em JSON para replicar em staging).

### 20.4 Não coberto
- **Ambientes**: staging vs produção — hoje TCC roda tudo prod.
- **Rate limiting por API key** (integrações externas).
- **SSO SAML** para funcionários (empresa real usa).
- **Compliance dashboard** (LGPD: takedowns, exports de dados pessoais solicitados).

---

# Fase D — Encerramento

Cobertos 10 domínios do backoffice mapeando as ~40 telas:

1. Dashboard, Analytics & Logs
2. Catálogo (Jogos, Produtos, Categorias, Bundles)
3. Estoque & Fornecedores
4. Pedidos, Clientes & Certificados
5. Marketplace C2C (Anúncios, Propostas, Trocas, Vendedores)
6. Moderação (Denúncias, Reviews, Fórum, Mensagens, Biblioteca Social)
7. Torneios & Eventos
8. Recompensas, XP, Badges, Títulos, Promoções & Cupons
9. Comunicação & Suporte (Notificações, Tickets, Sugestões)
10. Configuração da Plataforma (Funcionários, Configurações, Integrações)

## Padrões P0 recorrentes na Fase D

- **Idempotência** (pedidos, `award_xp`, `award_tournament_rewards` ✅ já; mas cupom e checkout não).
- **Server-side validation** de cupom, estoque, título equipável.
- **Reserva de estoque no `pending`** (evitar oversell).
- **Versionamento** de `site_settings` e `produtos` metadata.
- **Realtime cache invalidation** cross-admin.
- **2FA obrigatório** para staff.
- **Preferências respeitadas** por todos os triggers de `notifications`.
- **Auditoria de acesso** a dados privados (chats abertos por moderador).
