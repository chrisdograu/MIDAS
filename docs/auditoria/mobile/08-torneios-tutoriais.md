# Mobile · 08 · Torneios (grupo mobile) & Tutoriais (`/m/torneios/:id/grupo`, `/m/tutoriais`, `/m/tutorial/:key`)

> Arquivos: `MTournamentGroup.tsx`, `MTutoriais.tsx`, `MTutorial.tsx`.

## 1. Objetivo
Duas superfícies distintas mas ambas "acessórias" ao core mobile:
- **Torneio-grupo mobile**: chat + info do grupo específico de um torneio em que o usuário está inscrito. É a versão mobile-first da experiência competitiva descrita em Web/08-torneios.
- **Tutoriais**: onboarding contextual (memória `TutorialContext`) + página lista + player de tutorial individual.

## 2. Filosofia
**Torneios mobile** = "estou no ônibus, meu match é em 20min, preciso saber o que fazer" — não é lugar de criar torneio (isso é Web/Desktop), é lugar de **participar em movimento**.
**Tutoriais** = respeitar tempo do usuário. Nunca bloquear tela cheia sem opção de pular. Mostrar apenas o que aquele usuário ainda não viu (`tutorials_seen`).

## 3. Usuários-alvo
Torneio: participante ativo (foco), moderador de torneio (`tournament_moderators`), spectator (só assiste chat).
Tutorial: novo usuário (auto-trigger no primeiro uso de feature), curioso (busca em `/m/tutoriais`), retornante que esqueceu (revisita).

## 4. Estrutura visual
**Torneio grupo**:
```
[Header: nome do torneio + fase + próximo match countdown]
[Tabs: Chat | Bracket | Regras | Membros]
[Chat: idêntico ao MGroupChat mas com âncora torneio + reações especiais]
[Bracket: CinematicBracket em modo compacto vertical]
```
**Tutoriais lista**: cards agrupados por área (Compras, Fórum, Marketplace, Torneios, Perfil) com badge "novo" e "concluído".
**Tutorial individual**: passos verticais scrolláveis com screenshots + gif + "próximo".

## 5. Componentes
- **CinematicBracket** (compartilhado, precisa modo mobile-vertical)
- **HypeMeter**, **StorylinesPanel**, **LiveTournamentChat** (todos compartilhados de Web)
- **TutorialContext** provider — controla auto-trigger

## 9. Regras de negócio
- Só inscritos entram no grupo do torneio (`tournament_participants`)
- Chat modera com `tournament_chat_mutes` e `tournament_bans`
- Tutorial marcado como visto grava em `tutorials_seen` (user_id, tutorial_key)
- Auto-trigger só dispara se `!tutorials_seen[key]` E contexto certo (ex: tutorial-vendedor só se `seller_profiles` existe)

## 10. Estados
Torneio: aguardando início ("começa em X"), em andamento (destaque no próximo match), finalizado (bracket congelado + botão rever highlights), cancelado (banner + refund se pago).
Tutorial: nunca visto (auto), em progresso (retomar do passo X), concluído (badge + link relacionados).

## 11. Permissões
Torneio grupo: só participante ou mod. Chat mod pode silenciar/banir do chat. Admin plataforma vê tudo.
Tutoriais: público (não precisa login para ler, mas marcar como visto exige login).

## 12-14. Dados
Torneio: `tournaments`, `tournament_participants`, `tournament_chat_messages`, `tournament_chat_mutes`, `tournament_bans`, `tournament_moderators`, `tournament_matches`, `tournament_highlights`, `tournament_storylines`, `tournament_reactions`, `tournament_mvp_votes`, `tournament_predictions`.
Tutorial: `tutorials_seen`.
Hook: `TutorialContext` (`src/components/tutorial/`), edge function `tournament-reminders` (envia push 30min antes).

