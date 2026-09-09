# Backoffice — Pedidos, Clientes & Certificados

> **Rotas:** `/desktop/pedidos`, `/desktop/clientes`, `/desktop/certificados`
> **Arquivos:** `PedidosOnline.tsx`, `Clientes.tsx`, `Certificados.tsx`

---

## 1. Objetivo

Fechar o **ciclo comercial**: acompanhar pedidos do `pending` ao `delivered`, dar suporte a clientes, e conceder/revogar o Certificado de Vendedor (garantia da loja para trocas C2C).

## 2. Filosofia

Pedido é onde a promessa da loja é cumprida. Cliente é onde a relação vive além do pedido. Certificado é onde a **marca MIDIAS entra como aval** no marketplace C2C — vendedores certificados ganham selo, teto de anúncios maior e mais peso na busca.

## 3. Usuários-alvo

| Perfil | Pedidos | Clientes | Certificados |
| --- | --- | --- | --- |
| Admin | tudo | tudo | aprovar/revogar |
| Gerente | tudo | ver+editar | aprovar |
| Atendente | processar, cancelar | ver+comentar | ver |
| Moderador | ver | ver histórico de denúncias | — |

## 4. Estrutura visual

### PedidosOnline
```text
Filtros (status, data, valor, cupom, cliente)
   ↓
Tabela paginada
   ↓
Drawer detalhado (itens, endereço, timeline, cupom, notas internas)
   ↓
Ações: confirmar / processar / enviar / entregar / cancelar / reembolsar
```

### Certificados
```text
Fila "pendentes" (default)
   ↓
Documentos anexados + dados do vendedor
   ↓
Ações: aprovar (definir expires_at) / recusar (motivo) / revogar
```

## 9. Regras de negócio

- Transições de status: `pending → confirmed → processing → shipped → delivered`. `cancelled` só a partir de `pending/confirmed/processing`.
- `confirmed` dispara `on_order_confirmed`: decrementa estoque, adiciona à biblioteca (`quero_jogar`), grava movimentação, XP.
- `cancelled` dispara `on_order_cancelled`: repõe estoque.
- Reembolso parcial → hoje não existe (só cancelamento total). **P1**.
- Certificado ativo enquanto `status='ativo' AND (expires_at IS NULL OR expires_at > now())`.
- Vendedor com certificado ativo: sem teto de anúncios, badge visível, prioridade no ranking.
- Vendedor sem: teto `max_active_ads_uncertified` (default 5, trigger `enforce_uncertified_ad_limit`).

## 12. Origem dos dados

- `pedidos` (13 col), `itens_pedido`, `cupon_usos`, `movimentacoes_estoque`, `certificados`, `seller_profiles`, `profiles`, `auth.users` (email via RPC).

## 14. Hooks

- `usePedidos`, `EntityTimelineDrawer` (padrão reusado), `adminLog.ts`.

## 15. Ações admin

**Pedidos:**
- Alterar status manualmente (log em `admin_logs`).
- Enviar mensagem ao cliente (mensagens + email).
- Aplicar cupom manualmente pós-fato (compensação).
- Reprocessar (relançar edge function fake de pagamento).

**Clientes:**
- Ver LTV, ticket médio, jogos favoritos.
- Ver denúncias recebidas, banimentos, avaliações.
- Banir temporariamente (atualiza `profiles.banned_until` — trigger `protect_banned_until` exige admin).
- Enviar notificação especial.

**Certificados:**
- Aprovar com validade padrão (12 meses configurável).
- Recusar com motivo (usuário vê em `MConfig`).
- Revogar antes do vencimento (motivo obrigatório).

## 16. Casos extremos

- Pedido `confirmed` mas item removido do catálogo → biblioteca insere `NULL`? **P0**: FK deve barrar delete de produto com pedido.
- Cliente sem `display_name` (novo, ainda em `handle_new_user`) → tabela mostra fallback do email.
- Certificado revogado enquanto vendedor tem 30 anúncios ativos → o que acontece? **Hoje**: fica lá, mas próxima edição bate no trigger. **P0**: soft-deactivate excedentes ordenados por menos vistos.
- Timezone em `created_at` — filtro "hoje" varia por navegador.

## 20. Crítica

### 20.1 Bom
- Trigger `on_order_confirmed` unifica 4 side-effects (estoque, biblioteca, movimentação, XP). Ótima consolidação.
- `EntityTimelineDrawer` reusado — padrão consistente em vários lugares do admin.

### 20.2 Ruim
- **Sem idempotency key no `pedidos`** — F5 no checkout pode duplicar. **P0** (também flagged na fase B).
- **Sem paginação server-side** consistente — algumas telas ainda carregam tudo.
- **Certificado sem workflow multi-passo** (envio doc → análise → entrevista?). Hoje um clique aprova. **P1**: campo `review_stage`.
- **Notas internas de pedido armazenadas em `pedidos.internal_notes` (texto único)** → sem histórico por atendente. **P1**: `pedido_notes` (append-only).
- **Sem SLA visível** (pedido pending há 3 dias?). **P0**: highlight vermelho na tabela.

### 20.3 Dívida
- `pedidos.status` é `text` sem CHECK — permite typos.
- `certificados.expires_at` sem job de expiração automática — vencido continua "ativo" se ninguém consultar `has_active_certificate`. Já é `stable`, então RLS/queries pegam certo, mas UI admin não mostra "expirado". **P1**: cron diária.

### 20.4 Não coberto
- **Chargeback simulado** (TCC): fluxo de disputa não existe.
- **Export contábil** (NF-e simulada) — só PDF de recibo.
