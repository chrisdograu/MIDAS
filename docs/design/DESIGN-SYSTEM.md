# Sistema de Design — MIDIAS (v2)

Documento fundacional pra resolver o problema raiz: cada página foi criada individualmente, sem regra comum de onde as coisas ficam e o que cada cor significa. Isso aqui não é reforma visual — é a referência que todo prompt de página cita daqui pra frente ("aplicar a Regra 3 nesta tela"), em vez de cada prompt reinventar cor/espaçamento/hierarquia do zero.

**Nota sobre esta versão:** existiu uma v3 mais longa (12 seções, processo de aprovação por Design Lead, reunião mensal de governança, métrica trimestral) — reduzida de volta aqui porque esse tipo de estrutura pressupõe um time com várias pessoas revisando PR, que não é o caso do MIDIAS hoje. Mantive as tabelas de tipografia e espaçamento dessa versão (ficaram mais claras que texto corrido), cortei o resto.

Toda pesquisa citada abaixo foi de fato buscada e confirmada, não é lista decorativa:
- **Nielsen Norman Group** — padrão de leitura em F/Z (usuário escaneia o topo primeiro, desce pela esquerda; 57% do tempo de visualização é "acima da dobra"); em fileiras repetidas (cards, linhas), atenção cai do primeiro item pro último.
- **Shopify Polaris** (sistema de design do admin da Shopify) — cor com papel fixo, nunca decorativo: "Match color roles to their function rather than aesthetics."
- **Baymard Institute** (200mil+ horas de teste em e-commerce real) — hierarquia visual fraca, não design feio, é a causa mais comum de confusão em lojas e painéis.

---

## 1. Cor tem significado fixo — nunca decorativo

O projeto já tem os tokens certos em `src/index.css` (`--success`, `--warning`, `--destructive`, `--price`, `--primary`, `--accent`, `--muted-foreground`). O problema nunca foi falta de token, foi uso inconsistente.

**Regra:** antes de aplicar qualquer cor, perguntar "isso é sucesso, aviso, crítico, dinheiro, ação primária, ação secundária, ou só informativo?" Se a resposta for "nenhum desses, só gostei da cor", usa `--muted-foreground`.

| Token | Significado único | Uso certo | Uso proibido |
|---|---|---|---|
| `--success` (verde) | Deu certo, terminou bem | Pedido entregue, pagamento aprovado | Botão "Editar", ícone "Novo" |
| `--warning` (amarelo) | Precisa de atenção, não é erro | Estoque baixo, pendente de revisão | "Faturamento" só porque combina |
| `--destructive` (vermelho) | Erro, crítico, irreversível | Falha de pagamento, excluir | "Total de clientes" pra destacar |
| `--price` (dourado) | Exclusivamente valor monetário | Preço, faturamento, comissão | Medalha, estrela, badge |
| `--primary` (teal) | Ação principal, marca | Botão de ação primária | Badge de "Pendente" |
| `--accent` (roxo) | Ação secundária, novidade | Badge "Novo", segunda ação | Mensagem de erro |
| `--muted-foreground` (cinza) | Apoio, não crítico | Contagem simples, data, texto secundário | "Faturamento total" |

**Exemplo de correção (Dashboard):** Faturamento = `--price`. Total Pedidos = `--primary`. Pendentes = `--warning` só se > 0, senão `--muted-foreground`. Estoque Baixo = `--destructive`. Produtos/Clientes = `--muted-foreground` (são só contagem, não pedem ação).

## 2. Hierarquia por tamanho e posição

Baseado no padrão F/Z: o que importa mais fica em cima à esquerda, maior. Numa fileira de cards repetidos, os 2-3 primeiros são os que o usuário realmente vê — nunca colocar a métrica mais importante na quinta posição.

| Nível | Critério | Tamanho | Exemplo |
|---|---|---|---|
| Tier 1 — crítico | Impacto financeiro/conversão direto | `text-3xl`, bold | Faturamento |
| Tier 2 — ação imediata | Exige agir agora | `text-xl`, com badge | Estoque zerado, denúncia pendente |
| Tier 3 — monitorado | Acompanhar, sem urgência | `text-lg` | Pedidos em rota |
| Tier 4 — contagem | Só informativo | `text-sm` | Total de clientes, total de produtos |

