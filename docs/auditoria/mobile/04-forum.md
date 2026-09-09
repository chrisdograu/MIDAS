# Mobile · 04 · Fórum (`/m/forum`, `/m/forum/:gameId`, `/m/forum/post/:postId`, `/m/forum-comunidade`)

> Arquivos: `MForum.tsx`, `MForumGame.tsx`, `MForumPost.tsx`, `MForumComunidade.tsx`.

## 1. Objetivo
Espaço textual de discussão organizado **por jogo** (não por tópico solto). Cada jogo do catálogo tem seu subfórum. Existe também um fórum "comunidade" transversal (off-topic, meta).

## 2. Filosofia
Reddit dividido por jogo. O jogo é a unidade de comunidade — fãs de Elden Ring não deveriam ser diluídos com fãs de FIFA. Threading raso (post → replies planas) porque mobile não comporta árvore profunda; discussões complexas migram para chat de grupo.

## 3. Usuários-alvo
Lurker (só lê, 80%), participante (curte + comenta ocasional), autor recorrente (cria posts + guias), moderador de subfórum (permissão futura), admin.

## 4. Estrutura visual
**Índice** (`/m/forum`): grid de jogos com contador de posts ativos + chip "comunidade geral".
**Subfórum jogo** (`/m/forum/:gameId`): header do jogo + tabs (Recentes | Populares | Guias | Bugs) + lista de posts + FAB "novo post".
**Post** (`/m/forum/post/:postId`): post original + replies planas ordenadas + input rápido no rodapé + SpoilerGuard onde marcado.
**Comunidade** (`/m/forum-comunidade`): posts sem jogo, categorizados via `forum_categories`.

## 5. Componentes
- **PostCard** — título + snippet + likes + replies + spoiler mask
- **ReplyItem** — plana, com like + reply-quote
- **SpoilerGuard** (compartilhado) — reblur até tap explícito
- **MentionText** (`src/mobile/components/MentionText.tsx`) — parse @user
- **MentionCard** — preview ao tocar mention

## 9. Regras de negócio
- Post: título 5-120, corpo 10-10000
- Reply: 1-2000
- 1 like por usuário por post/reply
- Post pode ser marcado `has_spoiler` pelo autor (SpoilerComposerControls); admin pode marcar depois
- Trancar tópico: só admin/mod
- Mention notifica destinatário (`mentions` table + `notifications`)
- Bloqueio: replies de usuários bloqueados renderizam como "conteúdo oculto (bloqueado)"

## 10. Estados
- Subfórum vazio: "seja o primeiro a postar sobre X" com CTA
- Post deletado: "post removido pelo autor" (não sumir para não quebrar links)
- Trancado: badge + input desabilitado com texto explicativo
- Sem conexão: cache do último fetch + banner offline

## 11. Permissões
Visitante: ler tudo público. Logado: postar, curtir, comentar. Autor: editar em janela de 15min, deletar sempre. Mod (futuro): trancar, fixar, mover categoria. Admin: tudo + banir usuário.

## 12-14. Dados
Tabelas: `forum_posts`, `forum_replies`, `forum_post_likes`, `forum_reply_likes`, `forum_categories`, `mentions`.
Sem hooks centralizados — cada tela consulta direto. **P1**: `useForumSubforum(gameId)` com realtime opcional.

## 15. Painel admin (Desktop)
`ForumAdmin.tsx`:
- Feed cross-jogo de posts recentes com filtros (denunciados, com spoiler, novos autores)
- Ações inline: trancar, remover, marcar spoiler, banir autor
- Métricas: posts/dia por jogo, top autores, taxa de spoiler correta vs corrigida
- Gestão de `forum_categories` (comunidade geral)
- **Faltando**: fila de moderação priorizada por denúncias abertas (existe em `Denuncias.tsx` mas separada — unificar).

## 16. Casos extremos
- Jogo removido do catálogo mas com fórum ativo → congelar (readonly) + banner "jogo removido, discussões preservadas"
- Post com 5k replies → paginar em lotes de 50 + jump-to-last
- Autor deletou conta → nome vira "usuário removido" + avatar cinza; conteúdo permanece se admin quiser
- Mention a usuário inexistente → renderiza texto puro, sem link
- Spoiler mal categorizado → botão "denunciar como spoiler" que notifica mod

## 17. Justificativa UX
Fórum-por-jogo (não por categoria global) mantém sinal alto. Replies planas > threading porque mobile não tem espaço horizontal. FAB de novo post porque é ação primária. SpoilerGuard obrigatório para post-launch de AAA (proteger quem ainda não jogou é diferencial do MIDIAS).

## 18. Escalabilidade
Com 100k posts: índice em `(game_id, created_at DESC)` para "recentes" e `(game_id, likes_count DESC)` para "populares" — hoje sem `likes_count` denormalizado (soma em join, custa caro). **P0**: adicionar coluna denormalizada + trigger em `forum_post_likes`.

## 19. Melhorias futuras
- Guias fixados por moderadores (tipo wiki)
- Editor Markdown leve com preview
- Reação múltipla (👍😂🔥) além do like binário
- IA que sugere tag/categoria do post automaticamente
- Cross-post entre fórum do jogo e fórum-comunidade

## 20. Crítica
**Bom**: separação por jogo, spoiler-guard, mentions com card preview.
**Ruim**:
- **P0**: `likes_count` calculado por count() a cada load — denormalizar.
- **P0**: sem paginação em posts com muitas replies.
- **P0**: MForumPost carrega post + replies + likes do usuário em queries separadas sequenciais — paralelizar.
- **P1**: sem edit history — se autor edita, some o original. Guardar `edited_at` + diff opcional.
- **P1**: MForumComunidade duplica muita lógica de MForumGame — extrair componente `SubforumView`.

**Dívida técnica**: sem `forum_post_reports` — denúncias vão pra `denuncias` genérica sem tipo específico, dificulta moderação em massa.

**Ângulos não cobertos**: acessibilidade (SpoilerGuard precisa `aria-hidden` alternando + anúncio pra leitor de tela), moderação proativa (filtro de palavrão/hate speech client-side antes de submit), gamificação (XP por reply útil marcada como "solução").
