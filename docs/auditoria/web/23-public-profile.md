# Web · Perfil Público (/perfil/:userId)

## Propósito
Vitrine social read-only de outro usuário.

## Achados P0
- **Respeita `privacy_grants`?** Auditar cada bloco: biblioteca, favoritos, títulos — algum pode vazar dados privados. Criar RPC `get_public_profile(uid, viewer)` centralizada.
- SEO: falta `<title>` e OG tags dinâmicos (`profiles.display_name`).

## P1
- Cascata de queries (profile, badges, títulos, biblioteca, reviews) — bundle em RPC.
- Botão 'seguir' otimista sem rollback em erro.

