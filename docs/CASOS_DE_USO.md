# Casos de Uso · Plataforma MIDIAS

> Documento de requisitos funcionais em notação UML (Casos de Uso), complementar ao [MER](./MER.md).
> Cobre as três plataformas que usam o mesmo banco: **Web**, **Mobile** e **Desktop (painel administrativo)**.

## 0. Convenções

| Elemento | Significado |
|---|---|
| **Ator** | Pessoa ou sistema externo que interage com a plataforma |
| `([Caso de uso])` | Funcionalidade que entrega valor ao ator |
| `include` | O caso sempre executa o outro (obrigatório) |
| `extend` | O caso pode executar o outro em uma condição (opcional) |
| **UCxx** | Identificador do caso de uso |
| **RNxx** | Regra de negócio aplicada |

---

## 1. Atores

| Ator | Descrição | Plataformas |
|---|---|---|
| **Visitante** | Pessoa sem login. Navega e pesquisa. | Web, Mobile |
| **Jogador** | Usuário com conta. Compra, joga, interage. Herda tudo do Visitante. | Web, Mobile |
| **Vendedor** | Jogador que anuncia jogos no marketplace entre pessoas. | Mobile, Web |
| **Gestor de Estúdio** | Jogador autorizado a publicar no canal oficial de um desenvolvedor. | Web |
| **Moderador** | Funcionário que analisa denúncias e conteúdo. | Desktop |
| **Administrador** | Gerencia toda a operação da loja. Herda tudo do Moderador. | Desktop |
| **Sistema de Pagamento** | Ator externo que confirma o pagamento. | — |
| **Serviço de Autenticação** | Ator externo (Supabase Auth) que valida login e sessão. | — |

```mermaid
flowchart BT
  Jogador[Jogador] -->|herda| Visitante[Visitante]
  Vendedor[Vendedor] -->|herda| Jogador
  Gestor[Gestor de Estudio] -->|herda| Jogador
  Admin[Administrador] -->|herda| Moderador[Moderador]
```

---

## 2. Diagrama geral

```mermaid
flowchart LR
  Visitante[Visitante]
  Jogador[Jogador]
  Vendedor[Vendedor]
  Gestor[Gestor de Estudio]
  Admin[Administrador]
  Pagamento[Sistema de Pagamento]

  subgraph MIDIAS[Plataforma MIDIAS]
    UC_Nav([Navegar e buscar catalogo])
    UC_Conta([Criar conta e entrar])
    UC_Compra([Comprar jogo])
    UC_Bib([Gerenciar biblioteca])
    UC_Social([Interagir socialmente])
    UC_Chat([Conversar])
    UC_Torneio([Participar de torneio])
    UC_Custom([Customizar perfil])
    UC_Anuncio([Anunciar no marketplace])
    UC_Canal([Publicar no canal oficial])
    UC_Gestao([Gerenciar loja])
    UC_Mod([Moderar plataforma])
  end

  Visitante --- UC_Nav
  Visitante --- UC_Conta
  Jogador --- UC_Compra
  Jogador --- UC_Bib
  Jogador --- UC_Social
  Jogador --- UC_Chat
  Jogador --- UC_Torneio
  Jogador --- UC_Custom
  Vendedor --- UC_Anuncio
  Gestor --- UC_Canal
  Admin --- UC_Gestao
  Admin --- UC_Mod
  UC_Compra --- Pagamento
```

---

## 3. Diagramas por módulo

### 3.1 Loja e compra (B2C)

```mermaid
flowchart LR
  Visitante[Visitante]
  Jogador[Jogador]
  Pagamento[Sistema de Pagamento]

  subgraph Loja[Modulo Loja]
    UC01([UC01 Buscar jogos, pacotes e desenvolvedores])
    UC02([UC02 Ver detalhes do jogo])
    UC03([UC03 Adicionar ao carrinho])
    UC04([UC04 Finalizar compra])
    UC05([UC05 Aplicar cupom])
    UC06([UC06 Favoritar jogo])
    UC07([UC07 Consultar pedidos])
    UC08([UC08 Entrar na conta])
  end

  Visitante --- UC01
  Visitante --- UC02
  Jogador --- UC03
  Jogador --- UC04
  Jogador --- UC06
  Jogador --- UC07
  UC04 -. include .-> UC08
  UC05 -. extend .-> UC04
  UC04 --- Pagamento
```

### 3.2 Marketplace entre pessoas (C2C)

