# Fluxos globais do MIDIAS

Os **7 fluxos-mãe** que atravessam várias páginas. Cada arquivo de página referencia estes fluxos em vez de redesenhá-los.

Diagramas em **mermaid** — sem emojis dentro dos blocos (quebra o lexer).

---

## Fluxo 1 — Descoberta → Compra (B2C)

O caminho comercial padrão. É o fluxo que a banca vai testar primeiro.

```mermaid
flowchart TD
  Home[Home /] --> Descoberta{Como descobriu?}
  Descoberta -->|Orbita, Escolha do Dia| GameDetail[Game Detail /jogo/:id]
  Descoberta -->|Catalogo/Ofertas/EmAlta| GameDetail
  Descoberta -->|Busca global| GameDetail
  GameDetail --> Decide{Quer comprar?}
  Decide -->|Sim| Carrinho[Carrinho /carrinho]
  Decide -->|Ainda nao| Favoritos[Favoritos /favoritos]
  Decide -->|Compara| Bundle[Bundle Detail /bundle/:id]
  Carrinho --> Checkout[Checkout /checkout]
  Checkout --> Sucesso[Checkout Sucesso]
  Sucesso --> Biblioteca[Biblioteca /biblioteca]
  Sucesso --> Pedidos[Pedidos /pedidos]
  Favoritos -.notificacao de preco.-> GameDetail
```

**Pontos de fricção conhecidos:**
- Sessão expirada entre Carrinho e Checkout (P1)
- Estoque zera entre adicionar e finalizar (P1)
- Cupom aplicado no Carrinho não persiste se voltar para catálogo (P2)

---

## Fluxo 2 — Descoberta social

O caminho que valida a hipótese de "MIDIAS é rede social de gamers, não só loja".

```mermaid
flowchart TD
  Home[Home] --> GD[Game Detail]
  GD --> Reviews[Painel de reviews]
  Reviews --> ReviewCompleta[Review Completa /jogo/:id/review-completa]
  Reviews --> PerfilAutor[Perfil publico do autor]
  PerfilAutor --> BibliotecaAmigo[Biblioteca dele]
  PerfilAutor --> Seguir[Seguir / Adicionar amigo]
  BibliotecaAmigo --> GD2[Outro jogo]
  Seguir --> Feed[Ver atividade no /social]
```

---

## Fluxo 3 — Comunidade (fórum)

```mermaid
flowchart TD
  Forum[/forum/] --> Cat{Escolhe categoria ou jogo}
  Cat -->|Categoria| Lista[Lista de topicos]
  Cat -->|Jogo| ForumJogo[Forum do jogo]
  Lista --> Post[Detalhe do post]
  ForumJogo --> Post
  Post --> Reply[Responde]
  Post --> Report[Denuncia]
  Post --> PerfilAutor[Perfil do autor]
  PerfilAutor --> Chat[Iniciar chat 1:1]
  Report --> Admin[Fila de moderacao]
```

**Observação:** o fórum web (`ForumGeral.tsx`) e o mobile (`MForum.tsx`) compartilham o mesmo banco mas têm UIs distintas. Auditar paridade na Fase B.

---

## Fluxo 4 — Competitivo (torneios)

```mermaid
flowchart TD
  Torneios[/torneios/] --> Evento[Evento /torneios/:id]
  Evento --> Inscrever{Inscricao aberta?}
  Inscrever -->|Sim, solo| Confirma[Confirmacao]
  Inscrever -->|Sim, grupo| Grupo[/torneios/:id/grupo/]
  Grupo --> Chat[Chat do grupo]
  Confirma --> Chaveamento[Bracket ao vivo]
  Chaveamento --> Match[/torneios/:id/partida/:matchId/]
  Match --> ChatLive[Chat ao vivo do match]
  Match --> Predictions[Previsoes / MVP]
  Match --> Historico[Storylines geradas]
```

---

## Fluxo 5 — C2C (marketplace mobile)

**Só existe no mobile (Capacitor).** Web tem apenas leitura de perfil de vendedor via `/vendedor/:handle`.

