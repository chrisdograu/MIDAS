# Unificação de design + correções da varredura

Relatório completo: `docs/auditoria/_relatorio-varredura.md` (Web 45 telas, Mobile ~31, Desktop 49).

## O que a varredura mostrou

Funcionalmente o app está coerente — as telas leem e escrevem as tabelas certas e os fluxos existem nas três plataformas. A dívida é de **linguagem visual e de estados**, repetida igual em Web, Mobile e Desktop:

1. 360 cores cruas (`text-green-400`, `bg-red-500/20`, `text-white`) em vez de papel semântico.
2. `EstadoVazio`/`ErroCarregamento` adotados em ~11% da Web e **0%** do Desktop.
3. Estado "ativo/selecionado" com `bg-primary/10` plano em vez de glow.
4. Foco de teclado (`focus:ring`) inexistente fora de 5 formulários.
5. Hierarquia tipográfica plana: nenhuma tela tem um número claramente principal.

Mais achados concretos: dois `<h1>` duplicados em "Pra Você"; imagem quebrada sem fallback no Game Detail; opção "Pública" sobrevivendo nas etiquetas da Biblioteca (removida do resto do app); mobile sem "Excluir minha conta"; alvos de toque de 24-36px no mobile; emojis usados como ícone no Footer (renderizam como caixa vazia); `useDocumentMeta` em só 4 de 45 páginas web.

## Fase A — Base compartilhada

- `statusTone(status)` em `src/lib/semanticTone.ts`: um mapa único status → `text-success` / `text-warning` / `text-destructive` / `text-price`, usado por Web, Mobile e Desktop.
- Tokens que faltam em `index.css`: `--overlay` (scrim de sheets), `--seller` (gradiente do modo vendedor), `--gold` (troféu/rank).
- Classes utilitárias `.focus-ring` e `.overlay-scrim` para aplicar em massa.
- `KpiCard` (já criado) passa a definir Tier 1 = `text-3xl`, rótulo = `text-xs uppercase`.

## Fase B — Desktop backoffice

- Dashboard, Relatórios, Métricas e Estoque migram KPIs para `KpiCard` + `statusTone`; dinheiro passa a usar `text-price`.
- `EstadoVazio` nas 10 tabelas com string crua; `.glow-primary` nos 6 estados ativos; `.focus-ring` nos controles.
- `DesktopLayout`: menu agrupado e colapsável (hoje é lista longa plana) e glow no item ativo.
- UI de erro (não só toast) nas 9 páginas de formulário que hoje falham em silêncio.
- `Fornecedores`: adicionar o campo `address` que falta no formulário.

## Fase C — Web

- Corrigir o `<h1>` duplicado em `ParaVoce`.
- `EstadoVazio` + `ErroCarregamento` nas 13 páginas que hoje só têm spinner (Ofertas, Pedidos, Torneios, GameDetail, BundleDetail, perfis, torneios/*).
- Badges de status e ícones migram para `statusTone`; `text-white` → `text-primary-foreground`.
- Glow nos estados selecionados (Checkout, GameSocialHub, ReviewCompletaEditor, TournamentMatch).
- Game Detail: fallback de capa quebrada, `alt` e `loading="lazy"` nas imagens, e fechar o vazio da coluna "Sobre o Jogo".
- Biblioteca: remover a opção "Pública" das etiquetas (alinhar com a rodada 23) e trocar os `<select>` nativos pelo `Select` do design system.
- Footer: emoji de pagamento → ícones Lucide.
- `useDocumentMeta` nas páginas de conteúdo que faltam.

## Fase D — Mobile

- **"Excluir minha conta"** em `MConfig`, chamando `delete_my_account` com o mesmo diálogo de confirmação da web.
- Alvos de toque para 44px nos 4 controles apontados.
- `statusTone`, `EstadoVazio`, `.focus-ring`, `.overlay-scrim` e glow no ativo (inclusive na barra inferior).
- Corrigir o rótulo "Perfil $vendedor".
- Revisar `MBlockedUsers` (22 linhas, provavelmente sem estados).

## Fase E — Trava de regressão

Teste que falha se aparecer cor crua nova em `src/**/*.tsx` (allowlist para os casos legítimos de scrim sobre imagem), rodando junto com os testes atuais.

## Detalhes técnicos

- Nenhuma mudança de banco, RLS ou regra de negócio nesta rodada — exceto o mobile passar a chamar a RPC `delete_my_account` que já existe.
- Ordem de execução: A → B → C → D → E; A é pré-requisito das demais.
- Escopo por fase mantém os diffs auditáveis: B toca só `src/desktop`, C só `src/pages` + `src/components`, D só `src/mobile`.    faça  a fase A, B e C,aplicando em tudo. 