```mermaid
flowchart LR
  Jogador[Jogador]
  Vendedor[Vendedor]
  Admin[Administrador]

  subgraph Market[Modulo Marketplace]
    UC10([UC10 Navegar anuncios])
    UC11([UC11 Tornar-se vendedor])
    UC12([UC12 Enviar certificado])
    UC13([UC13 Publicar anuncio com fotos])
    UC14([UC14 Propor troca])
    UC15([UC15 Responder proposta])
    UC16([UC16 Avaliar vendedor])
    UC17([UC17 Aprovar certificado])
  end

  Jogador --- UC10
  Jogador --- UC11
  Jogador --- UC14
  Jogador --- UC16
  Vendedor --- UC13
  Vendedor --- UC15
  UC11 -. include .-> UC12
  Admin --- UC17
```

### 3.3 Comunidade, chat e torneios

```mermaid
flowchart LR
  Jogador[Jogador]
  Gestor[Gestor de Estudio]

  subgraph Comunidade[Modulo Comunidade]
    UC20([UC20 Seguir jogadores])
    UC21([UC21 Criar topico no forum])
    UC22([UC22 Escrever review])
    UC23([UC23 Curtir conteudo])
    UC24([UC24 Conversar no chat])
    UC25([UC25 Participar de grupo])
    UC26([UC26 Inscrever-se em torneio])
    UC27([UC27 Entrar na lista de espera])
    UC28([UC28 Comentar publicacao oficial])
    UC29([UC29 Publicar no canal oficial])
    UC30([UC30 Customizar perfil e cosmeticos])
    UC31([UC31 Receber notificacoes])
  end

  Jogador --- UC20
  Jogador --- UC21
  Jogador --- UC22
  Jogador --- UC23
  Jogador --- UC24
  Jogador --- UC25
  Jogador --- UC26
  Jogador --- UC28
  Jogador --- UC30
  Jogador --- UC31
  UC27 -. extend .-> UC26
  Gestor --- UC29
```

### 3.4 Painel administrativo (Desktop)

```mermaid
flowchart LR
  Moderador[Moderador]
  Admin[Administrador]

  subgraph Painel[Modulo Painel Desktop]
    UC40([UC40 Entrar no painel])
    UC41([UC41 Gerenciar jogos e pacotes])
    UC42([UC42 Controlar estoque])
    UC43([UC43 Gerenciar pedidos])
    UC44([UC44 Gerenciar cupons])
    UC45([UC45 Gerenciar equipe MIDIAS])
    UC46([UC46 Gerenciar desenvolvedores])
    UC47([UC47 Delegar gestor de estudio])
    UC48([UC48 Analisar denuncias])
    UC49([UC49 Banir usuario])
    UC50([UC50 Conceder XP])
  end

  Moderador --- UC40
  Moderador --- UC48
  Admin --- UC41
  Admin --- UC42
  Admin --- UC43
  Admin --- UC44
  Admin --- UC45
  Admin --- UC46
  Admin --- UC50
  UC47 -. extend .-> UC46
  UC49 -. extend .-> UC48
```

---

## 4. Especificação dos casos de uso principais

### UC04 — Finalizar compra (com UC05 Aplicar cupom)

| Campo | Descrição |
|---|---|
| **Ator principal** | Jogador |
| **Ator secundário** | Sistema de Pagamento |
| **Plataforma** | Web e Mobile |
| **Pré-condições** | Jogador logado; carrinho com ao menos um jogo ou pacote com estoque. |
| **Pós-condições** | Pedido registrado; cupom contabilizado; jogos adicionados à biblioteca após pagamento. |

**Fluxo principal**
1. O Jogador abre o carrinho.
2. O sistema mostra itens, preço unitário e subtotal.
3. O Jogador clica em "Finalizar compra".
4. O sistema mostra a tela de pagamento.
5. O Jogador escolhe a forma de pagamento e confirma.
6. O sistema grava o pedido e os itens com o preço do momento.
7. O Sistema de Pagamento confirma.
8. O sistema adiciona os jogos à biblioteca e mostra a tela de compra concluída.

**Fluxo alternativo A1 — Aplicar cupom (UC05)**
- 4a. O Jogador digita um código de cupom.
- 4b. O sistema valida e mostra o desconto. Volta ao passo 5.

**Fluxos de exceção**
- E1. Cupom inválido, vencido ou esgotado: o sistema avisa e mantém o preço normal.
- E2. Jogo sem estoque: o sistema avisa e não permite concluir.
- E3. Pagamento recusado: o pedido fica pendente e o Jogador pode tentar de novo.

