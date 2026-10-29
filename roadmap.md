- [x] Corrigir a ordem dos provedores que causa `useAuth must be used within AuthProvider`.
# Correções em andamento
- [ ] Acrescentar torneios de demonstração com jogos e contas reais existentes, sem novas contas; verificar leitura pública, inscrição e grupo mobile, registrando limites dos testes autenticados.
- [ ] Ampliar torneios, biblioteca social, produtos e periféricos no banco atual, preservando registros existentes e contas reais; verificar os dados e as páginas.
- [ ] Corrigir as falhas reais do roteiro: catálogo de conta comum, fórum/comentários, anúncio, chat/contraoferta, denúncia e consultas compartilhadas; retestar com contas existentes.
- [x] Terminar a verificação do roteiro com as três contas reais; compra, biblioteca, curtida, aceite de contato e certificado confirmados; etapas bloqueadas e limites registrados em docs/VERIFICACAO_ROTEIRO.md.
- [ ] Preencher torneios e biblioteca social com conteúdo de demonstração identificado, sem novas contas ou atividade inventada; conferir dados e páginas.
- [ ] Corrigir a consulta inválida de certificados na página móvel do vendedor e testar a abertura.
- [x] Concluir reordenação e paginação da equipe, limpeza de fotos ao salvar/cancelar/excluir e permissão de limpeza por gestores; testar regressões e páginas públicas.
- [x] Corrigir restauração e gravação das cores, atualização dos cosméticos por jogo e controles incompletos dos overlays; regressões cobertas por testes.
- [x] Revisar edição e envio de fotos nas novas páginas desktop; corrigir chamadas a RPCs inexistentes de desenvolvedores com gravação protegida pelas permissões administrativas existentes.
- [ ] Validar gravação e envio de fotos no painel com conta real — Supabase externo sem sessão disponível; testes isolados não validam a conta real.
- [x] Corrigir controles de gravação e atualização visual da customização do perfil; seis testes passaram e os toques responderam com dados isolados.

- [x] Corrigir bloqueio de toques causado pelo painel do sino móvel; abertura, filtros dos cosméticos, fechar e voltar às notificações testados por toque com dados isolados no navegador.

- [x] Corrigir notificações móveis, abertura da customização e carregamento da central de cosméticos; oito testes dos controles passaram.
- [ ] Validar notificações e cosméticos com sessão real — Supabase externo sem sessão de teste disponível.

- [x] Organizar visualmente os filtros de /m/chat, preservando opções e seções; quatro testes dos controles passaram.
- [ ] Validar a tela de chat completa com login — Supabase externo sem sessão de teste disponível.

- [x] Incluir desenvolvedores nas buscas web e desktop, testar os destinos e validar a busca web no navegador.
- [ ] Validar busca no desktop com administrador conectado — Supabase externo sem sessão de teste disponível.

- [x] Conectar as informações dos jogos às páginas dos desenvolvedores e testar a navegação nos dois sentidos.

- [x] Ampliar detalhes e filtros da página web do desenvolvedor e validar busca, filtros e limpeza.

- [x] Permitir envio de fotos e edição completa da equipe e desenvolvedores, exibindo os campos públicos.
- [x] Criar publicações oficiais e comentários somente no perfil web dos desenvolvedores.
- [x] Permitir ao administrador delegar e revogar a gestão apenas do canal de cada desenvolvedor.
- [x] Validar páginas públicas e revisar permissões sem acrescentar alertas de segurança.
- [ ] Validar envio de fotos, delegação e publicação/comentário com login — Supabase externo sem sessão de teste disponível.

- [x] Corrigir e testar páginas individuais de desenvolvedores e revisar textos e informações públicas da equipe.

- [x] Fazer páginas Equipe e Desenvolvedores exibirem dados editáveis pelo painel desktop.
- [x] Corrigir aplicação e contabilização atômica de cupons no checkout.
- [x] Impedir clientes de alterarem diretamente valores ou status de pedidos.
- [x] Corrigir perfil de amigos para usar perfil público seguro, silenciamento da conversa e convite real.
- [x] Corrigir os erros React que derrubam fórum e tutorial.
- [x] Aplicar filtros recolhíveis do marketplace em `/m/forum` e `/m/forum/:gameId`.
- [x] Encaminhar tutoriais web diretamente para a experiência web.
- [x] Representar cada bundle como um único item no carrinho, com preço do pacote.
- [x] Manter a compra segura e a entrega dos jogos internos do bundle.
- [ ] Validar fórum, tutoriais, carrinho e checkout no navegador.

# Preenchimento completo do banco

- [x] Inventariar tabelas vazias, vínculos obrigatórios e regras de acesso.
- [x] Definir volume e escopo dos dados fictícios com o usuário.
- [x] Popular os módulos que não dependem de novas contas, sem duplicações.
- [x] Validar contagens, relacionamentos e regras administrativas.
- [ ] Preencher dados que exigem outras contas — aguardando o usuário criar as contas reais; não criar contas fictícias.

- [x] Testes de abertura das telas menos testadas (web compra, mobile social, desktop gestão).
- [ ] Testar ações dessas telas com login real — Supabase externo sem sessão de teste disponível.
