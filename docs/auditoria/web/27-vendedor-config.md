# Web · Config do Vendedor (/vendedor)

## Propósito
Painel do vendedor logado (pedidos recebidos, estoque próprio, avaliações).

## Achados P0
- Route reusa componente entre web e mobile (`/m/vendedor`) sem responsive audit — sidebar quebra <768px.
- Não valida se `user_roles` inclui `seller` antes de renderizar.

## P1
- Falta gráfico de vendas por período.