**Regras de negócio**
- RN01. Pedido e uso do cupom são gravados juntos, em uma única operação.
- RN02. O preço do pacote é o preço do pacote, não a soma dos jogos.
- RN03. O Jogador nunca altera o status do pedido.

---

### UC13 — Publicar anúncio no marketplace

| Campo | Descrição |
|---|---|
| **Ator principal** | Vendedor |
| **Plataforma** | Mobile (principal) e Web |
| **Pré-condições** | Jogador logado com perfil de vendedor ativo. |
| **Pós-condições** | Anúncio visível na lista do marketplace. |

**Fluxo principal**
1. O Vendedor toca em "Novo anúncio".
2. Informa jogo, plataformas, condição, preço e se aceita troca.
3. Envia até várias fotos.
4. Confirma a publicação.
5. O sistema salva o anúncio e o mostra na lista.

**Fluxos de exceção**
- E1. Campos obrigatórios vazios: o sistema destaca os campos.
- E2. Falha no envio de foto: o sistema avisa e permite reenviar.

---

### UC14 / UC15 — Propor e responder troca

| Campo | Descrição |
|---|---|
| **Atores** | Jogador (propõe) e Vendedor (responde) |
| **Pré-condições** | Anúncio ativo que aceita troca. |
| **Pós-condições** | Proposta aceita ou recusada; ambos notificados. |

**Fluxo principal**
1. O Jogador abre o anúncio e toca em "Propor troca".
2. Descreve o que oferece.
3. O sistema registra a proposta como aberta e notifica o Vendedor.
4. O Vendedor aceita ou recusa.
5. O sistema atualiza o status e notifica o Jogador.

**Exceções**
- E1. O Jogador tenta propor troca no próprio anúncio: o sistema bloqueia.
- E2. Usuário bloqueado: a proposta não é permitida.

---

### UC26 — Inscrever-se em torneio (com UC27 Lista de espera)

| Campo | Descrição |
|---|---|
| **Ator principal** | Jogador |
| **Plataforma** | Web e Mobile |
| **Pré-condições** | Jogador logado e não banido do torneio; inscrições abertas. |
| **Pós-condições** | Jogador inscrito ou na lista de espera. |

**Fluxo principal**
1. O Jogador abre o torneio.
2. O sistema mostra jogo, formato, datas e vagas restantes.
3. O Jogador toca em "Inscrever-se".
4. O sistema registra a inscrição e atualiza as vagas.

**Fluxo alternativo A1 — Torneio lotado (UC27)**
- 4a. Não há vagas: o sistema oferece a lista de espera.
- 4b. Se uma vaga abrir, o primeiro da fila é promovido e notificado.

**Exceções**
- E1. Jogador banido do torneio: inscrição negada.
- E2. Inscrições encerradas: botão indisponível.

---

### UC29 / UC28 — Publicar no canal oficial e comentar

| Campo | Descrição |
|---|---|
| **Atores** | Gestor de Estúdio (publica) e Jogador (comenta) |
| **Plataforma** | Web |
| **Pré-condições** | Gestor delegado pelo Administrador para aquele desenvolvedor. |
| **Pós-condições** | Publicação visível na página do desenvolvedor. |

**Fluxo principal**
1. O Gestor abre a página do desenvolvedor.
2. Escreve a novidade e anexa imagens.
3. O sistema publica no mural oficial.
4. Jogadores leem e comentam.
5. O Gestor pode editar, excluir ou remover comentários.

**Regras de negócio**
- RN04. Somente a conta oficial ou gestores publicam; os demais apenas comentam.
- RN05. Ser gestor não dá acesso ao painel desktop.

---

### UC30 — Customizar perfil e cosméticos

| Campo | Descrição |
|---|---|
| **Ator principal** | Jogador |
| **Plataforma** | Web e Mobile |
| **Pré-condições** | Jogador logado com ao menos um cosmético desbloqueado. |
| **Pós-condições** | Visual do perfil ou da página do jogo atualizado. |

**Fluxo principal**
1. O Jogador abre a customização (pelo perfil ou pelo botão ao lado das notificações).
2. O sistema mostra molduras, fundos, títulos e efeitos disponíveis.
3. O Jogador escolhe um item e vê a prévia.
4. Confirma.
5. O sistema salva e mostra "Cosmético atualizado".

**Exceções**
- E1. Item bloqueado: o sistema mostra como desbloquear.
- E2. Falha ao salvar: o sistema avisa e mantém o visual anterior.

---

### UC42 — Controlar estoque

| Campo | Descrição |
|---|---|
| **Ator principal** | Administrador |
| **Plataforma** | Desktop |
| **Pré-condições** | Logado no painel com papel de administrador. |
| **Pós-condições** | Estoque atualizado e movimentação registrada. |

