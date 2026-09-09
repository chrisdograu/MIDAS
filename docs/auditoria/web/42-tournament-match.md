# Web · Partida do Torneio (/torneios/:id/partida/:matchId)

## Propósito
Detalhe de match: eventos, reações, chat local.

## Achados P0
- `tournament_match_events` inserido client-side pelo moderador — sem validação server-side de ordem (goal antes de kickoff).
- Reações sem throttle.

