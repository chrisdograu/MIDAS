# Web · Grupo de Torneio (/torneios/:id/grupo)

## Propósito
Chat privado do time no torneio.

## Achados P0
- Compartilha lógica com `MTournamentGroup` mas duplica queries — extrair hook comum.
- Admin bypass de leitura não é logado em `admin_logs` (privacy issue).

