# [Nome da página] — `/rota`

> **Status:** rascunho | revisão | final
> **Plataforma:** Web | Mobile | Desktop
> **Arquivo-fonte:** `src/pages/Arquivo.tsx`
> **Última revisão:** AAAA-MM-DD

---

## 1. Objetivo da página

Uma a três frases. O que ela precisa entregar ao usuário — não o que ela **é**, mas o que ela **resolve**.

## 2. Filosofia

Por que essa página existe **dentro do MIDIAS especificamente**? Qual pergunta do usuário só ela responde? Se ela sumisse amanhã, o que o usuário perderia que nenhuma outra página cobre?

## 3. Usuários-alvo

Matriz de quem usa e o que cada perfil enxerga.

| Perfil                 | O que enxerga                                | O que pode fazer            |
| ---------------------- | -------------------------------------------- | --------------------------- |
| Visitante (deslogado)  |                                              |                             |
| Logado — sessão nova   |                                              |                             |
| Logado — recorrente    |                                              |                             |
| Vendedor               |                                              |                             |
| Moderador / Admin      |                                              |                             |

## 4. Estrutura visual

Diagrama vertical dos blocos, na ordem em que aparecem.

```text
Header
   ↓
[Bloco 1]
   ↓
[Bloco 2]
   ↓
Footer
```

**Por que essa ordem?** Justificar. Se um bloco pudesse trocar de posição com outro, o que o usuário perderia?

## 5. Componentes

Cada bloco explicado em profundidade.

### 5.1 Nome do componente

- **O que é:**
- **O que mostra:**
- **Quando aparece / some:**
- **Como se comporta em mobile / tablet / desktop:**
- **Dependências:** (hooks, contexts, dados)

## 6. Fluxos de entrada

De onde o usuário chega até essa página?

- Link direto (URL bookmarked)
- Header / navbar
- Notificação push / bell
- Deep link de e-mail / redes sociais
- Redirect pós-ação (ex.: pós-login)
- Fluxo de outra página (ex.: veio do Carrinho)

## 7. Fluxos de saída

Para onde ele vai naturalmente depois? Ordenar por probabilidade real.

## 8. Navegação entre páginas

Como essa página conversa com **Perfil / Fórum / Marketplace / Torneios / Chat / Biblioteca**? Diagrama mermaid quando fizer sentido.

## 9. Regras de negócio

O que pode / não pode. Limites. Validações. Regras temporais (horário, dia da semana). Regras de estoque, preço, permissão.

## 10. Estados da interface

| Estado          | Trigger                                | O que o usuário vê                  |
| --------------- | -------------------------------------- | ----------------------------------- |
| Carregando      | dados em fetch                         | Skeleton                            |
| Vazio           | nenhum dado para mostrar               | Empty state com CTA                 |
| Erro            | fetch falhou                           | Mensagem + botão "Tentar de novo"   |
| Offline         | sem conexão                            |                                     |
| Sem permissão   | usuário não tem role                   |                                     |
| Muitos dados    | paginação / virtualização              |                                     |

## 11. Permissões

Matriz por role.

| Ação      | Visitante | Usuário | Vendedor | Mod | Admin |
| --------- | :-------: | :-----: | :------: | :-: | :---: |
| Visualizar |           |         |          |     |       |
| Interagir  |           |         |          |     |       |
| Editar     |           |         |          |     |       |
| Excluir    |           |         |          |     |       |

## 12. Origem dos dados

De onde vem cada bloco. Tabela, view, cálculo em tempo real, cache do React Query, edge function.

## 13. Banco relacionado

Tabelas Supabase envolvidas + relação. Diagrama ERD parcial quando houver mais de 3.

## 14. APIs / hooks

Hooks (`useProdutos`, `useRadarDelta`, etc.), edge functions, queries diretas ao Supabase. Mostrar payload de entrada e saída resumido.

## 15. Painel admin relacionado

**O ponto crítico da auditoria.** Descrever tela por tela, ação por ação, o que o admin faz. Nível de detalhe do exemplo "Escolha do Dia": pode agendar? duplicar? cancelar até quando? tem calendário / timer? histórico? alerta de vazio? regra anti-repetição?

## 16. Casos extremos

- Dado removido enquanto a página estava aberta
- Sessão expira no meio da interação
- Estoque zera enquanto o usuário decide
- Promoção expira entre o carrinho e o checkout
- Usuário banido tenta interagir
- Fonte externa (Steam, imagem) fora do ar
- Dados corrompidos ou tipos inesperados

## 17. Justificativa de UX/UI

Por que esse layout, essa ordem, essas cores, essa densidade? Referências (Steam, Epic, GOG, Itch, Discord, Twitch quando fizer sentido).

## 18. Escalabilidade

Comportamento com **100 / 10k / 1M** de registros / usuários. Onde quebra? Onde precisa paginar? Onde precisa cache CDN?

## 19. Melhorias futuras

Backlog priorizado (P0 / P1 / P2). Integrações externas (Steam, Epic, Xbox, GOG). IA. Cross-sell. PWA offline. i18n.

## 20. Crítica da implementação atual

### 20.1 O que está bom e por quê

Para cada ponto forte:
- **O que é:**
- **Por que funciona:**
- **Por que deve ficar:**
- **Como levar de bom para excelente:**

### 20.2 O que está ruim e por quê

Para cada ponto fraco:
- **O que é:**
- **Por que está ruim (evidência):**
- **Por que remover / substituir:**
- **Alternativa concreta:** (com trade-offs)
- **Prioridade:** P0 / P1 / P2

### 20.3 Dívida técnica visível

Coisas que não são bug agora mas vão travar as Fases B/C se ficarem.

### 20.4 Ângulos que a análise inicial não cobriu

Acessibilidade (WCAG), performance (LCP/CLS por bloco), SEO, i18n futuro, comportamento com JS desativado, dark/light parity, mobile-web (não app nativo) fallback, telemetria.
