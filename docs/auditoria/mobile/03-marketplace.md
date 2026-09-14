# Mobile · 03 · Marketplace C2C (`/m/marketplace`, `/m/marketplace/:id`, `/m/marketplace/novo`)

> Arquivos: `MMarketplace.tsx`, `MMarketplaceItem.tsx`, `MNewAd.tsx`.

## 1. Objetivo
O **único canal C2C** do MIDIAS. Loja oficial vende via Web/Cloud (`produtos`); usuário vende jogo usado / conta / cosmético via aqui (`anuncios`). Precisa dar confiança suficiente para dois estranhos fecharem negócio.

## 2. Filosofia
"Facebook Marketplace + OLX, mas dentro de uma comunidade gamer com reputação forte e certificado de proteção da plataforma." A confiança é construída por: perfil público rico, avaliações, **certificado** (memória `certificados-protecao`), e chat integrado com histórico.

## 3. Usuários-alvo
Comprador (quer preço bom + segurança), vendedor casual (1-3 anúncios), vendedor recorrente (10+ anúncios, precisa "modo férias"), admin (moderação de fraude).

## 4. Estrutura visual
**Lista** (`/m/marketplace`):
```
[Search + Filter (categoria, plataforma, preço, condição)]
[Chip "Meus favoritos" | "Perto de mim" | "Novos hoje"]
[Grid 2 colunas de cards: foto + preço + título + vendedor mini]
[FAB "+" → /novo]
```
**Detalhe** (`/m/marketplace/:id`):
```
[Galeria swipe]
[Título + preço + condição]
[Vendedor: avatar + nome + rating + badge certificado]
[Descrição + plataformas + trocas aceitas]
[CTA: Chat com vendedor | Favoritar | Denunciar]
[Anúncios relacionados do mesmo vendedor]
```

## 5. Componentes
- **AdCard** — usado em lista, favoritos, perfil do vendedor
- **AdGallery** — swipe horizontal com dots
- **SellerMini** — avatar + rating + link pro perfil
- **CertificadoBadge** — visual dourado quando `certificado_id != null`
- **ItemActionsMenu** (compartilhado) — reportar, bloquear vendedor

## 6-8. Fluxos
Entrada: bottom-nav "Market", link de anúncio compartilhado (deep-link `/m/marketplace/:id`), notificação "novo item do vendedor que você segue".
Saída: MChatThread (iniciar conversa), MProfile (vendedor), MNewAd (criar próprio).
Conversa com: **Chat** (contexto do anúncio anexado à conversa), **Perfil público** (reputação), **Denúncias** (Desktop moderação).

## 9. Regras de negócio
- Preço > 0, título 3-80 chars, descrição ≤ 2000
- Máx 8 fotos por anúncio (`fotos_anuncio`)
- Vendedor em `modo_ferias` → anúncios ocultos da lista mas visíveis em link direto
- Denúncia 3x válidas → auto-ocultar até revisão admin
- Bloqueio: se comprador bloqueou vendedor (ou vice-versa), anúncio não aparece e chat é bloqueado

## 10. Estados
- Lista vazia com filtro: "nenhum anúncio bate seu filtro, tente limpar"
- Anúncio removido: 410-like "este anúncio saiu do ar"
- Vendedor banido: página mostra "anúncio indisponível"
- Sem fotos: placeholder cinza + texto (não deixar quebrado)

## 11. Permissões
| Ação | Visitante | Logado | Dono | Admin |
|---|---|---|---|---|
| Ver lista/detalhe | ✅ | ✅ | ✅ | ✅ |
| Favoritar | — | ✅ | ✅ | ✅ |
| Chat | — | ✅ | próprio? no | ✅ |
| Criar anúncio | — | ✅ | — | ✅ |
| Editar/excluir | — | — | ✅ | ✅ |
| Remover como spam | — | — | — | ✅ |

## 12-14. Dados
Tabelas: `anuncios`, `fotos_anuncio`, `favoritos_anuncio`, `certificados`, `blocked_users`, `denuncias`.
Hooks: `useFavoritoAnuncio`, query direta ao Supabase (não há `useAnuncios` centralizado — **P1 criar**).
`anuncios.plataformas text[]` (memória `schema-unificado`) permite filtro multi-plataforma.

## 15. Painel admin relacionado (Desktop)
`AnunciosAdmin.tsx`, `Denuncias.tsx`, `Certificados.tsx`, `PropostasTroca.tsx`, `TrocasArquivadas.tsx`:
- Listar todos anúncios com filtros de status, denúncias, categoria
- Ver histórico de mudanças de preço de um anúncio
- Emitir certificado de proteção manualmente (após verificar chat + fotos)
- Ver conversas relacionadas a um anúncio (chave: `conversas.anuncio_id`) — auditoria de trocas
- Métricas: taxa de conversão de chat→troca, tempo médio até venda, taxa de denúncia por categoria
- **Faltando**: painel de "fraudes recorrentes" (mesmo device/IP em contas diferentes)

## 16. Casos extremos
- Vendedor deletou conta durante chat ativo → mostrar "vendedor removeu conta" no chat, congelar
- Anúncio favoritado + removido → aparecer riscado em MFavoritos, com "removido"
- Duas pessoas mandam mensagem simultaneamente → sem race (chat é append-only)
- Foto corrompida no upload → validar antes de salvar em `fotos_anuncio`
- Preço muda enquanto comprador negocia → chat mostra badge "preço mudou de X para Y às HH:MM"

## 17. Justificativa UX
Grid 2 colunas (não 1) porque marketplace precisa densidade visual — usuário compara. FAB "+" no canto porque criar anúncio é ação primária pra vendedor recorrente. Rating do vendedor **antes** da descrição porque decisão de comprar é 60% confiança / 40% produto.

## 18. Escalabilidade
Com 10k anúncios ativos: paginação já necessária (hoje traz tudo?). Confirmar e adicionar `.range()`. Full-text search em `title+description` requer índice `tsvector` — hoje é `ilike` que não escala.

## 19. Melhorias futuras
- Sugestão de preço IA baseada em histórico do mesmo jogo
- "Fazer proposta" formal (não só chat livre) com estado accepted/rejected
- Selo "vendedor verificado" (documento + selfie via Capacitor)
- Geolocalização opcional (encontro presencial p/ mídia física)
- Sistema de escrow para valores > R$ X

## 20. Crítica
**Bom**: separação clara Web (loja) vs Mobile (C2C), certificados como diferencial, integração com chat.
**Ruim**:
- **P0**: sem `useAnuncios` centralizado — cada tela refaz query e filtros. Extrair.
- **P0**: filtros são client-side sobre lista completa. Migrar para query params + RPC.
- **P0**: MNewAd não valida tamanho/formato de foto antes de subir (memória storage `ad-images`). Adicionar validação client + edge function.
- **P1**: MMarketplaceItem carrega tudo em uma request grande — dividir em galeria (crítica) vs "relacionados" (lazy).
- **P1**: sem indicador "última atividade do vendedor" (online há 5min / há 3 dias) — muda percepção de confiança.

**Dívida técnica**: `anuncios.user_id` nullable (memória) é semanticamente errado — todo anúncio *precisa* de dono. Backfill + tornar NOT NULL na próxima migração.

**Ângulos não cobertos**: LGPD (dados de contato aparecem em chat, mas não há política de retenção), anti-fraude (mesma foto reutilizada em N anúncios — hash perceptual pHash), SEO de anúncios compartilhados no WhatsApp (og-image dinâmica via edge function).