## 3. Densidade: nem tudo visível ao mesmo tempo

Achado real: o menu do desktop tem 49 itens, todos sempre abertos, 0 mecanismo de esconder o que não importa agora.

**Regra:** navegação com mais de ~8 itens precisa de agrupamento colapsável, só o grupo relevante aberto por padrão. Dentro de uma página, mais de ~8-10 blocos de informação também agrupa por prioridade em vez de listar linear.

## 4. Estado vazio nunca é só "sem dados" numa tela preta

Achado real: a tela de Títulos, sem nenhum título concedido ainda, mostra "Sem títulos" e o resto da tela fica em branco, sem nada.

**Padrão obrigatório:** ícone/ilustração relacionada ao conteúdo, texto explicando o que apareceria ali, e — quando fizer sentido — botão de ação pra criar o primeiro item. Já existe componente pronto pra isso (`EstadoVazio`, Bloco H, rodada 20) usado em Web/Mobile — Desktop só precisa aplicar o que já existe, não inventar de novo.

## 5. Item ativo/selecionado usa o glow, não fundo chapado

Achado real: o menu do desktop usa `bg-primary/10` (cor chapada, colada no texto) pro item ativo; o resto do app (14 arquivos Web/Mobile) usa o glow que já existe (`--glow-primary`/`--glow-accent`, sombra que se espalha suave). É essa diferença que dá a sensação "presa"/apertada no Desktop.

**Regra:** qualquer estado ativo/selecionado usa `.glow-primary`/`.glow-accent`, nunca cor de fundo isolada. Web, Mobile e Desktop são o mesmo produto, precisam parecer o mesmo produto.

## 6. Espaçamento

| Contexto | Espaçamento |
|---|---|
| Dentro do mesmo grupo (ícone + texto) | `gap-1` / `gap-2` |
| Entre elementos de um card | `gap-3` |
| Entre seções/grupos diferentes | `gap-4` / `gap-6` — nunca menos que isso entre blocos que não são a mesma coisa |
| Margem externa de página | `p-4` a `p-6` |

## 7. Tipografia (escala fixa)

| Classe | Peso | Uso |
|---|---|---|
| `text-3xl` | Bold | Métrica Tier 1 (ex: faturamento) |
| `text-2xl` | Bold | Título de página |
| `text-xl` | Semibold | Subtítulo, cabeçalho de card |
| `text-lg` | Semibold | Métrica Tier 2/3 |
| `text-base` | Regular | Corpo, descrição |
| `text-sm` | Medium | Tier 4, badge, texto de apoio |
| `text-xs` | Regular | Timestamp, legenda |

Regra: `font-bold` só em títulos e métricas de destaque. Texto de apoio é `font-normal`/`font-medium`.

## 8. Estados interativos

| Estado | Aplicação |
|---|---|
| Hover | `hover:brightness-105` ou `hover:opacity-80` |
| Focus (obrigatório, teclado) | `focus:ring-2 focus:ring-primary focus:ring-offset-2` |
| Active (clique) | `active:scale-95` |
| Disabled | `opacity-40 cursor-not-allowed` |

---

## Como aplicar

Este documento não substitui os prompts de página — é a referência que eles citam ("aplicar a Regra 1 nesta tela"). Fica salvo como `docs/design/DESIGN-SYSTEM.md`, ao lado dos outros documentos fundacionais do projeto (`RESPOSTA-A-INCIDENTES.md`, `MODERACAO-CONTEUDO-PRIVADO.md`).

**Mudança de regra:** se uma regra daqui atrapalhar mais do que ajudar numa tela específica, registra o motivo como comentário no código daquela tela e ajusta o documento na próxima revisão — não precisa de processo formal de aprovação, só não pode ser silencioso (outra pessoa — ou o próprio Lovable — precisa entender por que aquela tela é diferente das outras).

Em caso de dúvida entre regras: **funcionalidade > acessibilidade > consistência > estética.**
