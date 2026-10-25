# Verificação real do roteiro de apresentação — MIDIAS

**Conferência:** 24 e 25 de outubro de 2026.  
**Método:** navegação e ações pela interface, com três contas existentes, confirmação após recarregar e consultas de leitura ao Supabase externo. Nenhuma conta foi criada. Senhas, sessões e tokens não integram este documento.

## Conclusão

**O roteiro não está completamente funcional.** A compra com a conta administradora, a alteração do status da biblioteca, a leitura do pedido, a aprovação do certificado e a curtida foram verificadas. Publicação de anúncio, comentários no detalhe do fórum, chat da conta compradora e envio de denúncia bloquearam etapas reais.

Nenhum código funcional nem permissão do banco foi alterado durante esta conferência. Os erros abaixo continuam pendentes; concluir a verificação não significa corrigi-los.

## 1. Web — loja e compra

| Etapa | Resultado observado |
|---|---|
| Entrar nas três contas | As três contas existentes entraram pela tela de login. |
| Catálogo e filtro RPG, conta administradora | Quatro jogos RPG apareceram no teste inicial. |
| Detalhes de The Witcher 3, conta administradora | Página abriu, com desenvolvedor, preço e estoque. |
| Carrinho | Adição e apresentação dos descontos funcionaram. |
| Aplicar BEMVINDO10 e selecionar Pix | Após aguardar a aplicação do cupom, subtotal de R$ 79,90; Pix de R$ 4,00; cupom de R$ 7,99; total de **R$ 67,91**. |
| Confirmar compra simulada | Pedido `10c53883-b01e-4746-afd7-d9d8a4659826` gravado como `confirmed`, Pix, cupom BEMVINDO10 e total de R$ 67,91. Tela de sucesso abriu. |
| Estoque após a compra | Redução de 120 para 119 e saída de uma unidade registrada. |
| Biblioteca da conta administradora | Jogo aparece. Alteração de Completado para Jogando persistiu após recarregar; o estado original Completado foi restaurado. |
| Entrega de um jogo novo a outra conta | **Não verificada:** o jogo já pertencia à biblioteca da conta administradora antes da compra. A tentativa com a segunda conta foi bloqueada na página do jogo. |
| Catálogo RPG e jogo, segunda conta | Catálogo mostrou zero resultados e o mesmo jogo mostrou “Jogo não encontrado”. A causa precisa ser investigada sem ampliar permissões indiscriminadamente. |

### Esclarecimento sobre o valor do pagamento

Uma captura anterior foi feita antes de terminar a aplicação do cupom e mostrou R$ 75,90. O teste posterior aguardou o cupom aparecer: a interface mostrou R$ 67,91, igual ao pedido gravado. **Não foi confirmada uma divergência permanente de cálculo.** Resta avaliar se confirmar enquanto a validação ainda está em andamento exige proteção adicional.

### Problemas adicionais observados no web

- O checkout rotula The Witcher 3 como **Físico**, embora o registro consultado tenha `product_type = digital`.
- A restauração do carrinho consulta `carrinho_salvo`, tabela que não existe no banco atual.
- Uma seção de capturas do jogo solicita uma relação entre `game_screenshots` e `profiles` que o Supabase não encontra.

## 2. Mobile — comunidade e marketplace

| Etapa | Resultado observado |
|---|---|
| Perfil público pelo endereço com UUID real | Abriu. Algumas avaliações aparecem com o título genérico “Jogo”; nomes de autores em outras telas aparecem como “Usuário”. |
| Fórum geral | A lista geral estava vazia no teste inicial, embora existissem publicações. A listagem específica de Super Mario Odyssey mostrou publicação e review. |
| Curtir uma publicação existente | A terceira conta curtiu a publicação de Super Mario Odyssey: contador de 0 para 1, ainda 1 após recarregar. A curtida foi retirada depois e voltou a 0. |
| Abrir detalhe e comentar | **Bloqueado:** a consulta pede `forum_posts.edited_at`, coluna inexistente. A tela mostra “Post não encontrado” para uma publicação que existe. Não houve comentário enviado. |
| Publicar anúncio de troca com formulário preenchido e arquivo | **Falhou:** o envio contém `anuncios.expires_in_days`, coluna inexistente. O anúncio de teste não foi criado; seu upload e exibição pública não puderam ser validados. |
| Mandar mensagem ao vendedor | Criou um pedido de conversa entre as contas reais. |
| Vendedor aceitar o pedido de conversa | Funcionou: status da conversa mudou de `pending` para `accepted`, confirmado no banco. |
| Comprador abrir chat e enviar mensagem | **Bloqueado:** a segunda conta vê “Conversa não encontrada”, mesmo sendo participante. A primeira conta abre a conversa, mas a consulta de mensagens falha por `mensagens.edited_at`, coluna inexistente. Nenhuma mensagem de teste foi enviada. |
| Propor troca e aceitar | **Não concluído:** não há botão “Propor troca” no anúncio; existe “Mandar mensagem”. O fluxo de contraofertas está dentro do chat e grava mensagens, não propostas em `trade_proposals`. Além disso, a conversa criada a partir do anúncio ficou com `anuncio_id = null`, sem o contexto necessário para a contraoferta. |
| Certificado em análise | A tela real `/m/vendedor` mostrou o certificado pendente antes da aprovação. |
| Certificado aprovado | Após a decisão no painel, `/m/vendedor` mostrou **Ativo** e “Você é vendedor verificado”. |
| Enviar denúncia pela terceira conta | **Falhou:** mesmo sem anexos, o envio contém `denuncias.attachments`, coluna inexistente. A interface mostrou “Erro ao denunciar” e nenhuma denúncia foi criada. |

