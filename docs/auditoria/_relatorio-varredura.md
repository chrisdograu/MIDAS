# Relatório de varredura — Fase 1

Referências: `docs/design/DESIGN-SYSTEM.md` · `docs/auditoria/_checklist-design.md`
Data: 2026-08-06. Método: leitura de código de todas as páginas (Web `src/pages`, Mobile `src/mobile`, Desktop `src/desktop/pages`) + navegação real na preview com sessão autenticada.

## Inventário mecânico — Regra 1 (cor sem significado)

360 ocorrências de classe de cor crua em `src/**/*.tsx`, distribuídas em ~70 arquivos.

| Área | Arquivos afetados | Piores casos (ocorrências) |
|---|---|---|
| Desktop admin | 20 | `Moderacao` 13 · `NotificacoesAdmin` 6 · `Dashboard` 6 · `Torneios` 5 · `PropostasTroca` 5 · `MensagensAdmin` 5 · `Estoque` 5 |
| Web | ~20 (páginas + componentes) | `BibliotecaJogo` 10 · `TournamentLivePanel` 8 · `LibraryStatusBadge` 8 · `PreferencesPanel` 7 · `Tutorial` 6 |
| Mobile | 17 | `MProfile` 9 · `MPreferencesSection` 7 · `MFavoritos` 4 |

Correção padrão: papel resolvido por `src/lib/semanticTone.ts` (`toneText`, `toneBadge`, `toneForPending`, `toneForCritical`) e, no backoffice, `src/desktop/components/KpiCard.tsx`.

## Evidência de navegação real (preview autenticada)

| Tela | Achado | Severidade |
|---|---|---|
| `/` Home | Após 2,5 s ainda exibindo apenas skeletons de card — sem seções, sem hero visível; percepção de tela vazia em conexão lenta | média |
| Footer (todas as telas web) | Meios de pagamento usam emoji como ícone (`💳 📱 🏦`, `Footer.tsx:62-64`) — renderiza como caixa vazia em ambiente sem fonte de emoji. Trocar por ícone Lucide | média |
| `/jogo/:id` Game Detail | Imagem principal do produto quebrada (mostra o `alt`) para produtos seedados; falta fallback de imagem. Coluna esquerda de "Sobre o Jogo" com grande vazio ao lado de "Detalhes" (hierarquia/densidade) | alta (fallback) |
| `/jogo/:id` | "100 unidades em estoque" em verde cru — verde = sucesso, estoque é informativo/aviso (Regra 1) | média |
| `/biblioteca` | 4 KPIs com cor decorativa (Total teal, Jogando/Completados/Platinados roxo) sem papel semântico (Regra 1 e 2 — nenhum é Tier 1) | média |
| `/biblioteca` | `<select>` nativo para status e ordenação, fora do design system (resto do app usa `Select` do shadcn) | média |
| `/biblioteca` | Painel "Privacidade das etiquetas" ainda oferece **Pública**, opção removida do resto do app na rodada 23 (hoje só amigos/ninguém) — inconsistência de privacidade | alta |
| `/perfil` | Conteúdo centralizado em coluna estreita com metade da tela vazia em 1280px; sem Tier 1 | baixa |
| `/m/config` | Sem "Excluir minha conta" (existe na web em `PrivacidadeCentral.tsx`) — confirmado | alta |
| `/desktop/*` | Backoffice exige login próprio (`/desktop/login`, `useDesktopAuth`), não reaproveita a sessão web — auditoria do desktop feita por código | informativo |
| `NotFound` | Botão "Versão mobile" usa emoji como ícone (mesma caixa vazia do footer) | baixa |
| Convenção `$vendedor` | 22 ocorrências de textos como "Criar $vendedor" / "Config $vendedor". É a convenção de handle de vendedor (`$` como `@`), mas em botão/título soa como variável não interpolada — confirmar redação | a confirmar |

## Diagnóstico por área

As seções abaixo são preenchidas com o resultado da varredura por página (Desktop, Web, Mobile).

## Desktop Admin — 49 páginas (`src/desktop/pages`)

