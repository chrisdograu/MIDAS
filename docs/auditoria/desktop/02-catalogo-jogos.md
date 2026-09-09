# Backoffice — Catálogo de Jogos, Produtos, Categorias, Bundles

> **Status:** rascunho
> **Rotas:** `/desktop/jogos`, `/desktop/jogos/novo`, `/desktop/produtos`, `/desktop/categorias`, `/desktop/bundles`
> **Arquivos:** `JogosAdmin.tsx`, `CriarJogo.tsx`, `Produtos.tsx`, `Categorias.tsx`, `BundlesAdmin.tsx`

---

## 1. Objetivo

Curadoria do **catálogo comercial** (o que aparece na loja Web) — desde o metadado do jogo até a composição de bundles e a taxonomia de descoberta.

## 2. Filosofia

O catálogo é o **coração da economia MIDIAS**. Cada campo aqui vira card, filtro, recomendação, cross-sell e review. Um jogo mal cadastrado quebra: SEO, ranking, biblioteca social, e a página do jogo (`GameDetail`). Por isso o admin precisa de **preview em tempo real** de como o produto vai renderizar.

## 3. Usuários-alvo

| Perfil | Ações |
| --- | --- |
| Admin | tudo, incluindo delete lógico |
| Gerente | criar/editar produtos, bundles, categorias |
| Estoquista | ver produtos, ajustar campos de estoque (via `/desktop/estoque`) |
| Moderador | ver-somente (para contexto de denúncias) |

## 4. Estrutura visual

### JogosAdmin
```text
Filtros (plataforma, gênero, status, preço)
   ↓
Tabela com badges (destaque, em alta, oferta ativa)
   ↓
Ações inline: editar / promoção / bundle / remover
```

### CriarJogo (wizard)
```text
1. Identidade (título, slug, plataforma[])
2. Mídia (capa, screenshots via ProductGalleryAdmin)
3. Comercial (preço, desconto, estoque inicial)
4. Metadados (gênero, tags, idade)
5. SEO (meta title/desc, og image)
6. Preview + publish
```

## 5. Componentes

### 5.1 `ProductGalleryAdmin`
Upload multi-arquivo → bucket `product-images` → grava em `produto_imagens`. Drag-and-drop reorder.

### 5.2 BundlesAdmin
- Cria linha em `bundles`, associa produtos em `bundle_items`.
- Preço do bundle é **absoluto** (não desconto %), o que confunde admin. **P1**: campo derivado "desconto vs soma dos itens".

### 5.3 Categorias
- Árvore 1 nível (sem sub-categorias hoje). `parent_id` não existe.
- **P2**: hierarquia + slug único para SEO.

## 9. Regras de negócio

- Slug único, gerado do título (kebab-case), editável antes de publicar.
- `stock = 0` + `awaiting_first_stock = true` → produto oculto na loja até primeira entrada (trigger `unlock_product_on_first_stock`).
- `price` altera → grava em `price_history` (trigger `log_price_change`) → notifica wishlist se caiu (`notify_wishlist_price_drop`).
- Bundle não pode conter bundle (evitar recursão).
- Delete de produto com pedidos históricos → **soft delete** (`status = 'archived'`) não hard delete.

## 12. Origem dos dados

- `produtos` (25 col), `produto_imagens`, `categorias`, `bundles`, `bundle_items`, `games_catalog`, `price_history`.

## 14. Hooks

- `useProdutos` (CRUD)
- `useAdminTable` (paginação, ordenação, busca) — **bom padrão**, replicar para outras tabelas.

## 15. Ações admin específicas

- **Duplicar jogo**: cria cópia com sufixo "(cópia)" e status `draft`.
- **Agendar publicação**: `published_at > now()` — hoje é só `is_active` boolean. **P1**: agendamento.
- **Recalcular rating**: dispara `recalculate_product_rating` manualmente.
- **Reset stock**: com log em `movimentacoes_estoque`.

## 16. Casos extremos

- Jogo removido enquanto usuário tem no carrinho → cart precisa validar `is_active` no checkout.
- Imagem no bucket removida por fora → produto fica com placeholder; validar 404 e alertar.
- Bundle com produto arquivado → bundle vira inválido, mas não é auto-desabilitado. **P0**: trigger.
- Título duplicado (mesmo jogo, plataformas diferentes) → deve ser **um produto com `plataformas[]`**, não dois.

## 20. Crítica

### 20.1 Bom
- Wizard `CriarJogo` com preview → reduz erro de cadastro.
- Trigger `log_price_change` + notificação price-drop → engajamento automático.

### 20.2 Ruim
- **Sem versionamento de metadados**: editar título perde histórico. **P1**: `product_revisions`.
- **Categorias flat** — não escala. **P2**.
- **Bundle sem validação de coerência** (produto arquivado dentro). **P0**.
- **Upload de imagem sem processamento server-side**: sem resize, sem WebP, sem CDN transform. **P0** — hoje sobe PNG 5MB e Vite serve direto.
- **SEO fields opcionais** — muitos jogos com `<title>` genérico "Lovable App". **P0**: obrigatório antes de publicar.

### 20.3 Dívida
- `produtos.plataformas` não existe (só `platform` singular). Mobile já resolveu com `anuncios.plataformas[]`; loja não. **P0**.
- Sem full-text search server-side em produtos (busca hoje é `ilike` no cliente). Ativar `pg_trgm` que já está instalado.

### 20.4 Não coberto
- **Bulk edit** (aplicar 20% off em 50 jogos) — hoje um por um.
- **Import CSV** para migração inicial de catálogo.
- **Preview mobile** dentro do admin (só mostra desktop).
