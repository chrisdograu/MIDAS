# Web · Editor de Review Completa (/jogo/:id/review-completa)

## Propósito
Editor rich-text para reviews longos com screenshots, spoilers, capítulos.

## Achados P0
- **Sem autosave** — perda de trabalho se navegar/reload. Usar `localStorage` + debounce.
- Upload de screenshots direto sem otimização (imagens 4K não são redimensionadas).
- `SpoilerGuard` client-side apenas — HTML bruto viaja pela rede.

## P1
- Sem preview lado a lado.
- Versionamento (`review_metadata`) não gera histórico visível.

