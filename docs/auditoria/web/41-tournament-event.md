# Web · Evento de Torneio (/torneios/:id)

## Propósito
Página do torneio: bracket, chat, storylines, hype meter.

## Achados P0
- **CinematicBracket** não virtualiza — >64 jogadores derruba FPS.
- 8+ hooks realtime sem cleanup consolidado — vazamentos ao trocar de torneio.
- Predictions/MVP-votes sem lock após fim do prazo (front-end apenas).

