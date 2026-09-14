# Web · Hub Social do Jogo (/jogo/:id/social)

## Propósito
Agregador social por jogo: reviews, opiniões, screenshots, clips, timeline.

## Achados P0
- Faz 6+ queries em paralelo no mount. Consolidar em RPC `game_social_bundle(product_id)`.
- Sem paginação em opinions/screenshots — usuários com muito conteúdo travam a página.

## P1
- Falta filtro por tipo (só reviews, só clips).

