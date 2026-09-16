# Preencher o banco com uma demonstração completa

## Objetivo
Popular o Supabase externo com dados fictícios coerentes em todos os módulos visíveis, preservando integralmente os registros atuais.

## Escopo definido
- Criar contas fictícias suficientes para simular amizades, chats, grupos, vendas, compras, avaliações e torneios.
- Usar volume de demonstração: dezenas de registros por área, sem gerar carga artificial de milhares de linhas.
- Incluir pedidos, cupons, estoque, reembolsos, moderação, denúncias e chaves de produto claramente fictícias.
- Não preencher artificialmente tabelas puramente técnicas, como limites temporários, filas internas e relatórios de validação, salvo quando um fluxo real exigir esses registros.

## Implementação

### 1. Inventário e segurança
- Ler colunas, tipos, relacionamentos, valores permitidos, gatilhos e regras de acesso das tabelas envolvidas.
- Separar dados reais dos registros de demonstração com identificadores previsíveis.
- Corrigir os seeds existentes que usam nomes de colunas antigos antes de executá-los.

### 2. Contas e perfis
- Criar um conjunto variado de usuários fictícios por uma função protegida, sem senhas fixas no código ou no banco.
- Completar perfis, preferências, papéis não administrativos, títulos, selos, conquistas, XP, privacidade e plataformas conectadas.
- Preservar contas e permissões já existentes; nenhuma conta real será substituída.

### 3. Catálogo e comércio
- Ampliar jogos, produtos, imagens, categorias, publicadoras, desenvolvedoras, fornecedores, bundles, cupons e promoções.
- Criar estoque, histórico de preços, chaves falsas, pedidos em estados variados, itens, usos de cupons e reembolsos de demonstração.
- Manter preços, quantidades e relacionamentos consistentes entre catálogo, carrinho e pedidos.

### 4. Marketplace e comunidade
- Preencher vendedores, certificados, anúncios, fotos, favoritos, propostas, avaliações e conversas de negociação.
- Criar bibliotecas, listas, diário, tempo de jogo, opiniões, reviews, comentários, curtidas, screenshots, clips e atividades sociais.
- Criar amizades, solicitações, grupos, membros, eventos, enquetes, mensagens, reações e notificações.

### 5. Torneios, suporte e moderação
- Criar torneios em diferentes estados, participantes, partidas, previsões, votos, chat, destaques e eventos ao vivo.
- Criar tickets e respostas, sugestões, denúncias, recursos de banimento, alertas e históricos administrativos fictícios.
- Evitar qualquer ação real de cobrança, webhook externo ou envio de notificações para terceiros.

### 6. Validação
- Executar o preenchimento de forma repetível, sem duplicar dados quando rodado novamente.
- Conferir contagens, referências quebradas e erros do banco após a execução.
- Abrir amostras das telas web, mobile e administrativas para confirmar que os dados aparecem corretamente.

## Detalhes técnicos
- Uma função administrativa protegida criará as contas pelo serviço de autenticação e preencherá os módulos em uma ordem compatível com as dependências.
- Operações de catálogo independentes de usuário poderão ser adicionadas diretamente, sempre sem apagar registros atuais.
- Chaves de demonstração terão prefixo explícito e não representarão licenças reais.
