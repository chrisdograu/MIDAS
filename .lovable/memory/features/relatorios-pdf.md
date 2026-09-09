---
name: Exportação PDF de relatórios
description: Botão Exportar PDF em /desktop/relatorios usa jsPDF + jspdf-autotable para gerar relatório com KPIs, top produtos e série diária
type: feature
---
Em `/desktop/relatorios` há dois botões: **Exportar CSV** e **Exportar PDF**. O PDF usa `jspdf` + `jspdf-autotable` e gera:
- Cabeçalho colorido (teal) com título, período e timestamp
- Tabela de KPIs (faturamento, vendas, ticket médio, clientes ativos)
- Tabela "Top Produtos Mais Vendidos"
- Tabela "Faturamento Diário" (apenas dias com movimento)
- Rodapé com paginação em todas as páginas

Cores das tabelas seguem a marca: teal (`#14B8A6`) e roxo (`#A855F7`).
Arquivo salvo como `relatorio-{periodo}-{YYYY-MM-DD}.pdf`.
