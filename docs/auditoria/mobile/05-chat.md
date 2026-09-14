# Mobile · 05 · Chat & Grupos (`/m/chat`, `/m/chat/:id`, `/m/grupos*`, `/m/chat/:id/info`)

> Arquivos: `MChat.tsx`, `MChatThread.tsx`, `MChatInfo.tsx`, `MGroups.tsx`, `MGroupChat.tsx`, `MGroupNew.tsx`, `MGroupInfo.tsx`.

## 1. Objetivo
Mensageria 1:1 e grupos, integrada ao ecossistema. Não compete com WhatsApp em features; compete em **contexto**: cada conversa carrega âncora (anúncio, torneio, jogo) e reputação visível.

## 2. Filosofia
Chat não é feature isolada — é o **fim natural** de descoberta (marketplace, fórum, torneios). Toda mensagem tem um "porquê" rastreável (`conversas.anuncio_id`, `conversas.torneio_id`, etc.).

## 3. Usuários-alvo
Comprador↔vendedor (curta, transacional), amigos (livre, longa), grupos de torneio (temporário, alto volume), grupos de comunidade (permanente).

## 4. Estrutura visual
**Lista** (`/m/chat`): abas 1:1 | Grupos | Torneios · cards com último msg + unread badge.
**Thread** (`/m/chat/:id`): header (contraparte + âncora), bubbles, reações, input com anexos/gif.
**Info** (`/m/chat/:id/info`): perfis, silenciar, bloquear, arquivar, ver âncora, sair (grupo).
**Grupos** (`/m/grupos*`): lista, criar (nome, avatar, membros), chat, info (membros, admin, sair).

## 5. Componentes
- **MessageBubble** — texto/imagem/gif/system
- **ReactionsBar** — via `message_reactions`
- **GifPicker** (compartilhado) — Tenor API
- **AnchorHeader** — mostra o "porquê" da conversa
- **PollWidget** (grupos) — `group_polls` + `group_poll_votes`

## 9. Regras de negócio
- Mensagens: texto ≤ 4000, mídia ≤ 10MB
- Só editar em 5min pós-envio
- Deletar: soft delete (`deleted_at`), aparece como "mensagem apagada"
- Bloqueio bidirecional: chat congela, sem novas msgs, histórico preservado
- Grupo: máx 100 membros no free-tier (regra hipotética TCC), admin pode remover
- Silenciar não bloqueia — só some do bell
- Realtime obrigatório: Supabase channel por conversa

## 10. Estados
Vazio ("nenhuma conversa ainda, vá em Marketplace ou Fórum"), digitando ("X está digitando…" via broadcast), offline (fila local + reenviar ao voltar), msg falhou (reintentar), grupo removido (redirect + toast).

## 11. Permissões
Só participantes leem/enviam. Admin de grupo: convidar, remover, editar meta. Admin plataforma: **NUNCA** deveria ler DM (privacidade); pode ver metadados (existe conversa entre X e Y) via `MensagensAdmin.tsx` mas conteúdo requer denúncia explícita.

## 12-14. Dados
Tabelas: `conversas`, `mensagens`, `conversation_settings`, `message_reactions`, `groups`, `group_members`, `group_events`, `group_polls`, `group_poll_votes`, `group_blocks`, `blocked_users`.
Realtime: Supabase channel filtrado por `conversation_id`.

## 15. Painel admin (Desktop)
`MensagensAdmin.tsx`:
- Métricas globais (msgs/dia, conversas ativas, taxa de denúncia)
- Ver metadados de conversa (participantes, âncora, criada em) — **sem conteúdo por padrão**
- Ao receber denúncia com id de mensagem: liberar visualização do trecho denunciado + N mensagens ao redor para contexto
- Ferramenta de export para autoridade legal (com log de acesso obrigatório)
- Gestão de grupos: listar, ver membros, forçar arquivar spam
- **Faltando**: painel de "grupos suspeitos" (crescimento anômalo, muitas denúncias).

## 16. Casos extremos
- Msg enviada offline → fila local, reenviar; se conversa foi bloqueada nesse meio-tempo, descarta + avisa autor
- Grupo com criador banido → promover admin mais antigo automaticamente (não deixar orfão)
- Anexo grande em rede ruim → progresso + retry, não travar UI
- Reação a mensagem apagada → mostrar "reação a mensagem removida"
- Silenciamento + bloqueio simultâneo → bloqueio ganha

## 17. Justificativa UX
Abas 1:1 | Grupos | Torneios porque os 3 têm cadências diferentes (grupos de torneio explodem em horas de evento e depois somem). AnchorHeader porque "por que estou falando com essa pessoa" é a primeira pergunta ao reabrir conversa antiga.

## 18. Escalabilidade
Realtime custa. Com 10k usuários ativos simultâneos, canal por conversa é fino. Com 100k: migrar para presence + fan-out server-side (edge function). Índice em `mensagens(conversation_id, created_at DESC)` obrigatório.

## 19. Melhorias futuras
- Reply-quote (citar msg específica)
- Voice messages (Capacitor recorder)
- Encriptação E2E opcional para 1:1 (Signal-like) — vai contra painel admin, precisa política clara
- Tradução automática (IA gateway) para chats de torneio internacional
- Sticker packs próprios do MIDIAS (cosméticos desbloqueáveis)

## 20. Crítica
**Bom**: âncoras contextuais, realtime funcional, integração com `blocked_users`.
**Ruim**:
- **P0**: MChat lista faz N+1 (pra cada conversa busca última msg separada). Usar view `chat_list_view` com `LATERAL JOIN`.
- **P0**: contagem de unread global no `MobileLayout` faz count query a cada mount + realtime — cachear em `conversation_settings.unread_count` denormalizado, atualizar via trigger.
- **P0**: `MensagensAdmin` hoje permite ver conteúdo sem denúncia — **violação de privacidade**. Restringir por padrão + audit log obrigatório em cada leitura.
- **P1**: sem indicador "entregue/lido" claro (só is_read boolean). Adicionar `delivered_at` + `read_at`.
- **P1**: GIF picker sem histórico de usados recentemente.

**Dívida técnica**: `mensagens` tem 16 colunas — algumas legadas (verificar `imagem_url` vs anexo estruturado). Refatorar para `message_attachments` tabela separada.

**Ângulos não cobertos**: LGPD retenção (nunca deletar msgs de anúncios encerrados? política?), custo Supabase realtime em escala (medir), notificações push com preview do texto (opt-out por conversa).
