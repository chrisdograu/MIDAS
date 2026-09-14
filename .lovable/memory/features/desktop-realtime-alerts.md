---
name: Desktop Realtime Alerts
description: Hook useDesktopRealtimeAlerts dispara toasts (sonner) para inserts em denuncias, pedidos, certificados e trade_proposals; filtra por cargo via canAccess e ignora rows anteriores ao mountedAt
type: feature
---
Hook em src/hooks/useDesktopRealtimeAlerts.ts plugado em DesktopLayout.
- Subscribe único em canal Supabase Realtime.
- Filtra eventos por cargo (canAccess do useDesktopAuth): moderacao→denuncias, pedidos→pedidos, certificados→certificados, propostas→trade_proposals.
- mountedAtRef previne spam de eventos antigos no replay (tolerância de 2s).
- Toast com botão "Ver" navega para a página correspondente.
- Duração 8s. Sem som (pode ser adicionado via site_settings.notification_prefs.sound).
