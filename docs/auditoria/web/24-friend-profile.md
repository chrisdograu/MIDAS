# Web · Perfil de Amigo (/amigo/:userId)

## Propósito
Variante enriquecida do perfil público quando há relação de amizade (feed, jogos em comum, chat).

## Achados P0
- Verifica amizade client-side (`user_follows`); um usuário removido continua vendo dados privados até refresh. RLS deve ser a fonte da verdade.
- Rota separada de `/perfil/:userId` duplica lógica — considerar unificar e alternar layout via flag.

## P1
- Falta indicador 'online agora' com presence.

