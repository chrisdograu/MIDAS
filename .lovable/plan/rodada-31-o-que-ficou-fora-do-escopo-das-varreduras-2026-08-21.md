# Rodada 31 — o que ficou fora do escopo das varreduras

## Resposta curta

Sim: as três plataformas já foram varridas página a página (Desktop 49 telas, Web 45, Mobile 28 telas / 36 arquivos), registradas nas Varreduras 1 a 6 do relatório. O que sobrou é dívida consciente que eu deixei de fora por ser **design/acessibilidade transversal** ou **refatoração de backend**, não bug funcional. Abaixo está a lista verificada agora, com o que propor fazer.

## Pendências confirmadas nesta checagem

1. **Fase Mobile da Rodada 30 não foi feita.** A Fase Web recebeu busca, filtros, estados vazios e esqueletos; o mobile foi auditado apenas funcionalmente (agosto/16), sem o mesmo passe de busca/estado vazio/esqueleto por tela.
2. `**<select>` nativo em 18 arquivos** (web, mobile e desktop), fora do design system, enquanto o resto do app usa `Select` do shadcn. Aparece em telas de peso: `Checkout`, `Catalogo`, `Biblioteca`, `BibliotecaJogo`, `Pedidos`, `ReviewCompletaEditor`, `MNewAd`, `MTournamentGroup`, `Promocoes`, `Badges`, `IntegracoesAdmin`.
3. **Foco de teclado ausente no backoffice:** zero arquivos em `src/desktop` com anel de foco visível. Quem navega por Tab não sabe onde está.
4. `**glow-primary` em apenas 3 arquivos do desktop:** estado ativo/selecionado ainda é `bg-primary/10` plano em vários menus e abas.
5. **Alvos de toque abaixo de 44 px** em telas mobile densas (registrado no checklist, nunca fechado).
6. **Emoji como ícone** ainda em `Tutorial.tsx`, `Tutoriais.tsx` e nos rótulos de `BuscaGlobal.tsx` (`📱`/`🖥`) — cai como caixa vazia em ambiente sem fonte de emoji.
7. **Reações sociais compostas não atômicas** em `MForumGame` e `MReview`: curtir/descurtir grava em duas etapas sem rollback. Precisa virar uma função de banco única.

## Já resolvido (não voltam)

- Metadados por rota: centralizados em `RouteMeta` dentro de `WebRoutes`, cobrindo as rotas web.
- Cores cruas: caíram de 360 ocorrências para 6 e há teste de regressão travando o build.
- `EstadoVazio`: presente em 41 arquivos do desktop.
- Emojis do rodapé e do `NotFound`, exclusão de conta mobile, FKs dos embeds sociais e GRANT de `admin_logs`/`profiles`.

## Proposta de execução

**Etapa 1 — Fase Mobile da Rodada 30 (paridade com o web)**
Passe tela a tela em `src/mobile/pages`: busca onde há lista longa (marketplace, favoritos, biblioteca social, fórum, conversas, torneios), esqueleto de carregamento, `EstadoVazio` padronizado e correção de qualquer filtro que esconda registro válido (mesma classe de bug do `Biblioteca.tsx`).

**Etapa 2 — Unificação de controles**
Trocar os 18 `<select>` nativos por `Select` do design system, preservando comportamento e rótulos.

**Etapa 3 — Acessibilidade**
Anel de foco visível padrão no backoffice, `glow-primary` no estado ativo, e alvos de toque mínimos de 44 px nas telas mobile densas.

**Etapa 4 — Ícones**
Substituir emoji-ícone por Lucide em `Tutorial`, `Tutoriais` e `BuscaGlobal`, mantendo o significado "mobile / web".

**Etapa 5 — Atomicidade das reações**
Função de banco única para curtir/descurtir em fórum e review, com contagem e registro na mesma transação; o mobile passa a chamar só essa função.

**Etapa 6 — Relatório**
Varredura 7 no relatório de auditoria com o antes/depois de cada item.

## Detalhes técnicos

- Etapa 2 mantém `value`/`onValueChange` equivalentes e não altera consultas.
- Etapa 3 usa utilitário compartilhado de foco, sem cor crua (o teste de tokens continua travando o build).
- Etapa 5 cria uma RPC `security definer` com `GRANT` para `authenticated`, substituindo as duas escritas otimistas; o retorno traz o novo total para a interface.
- Fechamento com `tsgo --noEmit`, suíte de testes e smoke em navegador nas rotas mobile alteradas. faças as todas etapas, visto que elas nao sapesadas e bem faceis de resolver. se nao conseguir, faça o maximo.