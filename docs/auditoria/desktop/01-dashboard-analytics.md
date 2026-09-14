# Backoffice — Dashboard, Analytics & Logs

> **Status:** rascunho
> **Plataforma:** Desktop (Electron)
> **Rotas:** `/desktop` (Dashboard), `/desktop/analytics`, `/desktop/logs`
> **Arquivos-fonte:** `src/desktop/pages/Dashboard.tsx`, `Analytics.tsx`, `LogsAdministrativos.tsx`

---

## 1. Objetivo

Dar ao staff um **cockpit** do negócio em três camadas:
- **Dashboard**: pulso operacional agora (pendências, receita do dia, alertas).
- **Analytics**: séries históricas para decisão (funil de venda, retenção, engajamento social).
- **Logs**: quem fez o quê (auditoria e forensics).

## 2. Filosofia

Todo backoffice tem "gráfico bonito" — o diferencial do MIDIAS é que Dashboard **fala com pendências reais** (`useDesktopPending`) e Analytics correlaciona **três universos** (loja + marketplace C2C + comunidade). Sem isso, o admin decide preço olhando só receita e ignora que a comunidade está reclamando do jogo no fórum.

## 3. Usuários-alvo

| Perfil | Dashboard | Analytics | Logs |
| --- | --- | --- | --- |
| Admin | tudo | tudo | tudo |
| Gerente | tudo | tudo | próprios |
| Moderador | só denúncias/reviews | engajamento | próprios |
| Atendente | pedidos/certificados | — | próprios |
| Estoquista | estoque | vendas por SKU | próprios |

## 4. Estrutura visual

```text
AdminPageHeader
   ↓
[KPIs do dia — pendências + receita + novos usuários]
   ↓
[Alertas críticos] (denúncias P0, estoque zero, certificados expirando)
   ↓
[Atalhos por cargo]
   ↓
[Feed de atividade recente — realtime]
```

Ordem justificada: **pendências antes de gráficos**. Admin abre o app pra resolver, não pra contemplar.

## 5. Componentes-chave

### 5.1 KPIs em tempo real
- Fonte: `useDesktopPending` + query agregada `pedidos`/`profiles`/`anuncios`.
- Realtime via `useDesktopRealtimeAlerts` (toast sonner + badge no menu).

### 5.2 Analytics (gráficos)
- Recharts. Filtros 7d/30d/90d/12m.
- Séries: GMV, ticket médio, DAU/MAU, novos anúncios C2C, taxa de conversão carrinho→pedido, top jogos por horas na biblioteca, denúncias por dia.
- Comparativo período anterior (delta %).

### 5.3 Logs Administrativos
- Tabela `admin_logs` (10 colunas). Filtro por ator, ação, entidade, período.
- Diff before/after em JSON quando aplicável.
- Export CSV para auditoria externa.

## 9. Regras de negócio

- Nenhum admin consegue apagar seu próprio log (imutabilidade).
- Logs retidos por 2 anos mínimo (LGPD art. 16).
- Alerta P0 dispara toast + som opcional (`site_settings.notification_prefs.sound`).

## 12. Origem dos dados

| Bloco | Fonte |
| --- | --- |
| Pendências | `useDesktopPending` (5 tabelas) |
| Realtime alerts | Supabase Realtime canais `denuncias`, `pedidos`, `certificados`, `trade_proposals` |
| Analytics vendas | RPC agregado `admin_sales_daily` (**a criar**) sobre `pedidos` + `itens_pedido` |
| Analytics social | agregado sobre `game_timeline_events`, `forum_posts`, `avaliacoes` |
| Logs | `admin_logs` |

## 14. Hooks / RPCs

- `useDesktopPending` ✅
- `useDesktopRealtimeAlerts` ✅
- `useAdminAnalytics(range, kpi)` **faltando** — hoje cada card faz query própria (N+1 no dashboard).

## 15. Ações admin

- Clicar em KPI → drill-down na página filtrada (pedidos pendentes → `/desktop/pedidos?status=pending`).
- "Ver" no toast → deep-link.
- Export CSV/PDF de analytics via `jspdf` (padrão de `Relatorios.tsx`).

## 16. Casos extremos

- Realtime desconecta → fallback polling 60s já implementado.
- Timezone: hoje usa timezone do navegador; **deveria fixar America/Sao_Paulo** para todos os agregados diários.
- Admin novo (0 permissões) → mostrar estado "sem seções liberadas" ao invés de tela em branco.

## 20. Crítica

### 20.1 Bom
- **Realtime + fallback**: `useDesktopRealtimeAlerts` com `mountedAtRef` previne spam no replay. Padrão sólido.
- **RBAC granular**: `POSITION_PERMISSIONS` mapeia cargo → seções; `canAccess` centralizado.

### 20.2 Ruim
- **Analytics faz N queries no cliente** (uma por card). **P0**: consolidar em RPC única `admin_dashboard_bundle(range)` retornando JSON.
- **Sem cache**: cada navegação para Dashboard refaz tudo. Adicionar React Query com `staleTime: 60s`.
- **Logs sem paginação server-side** — carrega todos ordenados por `created_at desc`. Quebra >10k linhas. **P0**.
- **Sem export agendado**: relatório mensal precisa ser gerado manualmente. **P2**: edge function `weekly-admin-digest`.

### 20.3 Dívida
- `admin_logs` não tem índice em `(actor_id, created_at desc)` nem em `(entity_type, entity_id)`.
- Analytics não separa **loja** vs **marketplace C2C** — números misturados enganam decisão de curadoria.

### 20.4 Não coberto
- **Acessibilidade**: gráficos Recharts sem `aria-label` nem tabela alternativa.
- **Impressão**: `@media print` inexistente — admin que imprime dashboard para reunião pega tela quebrada.
