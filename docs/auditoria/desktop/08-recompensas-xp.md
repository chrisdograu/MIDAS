# Backoffice — Recompensas, XP, Badges, Títulos, Promoções & Cupons

> **Rotas:** `/desktop/recompensas`, `/desktop/recompensas/jogos`, `/desktop/badges`, `/desktop/titulos`, `/desktop/xp/mobile`, `/desktop/xp/web`, `/desktop/promocoes`, `/desktop/cupons`
> **Arquivos:** `RecompensasAdmin.tsx`, `GameRewardsAdmin.tsx`, `Badges.tsx`, `TitulosAdmin.tsx`, `XPMobile.tsx`, `XPWeb.tsx`, `Promocoes.tsx`, `Cupons.tsx`

---

## 1. Objetivo

Operar a **economia de bonificação** que amarra as três plataformas:
- **XP** = progressão numérica
- **Badges** = conquistas visuais
- **Títulos** = identidade textual (equipável)
- **Cosméticos por jogo** = frames, banners, temas, stickers desbloqueáveis
- **Cupons/Promoções** = alavanca comercial

## 2. Filosofia

Recompensa é o **combustível de retenção**. Ela precisa ser: (1) **transparente** (usuário entende como ganhar), (2) **auditável** (admin vê quem ganhou o quê e por quê), (3) **cross-platform** (jogar no mobile impacta título no perfil web).

## 3. Usuários-alvo

Admin + Gerente. Moderador não mexe.

## 4. Estrutura visual

### RecompensasAdmin (hub)
6 cards que roteiam para as subseções.

### Badges / Títulos / XP
Cada uma é um CRUD com preview visual.

### Cupons
```text
Filtros (ativos, expirados, esgotados)
   ↓
Tabela (código, tipo %/fixo, uses_count/max_uses, valid_until)
   ↓
Criar: código auto-gerado ou manual, min_purchase, first_purchase_only
```

### Promocoes / FlashPromotions
```text
Timer countdown ao vivo
   ↓
Produtos incluídos, desconto, banner
```

## 9. Regras de negócio

- XP disparado por triggers: `trg_xp_purchase` (>=50 ou floor(total)), `trg_xp_review` (25), `trg_xp_forum_post` (10), `trg_xp_forum_reply` (5), `set_tournament_xp` (dinâmico).
- `award_xp` idempotente via UNIQUE `(user_id, action, reference_id)` implícito (catch unique_violation).
- Level = `FLOOR(SQRT(xp/100)) + 1`.
- Badges auto: `check_and_award_badges` roda após XP relevante — critérios em compras, reviews, posts, level.
- Títulos: `user_titles.unlock_rule` (jsonb) validado por `can_equip_title` (achievement, playtime, xp).
- Trigger `enforce_active_title_lock` impede equipar título bloqueado.
- Cupom: `increment_coupon_uses` em `cupon_usos`. Trigger não valida `max_uses` — validação é na app antes do `pedidos` insert. **P0**: mover para trigger.
- Cupom `first_purchase_only` requer contagem de pedidos anteriores do user.

## 12. Origem dos dados

- `user_xp_log`, `xp_levels`, `badge_catalog`, `user_badges`, `user_titles`, `user_achievements`, `game_rewards`, `user_game_rewards`, `cupons`, `cupon_usos`, `flash_promotions`.

## 15. Ações admin

**Badges (`BadgesAdmin`):**
- CRUD em `badge_catalog` (id, name, icon emoji, category, description).
- Grant manual: `INSERT INTO user_badges (user_id, badge_id)`.
- Ver quantos usuários têm cada badge (para calibrar raridade).

**Títulos (`TitulosAdmin`):**
- Definir `unlock_rule` via JSON builder: achievement/playtime/xp.
- Award manual para evento especial.
- Ver holders atuais.

**XP Mobile/Web (`XPMobile`, `XPWeb`):**
- Ajustar valores por ação (chave em `site_settings`? hoje é hardcoded no trigger). **P0**: parametrizar via `site_settings.xp_rules` e reler no trigger.
- Ver ranking global.
- Zerar XP de user (com log — punição por fraude).

**Cosméticos por jogo (`GameRewardsAdmin`):**
- Frames/banners/temas/stickers com `unlock_rule` (playtime, achievement, purchase).
- Preview de como fica na página do jogo (`GamePageCustomizer`).

**Cupons:**
- Bulk create (100 códigos aleatórios para campanha).
- Import CSV.
- Restringir a produto/categoria/usuário específico.

**Promoções Flash:**
- Countdown com fuso `America/Sao_Paulo` fixo.
- Preview de banner no Home.
- Auto-desligar quando `ends_at < now()` (edge function).

## 16. Casos extremos

- Trigger XP falha silenciosamente (unique_violation) → OK, é intencional.
- Trigger recorre a `award_xp` que depende de `user_xp_log` — se tabela cheia (>1M linhas), insert lento. **P1**: particionar por mês.
- Título equipado é revogado → `enforce_active_title_lock` só valida no update; título já ativo continua. **P0**: nightly job para desequipar títulos revogados.
- Cupom com `max_uses=100` — 101ª compra passa se validação for só client-side. **P0** (repetido).
- Promoção flash termina no meio do checkout — preço já capturado no carrinho? sim, `price_at_add`.

## 20. Crítica

### 20.1 Bom
- **XP centralizado em `award_xp`** com log dedicado → replay, debug, refund fáceis.
- **Idempotência via unique_violation catch** — evita XP duplo em retry.
- **`badge_catalog` + `user_badges`** separados → catálogo evolui sem tocar em dados de usuário.
- **Cosméticos com `unlock_rule` jsonb** flexível.

### 20.2 Ruim
- **Valores XP hardcoded no trigger**: mudar "review vale 25" exige migration. **P0**: `site_settings.xp_rules`.
- **Nenhum retro-adjust** quando regra muda (ex.: reduzir XP de review 25→15 não afeta histórico — OK — mas admin quer opção de recalcular).
- **Level formula em código repetido** (JS + SQL `check_and_award_badges`). **P1**: uma fonte só (view `user_levels`).
- **`user_xp_log` sem TTL/archive** — cresce infinito. **P1**: mover >6meses para `user_xp_log_archive`.
- **Validação de cupom em cliente** → contornável. **P0**.
- **Sem A/B test** de promoção (medir uplift real). **P2**.
- **Título de campeão de torneio** hoje é texto livre → possível ofensivo. **P0**: sanitizar + review de admin em torneios de usuários.

### 20.3 Dívida
- `user_titles` sem `equipped_at` para histórico de troca.
- `flash_promotions` sem preço original snapshot (se produto muda de preço durante flash, cliente vê desconto real errado).
- Sem `game_rewards.rarity` para display "épico/lendário".

### 20.4 Não coberto
- **Loot box simulada** para TCC (com transparência total). **P2**.
- **Marketplace de cosméticos** entre usuários — hoje só desbloqueio via regra.
- **Notificação "faltam 20 XP para o próximo nível"** — nudge de retenção.
