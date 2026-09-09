# Web · Checkout Sucesso (/checkout/sucesso)

## Propósito
Confirmação pós-pedido: resumo, tempo estimado, próximos passos.

## Achados P0
- Depende de `state` do react-router — refresh perde o pedido. Ler de `pedidos?id=` da query string.
- Não dispara email de confirmação (só notification in-app).

