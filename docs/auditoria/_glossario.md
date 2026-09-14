# Glossário MIDIAS

Vocabulário canônico. Se um termo aparece em qualquer arquivo da auditoria, ele está definido aqui — sem sinônimos falsos.

> **Regra de ouro:** dois termos que aparecem juntos na Home (ex.: "Em Alta" e "Órbita") **precisam** ter significados diferentes, ou um dos dois é redundante e deve ser removido.

---

## Descoberta e curadoria

### Órbita
O painel **"o que se moveu hoje"** — aparece no topo da Home logo abaixo do hero. Alimentado pelo **Radar Delta**. Não é ranking permanente: é um retrato do agora. Se nada se moveu nas últimas 24h, mostra estado calmo ("Você está em dia").

**Não confundir com:** Em Alta (que olha 7 dias) e Pra Você (que é personalizado).

### Radar / Radar Delta
Motor interno (hook `useRadarDelta`) que calcula sinais compostos por produto:
- **Views** de página (`product_views`)
- **Posts** de fórum criados (`forum_posts.product_id`)
- **Reviews** publicadas (`avaliacoes`)

Fórmula:
```text
score = (contagem_últimas_24h × 3) + (contagem_últimas_72h - contagem_últimas_24h × 1)
```

Alimenta: **Órbita** (na Home), **Oportunidades** (rota `/oportunidades`).

**Evidência sempre visível:** cada card do Radar mostra *por que* apareceu ("12 views + 3 posts nas últimas 24h") — decisão de design consciente contra "caixa preta".

### Escolha do Dia
Um único jogo destacado por dia para toda a comunidade. Pode operar em dois modos:

- **Manual (`daily_pick_overrides`):** admin escolhe o jogo para uma data específica.
- **Automático (fallback):** algoritmo escolhe baseado em relevância + score Radar + variedade (evita repetir jogo dos últimos 30 dias).

**Ver seção 15 de `web/01-home.md`** para o modelo completo de administração (calendário, agendamento, duplicação, cancelamento, histórico, alertas).

### Em Alta (`/em-alta`)
Ranking dos **últimos 7 dias** por interação agregada. É mais lento que a Órbita (que é 24h) e mais rico (soma vendas, wishlists, reviews).

**Diferença de Órbita:** Órbita é "o que mudou agora"; Em Alta é "o que está aquecido esta semana".

### Pra Você (`/pra-voce`)
Recomendação **personalizada** — só existe para usuário logado. Usa biblioteca, favoritos, histórico de views, gêneros, e amizades.

**Diferença de Em Alta:** Em Alta é coletivo; Pra Você é individual.

### Destaques
Grade de jogos **curada manualmente** pelo time editorial (via `produtos.is_featured`). Não é algorítmico. É onde o MIDIAS "vende sua opinião".

**Diferença de Em Alta:** Em Alta é o que a comunidade elegeu; Destaques é o que a curadoria elegeu.

### Ofertas
Jogos com `desconto > 0` **agora**. Ordenado por % de desconto por default.

### Mais Bem Avaliados
Ranking por `rating_media` com peso mínimo de reviews (evita 1 review 5 estrelas ganhar de 100 reviews 4.9).

---

## Comércio

### Produto (`produtos`)
Item vendido pela loja MIDIAS (B2C). Tem estoque, preço, plataformas, imagens, avaliações.

### Anúncio (`anuncios`)
Item vendido/trocado **entre usuários** (C2C) — só existe no mobile (Capacitor). Não confundir com produto.

### Bundle
Combinação de produtos com preço agregado menor que a soma. Tem página própria (`/bundle/:id`) mostrando % de economia.

### Certificado
Garantia opcional emitida pela loja em trocas C2C (marketplace mobile). Gerenciado pelo admin em `src/desktop/pages/Certificados.tsx`.

### Modo Férias (vendedor)
Vendedor pausa recebimento de novos pedidos/mensagens. Banner aparece no `SellerProfile`. Gerenciado por ele mesmo em `/vendedor` ou pelo admin em `VendedoresAdmin`.

---

## Social e comunidade

### Fórum
Discussões em categorias (`forum_categories`) e por jogo (`forum_posts.product_id`). Tem posts, replies, likes, spoiler-guard, tópico trancado, solução marcada.

### Spoiler Guard
Componente `SpoilerGuard` que borra conteúdo marcado com `is_spoiler=true`. Usuário clica para revelar. Aplicável a posts, replies e reviews longas.

### Tópico trancado (`is_locked`)
Post do fórum onde só moderadores podem responder. Badge de cadeado visível no header do tópico.

### Solução (`is_solution`)
Reply marcada pelo autor do post como resposta oficial. Uma por tópico.

### Review completa
Texto longo estruturado (não é só nota estrelas). Vive em `reviews_completas`, editada em `/jogo/:id/review-completa`.

### Opinião (`game_opinions`)
Micro-review — 1-2 frases — que aparece na página do jogo em painel lateral. Pode virar conversa 1:1 se outro user responder.

### Conversa de opinião
Chat 1:1 puxado a partir de uma opinião. Rota `/perfil/:userId/jogo/:productId/opniao/:opinionId/conversa/:convId`.

---

## Perfil e progressão

### Perfil
Página pessoal do usuário. Tem highlights, biblioteca, reviews, títulos, badges, cosméticos ativos, favoritos.

### Vendedor (`seller_profiles`)
Perfil comercial. Um usuário pode ter perfil pessoal + perfil de vendedor no mesmo login. Handle único (`@handle`) para deep-link em `/vendedor/:handle`.

### Título / Badge / XP / Nível
- **XP** (`user_xp_log`): pontos por ação (compra, review, torneio, contribuição no fórum).
- **Nível** (`xp_levels`): derivado do total de XP.
- **Título** (`user_titles`): rótulo que aparece no perfil ("Colecionador", "Crítico", "Veterano"). Alguns são conquistados, outros comprados com XP.
- **Badge** (`user_badges`): ícone visual conquistado.

### Cosmético (`user_cosmetic_loadout`, `user_game_page_loadout`)
Personalização visual: moldura de avatar, overlay do perfil, layout da página de jogo. Desbloqueáveis por conquistas ou XP.

### Cosmetic Unlock Center
Sino separado (`CosmeticUnlocksCenter`) no header que notifica **especificamente** cosméticos recém-desbloqueados. Separado do sino de notificações normal para não competir por atenção.

---

## Competitivo

### Torneio (`tournaments`)
Evento organizado com inscrições, chaveamento, matches, chat ao vivo, previsões, MVP, moderadores.

### Match
Partida individual dentro de um torneio. Tem eventos (`tournament_match_events`), placar, reações.

### Grupo (`tournament_groups`)
Coletivo de jogadores que se inscrevem juntos. Tem chat próprio.

### Storyline
Narrativa gerada pelo sistema entre duas equipes/jogadores (histórico de confrontos, rivalidades). Aparece na página do evento.

---

## Infraestrutura conceitual

### Plataforma (do jogo)
`PC / PS5 / PS4 / Xbox / Switch / Mobile`. Um produto pode ter várias. Um anúncio C2C também.

### Sinal
Termo genérico para qualquer evento medível que alimenta descoberta: view, wishlist, review, post, share, purchase. O Radar consome sinais.

### Deep-link
URL que abre exatamente um contexto (jogo, perfil, torneio, thread). Todos os fluxos-mãe respeitam deep-link: qualquer estado da UI deve ser reproduzível abrindo a URL em aba anônima.
