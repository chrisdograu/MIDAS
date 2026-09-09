# Mobile · 07 · Favoritos, Amigos, Review, Notificações (`/m/favoritos`, `/m/amigos`, `/m/review/:productId`)

> Arquivos: `MFavoritos.tsx`, `MFriends.tsx`, `MReview.tsx`. Notificações via `NotificationBell` (componente compartilhado no `MobileLayout`).

## 1. Objetivo
Camadas de **retenção**: favoritos (voltar depois), amigos (voltar por rede), notificações (voltar por push), reviews (deixar rastro social).

## 2. Filosofia
Mobile ganha usuários por descoberta, retém por relacionamento. Sem grafo social forte, MHome vira só feed genérico. Favoritos + amigos são a base do "algoritmo pra você" futuro.

## 3. Usuários-alvo
Colecionador (favorita muito), social (foca amigos), reviewer (opinião pública), notificado (chega via push).

## 4. Estrutura visual
**Favoritos**: tabs "Jogos" (produtos loja) | "Anúncios" (C2C) — lista + remover swipe.
**Amigos**: tabs "Amigos" | "Pedidos" | "Bloqueados" (link) · search · sugestões.
**Review**: tela dedicada a avaliar produto — half-star rating (memória `reviews-estrelas` — apenas nota, sem texto na Web; mobile aqui **pode** ter comentário? — confirmar). Este arquivo assume mesma regra: 0.5-5.0 sem texto.
**Notificações**: painel do bell (não rota separada) com lista + mark all read + link contextual.

## 5. Componentes
- **HalfStarRating** (compartilhado)
- **NotificationBell** (compartilhado)
- **CosmeticUnlocksCenter** (aparece no header)

## 9. Regras de negócio
- Favorito de anúncio removido → mantém entrada marcada como "removido" (não sumir → confusão)
- Amigo bloqueado → sai da lista + fica em Bloqueados
- Follow requests: se perfil é privado, requer aceite (`follow_requests`)
- Close friends: subset (`close_friends`) para timeline restrita
- Review: exige `biblioteca_usuario` ownership (P0 da fase A — vale aqui)
- Notificação lida → `notifications.read_at` set + realtime update badge

## 10. Estados
Favoritos vazio ("nada aqui — favorite jogos e anúncios"), amigos vazio ("adicione o primeiro amigo"), pedido pendente > 30d (arquivar auto), review de item que voltou stock (habilita), sem push permission (banner "ative notificações").

## 11. Permissões
Só dono vê próprios favoritos e amigos. Reviews públicas. Notificações estritamente pessoais (RLS `user_id = auth.uid()`).

## 12-14. Dados
Tabelas: `favoritos`, `favoritos_anuncio`, `user_follows`, `follow_requests`, `close_friends`, `blocked_users`, `avaliacoes`, `notifications`, `device_tokens`, `notification_preferences`.
Hooks: `useFavoritos`, `useFavoritoAnuncio`, `useFollow` (mobile).

## 15. Painel admin (Desktop)
- `NotificacoesAdmin.tsx` + `NotificacoesEspeciais.tsx`: broadcast + templates + preview device
- `AvaliacoesUsuario.tsx`: moderar reviews suspeitas (review-bomb)
- **Faltando**: painel de "grafo social" (top influenciadores, clusters de amigos) para insights e detecção de fake-network.

## 16. Casos extremos
- Push chega mas usuário desinstalou → token inválido, marcar `device_tokens.invalid_at` e não retentar
- Review de produto que virou bundle → migrar avaliação para o bundle? decidir política
- 2 usuários se seguem mutuamente + um bloqueia → destruir os 2 follows
- Notificação de amigo que se deletou → renderizar como "usuário removido interagiu com você"

## 17. Justificativa UX
Swipe-to-remove em favoritos porque é ação frequente e mobile-nativo. Search em amigos aparece só quando > 20 (evita clutter). Notificações não têm rota dedicada — panel drawer > página, porque é ação-em-contexto.

## 18. Escalabilidade
`notifications` cresce rápido. Retenção: soft-delete > 90d, hard-delete > 180d via cron edge function. Push: agrupar (max 1 push/user/hora exceto DM direto) — hoje sem agrupamento (**P0**).

## 19. Melhorias futuras
- Favorito compartilhável (link "meu wishlist")
- Sugestão de amigos por jogos em comum
- Review em vídeo (Capacitor + storage)
- Rich push notifications com ação inline (aceitar amizade sem abrir app)

## 20. Crítica
**Bom**: separação clara favorito-loja vs favorito-C2C, HalfStarRating consistente cross-platform, bell realtime.
**Ruim**:
- **P0**: sem throttle de push → risco de spam ao usuário. Edge function agrupadora.
- **P0**: MFriends não pagina — com 500 amigos, lista trava.
- **P0**: review sem ownership check → review-bomb possível.
- **P1**: MFavoritos separa em 2 tabs, mas UX melhor seria segmento único com filtro (mudança pequena, ganho de discoverability).

**Dívida técnica**: `notification_preferences` (20 colunas) já apontado como P0 anteriormente. `avaliacoes` sem trigger que recalcula `produtos.rating_avg` — hoje é view? confirmar; se for count() on-the-fly, denormalizar.

**Ângulos não cobertos**: iOS push (Web Push funciona no Safari 16.4+ mas exige PWA instalado — comunicar), consent LGPD para push, custo de tokens FCM em escala, dead-letter queue de push falhados.
