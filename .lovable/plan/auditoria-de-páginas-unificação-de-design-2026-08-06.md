# Auditoria de páginas + unificação de design

Objetivo: varrer todas as telas (Web, Mobile, Desktop), registrar o que funciona / o que está estranho, e alinhar tudo ao `DESIGN-SYSTEM.md`. Feito em fases, para nunca virar um mega-refactor cego.

Estado confirmado agora:

- `docs/design/` não existe no projeto — o `DESIGN-SYSTEM.md` enviado ainda não está salvo no repo.
- Cor hardcoded (`text-green-400`, `text-yellow-400`, `text-red-400`, `text-blue-400`, `text-white`...) aparece em 20 páginas do desktop, 17 do mobile, e ~13 arquivos web/componentes. Piores no desktop: `Moderacao` (8), `NotificacoesAdmin` (6), `Dashboard` (6), `PropostasTroca` (5), `Torneios`/`Estoque`/`AvaliacoesUsuario`/`AnunciosAdmin` (4 cada).
- `EstadoVazio` existe em `src/components/EstadoVazio.tsx` e já é usado em Web/Mobile; nenhuma página do desktop usa.

## Fase 0 — Fundação (pré-requisito das outras fases)

1. Salvar o documento como `docs/design/DESIGN-SYSTEM.md` (referência citável nos próximos prompts).
2. Criar `docs/auditoria/_checklist-design.md`: checklist único de 8 itens (as 8 Regras) usado para pontuar cada tela.
3. Criar utilitários que evitam repetir decisão de cor em cada arquivo:
  - variantes semânticas de KPI/badge (sucesso, aviso, crítico, preço, informativo) para o desktop reusar em vez de escolher cor à mão;
  - tokens `--success`/`--warning`/`--price` já existem em `index.css`; se faltar classe Tailwind correspondente, adicionar em `tailwind.config.ts`.

## Fase 1 — Varredura e diagnóstico (sem mudar UI)

Passar tela por tela, na ordem Desktop → Web → Mobile, e para cada uma registrar em `docs/auditoria/<área>/<nº>-<tela>.md` (arquivos já existem, só ganham uma seção nova "Auditoria de design/estado"):

- Funciona? (carrega, grava, filtra, permissão correta)
- Estranho? (cor sem significado, hierarquia invertida, estado vazio pelado, densidade, espaçamento, foco de teclado)
- Nota por Regra 1–8 + lista de correções propostas.

Diagnóstico é feito por leitura de código + navegação real na preview (screenshots) nas telas de maior tráfego: Home, Catálogo, Game Detail, Carrinho, Checkout, Perfil, Biblioteca, e no desktop Dashboard/Pedidos/Moderação/Estoque.

Saída da fase: um `docs/auditoria/_relatorio-varredura.md` com tabela "tela → severidade → correção", ordenada por impacto.

## Fase 2 — Desktop (maior dívida, escopo já mapeado)

Inclui os itens da rodada 25 que já estão confirmados:

- `Dashboard.tsx`: Faturamento = `--price`, Total Pedidos = `--primary`, Pendentes = `--warning` só se > 0 (senão `--muted-foreground`), Estoque Baixo = `--destructive`, Produtos/Clientes = `--muted-foreground`. Hierarquia Tier 1–4 (faturamento em `text-3xl`, contagens em `text-sm`) e reordenação dos cards para o F/Z.
- `DesktopLayout.tsx`: item ativo com `.glow-primary` em vez de `bg-primary/10`; os 15 grupos de navegação (49 itens) colapsáveis, só o grupo da rota atual aberto, estado em localStorage.
- Depois, mesmas correções de cor nas demais páginas do desktop, em lotes por tema (Moderação/Denúncias/Chat → Catálogo/Estoque → Pedidos/Marketplace → Comunicação/Config).
- `EstadoVazio` aplicado nas telas de lista do desktop (começando por Títulos, achado do documento).
- `Fornecedores.tsx`: adicionar campo `address` no formulário de criar/editar e no payload (campo morto no schema).

## Fase 3 — Web e Mobile

- Trocar cor hardcoded por token nas telas listadas na varredura, mantendo o comportamento.
- Padronizar estado vazio e estado de erro com `EstadoVazio` / `ErroCarregamento` onde falta.
- Padronizar foco de teclado (`focus:ring-2 focus:ring-primary`) e hover/active conforme Regra 8.
- Paridade pendente: `MConfig.tsx` ganha "Excluir minha conta" chamando a RPC `delete_my_account`, com a mesma confirmação em dois passos da web (`PrivacidadeCentral.tsx`).

## Fase 4 — Trava de regressão

- Teste que falha se aparecer classe de cor crua (`text-green-400`, `bg-red-500`, `text-white`, `bg-[#...]`) em `src/`, com lista de exceções justificadas por comentário no código.
- Nota curta em cada tela que fugir da regra, explicando o motivo (exigência do próprio documento).

## Ponto a confirmar (rodada 25, item 4)

O carrossel de screenshots do Game Detail hoje é: faixa com os 6 mais curtidos + aba "Sem spoiler" com o resto. Preciso saber se isso atende o pedido original ("se a pessoa quiser, vê todos") ou se deve virar um carrossel único com todos.

## Detalhes técnicos

- Nenhuma mudança de schema nesta linha de trabalho, exceto o formulário de `Fornecedores` (coluna `address` já existe).
- Correções são de apresentação: classes Tailwind, tokens de `index.css`, componentes compartilhados. Lógica de negócio, queries e RLS ficam intactas.
- Cada fase termina com typecheck e revisão visual na preview.                   comece agora mesmo, com a fase 0 e 1 , vendo todas as paginas, e realmente vendo cada coisa,tanto de funçao, quanto oq esta faltando e sobre o design, e ver oq esta cumprindo das regras, e mais se for necessario.