---
name: Badges de pendências no menu Desktop
description: Hook useDesktopPending alimenta badges vermelhos no menu lateral mostrando contagens em tempo real
type: feature
---
O hook `useDesktopPending` (em `src/hooks/useDesktopPending.ts`) consulta as pendências em tempo real e expõe contagens para o `DesktopLayout`:
- **Pedidos Online** → `pedidos.status = 'pending'`
- **Propostas de Troca** → `trade_proposals.status = 'pending'`
- **Moderação** → `denuncias.status = 'pending'`
- **Certificados** → `certificados.status = 'pendente'`

Atualização automática via Supabase Realtime (subscrição em postgres_changes) + fallback de refetch a cada 60s.
Cada item de menu tem um campo opcional `pendingKey` que mapeia para a contagem; quando > 0 renderiza um Badge `destructive` (vermelho). No modo colapsado, aparece um pequeno círculo no canto superior direito do ícone.
