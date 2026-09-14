# Backoffice — Estoque & Fornecedores

> **Rotas:** `/desktop/estoque`, `/desktop/fornecedores`
> **Arquivos:** `Estoque.tsx`, `Fornecedores.tsx`

---

## 1. Objetivo

Controlar a **cadeia de suprimentos digital**: quantas cópias de cada jogo estão disponíveis, quem forneceu, quando entrou/saiu, e prever ruptura.

## 2. Filosofia

Mesmo sendo TCC 100% online, o estoque é **real** — cada chave/licença é finita. Sem controle o site vende o que não tem e explode em `certificado` ou reembolso. Este módulo é o **contador**, não a vitrine.

## 3. Usuários-alvo

| Perfil | Ações |
| --- | --- |
| Admin | tudo |
| Gerente | tudo, exceto delete de fornecedor com histórico |
| Estoquista | entradas, ajustes, ver fornecedores |
| Atendente | só ver estoque para atender cliente |

## 4. Estrutura visual

### Estoque
```text
Header + botão "Nova entrada"
   ↓
Cards KPI (SKUs, valor total, itens abaixo do mínimo)
   ↓
Gráfico entradas vs saídas (7/30/90d) — Recharts
   ↓
Tabela de movimentações (movimentacoes_estoque)
   ↓
Modal de ajuste manual (com motivo obrigatório)
```

### Fornecedores
```text
Tabela CRUD (nome, CNPJ, contato, produtos fornecidos, ativo)
```

## 5. Componentes

### 5.1 Gráfico de movimentações
- BarChart empilhado, entradas (primary) vs saídas (destructive).
- Filtros 7d/30d/90d controlam `chartDays` state; query busca até 500 linhas.
- **P1**: agregar server-side quando período > 90d.

### 5.2 Ajuste manual
- `type ∈ {entrada, saida, ajuste, perda}` — `ajuste` requer justificativa livre.
- Grava `quantity_before` e `quantity_after` → auditoria completa.

## 9. Regras de negócio

- Estoque **não pode ficar negativo**. Trigger no `on_order_confirmed` já usa `GREATEST(0, ...)` — mas isso **mascara** oversell em vez de bloquear. **P0**: validar antes do INSERT do pedido, não corrigir depois.
- Delete de fornecedor com movimentações → apenas `is_active = false`.
- Movimentação **nunca** é editável nem deletável (imutável para auditoria).
- Estoque mínimo por produto (`min_stock`) → dispara alerta no dashboard.

## 12. Origem dos dados

- `produtos.stock`, `movimentacoes_estoque` (append-only), `fornecedores`.

## 15. Ações admin

- **Entrada em lote**: importar CSV `(sku, qty, fornecedor_id)`.
- **Ordem de compra**: gerar PDF com marca da loja para envio ao fornecedor.
- **Baixa por perda/quebra**: com motivo e foto (bucket `stock-losses`).
- **Reserva temporária**: quando pedido `pending` (antes de `confirmed`), reservar estoque. **Hoje não existe** — pedido pending não trava estoque, causando oversell em pico. **P0**.

## 16. Casos extremos

- Dois admins ajustam estoque simultaneamente → last-write-wins. **P0**: usar `UPDATE ... WHERE stock = expected_current_stock`.
- Fornecedor deletado (`ON DELETE CASCADE`?) → **NÃO**: `ON DELETE SET NULL` para preservar histórico.
- Movimentação com produto arquivado → permitir (baixa contábil pós-arquivamento).
- Estoque de bundle → **hoje não existe**. Bundle é vendido, mas não decrementa itens individuais. **P0** crítico.

## 20. Crítica

### 20.1 Bom
- `movimentacoes_estoque` append-only com `quantity_before/after` → auditoria perfeita.
- Gráfico com filtros de período — UX direta.

### 20.2 Ruim
- **Sem reserva de estoque no `pending`** → oversell em Black Friday. **P0**.
- **Race condition em ajuste concorrente**. **P0**.
- **Bundle não decrementa componentes**. **P0** — inconsistência silenciosa.
- **Fornecedor sem "produtos fornecidos"**: relação N:N não modelada. Hoje é texto livre. **P1**: `fornecedor_produtos`.
- **Sem previsão de ruptura** (velocidade de venda × estoque). **P2**: view materializada.

### 20.3 Dívida
- `movimentacoes_estoque.reference_id` sem FK — se pedido é deletado, log fica órfão sem constraint.
- Query do gráfico busca 500 linhas fixas — pode subestimar dias com muito volume.

### 20.4 Não coberto
- **Multi-armazém**: hoje um pool único. Futuro: chaves regionais (BR-only, LATAM).
- **Custo médio ponderado**: `movimentacoes_estoque` tem preço? Não. Sem custo, sem margem real no relatório.
