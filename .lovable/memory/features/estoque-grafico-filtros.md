---
name: Gráfico de estoque com filtros de período
description: Gráfico de barras (entradas vs saídas) na página de Estoque do Desktop com filtros de 7, 30 e 90 dias
type: feature
---
A página Estoque.tsx possui um gráfico Recharts (BarChart) com entradas (primary) e saídas (destructive).
Botões 7d/30d/90d alternam o período exibido via estado `chartDays`.
O query busca até 500 movimentações para suportar o período de 90 dias.
