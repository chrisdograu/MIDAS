# Rodada 30 — Varredura por plataforma + correções do backoffice

Feito em fases, uma plataforma por vez (desktop → web → mobile), para cada uma sair realmente pronta antes de passar para a próxima.

## Diagnóstico confirmado agora

- **Não existe administração das avaliações de produto.** O menu "Avaliações Comerciais" abre `AvaliacoesUsuario`, que lê apenas as notas usuário↔usuário do marketplace. As avaliações de jogos (notas em estrelas) e as reviews completas não têm nenhuma tela de gestão.
- **Fórum do desktop mostra nome de produto.** Os posts do fórum são ligados ao produto (SKU com edição/plataforma), e o catálogo de jogos não tem vínculo com o produto. Por isso a lista "Por jogo" exibe títulos de produto.
- **Sem busca na lista de jogos do fórum** e sem busca em várias listas do backoffice.
- **Certificados** tem só 2 abas ("Pendentes" / "Todos"), sem separação por status.

## Fase 1 — Desktop (backoffice)

### 1. Nova tela: Avaliações de Jogos

- Lista das avaliações de produto: usuário, jogo, nota, comentário, data, aprovada ou não.
- Filtros por nota, por jogo e por status de aprovação + busca por usuário/jogo.
- Ações: aprovar/reprovar, ocultar e excluir (com confirmação e registro no histórico de auditoria).
- Aba irmã para as **reviews completas** (título, jogo, autor, veredito) com ver/ocultar/excluir.
- Menu lateral passa a ter: "Avaliações de Jogos" e "Avaliações entre Usuários" (renomeando a atual, que hoje se chama "Comerciais" e confunde).

### 2. Fórum por jogo real

- Vincular produto ↔ catálogo de jogos (campo opcional no produto), com preenchimento automático inicial por correspondência de título e seletor no formulário de produto.
- No fórum admin, agrupar e exibir pelo **nome do jogo do catálogo**, com o produto como informação secundária. Sem vínculo, mostra o nome do produto limpo (sem sufixo de edição/plataforma).
- Adicionar **barra de busca** na lista de jogos e na lista de posts do jogo selecionado.

### 3. Certificados — solicitações em 3 status

- Aba "Solicitações" com 3 sub-abas: **Pendentes**, **Aprovadas**, **Recusadas** (revogados seguem em "Todos").
- Contadores em cada sub-aba, filtro por período e busca por usuário.
- Corrigir bug: quando a decisão falha, o botão fica travado em "salvando" — liberar o estado no erro.
- Aba "Solicitações" como painel de entrada que também aponta para os outros pedidos que chegam ao ADM (verificação de responsável e sugestões de jogos), como atalho.

### 4. Varredura de "erros bobos" nas ~50 telas do desktop

Checagem padronizada em cada página: busca presente onde há lista longa, contadores certos, estados vazios, textos em PT-BR corretos, confirmação em ações destrutivas, registro em auditoria, botão sem travar em erro, colunas coerentes com o banco.

### 5. Design unificado

- Cabeçalho de página padrão (título, descrição, ações) em todas as telas.
- KPIs, tabelas, badges de status e espaçamentos alinhados ao mesmo padrão.
- Tabelas com largura/alinhamento consistentes e truncamento previsível.

Entrega: relatório atualizado em `docs/auditoria/_relatorio-varredura.md` com o que foi corrigido tela por tela. ver cada linha pra ter certeza que tudo funciona,e tambem logica, se um lugar e de um jeito , outros devem ser iguais,se trata da mesma coisa, a nao ser que seja um caso especifico que tenha coisa especificas. isso se aplica aos 3 plataformas

&nbsp;

## Fase 2 — Web

Mesma varredura página a página (catálogo, jogo, biblioteca, carrinho, checkout, perfis, social, torneios): consistência visual, estados vazios/carregando, mensagens de erro reais, links quebrados, dados coerentes com o banco.

## Fase 3 — Mobile

Mesma varredura nas telas do PWA, com foco em alvos de toque, listas com busca, fórum/marketplace/chat e escrita atômica onde hoje há múltiplos inserts soltos.

## Detalhes técnicos

- Migração: `produtos.catalog_game_id uuid null` com FK para `games_catalog`, índice, e backfill por título normalizado. Sem quebra: código atual continua funcionando com o campo vazio.
- Reviews de produto: tabela `avaliacoes` (nota, comentário, `is_approved`) e `reviews_completas`; leitura no admin com join manual em `profiles`/`produtos` (padrão já usado nas outras telas).
- Toda ação destrutiva ou de moderação passa por `adminLog` (`admin_logs`), com "antes → depois".
- Sem alteração no fluxo de compra, XP ou RLS nesta rodada, exceto as políticas necessárias para o admin ler/moderar `avaliacoes` e `reviews_completas`.