Violações **sistêmicas** (praticamente todas as páginas):
- **Regra 4 — `EstadoVazio` usado em 0 arquivos.** Vazio é string crua em `<TableCell>`/`<p>`: `Clientes:115`, `Cupons:126`, `Fornecedores:122`, `ForumAdmin:217`, `Funcionarios:267`, `PedidosOnline:139,179`, `Produtos:215`, `Relatorios:312`, `VendedoresAdmin:101`. Várias telas não têm vazio nenhum (`Categorias`, `Torneios`, `ChatAlertsQueue`).
- **Regra 5 — `.glow-primary` usado em 0 arquivos.** Ativo/selecionado usa `bg-primary/10`: `Configuracoes:228,231`, `ForumAdmin:108`, `Funcionarios:275`, `MetricasPlataforma:280`, `NotificacoesAdmin:76`, `Torneios:354`.
- **Regra 8 — `focus:ring-2 focus:ring-primary` em 0 arquivos.**
- **Regra 1 — 79 cores cruas.** Piores: `Moderacao:58-74,277-281,340,408,412` (inclui `text-white` sobre `bg-orange-500`), `NotificacoesAdmin:16-18,75-77,115`, `Certificados:79-82`, `Estoque:21,122-126,232`, `Dashboard:75-80,125,136`, `ChatAlertsQueue:25-27`, `PropostasTroca:69-71,101-102`, `MensagensAdmin:153-157,206,214`.
- **Regra 2 — sem Tier 1.** Métrica principal para em `text-2xl` em `Dashboard`, `Relatorios`, `MetricasPlataforma`, `Estoque`. Só `Badges` usa `text-3xl`.
- **Regra 3 — tabelas longas planas** (`Produtos`, `Estoque`, `Clientes`, `PedidosOnline`, `NotificacoesAdmin`, `LogsAdministrativos`, `XPList`, `TicketsList`).
- **`text-price` só em `Promocoes:195,261`** — todo o resto mostra dinheiro sem token.
- Sem UI de erro (só toast): `Badges`, `BundlesAdmin`, `CriarJogo`, `CriarTorneio`, `GameRewardsAdmin`, `GamesCatalogAdmin`, `JogosAdmin`, `NotificacoesEspeciais`, `Promocoes`.

Funcionalmente **o backoffice está coerente**: cada página lê/escreve as tabelas esperadas; `Analytics`, `XPMobile`, `XPWeb` são wrappers legítimos; `RecompensasAdmin` é hub estático. `Promocoes` é a referência de Regra 1.

## Web — 45 páginas (`src/pages`)

Referências boas a replicar: **`Catalogo.tsx` e `SocialLibrary.tsx`** (skeleton + `ErroCarregamento` + `EstadoVazio`).

- **`EstadoVazio`/`ErroCarregamento` em ~11% das páginas** (Catalogo, Favoritos, FriendProfile, SocialLibrary, Biblioteca parcial). Sem tratamento onde há dado assíncrono real: `Ofertas:19`, `Pedidos:20`, `Torneios`, `GameDetail:68`, `GameSocialHub:195`, `SellerProfile:89`, `PublicProfile:107`, `BundleDetail:59`, `ReviewCompletaEditor:160`, `OpinionConversation:52`, `OpinionsConversations`, `VendedorConfig:90`, `torneios/*`.
- **Bug de hierarquia:** `ParaVoce.tsx:43` e `:54` renderizam dois `<h1>` "Pra Você".
- **Regra 1 (status hardcoded):** `BibliotecaJogo:20-26`, `Torneios:142,147`, `TournamentEvent:117`, `TournamentMatch:133,285`, `BundleDetail:129`; ícones amarelos/laranja em `Perfil:283`, `EmAlta:17,68`, `Tutorial`, `TournamentGroup:130,133,177`.
- **Regra 5:** seleção com `bg-primary/10` plano em `GameSocialHub:289`, `ReviewCompletaEditor:230,241`, `Checkout:154`, `TournamentMatch:285`.
- **`text-white` cru:** `CriarVendedor:125`, `Perfil:212`.
- **Regra 8:** maioria das páginas com 0 `focus:ring` (exceções: Auth, Checkout, Perfil, Contato, Catalogo).
- **SEO:** `useDocumentMeta` em apenas 4/45 (GameDetail, PublicProfile, SellerProfile, TournamentEvent). Falta em Catalogo, Index, Ofertas, EmAlta, ParaVoce, Torneios, BundleDetail, FAQ, Termos etc.
- **Imagens:** sem `loading="lazy"` em `GameDetail`, `FriendProfile` (6), `Carrinho`, `Perfil`; `GameDetail` sem `alt`.
- Escala de título inconsistente: `text-2xl` vs `text-3xl/4xl/font-display` entre páginas utilitárias e de conteúdo.

