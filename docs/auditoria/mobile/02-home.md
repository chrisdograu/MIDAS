# Mobile · 02 · Home (`/m`)

> Arquivo real: `src/mobile/pages/MHome.tsx` · Rota raiz do PWA mobile.

## 1. Objetivo
Ser o **feed de comunidade** do MIDIAS mobile. Diferente da Home Web (comercial/loja), a MHome é sobre "o que está acontecendo entre gamers **agora**": posts em alta, torneios rolando, amigos ativos, anúncios C2C quentes.

## 2. Filosofia
Mobile ≠ vitrine, é **presença**. O usuário abre o app 4-8x por dia por 30-60s. A Home precisa entregar valor em ≤ 2 rolagens. Nada de hero gigante, nada de institucional. Um card = uma decisão.

## 3. Usuários-alvo
| Perfil | O que vê |
|---|---|
| Visitante | Feed público (posts fórum, torneios abertos, anúncios) + CTA login em bloco discreto |
| Novo logado (< 7d) | Onboarding: "adicione amigos", "conecte plataformas", "escolha jogos favoritos" |
| Recorrente | Feed personalizado por jogos favoritos + amigos + torneios inscritos |
| Vendedor ativo | Card fixo "seus anúncios" com pendências (mensagens, propostas) |

## 4. Estrutura visual (top→bottom)
```
[Saudação + streak/XP]
[Chips de filtro: Todos | Amigos | Meus jogos | Torneios]
[Card: Torneio começando em X min] (se houver)
[Feed cards mistos: fórum-post | anúncio-hot | torneio | review | conquista amigo]
[Bloco "sugeridos": jogos p/ favoritar]
```

## 5. Componentes-chave
- **HeaderBar** (via `MobileLayout`): logo + bell + cosmeticUnlocks
- **Greeting card** — nome + level + XP até próximo
- **FilterChips** — estado local, salva última escolha em `localStorage`
- **FeedItem polymorphic** — discriminated union: `{type: 'post'|'ad'|'tournament'|'review'|'achievement', data: ...}`
- **EmptyState** contextual por filtro

## 6-8. Fluxos
Entrada: bottom-nav "Início", push notification "genérica", pwa-installed launch.
Saída: MForumPost, MMarketplaceItem, MTournamentGroup, MProfile (autor).
Conversa com: **todas as outras tabs** — é o hub de descoberta.

## 9. Regras de negócio
- Feed limitado a 30 itens iniciais + infinite scroll (10 em 10)
- Posts de usuários bloqueados **nunca** aparecem (filtrar via `blocked_users`)
- Anúncios em `modo_ferias` são ocultados
- Torneios com `starts_at < now - 2h` saem do card "começando"
- Item de amigo respeita `privacy_grants` do autor

## 10. Estados
- Loading: skeleton 3 cards
- Vazio: "adicione amigos para ver mais aqui" + botão pra MFriends
- Erro: retry
- Offline: mostrar último feed cacheado (React Query `persistQueryClient`)

## 11. Permissões
Visitante vê feed público sem items de amigos e sem "Meus jogos". Ações (curtir, comentar) exigem login → LoginGate.

## 12-14. Dados
Hoje: múltiplas queries paralelas (`forum_posts`, `anuncios`, `tournaments`, `user_achievements`) mescladas client-side. **P0**: migrar para RPC `get_mobile_feed(user_id, cursor, filter)` que ordena por `hot_score` server-side.
Hooks: `useFriendActivity`, `useRadarDelta` (compartilhado com Web).

## 15. Painel admin relacionado
Desktop → **precisa criar** `MobileFeedAdmin`:
- Peso de cada tipo (post vs anúncio vs torneio) no feed
- Blacklist de posts/anúncios que não devem entrar em Home
- Pin de card institucional (ex: "manutenção 22h") por período
- Métricas: CTR por tipo de card, dwell time
- Preview do feed como usuário X

## 16. Casos extremos
- Todos os itens filtrados → empty state amigável, não "0 resultados"
- Amigo excluiu post que estava no cache → 404 silencioso, remover do feed
- Torneio cancelado enquanto usuário rola → invalidar via realtime
- Anúncio vendido → badge "vendido" ao invés de desaparecer (evita layout shift)

## 17. Justificativa UX
Chips > tabs porque mobile-web tem toque impreciso e chips permitem 4-5 opções sem overflow. Greeting persistente porque cria hábito (streak). Sem hero porque LCP > 2s inviabiliza retenção.

## 18. Escalabilidade
Com 10k usuários ativos: feed atual (múltiplas queries + merge client) ≈ 800ms LCP. Com RPC + índices por `(user_id, hot_score, created_at)`: 200ms. Com 1M: adicionar cache Redis (Supabase Edge Function KV) por chave `feed:{user}:{filter}:{cursor}`.

## 19. Melhorias futuras
- Stories tipo Instagram para amigos que jogaram algo hoje
- Live indicator quando amigo está em torneio agora
- Push contextual "seu amigo X entrou no ranking top 10 de Y"
- Widget iOS/Android (Capacitor) mostrando 3 cards

## 20. Crítica
**Bom**: bottom-nav com LED animado, prefetch em hover/touch (`usePrefetchRoute`), header sticky glass.
**Ruim**:
- **P0**: fetch em cascata sem paralelismo real — usa vários `useEffect` isolados. Consolidar em `Promise.all` ou RPC única.
- **P0**: sem virtualização — feed grande derruba FPS em Android mid-range. Usar `@tanstack/react-virtual`.
- **P1**: greeting não muda ao longo do dia (bom-dia/tarde/noite) — trivial.
- **P1**: filtro "Amigos" quebra silenciosamente se usuário não tem amigos ainda.

**Dívida técnica**: MHome mistura lógica de agregação, apresentação e navegação. Extrair `useMobileFeed()` e componentizar cada `FeedItem*`.

**Ângulos não cobertos**: performance real (Lighthouse mobile ainda não rodado), acessibilidade (chips sem `role=tab`), SEO (irrelevante em app mode mas relevante em compartilhamento de link).
