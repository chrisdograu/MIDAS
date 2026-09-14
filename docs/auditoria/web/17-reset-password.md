# Web · Reset de Senha (/reset-password)

## Propósito
Fluxo de recuperação via magic link do Supabase.

## Fluxos
1) Solicitar → `supabase.auth.resetPasswordForEmail` com `redirectTo`. 2) Callback com `type=recovery` → `updateUser({ password })`.

## Achados P0
- Token expirado não é comunicado claramente (mostra erro genérico).
- Não invalida outras sessões ativas ao trocar senha (deveria chamar `signOut({ scope: 'others' })`).

## Achados P1
- Falta política de senha (min 8, complexidade).
- Sem log em `admin_logs` de resets bem-sucedidos para auditoria.

