# Backoffice — Moderação (Denúncias, Avaliações, Fórum, Mensagens, Biblioteca Social)

> **Rotas:** `/desktop/moderacao`, `/desktop/denuncias`, `/desktop/avaliacoes-usuario`, `/desktop/forum`, `/desktop/mensagens`, `/desktop/biblioteca-social`
> **Arquivos:** `Moderacao.tsx`, `Denuncias.tsx`, `AvaliacoesUsuario.tsx`, `ForumAdmin.tsx`, `MensagensAdmin.tsx`, `BibliotecaSocialAdmin.tsx`

---

## 1. Objetivo

Manter a comunidade **saudável**: triagem de denúncias, remoção de reviews maliciosas, moderação do fórum, intervenção em chats reportados, e limpeza de biblioteca social (custom covers, highlights, screenshots).

## 2. Filosofia

Moderação é o que impede o MIDIAS de virar rede social tóxica. O admin **nunca lê chat sem denúncia** (privacidade), **nunca deleta silenciosamente** (transparência via `moderation_history`) e **sempre educa antes de punir** (aviso → mute → suspensão → ban).

## 3. Usuários-alvo

Exclusivo Moderador + Admin. Atendente vê status para responder ticket.

## 4. Estrutura visual

### Moderacao (hub central)
```text
KPIs (fila pendente, SLA médio, resolvidas hoje)
   ↓
Tabs: Denúncias | Reviews | Fórum | Chats reportados | Biblioteca social
   ↓
Fila priorizada (severidade × idade)
   ↓
Ação em massa (marcar como spam, arquivar)
```

### Fluxo de denúncia
```text
denuncia.status = pending
   ↓ (moderador abre)
Contexto: alvo + histórico + denunciante + evidências
   ↓
Ações: dismiss / warn / remove_content / mute_user / ban_temp / ban_perm
   ↓
moderation_history + notify user
   ↓ trigger unflag_conversa_on_resolve libera conversa quando não há mais pending
```

## 9. Regras de negócio

- Denúncia tem `severity` derivada do `reason` (assédio > spam > off-topic).
- Trigger `flag_conversa_on_report` marca conversa como `has_active_report=true` (visível ao admin).
- Trigger `unflag_conversa_on_resolve` limpa flag quando última denúncia daquela conversa é resolvida.
- Trigger `validate_message_and_ratelimit`: 30 msgs/60s → auto-ban 90 dias + notifica todos admins.
- Ban tem 4 níveis: warn (só notifica), mute (não pode postar), temp (`banned_until`), perm (`banned_until = 2099-01-01`).
- **Nunca deletar `denuncias`** — só `resolved_at + resolution`.
- Review removida → recalcula `produtos.rating` (trigger `recalculate_product_rating`).

## 12. Origem dos dados

- `denuncias` (10 col), `moderation_history`, `avaliacoes`, `forum_posts`, `forum_replies`, `mensagens`, `conversas`, `biblioteca_usuario`, `library_custom_covers`, `profile_highlights`, `game_screenshots`.

## 15. Ações admin específicas

**Denúncias:**
- Preview do conteúdo denunciado inline (sem sair da tela).
- Ver denúncias anteriores do mesmo alvo/denunciante (padrão de repetição).
- Merge de denúncias duplicadas (mesmo alvo).
- Encaminhar para superior (`escalated_to`).

**Reviews (`AvaliacoesUsuario`):**
- Aprovar/reprovar comentário. Review nota-only não precisa aprovação.
- Detectar review-bomb (>10 reviews 1-estrela em 24h num produto → alerta).

**Fórum:**
- Fixar tópico, trancar, mover categoria.
- Editar post com motivo público ("editado pela moderação: link removido").
- Dar highlight (mostra em `MForum` home).

**Mensagens/Chats:**
- Só abre com flag ativa (`has_active_report`).
- Ler contexto ±10 mensagens antes/depois da denunciada.
- **Todo acesso** grava em `admin_logs`.

**Biblioteca Social:**
- Remover custom cover ofensiva.
- Remover screenshot NSFW.
- Ban de highlight (usuário pode subir outro).

## 16. Casos extremos

- Denunciante bane-se → denúncia continua válida.
- Alvo deleta conta antes da resolução → soft-delete preserva histórico.
- Post editado após denúncia → mostrar diff.
- Denúncia contra admin → escalonar auto para outro admin (não pode auto-julgar).

## 20. Crítica

### 20.1 Bom
- Flag de conversa via triggers (`flag_conversa_on_report`/`unflag_conversa_on_resolve`) → moderação privada só quando necessário. Privacy by design.
- `moderation_history` append-only → auditoria.
- Auto-ban por flood no `validate_message_and_ratelimit`.

### 20.2 Ruim
- **Sem SLA visível por severidade** — assédio e off-topic tratados iguais. **P0**: colorir fila por prioridade.
- **Sem escalonamento automático** (denúncia parada há 48h → sobe pra admin). **P1**.
- **Auto-ban de flood não notifica admin no dashboard** (só cria notification para admin role — mas dashboard não lê essas). **P0**.
- **Sem "mute progressivo"** (1º mute 1h, 2º 24h, 3º 7d, 4º ban perm). Hoje moderador escolha na mão. **P1**.
- **Review-bomb não detectado**. **P0**: view `product_rating_velocity`.
- **Fórum sem categoria de "reportado"** — precisa ir em Denúncias e filtrar por target_type.

### 20.3 Dívida
- `denuncias.reason` é texto livre → sem taxonomia analytics quebra.
- `moderation_history.action` idem.
- Não há `moderator_notes` privadas na denúncia (só resolução final).

### 20.4 Não coberto
- **Fila de apelação** (usuário banido contesta) — não existe. **P1**.
- **Transparência pública**: relatório trimestral de moderação (moderação de plataformas grandes publica). **P2**.
