# Project Memory

## Core
- **Language & Styling**: Strictly PT-BR (UI, emails). Dark mode default. Brand "MIDIAS": Teal (#14B8A6) & Purple (#A855F7), Orbitron/Inter fonts.
- **Platform Scope**: Web = E-commerce/Library; Mobile (Capacitor) = Community/C2C Marketplace; Desktop Electron = Backoffice/Admin. Single Supabase DB for all 3.
- **Academic Context (TCC)**: Simulated checkout (Pix 5% off, CC installments), no real payments. 100% online, no POS.
- **Tech Stack**: React (Vite+TS), Tailwind, Supabase (Postgres, RLS, Edge Functions, Auth, Storage).
- **Design Parity**: Web Auth design MUST strictly match Mobile PWA (icons in fields, emojis, Teal/Purple).

## Memories
- [Aesthetic & Styling](mem://style/estetica) — Dark gamer aesthetic, neon, glassmorphism, Framer Motion
- [Visual Identity](mem://style/identidade-visual) — "MIDIAS" brand, logo details, Teal/Purple palette
- [Typography](mem://style/tipografia) — Orbitron for titles, Inter for body
- [Themes](mem://style/temas) — Light/Dark via ThemeProvider, dark default via localStorage
- [Mobile Layout](mem://style/layout-mobile) — Bottom nav for community features, responsive PWA
- [Estados vazios, status de pedido e glow](mem://style/estados-vazios-e-glow) — EstadoVazio em listas buscadas, orderStatusTone único, glow no modo economia
- [Auth Design Parity](mem://style/auth-design-parity) — Strict visual match between Web and Mobile Auth screens

- [App Architecture Stack](mem://tecnologia/stack) — React, Tailwind, Supabase JWT/RLS/Edge Functions
- [Mobile PWA](mem://tecnologia/mobile-pwa) — Vite-plugin-pwa setup for the mobile version
- [Desktop Electron](mem://tecnologia/desktop-electron) — Backoffice packaged as an Electron desktop app
- [Storage Buckets](mem://tecnologia/storage) — 'product-images', 'ad-images', 'avatars' with public view/restricted upload

- [TCC Context](mem://projeto/contexto-tcc) — Academic requirements: Postgres, JWT, API serverless
- [Language Restrictions](mem://projeto/idioma) — PT-BR exclusively across all systems
- [Platform Scope](mem://projeto/escopo) — Division of modules between Web, Mobile App, and Desktop
- [Strictly Online Scope](mem://projeto/escopo-online-estrito) — 100% digital e-commerce, no physical POS
- [Mobile is Capacitor](mem://projeto/mobile-flutter) — Mobile app built in React empacotado com Capacitor, shares same Supabase DB

- [Auth & Roles](mem://auth/fluxo-e-rbac) — Supabase RBAC, sensitive data validation, profile auto-creation
- [Desktop RBAC](mem://auth/desktop-rbac) — 6 admin roles with dynamic sidebar/route permissions

- [Database Schema Details](mem://database/schema-v2-detalhes) — 'employee_position' enum, expanded profiles, triggers
- [Forum & Chat Tables](mem://database/forum-chat-tables) — 'forum_posts', 'forum_replies', 'conversas' with RLS policies
- [DB Unified Schema](mem://database/schema-unificado) — blocked_users, push/email notifications on profiles, plataformas on anuncios
- [Site Settings](mem://database/site-settings) — Singleton chave/valor JSONB para configurações globais persistentes

- [E-commerce Engine](mem://funcionalidades/ecommerce) — Real-time stock via Supabase triggers, empty stock handling
- [Simulated Checkout](mem://funcionalidades/checkout-simulado) — Pix (5% off) and Credit Card installments logic
- [Marketplace C2C](mem://funcionalidades/marketplace) — Mobile-exclusive module for ads, chat, and trades

- [User Profile](mem://features/perfil-usuario) — Profile with avatar upload, CPF, phone, username, bio
- [Public Profile](mem://features/perfil-publico) — Photo, bio, reputation, and mobile library for C2C trust
- [Web Library](mem://features/biblioteca-web) — Linked to purchases, played/want-to-play status, no social features
- [Star Reviews System](mem://features/reviews-estrelas) — Web reviews restricted to 0.5-5.0 average only, no text/comments
- [Review Technical Details](mem://features/reviews-detalhes-tecnicos) — numeric(2,1) DB type and HalfStarRating component
- [Admin Desktop Features](mem://features/backoffice-desktop) — 17 CRUD screens including Cupons for commercial and community management
- [Desktop Settings](mem://features/desktop-settings-admin) — Account management and global store controls for admins
- [Staff Management](mem://features/gestao-funcionarios) — CRUD for employees via Edge Function 'manage-employee'
- [Online Suppliers](mem://features/fornecedores-online) — Supplier control aligned with 100% online operation
- [Protection Certificates](mem://features/certificados-protecao) — Store guarantees for C2C trades, managed via Admin
- [Notification System](mem://features/notifications-system) — 'notifications', 'device_tokens' for push, and trigger events
- [Stock Tracking](mem://features/stock-tracking) — 'movimentacoes_estoque' auto-audit logs
- [Discount Coupons](mem://features/cupons-desconto) — System using 'cupon_usos' for limits and valid periods, CRUD in desktop
- [Game Rankings](mem://features/ranking-jogos) — Mobile leaderboard using average scores and library data
- [Checkout Success](mem://features/checkout-sucesso) — Post-purchase success page with order ID and library info
- [Moderação e Banimento](mem://features/moderacao-banimento) — banned_until + is_user_banned() bloqueia ações sensíveis via RLS
- [Banner banimento global](mem://features/banimento-header-global) — Barra vermelha no Header quando conta suspensa
- [Estoque gráfico com filtros](mem://features/estoque-grafico-filtros) — Gráfico entradas vs saídas com filtros 7/30/90 dias
- [Seed de dados de teste](mem://features/seed-de-testes) — Edge function seed-test-users + botão admin em /desktop/configuracoes
- [Badges menu Desktop](mem://features/desktop-badges-pendencias) — Contagens em tempo real de denúncias/certificados/pedidos/propostas pendentes
- [Alertas em tempo real Desktop](mem://features/desktop-realtime-alerts) — Toasts (sonner) para inserts em denuncias/pedidos/certificados/propostas, filtrados por cargo
- [Trigger banned_until](mem://features/banned-until-trigger) — Só admin pode alterar status de banimento via SQL
- [Relatórios PDF](mem://features/relatorios-pdf) — Exportação PDF com jsPDF/autotable em /desktop/relatorios
- [Guia de Testes](GUIA_DE_TESTES.md) — Documento na raiz com contas, fluxos QA e limitações conhecidas
