# Backoffice — Torneios & Eventos

> **Rotas:** `/desktop/torneios`, `/desktop/torneios/atuais`, `/desktop/torneios/eventos`, `/desktop/torneios/novo`
> **Arquivos:** `Torneios.tsx`, `TorneiosAtuais.tsx`, `TorneiosEventos.tsx`, `CriarTorneio.tsx`

---

## 1. Objetivo

Operar competições ao vivo: criar torneio, gerenciar chaveamento cinematográfico, moderar chat, distribuir prêmios (XP, badges, títulos exclusivos).

## 2. Filosofia

Torneio é o **momento épico** do MIDIAS — onde a comunidade se junta em tempo real. O admin não é só "operador da chave", é **narrador**: precisa ver rivalidades, streaks, MVPs e conseguir amplificar o hype (highlights, storylines automáticas).

## 3. Usuários-alvo

| Perfil | Ações |
| --- | --- |
| Admin | tudo |
| Gerente | criar, aprovar, distribuir prêmios |
| Moderador | banir de chat, silenciar (`tournament_chat_mutes`), remover posts |
| Creator (usuário) | criar torneio próprio (tornado moderador automaticamente por `tournament_register_creator_mod`) |

## 4. Estrutura visual

### Torneios (hub)
```text
Tabs: Ativos | Agendados | Encerrados | Rascunhos
   ↓
Card com bracket mini, participantes X/Y, hype meter
   ↓
Ações: entrar no modo live / editar / cancelar
```

### CriarTorneio (wizard)
```text
1. Identidade (título, jogo, formato: single/double/round-robin)
2. Regras (max_participants, sem/com waitlist, chat_role default)
3. Prêmios (xp_signup/match/champion — auto via calc_tournament_xp, title custom, badge)
4. Cronograma (inicio, checkin_window, matches)
5. Moderadores (adiciona a tournament_moderators)
6. Preview + publish
```

### Modo Live
```text
Bracket (CinematicBracket)
   ↓
Painel matches em andamento (score, timer, mod actions)
   ↓
Chat ao vivo (LiveTournamentChat)
   ↓
Storylines (StorylinesPanel) — geradas por trigger generate_match_storylines
   ↓
MVP vote, predictions, highlights
```

## 9. Regras de negócio

- XP calculado por `calc_tournament_xp(max_participants)` — 5 faixas (8/16/32/64/>64).
- `set_tournament_xp` (BEFORE INSERT/UPDATE) preenche `xp_signup/match_win/champion`.
- `award_tournament_rewards(_tournament_id)`: só admin, roda uma vez (`rewards_distributed=true`).
  - Rank 1: 100% xp_champion + prize_xp_bonus + badge tourn_gold + user_title
  - Rank 2: 60% + tourn_silver
  - Rank 3: 35% + tourn_bronze
- `prevent_banned_signup`: `tournament_bans` bloqueia inscrição.
- `remove_on_ban`: banimento retira participante ativo.
- `check_tournament_chat_role`: observer não fala.
- `check_tournament_mute`: `tournament_chat_mutes` bloqueia mensagem.
- Waitlist promove via `notify_promoted_to_participant` quando vaga abre.
- Storylines: `generate_match_storylines` detecta rivalry (mesmos jogadores) e streak (3+ vitórias no torneio).

## 12. Origem dos dados

- `tournaments` (42 col!), `tournament_participants`, `tournament_matches`, `tournament_moderators`, `tournament_bans`, `tournament_waitlist`, `tournament_confirmations`, `tournament_chat_messages`, `tournament_chat_mutes`, `tournament_storylines`, `tournament_highlights`, `tournament_mvp_votes`, `tournament_predictions`, `tournament_reactions`, `tournament_reminder_log`, `tournament_duplicate_alerts`, `tournament_match_events`.

## 15. Ações admin

- **Iniciar torneio**: fecha inscrições, gera chave (Round 1), notifica todos.
- **Editar match**: setar `winner_id`, `score_a`, `score_b`, `ended_at`. Se avança para próximo round, criar match seguinte com winners.
- **Recuperar match**: undo do vencedor (com log).
- **Distribuir prêmios**: botão único → chama `award_tournament_rewards`. Idempotente.
- **Marcar highlight**: `tournament_highlights` (clip URL, jogadores, momento).
- **Cancelar torneio**: com motivo → refund XP de signup, notifica.
- **Duplicar torneio**: base para nova edição (semanal/mensal).

## 16. Casos extremos

- Participante desiste no meio (bye/forfeit). `tournament_participants.status='dropped'`. Match adversário recebe walkover.
- No-show no check-in → auto-promover waitlist.
- Empate em match sem regra de desempate → admin decide manualmente + log.
- Torneio 128 pessoas → `CinematicBracket` precisa virtualizar. Hoje renderiza tudo. **P0** mobile parity.
- Duplicate account (mesma pessoa em duas contas) → `tournament_duplicate_alerts` sinaliza; admin bane.

## 20. Crítica

### 20.1 Bom
- **XP dinâmico por tamanho** — não trivializa torneio pequeno nem infla o grande.
- **Storylines automáticas via trigger** — narrativa emerge sem trabalho manual.
- **award_tournament_rewards idempotente** com `rewards_distributed` flag.
- **Creator → moderador automático** (`tournament_register_creator_mod`) — reduz atrito.

### 20.2 Ruim
- **`tournaments` com 42 colunas** — sinal de excesso de responsabilidade. **P1**: extrair `tournament_settings`, `tournament_prizes` como JSONs ou tabelas.
- **Bracket sem virtualização** para >64 participantes. **P0**.
- **Sem "modo live" separado** — hoje admin usa mesma UI que espectador. **P1**: página `/desktop/torneios/:id/live` com controles.
- **Duplicate detection** existe (tabela) mas não há regra automática (IP, device_id, similaridade de perfil). **P1**.
- **Prêmios só XP/badge/título** — sem cupom/desconto de loja. **P2**: `prize_coupon_id`.
- **Sem replay de bracket** (ver evolução histórica) — só estado final. **P2**.

### 20.3 Dívida
- `tournament_chat_messages` sem paginação; carrega todas.
- MVP voting sem anti-fraude (mesma pessoa vota várias vezes se limpar localStorage? verificar RLS).
- `tournament_match_events` sem índice `(tournament_id, created_at desc)`.

### 20.4 Não coberto
- **Integração com streaming** (Twitch embed no bracket).
- **Regras customizadas por jogo** (best-of-5 para FGC, tempo em tabuleiro para xadrez).
- **Estatísticas post-mortem**: heatmap de horários mais vistos, retenção de espectadores.
