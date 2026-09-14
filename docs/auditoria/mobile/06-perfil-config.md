# Mobile · 06 · Perfil, Config e Bloqueados (`/m/perfil`, `/m/perfil/:userId`, `/m/config`, `/m/config/bloqueados`)

> Arquivos: `MProfile.tsx`, `MConfig.tsx`, `MBlockedUsers.tsx`.

## 1. Objetivo
Identidade pública (perfil como cartão de visita gamer) + controles privados (config, privacidade, bloqueados). Diferente do Perfil Web (foco loja/biblioteca), mobile foca **reputação social e C2C**.

## 2. Filosofia
Perfil é a **moeda de confiança** do marketplace e do fórum. Precisa transmitir em 5 segundos: "esse cara é sério?" via avatar + level + rating + badges + histórico de trocas.

## 3. Usuários-alvo
Visitante do perfil (comprador avaliando vendedor), amigo (quer ver o que jogou), dono (quer customizar), admin (moderar).

## 4. Estrutura visual (perfil próprio)
```
[Cover + Avatar + Frame (cosmético)]
[Nome + Título ativo + Level + XP bar]
[Chips: rating C2C · seguidores · seguindo · certificados]
[Tabs: Sobre | Biblioteca | Anúncios | Reviews | Amigos | Customização]
[Aba Customização (só dono): AvatarFrame, Título, Highlights, PageCosmetic]
```

## 5. Componentes
- **AvatarWithFrame** (cosmético), **LevelTitleBadge**, **UserBadges**
- **ProfileCosmeticOverlay** — aplica overlay se dono comprou cosmético página
- **HighlightsStrip** — 3-5 destaques (jogo favorito, torneio ganho, etc.)
- **FriendIdentityPanel** — quando é amigo, mostra dados extra
- **ActiveTitleSelector** — trocar `active_title_id`

## 9. Regras de negócio
- `display_name` cooldown 30d (P0 mencionado na fase B — vale aqui também)
- Só amigos aceitos veem `library` completa se privacidade = "amigos"
- Bloquear alguém → sumir mutuamente (feed, fórum, chat)
- Denunciar perfil → `denuncias` tipo `profile`
- Customização: cosmético precisa estar em `user_cosmetic_loadout` (inventário) para aplicar

## 10. Estados
Perfil privado (mostra só card básico + botão seguir), banido (banner + esconder conteúdo), próprio (edit inline).

## 11. Permissões
Público: cabeçalho + rating + badges. Amigo: + biblioteca conforme `privacy_grants`. Dono: tudo + editar. Admin: tudo + moderar (banir, remover cosmético indevido).

## 12-14. Dados
Tabelas: `profiles`, `user_roles`, `user_badges`, `user_titles`, `user_cosmetic_loadout`, `user_game_page_loadout`, `profile_highlights`, `user_follows`, `follow_requests`, `close_friends`, `privacy_grants`, `blocked_users`, `notification_preferences`.
Hooks: `useAuth`, `useCosmetics`, `useFollow` (mobile lib).

## 15. Painel admin (Desktop)
`Clientes.tsx`, `Funcionarios.tsx`, `TitulosAdmin.tsx`, `Badges.tsx`, `GameRewardsAdmin.tsx`, `Moderacao.tsx`:
- Ver perfil admin-view (dados sensíveis, IP, device, histórico banimento)
- Conceder/revogar badge/título manualmente
- Resetar display_name (bypass cooldown quando ofensivo)
- Ver árvore de bloqueios (quem bloqueou X)
- Ver denúncias abertas contra este perfil
- **Faltando**: painel unificado "reputação" (score composto de rating C2C + likes fórum + torneios) — hoje espalhado.

## 16. Casos extremos
- Cosmético desativado por admin depois de comprado → manter no inventário, mas overlay não renderiza + notificação com refund em créditos
- Amigo bloqueou você → seu perfil aparece como "usuário não encontrado" para ele (opção paranoid)
- Perfil de menor de idade → esconder cidade/telefone mesmo em amigos
- Muitos highlights removidos → auto-preencher com "recentes" para não deixar vazio

## 17. Justificativa UX
Tabs > acordeões porque mobile tem swipe horizontal natural. Customização só pra dono evita confusão. Chips no topo (rating, seguidores) porque é o "score" instantâneo. Aba Amigos separada de Seguidores (Web tem confusão, mobile deixar claro).

## 18. Escalabilidade
Com 1M perfis, biblioteca de amigo pode ter 500 jogos — virtualizar. Highlights limitados a 5 (regra). Badges limitados a 12 exibidos + ver todos.

## 19. Melhorias futuras
- Perfil "steam-like" com showcase configurável
- QR code do perfil para adicionar amigo presencial
- Estatísticas cross-plataforma (Steam/PSN/Xbox conectados via `connected_platforms`)
- Timeline pública opcional (últimas conquistas)

## 20. Crítica
**Bom**: cosméticos como diferencial forte, integração badges/títulos/frames, respeito a privacidade granular.
**Ruim**:
- **P0**: MProfile faz 8+ queries paralelas ao abrir. Consolidar em RPC `get_profile_bundle(user_id, viewer_id)` que já aplica privacidade.
- **P0**: `banned_until` verificado só no login — se admin bane usuário online, ele continua ativo até refresh. Realtime channel em `profiles.banned_until` ou trigger que revoga sessão.
- **P1**: MConfig tem 15+ toggles em uma tela longa — agrupar em accordions.
- **P1**: MBlockedUsers sem search — se usuário bloqueou 50 pessoas, dor.

**Dívida técnica**: `notification_preferences` tem 20 colunas — normalizar em `preference_key/value` para escalar novos tipos sem migration.

**Ângulos não cobertos**: acessibilidade em cosméticos (frames animados podem causar problema motion-sensitive — respeitar `prefers-reduced-motion`), GDPR "download meus dados" (falta), suspensão temporária self-service ("férias" para o perfil todo, não só vendedor).