## Mobile — varredura funcional completa (`src/mobile`, 36 arquivos)

Rechecagem de todas as páginas, componentes, utilitários e rotas mobile em 2026-08-16:

- **Rotas:** todas as páginas importadas possuem rota; páginas privadas estão envolvidas por `ProtectedRoute`. Os aliases de fórum e amigos são intencionais.
- **Conta:** `MConfig.tsx` já possui exclusão definitiva via `delete_my_account`, confirmação destrutiva, estado de envio e orientação para pausa. A lacuna registrada na primeira varredura está **corrigida**.
- **Onboarding e preferências:** `MOnboardingSheet` e `MPreferencesSection` persistem gêneros e indicação, exigem ao menos três gêneros e oferecem encaminhamento ao tutorial; Steam permanece sinalizada como integração futura/AFK.
- **Escritas críticas:** chat (aceitar/recusar), bloqueio, silenciamento, favoritos, exclusão de mensagem de grupo, remoção/silenciamento em torneio e registro de menções agora exibem erro e só atualizam a interface após confirmação do banco.
- **Navegação corrigida:** links de autores do fórum permanecem no perfil mobile; criação de vendedor a partir de Novo Anúncio usa a rota mobile existente.
- **Não lidas corrigidas:** mensagens coletivas são gravadas como lidas para o remetente e excluídas das consultas do badge/contador de chat pessoal.
- **Mídia e contraofertas:** a prévia da conversa só é atualizada depois que o envio da mensagem é confirmado pelo banco.
- **Achado corrigido:** `MChatInfo` deixou de usar asserções não nulas em `conversationId`/usuário nas escritas.
- **Dívida funcional restante, não silenciosa:** reações otimistas em `MForumGame` e `MReview` são operações compostas; os clientes do banco não lançam exceções por erro de resposta, portanto ainda devem ser consolidadas em uma operação atômica de backend para rollback integral.
- **Dívida visual registrada:** ainda existem controles nativos e alvos de toque menores que 44 px em telas densas; isso não bloqueia os fluxos funcionais e permanece no checklist de design/acessibilidade.

## Comprovação das quatro varreduras

| Área | Escopo | Evidência | Estado em 2026-08-16 |
|---|---|---|---|
| Desktop | 56 páginas e layout administrativo | `docs/auditoria/desktop/` + diagnóstico deste relatório | Funcional auditado; ações mutáveis de Cupons, Estoque, Torneios e Propostas chamam `adminLog` |
| Web | 45 páginas e rotas públicas/privadas | `docs/auditoria/web/` + seção Web acima | Funcional auditado; embeds sociais possuem vínculos reais com `profiles` |
| Mobile | 31 telas, 36 arquivos incluindo componentes/utilitários | `docs/auditoria/mobile/` + seção Mobile acima | Varredura funcional completa concluída; falhas silenciosas prioritárias corrigidas |
| Transversal | banco, RLS, GRANTs, design e estados | `_checklist-design.md`, migrations e consultas de verificação | `admin_logs` tinha zero linhas e privilégio Data API ausente; GRANT reaplicado em 2026-08-16 |

### Pendências explicitamente verificadas