## 15. Painel admin (Desktop)
`Torneios.tsx`, `TorneiosAtuais.tsx`, `TorneiosEventos.tsx`, `CriarTorneio.tsx`:
- Criar/agendar torneio, seed manual, editar bracket
- Moderar chat de qualquer torneio ao vivo
- Ver `tournament_reminder_log` para debug de push
- Aprovar `tournament_moderators`
- Métricas: taxa de show-up (confirmações vs inscritos), abandono por fase
- Painel de tutoriais: criar novo, editar passos, ver taxa de conclusão por key, A/B test futuro
- **Faltando**: "torneios órfãos" (sem admin depois que criador saiu) + alertas de HypeMeter baixo.

## 16. Casos extremos
- Match adiado 3x → notificar todos + resetar contador
- Participante sai do grupo antes do match → auto-forfeit (bracket avança)
- Chat spam explode em final → auto-slow-mode (1 msg/10s)
- Tutorial mudou (passos foram atualizados) enquanto usuário parou no meio → resetar progresso + toast "atualizamos, comece de novo"
- Torneio deletado com highlights salvos → arquivar highlights em `tournament_highlights` sem apagar

## 17. Justificativa UX
Bracket em vertical no mobile (não horizontal com zoom) porque ninguém pinch-zooma bracket — quer scroll natural. Tabs no torneio-grupo porque o participante alterna rapidamente entre "conversar" e "onde estou no chaveamento". Tutorial em scroll único (não wizard modal) porque permite voltar/reler sem perder posição.

## 18. Escalabilidade
Torneio 128 participantes com chat ativo = ~500 msgs/min. Realtime channel dedicado por torneio (não misturar com chat geral). Cache do bracket em edge (TTL 30s) para evitar recomputar posições. Tutoriais são estáticos → CDN.

## 19. Melhorias futuras
- Stream integrado (Twitch embed) no card de match ao vivo
- Aposta lúdica com XP (não dinheiro) — `tournament_predictions` já existe
- MVP voting em tempo real durante match (`tournament_mvp_votes`)
- Tutoriais interativos com highlight na UI (spotlight)
- Tradução de chat de torneio via IA gateway

## 20. Crítica
**Bom**: infra rica de torneio (11+ tabelas), predictions/mvp/highlights, tutoriais bem separados de features.
**Ruim**:
- **P0**: `MTournamentGroup` reusa componentes desktop (`CinematicBracket`) sem breakpoint mobile — quebra em telas < 380px. Criar variante mobile-native.
- **P0**: `tournament-reminders` edge function não tem dedupe robusto — se rodar 2x, dispara push duplicado (verificar `tournament_reminder_log` como idempotency key).
- **P0**: tutorial auto-trigger conflita com modais de outras features (ex: cosmetic unlock) — precisa fila global de "modals" priorizada.
- **P1**: `MTutoriais` sem indicador de "quanto falta" (barra de progresso geral tipo Duolingo aumenta completion rate).
- **P1**: Chat de torneio sem "quote match event" (ex: citar "gol do X min 34") — feature de engajamento óbvia.

**Dívida técnica**: `tournament_duplicate_alerts` sugere que o problema anti-fraude foi identificado mas está isolado — falta pipeline que consome esses alerts em painel admin visível.

**Ângulos não cobertos**: acessibilidade (bracket como grafo não é lido por screen reader — precisa alt-text estruturado ou tabela alternativa), performance (CinematicBracket com animações caras em Android low-end — degradar via `prefers-reduced-motion`), fuso horário (torneios internacionais mostram horário local? hoje UTC bruto).

---

## Encerramento da Fase C

**Cobertura**: 8 arquivos cobrindo as 26 telas mobile (agrupadas por domínio funcional).

**Padrão P0 recorrente na Fase C**:
1. Queries em cascata em vez de RPC única/consolidada (perfil, home, chat list).
2. Denormalizações faltantes (`likes_count`, `unread_count`, `rating_avg`).
3. Falta de paginação em listas que crescem (amigos, favoritos, replies de post).
4. Realtime custoso sem cache/agrupamento (notificações, chat).
5. Componentes compartilhados Web sem breakpoint mobile-native (bracket, alguns modais).

**Próximo**: Fase D — Desktop Admin (~40 telas em `src/desktop/pages/`). Diga "seguir" para começar, ou "resumir" para consolidar Fases A-C em executive summary antes de continuar.
