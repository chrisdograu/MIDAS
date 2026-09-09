# Mobile · Review de Produto (/m/review/:productId)

## Propósito
Nota estrelas (0.5-5.0) — sem texto por decisão de escopo web/mobile.

## Achados P0
- Não valida se usuário possui o jogo (`biblioteca_usuario`) antes de permitir avaliar — abre porta para review-bombing.
- Update de média em `produtos.rating` deveria ser via trigger, não client.