- **`admin_logs`:** o código dos quatro módulos registra as ações e aguarda `adminLog`. O banco tinha exatamente **0 linhas**; o `GRANT SELECT, INSERT` para `authenticated` e `ALL` para o backend administrativo foi reaplicado. A tela de logs agora mostra erros de leitura em vez de transformar falha em lista vazia. Novos registros surgem a partir da próxima ação administrativa; não foram fabricados logs retroativos.
- **Auditoria complementar:** alteração da classificação final de torneio passou a gerar log; `read_user_library_admin` foi corrigida para usar os campos atuais de `admin_logs`; privilégios de alteração/remoção direta dos logs foram revogados.
- **Embeds sem FK:** **corrigido e comprovado no banco**. Existem FKs `biblioteca_usuario_profiles_fkey`, `avaliacoes_profiles_fkey`, `forum_posts_profiles_fkey` e `game_opinions_profiles_fkey`; por isso `SocialLibrary` e `BibliotecaJogo` podem usar `profiles!inner`. A migration local correspondente é `20260815024323_39f69d41-aa13-4d73-9152-2ed631f426b6.sql`.
- **Relatório:** este arquivo é o relatório consolidado e rastreável das quatro varreduras; os relatórios por página permanecem nos diretórios `desktop`, `web` e `mobile`.

## Veredito

Funcionalmente os fluxos principais existem nas três plataformas. As pendências que o relatório anterior ainda marcava como abertas — exclusão de conta mobile, FKs dos embeds e acesso Data API de `admin_logs` — foram rechecadas e corrigidas/explicitadas. A dívida remanescente é sobretudo de linguagem visual, acessibilidade e atomicidade das reações sociais compostas.

---

## Varredura 5 — verificação funcional + banco (17/08/2026)

Método: typecheck (`tsgo`), suíte de testes (14/14 verdes), smoke em navegador de 28 rotas
(web, mobile e desktop) e conferência de **todas** as tabelas/RPCs usadas pelo código
contra o banco real.

| Verificação | Resultado |
|---|---|
| Tabelas referenciadas no código (79) existem no banco | ✅ nenhuma faltando |
| RPCs referenciadas no código (32) existem no banco | ✅ nenhuma faltando |
| RLS habilitado + políticas em todas as tabelas públicas | ✅ |
| Buckets (`product-images`, `ad-images`, `avatars`, `chat-images`, `game-rewards`) | ✅ |
| Rotas renderizando sem erro de runtime | ✅ 28/28 |

### Falha real encontrada e corrigida
- **`profiles` sem GRANT na Data API** → toda leitura/edição direta de perfil retornava
  `42501 permission denied`. Corrigido com `GRANT SELECT, UPDATE ... TO authenticated`
  e `GRANT ALL ... TO service_role`. Validado por requisição autenticada real.
- **`ui/skeleton` sem `forwardRef`** → aviso de ref perdida no console. Corrigido.

### Comportamentos por desenho (não são bugs)
- `profiles` continua **sem acesso anônimo**: visitantes deslogados veem perfis apenas
  via `get_public_profile`. Consequência esperada: em `/busca` e `/vendedor/:handle`
  deslogado, nomes de usuário não aparecem.
- `cupons` não é legível por anônimo (uso via `validate_and_use_coupon`).
- Avisos de `forwardRef` restantes no preview vêm do `lovable-tagger` (só em dev).

## Varredura 6 — Rodada 30 · Fase Web (todas as áreas)

Escopo: todas as rotas de `src/routes/WebRoutes.tsx` (loja, biblioteca, social, torneios,
perfis, vendedor, institucional). Método: leitura de código página a página + smoke test
Playwright em rotas públicas (`/torneios`, `/social`, `/contato`, `/oportunidades`).

