# Apêndice B · ADRs (Architecture Decision Records)

## Índice
- ADR-001: Roles em tabela separada (user_roles)
- ADR-002: Mobile React empacotado com Capacitor (não Flutter)
- ADR-003: Lovable Cloud (Supabase managed) como backend único
- ADR-004: Checkout simulado (TCC) — sem gateway real
- ADR-005: Reviews numéricas (0.5-5.0) sem texto no web
- ADR-006: Marketplace C2C exclusivo mobile
- ADR-007: Desktop Electron para staff (não web /admin)
- ADR-008: Realtime via Supabase channels (sem serviço externo)

## ADR-001 · Roles separadas
**Status:** aceito. **Contexto:** armazenar role em `profiles` abre privilege escalation. **Decisão:** `user_roles(user_id, role)` + `has_role()` SECURITY DEFINER. **Consequência:** todas policies via função.

## ADR-002 · Capacitor mobile
**Status:** aceito. **Contexto:** UX nativa, câmera, push, offline. **Consequência:** dois codebases para features cross-platform; alinhamento via schema Supabase compartilhado (ver `mem://database/schema-unificado`).

## ADR-003 · Lovable Cloud
**Status:** aceito. Sem multi-cloud; edge functions rodam em Deno.

## ADR-004 · Checkout simulado
**Status:** aceito (contexto TCC). Pix 5% off, CC parcelado. Sem gateway. Documentar claramente ao avaliador.

## ADR-005 · Reviews numéricas web
**Status:** aceito. Só estrelas 0.5–5.0. Texto/comentários apenas em `reviews_completas` (opcional).

## ADR-006 · C2C só mobile
**Status:** aceito. Web tem visualização (SellerProfile) mas criação/chat só mobile.

## ADR-007 · Desktop Electron
**Status:** aceito. Isolamento de credenciais staff + UX nativa. Não expor `/admin` na web pública.

## ADR-008 · Realtime Supabase
**Status:** aceito. Trade-off: limite de conexões concorrentes; consolidar canais por página.

## Template
```md
# ADR-NNN · Título
Status: proposto|aceito|substituído por ADR-XXX
Contexto:
Decisão:
Consequência:
```

