# Corrigir fórum mobile, tutoriais e bundles

## Objetivo
Eliminar as falhas visíveis, reduzir a poluição dos filtros do fórum e fazer bundles funcionarem como um pacote único do carrinho até a compra.

## Implementação

### 1. Corrigir os erros React
- Ajustar o botão compartilhado para que o modo de link (`asChild`) entregue exatamente um elemento ao componente interno, eliminando `React.Children.only`.
- Mover os hooks de metadados da página de jogo para antes dos retornos condicionais, mantendo sempre a mesma ordem de hooks e eliminando o erro React #310.
- Revisar as telas do fórum relacionadas para remover outros usos equivalentes que possam disparar os mesmos erros.

### 2. Melhorar os filtros de `/m/forum` e `/m/forum/jogo/:gameId`
- Reaproveitar o padrão do marketplace: botão compacto com contador de filtros ativos e painel inferior expansível.
- Colocar ordenação e período dentro desse painel, com ações “Limpar” e “Aplicar”.
- Manter apenas os seletores principais de conteúdo na tela, reduzindo o espaço ocupado.
- Garantir que as duas rotas do fórum por jogo usem o mesmo comportamento.

### 3. Separar corretamente mobile e web nos tutoriais
- Links de tutoriais mobile continuam dentro de `/m/tutorial/...`.
- Links de tutoriais web saem diretamente para `/tutorial/...`, sem tentar renderizar conteúdo web dentro da tela mobile.
- Manter uma mensagem de transição apenas como segurança para links antigos.

### 4. Corrigir bundles no carrinho e checkout
- Evoluir o item do carrinho para representar um bundle como uma única linha, contendo título, imagem, preço fechado e os jogos incluídos.
- Ao adicionar um bundle, impedir duplicação e aumentar a quantidade do pacote, em vez de adicionar três jogos avulsos.
- Exibir e calcular o preço do bundle no carrinho e checkout; os jogos internos aparecem como conteúdo do pacote, não como itens separados.
- Na criação do pedido, expandir o pacote nos produtos internos somente no envio seguro ao Supabase, preservando validação de estoque, preço oficial e entrega de todos os jogos.
- Manter compatibilidade com carrinhos antigos salvos no navegador.

## Validação
- Rodar verificação de tipos e testes relevantes.
- Abrir no navegador `/m/forum`, as duas formas da rota de fórum por jogo, tutoriais mobile/web, bundle, carrinho e checkout.
- Confirmar ausência dos dois erros React e conferir visualmente filtros recolhíveis, agrupamento e total do bundle.

## Observação
A sessão autenticada automatizada não está disponível para este Supabase externo; os fluxos públicos serão testados integralmente e as etapas protegidas serão validadas até o redirecionamento/login e por testes locais de estado.