**Fluxo principal**
1. O Administrador abre "Estoque".
2. O sistema lista jogos com quantidade e alerta de estoque baixo.
3. O Administrador registra entrada, saída ou ajuste, com motivo e fornecedor.
4. O sistema atualiza a quantidade e grava o histórico.

**Exceções**
- E1. Saída maior que o estoque: o sistema bloqueia.

---

### UC45 — Gerenciar equipe MIDIAS

| Campo | Descrição |
|---|---|
| **Ator principal** | Administrador |
| **Plataforma** | Desktop |
| **Pós-condições** | Página pública "Equipe" atualizada automaticamente. |

**Fluxo principal**
1. O Administrador abre "Equipe".
2. Cria ou edita um integrante: nome, cargo, bio, foto, capa e redes.
3. Reordena com "subir" e "descer".
4. Salva; o sistema confirma e a página pública reflete a mudança.

**Exceções**
- E1. Falha ao salvar: o sistema avisa e não perde os dados digitados.
- E2. Foto removida antes de salvar: o arquivo enviado é apagado.

---

### UC48 / UC49 — Analisar denúncia e banir

| Campo | Descrição |
|---|---|
| **Atores** | Moderador e Administrador |
| **Plataforma** | Desktop |
| **Pós-condições** | Denúncia resolvida e registrada no histórico. |

**Fluxo principal**
1. O Moderador abre "Denúncias".
2. Vê o conteúdo denunciado e o motivo.
3. Decide: arquivar, remover conteúdo ou banir (UC49).
4. O sistema grava a decisão no histórico de moderação.

**Fluxo alternativo — Banir (UC49)**
- 3a. Define prazo e motivo; o usuário fica impedido de interagir até a data.
- 3b. O usuário pode enviar recurso de banimento.

---

## 5. Matriz de rastreabilidade

| Caso de uso | Web | Mobile | Desktop | Entidades do MER |
|---|:-:|:-:|:-:|---|
| UC01 Buscar | ✓ | ✓ | ✓ | JOGO, BUNDLE, DESENVOLVEDOR |
| UC04 Comprar | ✓ | ✓ | | PEDIDO, ITEM DE PEDIDO, BIBLIOTECA |
| UC05 Cupom | ✓ | ✓ | | CUPOM, USO DE CUPOM |
| UC13 Anunciar | ✓ | ✓ | | ANÚNCIO, FOTO DE ANÚNCIO |
| UC14 Troca | | ✓ | | PROPOSTA DE TROCA |
| UC17 Certificado | | | ✓ | CERTIFICADO, PERFIL DE VENDEDOR |
| UC21 Fórum | ✓ | ✓ | | TÓPICO, RESPOSTA, CURTIDA |
| UC22 Review | ✓ | ✓ | | REVIEW COMPLETA |
| UC24 Chat | ✓ | ✓ | | CONVERSA, MENSAGEM |
| UC26 Torneio | ✓ | ✓ | | TORNEIO, PARTICIPANTE, LISTA DE ESPERA |
| UC29 Canal oficial | ✓ | | | PUBLICAÇÃO OFICIAL, GESTOR DE CANAL |
| UC30 Customizar | ✓ | ✓ | | COSMÉTICO, PERFIL |
| UC31 Notificações | ✓ | ✓ | | NOTIFICAÇÃO |
| UC42 Estoque | | | ✓ | MOVIMENTAÇÃO DE ESTOQUE, FORNECEDOR |
| UC45 Equipe | ✓ (leitura) | | ✓ | MEMBRO DA EQUIPE |
| UC46 Desenvolvedores | ✓ (leitura) | | ✓ | DESENVOLVEDOR |
| UC48 Denúncias | | | ✓ | DENÚNCIA, HISTÓRICO DE MODERAÇÃO |
| UC50 Conceder XP | | | ✓ | LOG DE XP, NÍVEL |

---

## 6. Requisitos não funcionais ligados aos casos de uso

| Código | Requisito |
|---|---|
| RNF01 | Web, Mobile e Desktop usam o mesmo banco: uma mudança no painel aparece no site. |
| RNF02 | Cada pessoa só lê e altera o que tem permissão (regras de acesso no banco). |
| RNF03 | Operações críticas (compra, cupom, XP, status de pedido) só por funções confiáveis. |
| RNF04 | Telas móveis funcionam por toque e cabem na tela do celular. |
| RNF05 | Visitantes veem catálogo e páginas públicas sem login. |
