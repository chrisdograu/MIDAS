# Web · Perfil do Vendedor (/vendedor/:handle)

## Propósito
Vitrine pública do vendedor certificado (reputação, produtos, políticas).

## Componentes
`seller_profiles`, `avaliacoes_usuario`.

## Achados P0
- **Handle único não é enforced com case-insensitive** — 'Loja1' e 'loja1' podem colidir. Adicionar `UNIQUE(lower(handle))`.
- Reputação calculada client-side; migrar para view materializada `seller_reputation`.

## P1
- Sem breadcrumb estruturado.
- Sem `Product` JSON-LD para itens listados.