### Importante sobre a página do vendedor

A rota `/m/vendedor` utiliza `VendedorConfig`, não o arquivo antigo `MVendedor`. A diferença de nomes de status encontrada no arquivo antigo **não explica uma falha na rota testada**. A página real exibiu corretamente Pendente e Ativo.

A frase “Sem certificação” no formulário de anúncio, com a proteção desligada, descreve o anúncio não protegido; não prova que o certificado do vendedor deixou de existir.

## 3. Desktop — painel administrativo

| Etapa | Resultado observado |
|---|---|
| Acesso da conta administradora | Painel abriu com os dados reais. |
| Pedido da compra web | Apareceu com total de R$ 67,91. Os detalhes carregaram The Witcher 3, uma unidade e preço de R$ 79,90 antes dos descontos. |
| Contador de certificados pendentes | Exibiu uma solicitação antes do teste. |
| Analisar e aprovar certificado | Decisão salva. Painel passou a mostrar zero pendentes e um ativo. Leitura posterior confirmou `status = ativo` e vencimento em 25/10/2027. |
| Estoque | Saída da compra apareceu na tabela; seletores 7d, 30d e 90d trocaram o gráfico. |
| Triagem e descarte de denúncia | **Não verificável neste roteiro:** o envio pela interface móvel falhou; o painel permaneceu sem denúncias. Não foi criada denúncia por SQL para contornar o erro. |
| Banir ou apagar conteúdo | Não executado: seria inadequado punir contas reais ou remover conteúdo sem denúncia real. |

O painel chama `record_admin_login`, função ausente do banco atual. O acesso funciona, mas esse registro de auditoria não foi validado.

## 4. Falhas compartilhadas

Foram recebidas respostas de erro recorrentes, sem derrubar necessariamente a página:

- `profiles.email_confirmed` não existe; a leitura de dados do perfil deve ser revisada.
- `tutorials_seen.feature_key` não existe; o nome real utilizado pelo banco deve ser respeitado.
- O perfil móvel consulta `badge_catalog.rarity`, coluna inexistente.
- Algumas leituras diretas de perfis retornam nomes ausentes para contas comuns. Investigar pelo caminho público seguro, sem expor dados privados.

Esses erros impedem afirmar que a abertura da página significa funcionamento completo.

## 5. Alterações nos dados durante os testes

- Uma compra simulada foi criada na conta administradora, pedido `10c53883…`, total R$ 67,91. Houve baixa de uma unidade e uso do cupom.
- O certificado existente foi **aprovado como parte do teste** e permanece ativo. Não houve uma nova verificação documental da identidade; isso foi um teste do roteiro, não uma auditoria de identidade.
- O pedido de conversa entre comprador e vendedor foi aceito e permanece aceito.
- A alteração de status da biblioteca e a curtida foram restauradas ao estado anterior.
- Não foram criados anúncio, comentário, mensagem de teste ou denúncia, pois os respectivos passos falharam.

## 6. Próxima rodada de correções e reteste

1. Alinhar os campos enviados e consultados em anúncios, denúncias, fórum, mensagens, tutoriais e perfil com o banco atual.
2. Investigar o acesso ao catálogo e às conversas das contas comuns, preservando restrições de idade e privacidade.
3. Preservar o anúncio de origem ao iniciar a conversa e definir se a apresentação usará contraoferta no chat ou uma proposta de troca formal.
4. Repetir publicação, comentário, mensagem, troca e denúncia pela interface e confirmar os resultados após recarregar.
5. Comprar um jogo que ainda não esteja na biblioteca de uma conta comum e confirmar a entrega nela.
6. Só depois do envio de uma denúncia de teste funcionar, testar seu descarte no painel sem punição.

**Não é seguro gravar o roteiro completo como se todas as etapas já funcionassem.**