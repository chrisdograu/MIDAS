# Apêndice C · ERD completo (agrupado por domínio)

## Domínio · Identidade & Auth
- `auth.users` (Supabase)
- `profiles` (1:1 users) — display_name, avatar_url, banned_until, push/email prefs
- `user_roles` (N:1 users) — role enum, position enum
- `user_titles` (N:1 users) — cosmético
- `user_badges` → `badge_catalog`
- `user_cosmetic_loadout`, `user_game_page_loadout`
- `notification_preferences` (1:1 profile)
- `privacy_grants` (grantor→grantee)
- `blocked_users` (blocker→blocked)

## Domínio · Catálogo
- `produtos` ⇄ `produto_imagens`
- `games_catalog` (mestre canônico)
- `categorias`
- `bundles` ⇄ `bundle_items` → `produtos`
- `price_history` (N:1 produtos)
- `cupons` ⇄ `cupon_usos`
- `flash_promotions`

## Domínio · Comércio
- `pedidos` ⇄ `itens_pedido` → `produtos`
- `movimentacoes_estoque` (N:1 produtos, opcional N:1 pedido)
- `certificados` (troca C2C)
- `fornecedores`
- `biblioteca_usuario` (user × produto)
- `library_custom_covers`, `user_playtime`

## Domínio · Marketplace C2C
- `anuncios` (user_id, plataformas[])
- `fotos_anuncio`
- `favoritos_anuncio`
- `trade_proposals`
- `avaliacoes_usuario` (user-to-user)
- `seller_profiles`

## Domínio · Social & Fórum
- `user_follows`, `follow_requests`, `close_friends`
- `forum_categories` ⇄ `forum_posts` ⇄ `forum_replies`
- `forum_post_likes`, `forum_reply_likes`
- `game_opinions` ⇄ `game_opinion_replies`, `game_opinion_likes`, `opinion_conversations`, `opinion_mutes`
- `game_screenshots`, `game_screenshot_likes`
- `game_clips`
- `game_timeline_events`
- `reviews_completas` ⇄ `review_screenshots`, `review_comments`, `review_likes`, `review_metadata`, `review_completa_visibility`
- `avaliacoes` (estrelas produto)
- `favoritos`, `social_favorites`, `friend_favorites`
- `profile_highlights`
- `friend_activity_states`, `social_content_states`
- `user_game_mutes`

## Domínio · Chat
- `conversas` ⇄ `mensagens` ⇄ `message_reactions`
- `conversation_settings`
- `mentions`
- `groups` ⇄ `group_members`, `group_blocks`, `group_events`, `group_polls` ⇄ `group_poll_votes`

## Domínio · Torneios
- `tournaments` ⇄ `tournament_participants`, `tournament_waitlist`, `tournament_confirmations`, `tournament_bans`, `tournament_moderators`
- `tournament_matches` ⇄ `tournament_match_events`, `tournament_reactions`
- `tournament_chat_messages`, `tournament_chat_mutes`
- `tournament_predictions`, `tournament_mvp_votes`
- `tournament_storylines`, `tournament_highlights`, `tournament_duplicate_alerts`, `tournament_reminder_log`

## Domínio · Gamificação
- `user_xp_log` → `xp_levels`
- `user_achievements`
- `game_rewards` ⇄ `user_game_rewards`

## Domínio · Comunicação & Suporte
- `notifications`
- `device_tokens`
- `tickets` ⇄ `ticket_messages`
- `game_suggestions`
- `denuncias`
- `moderation_history`
- `admin_logs`

## Domínio · Plataforma
- `site_settings`
- `integration_webhooks`
- `connected_platforms` (Steam/PSN/Xbox linking)
- `daily_pick_overrides`
- `tutorials_seen`
- `product_views`

## Notas
Diagrama visual (Mermaid ER) pode ser gerado depois por domínio. Estrutura acima cobre 110+ tabelas listadas em `<supabase-tables>`.

