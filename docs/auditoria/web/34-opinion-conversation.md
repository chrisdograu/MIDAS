# Web · Thread de Opinião (/perfil/.../conversa/:convId)

## Propósito
Thread encadeada de replies em opinião de jogo.

## Achados P0
- Rota extensa e frágil (5 params). Considerar `/opiniao/:convId` com resolve server-side.
- Sem realtime — replies novos só aparecem em reload.