```mermaid
flowchart TD
  MMarket[MMarketplace] --> Anuncio[MMarketplaceItem]
  Anuncio --> Chat[MChatThread com vendedor]
  Anuncio --> Proposta[Proposta de troca]
  Proposta --> Aceita{Aceita?}
  Aceita -->|Sim| Certificado[Emite certificado opcional]
  Aceita -->|Nao| Fim[Fim]
  Certificado --> Admin[Certificados.tsx gerencia]
  Chat --> Denuncia[Denunciar usuario]
```

---

## Fluxo 6 — Notificação → Ação

O sino é o teletransporte do ecossistema. Toda notificação **precisa** cair em um contexto específico, nunca só na Home.

```mermaid
flowchart TD
  Sino[Bell no header] --> Lista[Lista de notificacoes]
  Lista --> Tipo{Tipo}
  Tipo -->|Pedido| Pedidos[/pedidos/]
  Tipo -->|Mensagem| Chat[/chat/thread/id]
  Tipo -->|Menção fórum| Post[/forum/post/id]
  Tipo -->|Torneio| Evento[/torneios/id]
  Tipo -->|Amigo comprou| GameDetail[/jogo/id]
  Tipo -->|Preço caiu| GameDetail
  Tipo -->|Denuncia resolvida| Perfil[/perfil]
```

**Regra de design:** notificação sem destino específico é bug, não feature. Rejeitar no code review.

---

## Fluxo 7 — Cosmético desbloqueado → Customização

Fluxo isolado com sino próprio (`CosmeticUnlocksCenter`) para não competir com o sino de notificações normal.

```mermaid
flowchart TD
  Acao[Usuario ganha XP / completa conquista] --> Trigger[Trigger de banco]
  Trigger --> Insert[Insere em user_cosmetic_loadout como desbloqueado]
  Insert --> Sino[Sino cosmetico pisca no header]
  Sino --> Center[Unlock Center abre]
  Center --> Preview[Preview do cosmetico]
  Preview --> Customizar[/m/perfil?tab=customizacao ou /perfil?tab=customizacao/]
  Customizar --> Aplicar[Aplica no perfil / pagina de jogo]
```

---

## Matriz de conexão entre páginas

Onde cada página **naturalmente** leva. `X` = ponte forte (usada por >20% dos usuários que passam pela origem, estimativa). `.` = ponte fraca ou inexistente.

|              | Home | Cat | Ofertas | EmAlta | PraVc | GameDet | Bundle | Torneios | Perfil | Fórum | Chat | Biblioteca |
| ------------ | :--: | :-: | :-----: | :----: | :---: | :-----: | :----: | :------: | :----: | :---: | :--: | :--------: |
| **Home**     |  —   |  X  |    X    |   X    |   X   |    X    |   X    |    X     |   X    |   X   |  .   |     X      |
| **Catálogo** |  .   |  —  |    X    |   .    |   .   |    X    |   .    |    .     |   .    |   .   |  .   |     .      |
| **Ofertas**  |  .   |  X  |    —    |   .    |   .   |    X    |   X    |    .     |   .    |   .   |  .   |     .      |
| **GameDet**  |  .   |  .  |    .    |   .    |   .   |    —    |   .    |    .     |   X    |   X   |  X   |     X      |
| **Perfil**   |  X   |  .  |    .    |   .    |   .   |    X    |   .    |    X     |   —    |   X   |  X   |     X      |
| **Fórum**    |  X   |  .  |    .    |   .    |   .   |    X    |   .    |    .     |   X    |   —   |  X   |     .      |

**Leitura:** Home é hub verdadeiro (linha cheia de X). GameDetail é o ponto de convergência — todo mundo chega lá. Fórum é subutilizado como origem para descoberta comercial (linha quase vazia para GameDetail via jogo mencionado — oportunidade P1).

---

## Princípios cross-fluxo

1. **Todo estado é deep-linkável.** Se você não consegue mandar a URL para um amigo e ele ver a mesma coisa, está errado.
2. **Notificação sempre cai em contexto.** Nunca em Home.
3. **Voltar (browser back) preserva scroll e filtros.** URL guarda `?platform=&sort=&q=` — checar em `Catalogo.tsx`.
4. **Sessão perdida no meio do fluxo redireciona para login e volta ao ponto exato.** Usar `redirect_to` em query.
5. **Feedback ótico é imediato.** Optimistic update no favoritar, curtir, adicionar ao carrinho — rollback silencioso se falhar.
