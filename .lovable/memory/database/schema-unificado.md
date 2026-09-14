---
name: DB Unified Schema
description: Schema alinhado entre Web/Desktop (React) e Mobile (Capacitor), com blocked_users, notification prefs, plataformas
type: feature
---
O banco de dados Supabase é compartilhado entre as 3 plataformas (Web, Desktop, Mobile (Capacitor)).

Alinhamentos feitos:
- Tabela `blocked_users` criada (blocker_id, blocked_id) com RLS
- `profiles` ganhou `push_notifications` (default true) e `email_notifications` (default false)
- `anuncios` ganhou `plataformas` (text[]) e `user_id` (uuid nullable)
- `anuncios.game_title` e `anuncios.platform` tornados nullable
- `certificados.product_id` tornado nullable (mobile não usa)