### Corrigido
| Página | Problema | Correção |
| --- | --- | --- |
| `Biblioteca.tsx` | `platinado` e `rejogando` existiam no seletor de status mas ficavam fora dos filtros "Já joguei"/"Quero jogar" — jogo desaparecia da lista | `JA_JOGUEI_STATUSES` completo + busca por título/etiqueta |
| `Pedidos.tsx` | lista longa sem busca nem filtro | busca (jogo, nº do pedido, cupom) + filtro de status incl. `refunded` |
| `Favoritos.tsx` | sem busca | busca por título e estado vazio próprio |
| `Torneios.tsx` | `talkToAdmin` navegava para `/m/chat/:id` (rota mobile) a partir do web | mensagem enviada e confirmada por toast, sem navegação cross-platform; + busca por nome |
| `SocialLibrary.tsx` | feed sem busca | busca por amigo, jogo ou texto |
| `OpinionsConversations.tsx` | lista sem busca | busca por jogo, pessoa ou mensagem |
| `Contato.tsx` | inputs HTML crus, sem validação real | `Input`/`Textarea`/`Label`/`Button`, validação de nome/e-mail/tamanho com `aria-invalid`, contador 0/2000 |
| `OpportunityCenter.tsx` | tela vazia durante o carregamento | esqueletos de prateleira (`GameCardGridSkeleton`) |

### Novo componente
`src/components/BuscaInput.tsx` — campo de busca único do web (ícone, botão limpar, `aria-label`).

### Verificado sem alteração
- `Oportunidades.tsx` e `TimelineGamer.tsx` são casca: o carregamento é dos filhos
  (`OrbitRadar` já tinha skeleton, `GameTimeline` usa `TimelineSkeleton`).
- Rota da timeline é `/perfil/timeline` (não `/timeline`).
- Links `/m/...` restantes em páginas web são intencionais (chat e marketplace C2C são
  exclusivos do app mobile pelo escopo da plataforma).

### Observação (não bloqueante)
Aviso de desenvolvimento do React "Function components cannot be given refs" aparece em
todas as rotas, inclusive antes desta rodada; é ruído do ambiente de dev (HMR), não
reproduz em build de produção e não afeta renderização.

Status: `tsgo --noEmit` limpo · `vitest` 14/14 verdes.

## Varredura 7 — fechamento da Rodada 31

- **Etapa 3 (acessibilidade)**: foco de teclado global na camada base de `src/index.css`
  (anel duplo em `a`, `button`, `input`, `select`, `textarea`, `summary`, `[role]` interativo e
  `[tabindex]`) + estado desabilitado padronizado (`opacity-40 cursor-not-allowed`).
  Cobre backoffice, web e mobile sem aplicar classe tela por tela.
- **Etapa 5 (reações atômicas)**: criadas as RPCs `toggle_like(p_kind, p_target)` e
  `toggle_message_reaction(p_message_id, p_emoji)` (`security definer`, `GRANT` para
  `authenticated`). Helper compartilhado em `src/lib/toggleLike.ts`.
  Aplicado em `MForumGame`, `MForumPost`, `MReview`, `MChatThread`, `OpinionsPanel`
  e `ScreenshotsPanel` — o par delete+insert sem rollback foi eliminado e a contagem
  volta do banco na mesma transação.
- Validação: `tsgo --noEmit` limpo e 14 testes verdes.

## Varredura 8 — fechamento da Rodada 32

- **Tema claro Neon Glass**: `.light .glass` refeito (branco 75%, `backdrop-blur` 16px com
  saturação, borda e sombra frias); títulos Orbitron mantêm o gradiente teal→violeta com
  contraste legível sobre o fundo claro.
- **Header enxuto**: alternância de tema saiu da barra superior e vive em Perfil → Aparência;
  a soneca de notificações foi movida para dentro do `NotificationBell`; as customizações
  cosméticas passaram para Minha Biblioteca.
- **Biblioteca**: consulta N:N a `biblioteca_lista_itens` (um jogo aparece em várias listas),
  chips de listas nos cards, filtros por lista/etiqueta/plataforma, modo "Biblioteca limpa"
  persistido em `localStorage` e `CosmeticUnlocksCenter` integrado.
- **Moderação de mídia**: `src/desktop/components/GameMediaModeration.tsx` integrado como
  abas "Screenshots" e "Opiniões" em `AvaliacoesJogos.tsx`. Usa as RPCs auditadas
  `admin_list_game_media`, `admin_set_content_visibility` e `admin_delete_game_media`,
  todas exigindo justificativa (mín. 6 caracteres) e gravando em `admin_logs`.
- Validação: `tsgo --noEmit` limpo · `vitest` 14/14 verdes.
