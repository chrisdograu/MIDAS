# Backoffice — Comunicação & Suporte (Notificações, Tickets, Sugestões)

> **Rotas:** `/desktop/notificacoes`, `/desktop/notificacoes/especiais`, `/desktop/tickets/mobile`, `/desktop/tickets/web`, `/desktop/sugestoes`
> **Arquivos:** `NotificacoesAdmin.tsx`, `NotificacoesEspeciais.tsx`, `TicketsMobile.tsx`, `TicketsWeb.tsx`, `SugestoesJogos.tsx`

---

## 1. Objetivo

Fechar o loop admin↔usuário: mandar recado em massa (notificações), atender chamados 1:1 (tickets), e capturar demanda de catálogo (sugestões de jogos).

## 2. Filosofia

Notificação em massa é **fogo amigo em potencial** — precisa preview, segmentação e cooldown. Ticket é **contrato de suporte** — precisa SLA visível. Sugestão é **inteligência de mercado grátis** — precisa ranking e feedback.

## 3. Usuários-alvo

| Perfil | Notifs em massa | Notifs especiais | Tickets | Sugestões |
| --- | --- | --- | --- | --- |
| Admin | tudo | tudo | tudo | aprovar |
| Gerente | criar | criar | responder | aprovar |
| Atendente | — | — | responder | ver |
| Moderador | — | — | — | ver |

## 4. Estrutura visual

### NotificacoesAdmin
```text
Filtros (tipo, período, lidas/não lidas por segmento)
   ↓
Tabela agregada por campanha
   ↓
Criar campanha: segmento (SQL builder) → template → preview → agendar
```

### NotificacoesEspeciais
Notificações "system-wide" com estilo hero (banner no topo do app).

### Tickets
```text
Fila (aberto / em análise / respondido / resolvido / fechado)
   ↓
Thread ticket_messages
   ↓
Attach: pedido / anúncio / usuário
   ↓
Ações: responder, marcar como resolvido, escalar
```

### SugestoesJogos
```text
Tabela com upvotes agregados
   ↓
Status: pendente / analisando / aprovado / rejeitado / lançado
   ↓
Ao aprovar: já cria produto rascunho em produtos
```

## 9. Regras de negócio

- `notification_preferences` (20 col!) por usuário controla o que aceita.
- `device_tokens` guarda push tokens (FCM/APNs).
- Broadcast respeita preferências: `WHERE notif_type NOT IN (blocked_types)`.
- Cooldown entre notifs mesmo tipo: **regra a implementar** (P0) — hoje admin pode spammar.
- Ticket sem resposta há 24h → SLA warning; 48h → escalado.
- Sugestão com 50+ upvotes → destaque automático na fila.
- Sugestão aprovada → notifica todos que votaram: "o jogo X que você sugeriu está disponível!".

## 12. Origem dos dados

- `notifications` (13 col), `notification_preferences` (20 col), `device_tokens`, `tickets`, `ticket_messages`, `game_suggestions`.

## 15. Ações admin

**Notificações massa:**
- Segment builder: filtros por level, país, jogos na biblioteca, última atividade, gasto.
- Preview em device mock (mobile/web).
- Test send (para próprio admin).
- Agendar envio (edge function + cron).
- Ver métricas: entregues, abertas, cliques (deep link).

**Tickets:**
- Templates de resposta.
- Anexar pedido/anúncio ao ticket (contexto para outro atendente).
- Merge tickets duplicados do mesmo usuário.
- Auto-tag por palavras-chave (pagamento, entrega, banimento).

**Sugestões:**
- Ver upvotes com quem votou (para notificar em lançamento).
- Comentar publicamente (usuário vê).
- Duplicate detection (Cyberpunk 2077 vs Cyberpunk2077).
- Aprovar → cria `produtos` rascunho + notifica votantes ao publicar.

## 16. Casos extremos

- Usuário desativa todas notifs → não recebe nada (inclusive críticas: banimento?). **P0**: categoria "system_critical" ignora preferências.
- Push token expirado → limpar em `device_tokens` após 3 falhas.
- Ticket com anexo de imagem 20MB → limitar 5MB, compressão client-side.
- Sugestão de jogo já no catálogo → auto-rejeitar com link.
- Sugestão idêntica postada por 100 bots → rate limit por IP.

## 20. Crítica

### 20.1 Bom
- **`notification_preferences` granular (20 col)** — usuário controla mesmo.
- **Sugestões com voto + status** → funil de curadoria transparente.
- Separação Tickets Mobile vs Web reconhece contextos diferentes.

### 20.2 Ruim
- **Sem cooldown em broadcast** → risco de burnout. **P0**.
- **Preferências não bloqueiam triggers de notification insert** — todo trigger (`notify_new_message`, `notify_mention`, `notify_wishlist_price_drop`, etc.) faz insert direto em `notifications` sem checar `notification_preferences`. **P0**: cada trigger deveria consultar prefs.
- **Sem métrica de open rate**. **P0**: `notifications.opened_at`.
- **Ticket SLA não visível** na fila. **P0**: coluna "aguarda há X horas".
- **Sugestões sem categoria** (jogo indie vs AAA vs re-release) — dificulta priorização.
- **Notificações especiais (hero banner)** não têm dismissal por usuário — vê sempre. **P1**.
- **Sem localização** (i18n) nos templates de notificação — futuro.

### 20.3 Dívida
- `notifications` sem particionamento (cresce sem parar).
- `ticket_messages` sem attachment URL FK — texto livre.
- Triggers de notificação disparam sínc no INSERT. **P1**: enfileirar em `notification_queue` e processar assíncrono para não travar transações principais.

### 20.4 Não coberto
- **Rich notifications** (imagem, botão de ação inline).
- **Web Push** vs SMS vs Email (hoje só in-app + push mobile).
- **Ticket bot** (primeira resposta automatizada com IA sobre docs).
